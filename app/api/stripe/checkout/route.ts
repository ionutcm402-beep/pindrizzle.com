import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPingStripe, PingStripeConfigError } from "@/lib/stripeServer";

export const runtime = "nodejs";

type CheckoutRow = {
  checkout_action: "claimed" | "existing";
  existing_session_id: string | null;
  promotion_id: string;
  ping_id: string;
  ping_title: string;
  sponsor_name: string;
  quoted_price_pence: number;
  currency: string;
  duration_hours: number;
  target_radius_meters: number;
};

function bearerToken(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function radiusLabel(meters: number) {
  if (meters === 805) return "0.5 mi";
  if (meters === 1609) return "1 mi";
  if (meters === 4828) return "3 mi";
  if (meters === 8047) return "5 mi";
  return `${meters} m`;
}

export async function POST(request: NextRequest) {
  let claimToken = "";
  let promotionId = "";
  let supabase: SupabaseClient | null = null;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Checkout is not configured yet." }, { status: 503 });
    }

    let stripeConfig;
    try {
      stripeConfig = getPingStripe();
    } catch (error) {
      if (error instanceof PingStripeConfigError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      throw error;
    }
    const { stripe, mode } = stripeConfig;

    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => null) as { promotionId?: string } | null;
    promotionId = body?.promotionId?.trim() || "";
    if (!promotionId) return NextResponse.json({ error: "Promotion ID is required." }, { status: 400 });

    supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    claimToken = randomUUID();
    const { data, error } = await supabase.rpc("claim_promotion_checkout", {
      target_promotion_id: promotionId,
      claim_token: claimToken,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: /already starting/i.test(error.message) ? 409 : 400 });

    const row = (Array.isArray(data) ? data[0] : data) as CheckoutRow | undefined;
    if (!row) return NextResponse.json({ error: "This promotion is not ready for payment." }, { status: 400 });

    if (row.checkout_action === "existing" && row.existing_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(row.existing_session_id);
      if (existing.status === "open" && existing.url) {
        return NextResponse.json({ url: existing.url, mode, reused: true });
      }
      if (existing.status === "complete") {
        return NextResponse.json({ error: "This payment is already being verified. Refresh your promotion shortly." }, { status: 409 });
      }
      return NextResponse.json({ error: "The previous checkout has expired. Please try again." }, { status: 409 });
    }

    const origin = request.nextUrl.origin;
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    const metadata = {
      promotion_id: row.promotion_id,
      promoter_user_id: userData.user.id,
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: userData.user.email || undefined,
        client_reference_id: row.promotion_id,
        metadata,
        payment_intent_data: { metadata },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: row.currency.toLowerCase(),
              unit_amount: row.quoted_price_pence,
              product_data: {
                name: `Promote: ${row.ping_title}`,
                description: `${row.sponsor_name} · ${radiusLabel(row.target_radius_meters)} · ${row.duration_hours}h local placement`,
              },
            },
          },
        ],
        success_url: `${origin}/promote?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/promote?checkout=cancelled`,
        expires_at: expiresAt,
      },
      { idempotencyKey: `ping-promotion-${row.promotion_id}-${claimToken}` },
    );

    if (!session.url) throw new Error("Stripe did not return a Checkout URL");

    const { error: registerError } = await supabase.rpc("register_promotion_checkout", {
      target_promotion_id: row.promotion_id,
      claim_token: claimToken,
      checkout_session_id: session.id,
      checkout_expires_at: new Date(expiresAt * 1000).toISOString(),
    });
    if (registerError) {
      try { await stripe.checkout.sessions.expire(session.id); } catch { /* best-effort orphan cleanup */ }
      throw registerError;
    }

    claimToken = "";
    return NextResponse.json({ url: session.url, mode, reused: false });
  } catch (error) {
    if (claimToken && promotionId && supabase) {
      try {
        await supabase.rpc("release_promotion_checkout_claim", {
          target_promotion_id: promotionId,
          claim_token: claimToken,
        });
      } catch { /* claim expires automatically */ }
    }
    console.error("Promotion checkout creation failed", error);
    return NextResponse.json({ error: "Checkout could not be started right now." }, { status: 500 });
  }
}
