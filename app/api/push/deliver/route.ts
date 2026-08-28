import { createSign, sign as cryptoSign, timingSafeEqual } from "node:crypto";
import http2 from "node:http2";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

type NativeDeviceRow = {
  id: string;
  platform: "ios" | "android";
  token: string;
};

type AttemptRow = {
  attempt_count: number;
  delivered_at: string | null;
};

type DeliverySummary = {
  delivered: number;
  failed: number;
  skipped: number;
  missingConfig: string[];
};

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type FcmErrorResponse = {
  error?: {
    status?: string;
    message?: string;
    details?: Array<{ "@type"?: string; errorCode?: string }>;
  };
};

let cachedApnsToken: { value: string; expiresAt: number; fingerprint: string } | null = null;
let cachedFcmToken: { value: string; expiresAt: number; clientEmail: string } | null = null;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pushData(notification: NotificationRow) {
  return {
    notificationId: notification.id,
    kind: notification.kind,
    pingId: notification.ping_id || "",
    url: notification.ping_id ? `/#ping=${encodeURIComponent(notification.ping_id)}` : "/alerts",
  };
}

function webPayload(notification: NotificationRow) {
  return JSON.stringify({
    ...pushData(notification),
    title: notification.title.slice(0, 120),
    body: notification.body.slice(0, 220),
  });
}

function apnsProviderToken() {
  const teamId = String(process.env.PINDRIZZLE_APNS_TEAM_ID || "").trim();
  const keyId = String(process.env.PINDRIZZLE_APNS_KEY_ID || "").trim();
  const privateKey = String(process.env.PINDRIZZLE_APNS_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!teamId || !keyId || !privateKey) return null;

  const fingerprint = `${teamId}:${keyId}:${privateKey.length}`;
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsToken && cachedApnsToken.expiresAt > now + 60 && cachedApnsToken.fingerprint === fingerprint) {
    return cachedApnsToken.value;
  }

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${claims}`;
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const value = `${signingInput}.${base64Url(signature)}`;
  cachedApnsToken = { value, expiresAt: now + 50 * 60, fingerprint };
  return value;
}

async function sendApns(device: NativeDeviceRow, notification: NotificationRow) {
  const providerToken = apnsProviderToken();
  const bundleId = String(process.env.PINDRIZZLE_APNS_BUNDLE_ID || "com.pindrizzle.app").trim();
  const environment = String(process.env.PINDRIZZLE_APNS_ENV || "production").toLowerCase();
  if (!providerToken || !bundleId) {
    return { ok: false, configured: false, status: 0, reason: "APNs credentials are incomplete.", unregister: false };
  }

  const origin = environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const payload = JSON.stringify({
    aps: {
      alert: {
        title: notification.title.slice(0, 120),
        body: notification.body.slice(0, 220),
      },
      sound: "default",
    },
    ...pushData(notification),
  });

  return await new Promise<{ ok: boolean; configured: boolean; status: number; reason: string; unregister: boolean }>((resolve) => {
    let settled = false;
    const client = http2.connect(origin);
    const finish = (result: { ok: boolean; configured: boolean; status: number; reason: string; unregister: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { client.close(); } catch {}
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, configured: true, status: 0, reason: "APNs request timed out.", unregister: false }), 12000);

    client.once("error", (error) => finish({ ok: false, configured: true, status: 0, reason: String(error.message || "APNs connection failed").slice(0, 300), unregister: false }));
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(device.token)}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });

    let status = 0;
    let responseBody = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => { status = Number(headers[":status"] || 0); });
    request.on("data", (chunk) => { responseBody += chunk; });
    request.on("error", (error) => finish({ ok: false, configured: true, status, reason: String(error.message || "APNs request failed").slice(0, 300), unregister: false }));
    request.on("end", () => {
      let reason = responseBody || (status === 200 ? "" : `APNs HTTP ${status || "error"}`);
      try {
        const parsed = responseBody ? JSON.parse(responseBody) as { reason?: string } : null;
        if (parsed?.reason) reason = parsed.reason;
      } catch {}
      finish({
        ok: status === 200,
        configured: true,
        status,
        reason: String(reason).slice(0, 300),
        unregister: status === 410 || reason === "Unregistered",
      });
    });
    request.end(payload);
  });
}

function firebaseServiceAccount(): FirebaseServiceAccount | null {
  const raw = String(process.env.PINDRIZZLE_FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FirebaseServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (error) {
    console.error("Firebase service-account JSON could not be parsed", error);
    return null;
  }
}

async function firebaseAccessToken(serviceAccount: FirebaseServiceAccount) {
  const clientEmail = serviceAccount.client_email || "";
  const privateKey = serviceAccount.private_key || "";
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  if (cachedFcmToken && cachedFcmToken.expiresAt > now + 120 && cachedFcmToken.clientEmail === clientEmail) {
    return cachedFcmToken.value;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${base64Url(signer.sign(privateKey))}`;

  const tokenResponse = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const data = await tokenResponse.json().catch(() => null) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!tokenResponse.ok || !data?.access_token) {
    throw new Error(data?.error_description || `Firebase OAuth HTTP ${tokenResponse.status}`);
  }

  cachedFcmToken = {
    value: data.access_token,
    expiresAt: now + Math.max(300, Math.min(Number(data.expires_in || 3600), 3600)),
    clientEmail,
  };
  return data.access_token;
}

function fcmErrorCode(body: FcmErrorResponse | null) {
  return body?.error?.details?.find((detail) => detail["@type"]?.includes("google.firebase.fcm.v1.FcmError"))?.errorCode || "";
}

async function sendFcm(device: NativeDeviceRow, notification: NotificationRow) {
  const serviceAccount = firebaseServiceAccount();
  if (!serviceAccount) {
    return { ok: false, configured: false, status: 0, reason: "Firebase service-account credentials are incomplete.", unregister: false };
  }

  try {
    const accessToken = await firebaseAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || "";
    const data = pushData(notification);
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: {
            title: notification.title.slice(0, 120),
            body: notification.body.slice(0, 220),
          },
          data,
          android: {
            priority: "high",
            notification: {
              channel_id: "pindrizzle-default",
              sound: "default",
            },
          },
        },
      }),
      cache: "no-store",
    });
    const responseData = await response.json().catch(() => null) as FcmErrorResponse | { name?: string } | null;
    const errorBody = responseData as FcmErrorResponse | null;
    const code = fcmErrorCode(errorBody);
    const reason = response.ok ? "" : (errorBody?.error?.message || code || `FCM HTTP ${response.status}`);
    return {
      ok: response.ok,
      configured: true,
      status: response.status,
      reason: String(reason).slice(0, 300),
      unregister: code === "UNREGISTERED",
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      status: 0,
      reason: String(error instanceof Error ? error.message : "FCM delivery failed").slice(0, 300),
      unregister: false,
    };
  }
}

async function recordNativeAttempt(admin: SupabaseClient, notificationId: string, deviceId: string, attempt: AttemptRow | null) {
  const nextAttempt = (attempt?.attempt_count || 0) + 1;
  const result = await admin.from("native_push_delivery_attempts").upsert({
    notification_id: notificationId,
    device_id: deviceId,
    attempt_count: nextAttempt,
    last_attempt_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "notification_id,device_id" });
  if (result.error) throw result.error;
}

async function deliverWeb(admin: SupabaseClient, config: PushConfig, notification: NotificationRow, subscriptions: SubscriptionRow[]) {
  const summary: DeliverySummary = { delivered: 0, failed: 0, skipped: 0, missingConfig: [] };
  if (!subscriptions.length) return summary;

  if (!config.vapid_public_key || !config.vapid_private_key || !config.vapid_subject) {
    summary.skipped = subscriptions.length;
    summary.missingConfig.push("web-vapid");
    return summary;
  }

  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);
  const payload = webPayload(notification);

  for (const subscription of subscriptions) {
    const previous = await admin
      .from("push_delivery_attempts")
      .select("attempt_count,delivered_at")
      .eq("notification_id", notification.id)
      .eq("subscription_id", subscription.id)
      .maybeSingle();
    if (previous.error) throw previous.error;
    const attempt = previous.data as AttemptRow | null;
    if (attempt?.delivered_at) {
      summary.skipped += 1;
      continue;
    }

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

      summary.delivered += 1;
      await admin.from("push_delivery_attempts").update({ delivered_at: new Date().toISOString(), last_error: null })
        .eq("notification_id", notification.id).eq("subscription_id", subscription.id);
    } catch (sendError) {
      summary.failed += 1;
      const detail = sendError as { statusCode?: number; message?: string };
      const statusCode = Number(detail.statusCode || 0);
      const message = String(detail.message || "Web Push delivery failed").slice(0, 300);
      await admin.from("push_delivery_attempts").update({ last_error: `${statusCode || "error"}: ${message}` })
        .eq("notification_id", notification.id).eq("subscription_id", subscription.id);

      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", subscription.id);
      }
    }
  }

  return summary;
}

async function deliverNative(admin: SupabaseClient, notification: NotificationRow, devices: NativeDeviceRow[]) {
  const summary: DeliverySummary = { delivered: 0, failed: 0, skipped: 0, missingConfig: [] };

  for (const device of devices) {
    const previous = await admin
      .from("native_push_delivery_attempts")
      .select("attempt_count,delivered_at")
      .eq("notification_id", notification.id)
      .eq("device_id", device.id)
      .maybeSingle();
    if (previous.error) throw previous.error;
    const attempt = previous.data as AttemptRow | null;
    if (attempt?.delivered_at) {
      summary.skipped += 1;
      continue;
    }

    await recordNativeAttempt(admin, notification.id, device.id, attempt);
    const result = device.platform === "ios"
      ? await sendApns(device, notification)
      : await sendFcm(device, notification);

    if (!result.configured) {
      summary.skipped += 1;
      const key = device.platform === "ios" ? "ios-apns" : "android-fcm";
      if (!summary.missingConfig.includes(key)) summary.missingConfig.push(key);
      await admin.from("native_push_delivery_attempts").update({ last_error: result.reason })
        .eq("notification_id", notification.id).eq("device_id", device.id);
      continue;
    }

    if (result.ok) {
      summary.delivered += 1;
      await admin.from("native_push_delivery_attempts").update({ delivered_at: new Date().toISOString(), last_error: null })
        .eq("notification_id", notification.id).eq("device_id", device.id);
    } else {
      summary.failed += 1;
      await admin.from("native_push_delivery_attempts").update({ last_error: `${result.status || "error"}: ${result.reason}` })
        .eq("notification_id", notification.id).eq("device_id", device.id);
      if (result.unregister) {
        await admin.from("native_push_devices").update({ disabled_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
  }

  return summary;
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

    const [subscriptionsResult, devicesResult] = await Promise.all([
      admin.from("push_subscriptions")
        .select("id,endpoint,p256dh,auth_secret")
        .eq("user_id", notification.user_id)
        .is("disabled_at", null)
        .limit(5),
      admin.from("native_push_devices")
        .select("id,platform,token")
        .eq("user_id", notification.user_id)
        .is("disabled_at", null)
        .limit(5),
    ]);
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (devicesResult.error) throw devicesResult.error;

    const subscriptions = (subscriptionsResult.data || []) as SubscriptionRow[];
    const devices = (devicesResult.data || []) as NativeDeviceRow[];
    if (!subscriptions.length && !devices.length) return NextResponse.json({ ok: true, delivered: 0, failed: 0, skipped: 0 });

    const [web, native] = await Promise.all([
      deliverWeb(admin, config, notification, subscriptions),
      deliverNative(admin, notification, devices),
    ]);

    const missingConfig = Array.from(new Set([...web.missingConfig, ...native.missingConfig]));
    return NextResponse.json({
      ok: true,
      delivered: web.delivered + native.delivered,
      failed: web.failed + native.failed,
      skipped: web.skipped + native.skipped,
      web,
      native,
      missingConfig,
    });
  } catch (error) {
    console.error("Push delivery failed", error);
    return NextResponse.json({ error: "Push delivery failed." }, { status: 500 });
  }
}
