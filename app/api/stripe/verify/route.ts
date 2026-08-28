import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  activationFailureNeedsRefund,
  checkoutPaymentIntentId,
  getPingStripe,
  PingStripeConfigError,
  refundUnfulfillableCheckout,
} from "@/lib/stripeServer";

export const runtime = "nodejs";

function bearerToken(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Payment verification is not configured yet." }, { status: 503 });
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

    const body = await request.json().catch(() => null) as { sessionId?: string } | null;
    const sessionId = body?.sessionId?.trim();
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Stripe session is missing." }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Stripe has not confirmed this payment yet." }, { status: 409 });
    }

    const promotionId = session.metadata?.promotion_id || session.client_reference_id || "";
    const promoterUserId = session.metadata?.promoter_user_id || "";
    if (!promotionId || promoterUserId !== userData.user.id) {
      return NextResponse.json({ error: "This payment does not belong to your promotion." }, { status: 403 });
    }

    const paymentIntentId = checkoutPaymentIntentId(session);
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Stripe payment details are incomplete." }, { status: 409 });
    }

    const { error } = await admin.rpc("finalize_promotion_payment", {
      target_promotion_id: promotionId,
      checkout_session_id: session.id,
      payment_intent_id: paymentIntentId,
      amount_total: session.amount_total || 0,
      paid_currency: session.currency || "",
    });

    if (error) {
      if (activationFailureNeedsRefund(error.message)) {
        const duplicate = /already paid by a different checkout/i.test(error.message);
        await refundUnfulfillableCheckout(stripe, session, duplicate ? "duplicate" : "activation_failed");
        return NextResponse.json(
          { error: "Payment was received, but Ping could not safely start this promotion. A Stripe refund has been requested." },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, promotionId, mode });
  } catch (error) {
    console.error("Stripe return verification failed", error);
    return NextResponse.json({ error: "Payment could not be verified right now." }, { status: 500 });
  }
}
