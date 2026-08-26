import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

async function activatePaidPromotion(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const promotionId = session.metadata?.promotion_id || session.client_reference_id || "";
  if (!promotionId) throw new Error("Stripe Checkout session is missing promotion metadata");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase webhook credentials are missing");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";
  const { error } = await supabase.rpc("finalize_promotion_payment", {
    target_promotion_id: promotionId,
    checkout_session_id: session.id,
    payment_intent_id: paymentIntentId,
    amount_total: session.amount_total || 0,
    paid_currency: session.currency || "",
  });
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  try {
    const stripe = new Stripe(stripeSecret);
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await activatePaidPromotion(event.data.object as Stripe.Checkout.Session);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }
}
