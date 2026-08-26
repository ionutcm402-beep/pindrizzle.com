import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Push notifications are not configured." }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("push_server_config");
    if (error) throw error;
    const config = ((data || [])[0] || null) as PushConfig | null;
    if (!config?.vapid_public_key) {
      return NextResponse.json({ error: "Push notifications are not ready." }, { status: 503 });
    }

    return NextResponse.json(
      { publicKey: config.vapid_public_key },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Push public key failed", error);
    return NextResponse.json({ error: "Push notifications are not ready." }, { status: 500 });
  }
}
