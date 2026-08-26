import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

type CheckoutRow = {
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
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!stripeSecret || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Checkout is not configured yet." }, { status: 503 });
    }

    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => null) as { promotionId?: string } | null;
    const promotionId = body?.promotionId?.trim();
    if (!promotionId) return NextResponse.json({ error: "Promotion ID is required." }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("prepare_promotion_checkout", {
      target_promotion_id: promotionId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = (Array.isArray(data) ? data[0] : data) as CheckoutRow | undefined;
    if (!row) return NextResponse.json({ error: "This promotion is not ready for payment." }, { status: 400 });

    const stripe = new Stripe(stripeSecret);
    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userData.user.email || undefined,
      client_reference_id: row.promotion_id,
      metadata: {
        promotion_id: row.promotion_id,
        promoter_user_id: userData.user.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
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
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Promotion checkout creation failed", error);
    return NextResponse.json({ error: "Checkout could not be started right now." }, { status: 500 });
  }
}
