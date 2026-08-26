import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLaunchReadiness } from "@/lib/launchReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Launch readiness is not configured." }, { status: 503 });
  }

  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const moderator = await supabase.rpc("is_moderator");
  if (moderator.error || !moderator.data) {
    return NextResponse.json({ error: "Moderator access required." }, { status: 403 });
  }

  const stageResult = await supabase.rpc("public_release_stage");
  const stage = stageResult.error ? null : String(stageResult.data || "closed_beta");

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ...getLaunchReadiness(stage),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
