"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type PromotionRequest = {
  promotion_id: string;
  ping_title: string;
  sponsor_name: string;
  status: string;
  target_radius_meters: number;
  duration_hours: number;
  quoted_price_pence: number | null;
  currency: string;
  payment_status: string;
};

function money(pence: number | null) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

function radiusLabel(meters: number) {
  if (meters === 805) return "0.5 mi";
  if (meters === 1609) return "1 mi";
  if (meters === 4828) return "3 mi";
  if (meters === 8047) return "5 mi";
  return `${meters} m`;
}

export default function Phase9CheckoutPanel() {
  const [host, setHost] = useState<Element | null>(null);
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loadingId, setLoadingId] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setRequests([]);
      return;
    }
    const { data, error } = await supabase.rpc("my_promotion_requests");
    if (error) {
      console.error("Promotion payment list failed", error);
      return;
    }
    setRequests(((data || []) as PromotionRequest[]).filter((item) => item.status === "approved" && item.payment_status === "unpaid"));
  }, []);

  const verifyReturnedPayment = useCallback(async (sessionId: string) => {
    setSuccess("Payment received. Verifying with Stripe…");
    setMessage("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again so Ping can verify the payment.");

      const response = await fetch("/api/stripe/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Payment could not be verified.");

      setSuccess("Payment confirmed. Your promotion is now active.");
      await load();
      window.dispatchEvent(new CustomEvent("ping:visibility-changed"));
      window.dispatchEvent(new CustomEvent("ping:promotion-updated"));
      window.sessionStorage.setItem("ping:payment-confirmed", "1");
      window.location.replace("/promote");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "Payment could not be verified right now.");
    }
  }, [load]);

  useEffect(() => {
    // This component is mounted by /promote/layout.tsx, so the route content is
    // already present when effects run. Target the explicit payment/history slot
    // once instead of globally observing and rescanning the document.
    setHost(document.querySelector(".phase9-request-history"));

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    if (checkout === "success" && sessionId) void verifyReturnedPayment(sessionId);
    else if (checkout === "success") setMessage("Stripe returned without a checkout session. Please refresh and try again.");
    if (checkout === "cancelled") setMessage("Checkout was cancelled. No payment was taken.");

    const confirmed = window.sessionStorage.getItem("ping:payment-confirmed");
    if (confirmed === "1") {
      window.sessionStorage.removeItem("ping:payment-confirmed");
      setSuccess("Payment confirmed. Your promotion is now active.");
      window.dispatchEvent(new CustomEvent("ping:promotion-updated"));
    }

    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load, verifyReturnedPayment]);

  const pay = async (promotionId: string) => {
    setLoadingId(promotionId);
    setMessage("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again before paying.");

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promotionId }),
      });
      const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be started.");
      setLoadingId("");
    }
  };

  if (!host || (!requests.length && !message && !success)) return null;

  return createPortal(
    <section className="phase9-payment-panel">
      <div className="phase9-payment-heading">
        <div><strong>Payment</strong><span>Only approved promotions can be paid.</span></div>
        <b>{requests.length}</b>
      </div>
      {success && <div className="phase9-payment-success">✓ {success}</div>}
      {message && <div className="phase9-payment-error">{message}</div>}
      {requests.map((request) => (
        <article key={request.promotion_id}>
          <div className="phase9-payment-top"><span>Approved · awaiting payment</span><strong>{money(request.quoted_price_pence)}</strong></div>
          <h3>{request.ping_title}</h3>
          <p>{request.sponsor_name} · {radiusLabel(request.target_radius_meters)} · {request.duration_hours}h</p>
          <button type="button" disabled={loadingId === request.promotion_id} onClick={() => void pay(request.promotion_id)}>
            {loadingId === request.promotion_id ? "Opening secure checkout…" : `Pay ${money(request.quoted_price_pence)} securely`}
          </button>
          <small>Stripe test checkout · no card details are handled by Ping.</small>
        </article>
      ))}
      <style jsx global>{`
        .phase9-payment-panel{margin-top:13px;border:1px solid #dce4d9;border-radius:19px;background:#f5faf2;padding:12px}.phase9-payment-heading{display:flex;justify-content:space-between;align-items:center;padding:1px 2px 9px}.phase9-payment-heading strong,.phase9-payment-heading span{display:block}.phase9-payment-heading strong{font-size:14px}.phase9-payment-heading span{font-size:8px;color:#7c887e;margin-top:2px}.phase9-payment-heading>b{min-width:27px;height:27px;border-radius:10px;background:#dfeeda;display:grid;place-items:center;font-size:10px}.phase9-payment-panel article{background:#fff;border:1px solid #dde5da;border-radius:15px;padding:12px;margin-top:8px}.phase9-payment-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.phase9-payment-top span{font-size:8px;font-weight:950;color:#47704a}.phase9-payment-top strong{font-size:18px}.phase9-payment-panel h3{font-size:14px;margin:8px 0 3px}.phase9-payment-panel p{font-size:8px;color:#707c72;margin:0 0 10px}.phase9-payment-panel button{width:100%;border:0;border-radius:12px;background:#1f2921;color:#fff;padding:11px;font-size:10px;font-weight:950}.phase9-payment-panel button:disabled{opacity:.55}.phase9-payment-panel article small{display:block;text-align:center;color:#8a938b;font-size:7px;margin-top:7px}.phase9-payment-success,.phase9-payment-error{border-radius:11px;padding:9px;font-size:9px;margin:3px 0 8px}.phase9-payment-success{background:#e4f4df;color:#2c6433}.phase9-payment-error{background:#f7e8e4;color:#8d5047}
      `}</style>
    </section>,
    host,
  );
}
