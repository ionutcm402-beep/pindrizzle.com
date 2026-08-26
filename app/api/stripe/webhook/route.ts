import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  activationFailureNeedsRefund,
  checkoutPaymentIntentId,
  getPingStripe,
  PingStripeConfigError,
  refundUnfulfillableCheckout,
  stripeObjectId,
} from "@/lib/stripeServer";

export const runtime = "nodejs";

type AdminClient = SupabaseClient;

async function recordPaymentEvent(
  admin: AdminClient,
  event: Stripe.Event,
  kind: "checkout.completed" | "refund" | "dispute.created" | "dispute.closed",
  paymentIntentId: string,
  amount: number | null,
  currency: string | null,
  outcome: string | null,
  details: Record<string, unknown>,
) {
  if (!paymentIntentId) return "unmatched";
  const { data, error } = await admin.rpc("record_promotion_payment_event", {
    p_stripe_event_id: event.id,
    p_event_kind: kind,
    p_payment_intent_id: paymentIntentId,
    p_event_amount: amount,
    p_event_currency: currency,
    p_event_outcome: outcome,
    p_event_details: details,
  });
  if (error) throw error;
  return data as string;
}

async function activatePaidPromotion(
  stripe: Stripe,
  admin: AdminClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  if (session.payment_status !== "paid") return;
  const promotionId = session.metadata?.promotion_id || session.client_reference_id || "";
  if (!promotionId) throw new Error("Stripe Checkout session is missing promotion metadata");
  const paymentIntentId = checkoutPaymentIntentId(session);
  if (!paymentIntentId) throw new Error("Stripe Checkout session is missing payment intent");

  const { error } = await admin.rpc("finalize_promotion_payment", {
    target_promotion_id: promotionId,
    checkout_session_id: session.id,
    payment_intent_id: paymentIntentId,
    amount_total: session.amount_total || 0,
    paid_currency: session.currency || "",
  });

  if (error) {
    if (!activationFailureNeedsRefund(error.message)) throw error;
    const duplicate = /already paid by a different checkout/i.test(error.message);
    await refundUnfulfillableCheckout(stripe, session, duplicate ? "duplicate" : "activation_failed");
    await recordPaymentEvent(
      admin,
      event,
      "checkout.completed",
      paymentIntentId,
      session.amount_total,
      session.currency,
      "refund_requested",
      { checkout_session_id: session.id, reason: error.message.slice(0, 300) },
    );
    return;
  }

  await recordPaymentEvent(
    admin,
    event,
    "checkout.completed",
    paymentIntentId,
    session.amount_total,
    session.currency,
    "activated",
    { checkout_session_id: session.id },
  );
}

async function processPaymentEvent(stripe: Stripe, admin: AdminClient, event: Stripe.Event) {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await activatePaidPromotion(stripe, admin, event, event.data.object as Stripe.Checkout.Session);
    return;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = stripeObjectId(charge.payment_intent);
    const fullRefund = charge.amount > 0 && charge.amount_refunded >= charge.amount;
    await recordPaymentEvent(
      admin,
      event,
      "refund",
      paymentIntentId,
      charge.amount_refunded,
      charge.currency,
      fullRefund ? "full" : "partial",
      { charge_id: charge.id, original_amount: charge.amount },
    );
    return;
  }

  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId = stripeObjectId(dispute.payment_intent);
    const kind = event.type === "charge.dispute.created" ? "dispute.created" : "dispute.closed";
    await recordPaymentEvent(
      admin,
      event,
      kind,
      paymentIntentId,
      dispute.amount,
      dispute.currency,
      dispute.status,
      { dispute_id: dispute.id, reason: dispute.reason, status: dispute.status },
    );
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  let stripe: Stripe;
  try {
    stripe = getPingStripe({ allowDisabledLive: true }).stripe;
  } catch (error) {
    const message = error instanceof PingStripeConfigError ? error.message : "Stripe is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.warn("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await processPaymentEvent(stripe, admin, event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", { eventId: event.id, eventType: event.type, error });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
