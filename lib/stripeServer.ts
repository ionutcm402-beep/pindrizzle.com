import Stripe from "stripe";

export type PingStripeMode = "test" | "live";

export class PingStripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PingStripeConfigError";
  }
}

export function getPingStripe(options?: { allowDisabledLive?: boolean }) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!secret) throw new PingStripeConfigError("Stripe is not configured yet.");

  const mode: PingStripeMode | null = secret.startsWith("sk_test_")
    ? "test"
    : secret.startsWith("sk_live_")
      ? "live"
      : null;

  if (!mode) throw new PingStripeConfigError("Ping requires a Stripe secret key with a recognised test or live prefix.");
  if (mode === "live" && !options?.allowDisabledLive && process.env.PING_LIVE_PAYMENTS_ENABLED !== "true") {
    throw new PingStripeConfigError("Live payments are locked until Ping's production launch gate is enabled.");
  }

  return {
    mode,
    stripe: new Stripe(secret, { maxNetworkRetries: 2 }),
  };
}

export function checkoutPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || "";
}

export function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || "";
}

export function activationFailureNeedsRefund(message: string) {
  return /already paid by a different checkout|not awaiting payment|unexpected payment currency|payment amount does not match quote|unexpected checkout session|ping is no longer active|ping no longer has enough time/i.test(message);
}

export async function refundUnfulfillableCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  reason: string,
) {
  if (session.payment_status !== "paid") return false;
  const paymentIntentId = checkoutPaymentIntentId(session);
  if (!paymentIntentId) return false;

  try {
    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        ...(reason === "duplicate" ? { reason: "duplicate" as const } : {}),
        metadata: {
          ping_promotion_id: session.metadata?.promotion_id || session.client_reference_id || "unknown",
          ping_checkout_session_id: session.id,
          ping_refund_trigger: reason.slice(0, 120),
        },
      },
      { idempotencyKey: `ping-auto-refund-${session.id}` },
    );
    return true;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    if (code === "charge_already_refunded") return true;
    throw error;
  }
}
