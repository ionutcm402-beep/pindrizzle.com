import { getPingStripe } from "@/lib/stripeServer";

export type LaunchGate = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type PublicOperatorConfig = {
  operatorName: string;
  operatorAddress: string;
  supportEmail: string;
  privacyEmail: string;
  safetyEmail: string;
  governingLaw: string;
  publicUrl: string;
};

function value(name: string) {
  return process.env[name]?.trim() || "";
}

function flag(name: string) {
  return value(name).toLowerCase() === "true";
}

function emailReady(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUrlReady(url: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function getPublicOperatorConfig(): PublicOperatorConfig {
  return {
    operatorName: value("PING_OPERATOR_NAME"),
    operatorAddress: value("PING_OPERATOR_ADDRESS"),
    supportEmail: value("PING_SUPPORT_EMAIL"),
    privacyEmail: value("PING_PRIVACY_EMAIL"),
    safetyEmail: value("PING_SAFETY_EMAIL"),
    governingLaw: value("PING_GOVERNING_LAW"),
    publicUrl: value("PING_PUBLIC_URL"),
  };
}

export function getLaunchReadiness(releaseStage: string | null) {
  const operator = getPublicOperatorConfig();
  let stripeMode: "test" | "live" | "missing" = "missing";
  try {
    stripeMode = getPingStripe({ allowDisabledLive: true }).mode;
  } catch {
    stripeMode = "missing";
  }

  const livePaymentsEnabled = flag("PING_LIVE_PAYMENTS_ENABLED");
  const stripeAccountReady = flag("PING_STRIPE_ACCOUNT_READY");
  const smtpReady = flag("PING_SMTP_READY");
  const legalReviewComplete = flag("PING_LEGAL_REVIEW_COMPLETE");
  const onlineSafetyReviewComplete = flag("PING_ONLINE_SAFETY_REVIEW_COMPLETE");

  const gates: LaunchGate[] = [
    { key: "operator_name", label: "Operator identity", ready: operator.operatorName.length >= 2, detail: operator.operatorName ? "Configured" : "Set PING_OPERATOR_NAME" },
    { key: "operator_address", label: "Operator contact address", ready: operator.operatorAddress.length >= 8, detail: operator.operatorAddress ? "Configured" : "Set PING_OPERATOR_ADDRESS" },
    { key: "support_email", label: "Support contact", ready: emailReady(operator.supportEmail), detail: emailReady(operator.supportEmail) ? operator.supportEmail : "Set a valid PING_SUPPORT_EMAIL" },
    { key: "privacy_email", label: "Privacy contact", ready: emailReady(operator.privacyEmail), detail: emailReady(operator.privacyEmail) ? operator.privacyEmail : "Set a valid PING_PRIVACY_EMAIL" },
    { key: "safety_email", label: "Safety contact", ready: emailReady(operator.safetyEmail), detail: emailReady(operator.safetyEmail) ? operator.safetyEmail : "Set a valid PING_SAFETY_EMAIL" },
    { key: "governing_law", label: "Governing-law wording", ready: operator.governingLaw.length >= 4, detail: operator.governingLaw || "Set PING_GOVERNING_LAW after legal review" },
    { key: "public_domain", label: "Custom HTTPS domain", ready: publicUrlReady(operator.publicUrl), detail: publicUrlReady(operator.publicUrl) ? operator.publicUrl : "Set PING_PUBLIC_URL to the final custom HTTPS domain" },
    { key: "smtp", label: "Production auth email / SMTP", ready: smtpReady, detail: smtpReady ? "Operator confirmed tested" : "Configure and test custom SMTP, then set PING_SMTP_READY=true" },
    { key: "stripe_account", label: "Ping live Stripe identity", ready: stripeAccountReady && stripeMode === "live", detail: stripeMode !== "live" ? `Stripe mode: ${stripeMode}` : stripeAccountReady ? "Live Stripe account confirmed for Ping" : "Live key present, but PING_STRIPE_ACCOUNT_READY is not confirmed" },
    { key: "legal_review", label: "Final legal review", ready: legalReviewComplete, detail: legalReviewComplete ? "Operator confirmed complete" : "Set PING_LEGAL_REVIEW_COMPLETE=true only after final review" },
    { key: "online_safety", label: "Online Safety assessments & ownership", ready: onlineSafetyReviewComplete, detail: onlineSafetyReviewComplete ? "Operator confirmed complete" : "Set PING_ONLINE_SAFETY_REVIEW_COMPLETE=true after the required assessments/process ownership are complete" },
  ];

  const prerequisitesReady = gates.every((gate) => gate.ready);
  const stage = releaseStage === "public" ? "public" : "closed_beta";

  return {
    stage,
    stripeMode,
    livePaymentsEnabled,
    prerequisitesReady,
    publicAccessLive: stage === "public",
    paymentsLive: stripeMode === "live" && livePaymentsEnabled,
    safeToOpenPublicAccess: prerequisitesReady && stage === "closed_beta",
    safeToEnableLivePayments: prerequisitesReady && stripeMode === "live" && !livePaymentsEnabled,
    operator,
    gates,
  };
}
