import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushConfig = {
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  webhook_secret: string | null;
  push_origin: string | null;
  vapid_subject: string | null;
  delivery_enabled: string | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  ping_id: string | null;
  kind: string;
  title: string;
  body: string;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

type AttemptRow = {
  attempt_count: number;
  delivered_at: string | null;
};

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Push delivery is not configured." }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: configData, error: configError } = await admin.rpc("push_server_config");
    if (configError) throw configError;
    const config = ((configData || [])[0] || null) as PushConfig | null;
    const suppliedSecret = request.headers.get("x-ping-push-secret") || "";
    if (!config?.webhook_secret || !suppliedSecret || !safeEqual(suppliedSecret, config.webhook_secret)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (String(config.delivery_enabled).toLowerCase() !== "true") {
      return NextResponse.json({ ok: true, delivered: 0, disabled: true }, { status: 202 });
    }

    if (!config.vapid_public_key || !config.vapid_private_key || !config.vapid_subject) {
      return NextResponse.json({ error: "Push keys are incomplete." }, { status: 503 });
    }

    const body = await request.json().catch(() => null) as { notificationId?: string } | null;
    const notificationId = String(body?.notificationId || "");
    if (!isUuid(notificationId)) {
      return NextResponse.json({ error: "Notification ID is invalid." }, { status: 400 });
    }

    const notificationResult = await admin
      .from("notifications")
      .select("id,user_id,ping_id,kind,title,body")
      .eq("id", notificationId)
      .maybeSingle();
    if (notificationResult.error) throw notificationResult.error;
    const notification = notificationResult.data as NotificationRow | null;
    if (!notification) return NextResponse.json({ ok: true, delivered: 0, missing: true });

    const subscriptionsResult = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_secret")
      .eq("user_id", notification.user_id)
      .is("disabled_at", null)
      .limit(5);
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    const subscriptions = (subscriptionsResult.data || []) as SubscriptionRow[];
    if (!subscriptions.length) return NextResponse.json({ ok: true, delivered: 0 });

    webpush.setVapidDetails(
      config.vapid_subject,
      config.vapid_public_key,
      config.vapid_private_key,
    );

    const payload = JSON.stringify({
      notificationId: notification.id,
      title: notification.title.slice(0, 120),
      body: notification.body.slice(0, 220),
      kind: notification.kind,
      pingId: notification.ping_id,
      url: notification.ping_id ? `/#ping=${encodeURIComponent(notification.ping_id)}` : "/alerts",
    });

    let delivered = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      const previous = await admin
        .from("push_delivery_attempts")
        .select("attempt_count,delivered_at")
        .eq("notification_id", notification.id)
        .eq("subscription_id", subscription.id)
        .maybeSingle();
      if (previous.error) throw previous.error;
      const attempt = previous.data as AttemptRow | null;
      if (attempt?.delivered_at) continue;

      const nextAttempt = (attempt?.attempt_count || 0) + 1;
      await admin.from("push_delivery_attempts").upsert({
        notification_id: notification.id,
        subscription_id: subscription.id,
        attempt_count: nextAttempt,
        last_attempt_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "notification_id,subscription_id" });

      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, payload, { TTL: 3600 });

        delivered += 1;
        await admin.from("push_delivery_attempts").update({
          delivered_at: new Date().toISOString(),
          last_error: null,
        }).eq("notification_id", notification.id).eq("subscription_id", subscription.id);
      } catch (sendError) {
        failed += 1;
        const detail = sendError as { statusCode?: number; message?: string };
        const statusCode = Number(detail.statusCode || 0);
        const message = String(detail.message || "Push delivery failed").slice(0, 300);

        await admin.from("push_delivery_attempts").update({ last_error: `${statusCode || "error"}: ${message}` })
          .eq("notification_id", notification.id)
          .eq("subscription_id", subscription.id);

        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", subscription.id);
        }
      }
    }

    return NextResponse.json({ ok: true, delivered, failed });
  } catch (error) {
    console.error("Push delivery failed", error);
    return NextResponse.json({ error: "Push delivery failed." }, { status: 500 });
  }
}
