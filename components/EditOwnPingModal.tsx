"use client";

import { useEffect, useMemo, useState } from "react";
import PingIcon from "@/components/PingIcon";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORY_DEFINITIONS,
  DEAL_KIND_LABEL,
  DEAL_KINDS,
  DEAL_SOURCE_LABEL,
  MARKETPLACE_INTENT_LABEL,
  MARKETPLACE_INTENTS,
  MARKETPLACE_PRICE_PERIOD_LABEL,
  MARKETPLACE_PRICE_PERIODS,
  MARKETPLACE_TYPE_LABEL,
  MARKETPLACE_TYPES,
  expiryOptionsForCategory,
  marketplaceSubtypeOptions,
  type DealKind,
  type DealSource,
  type MarketplaceIntent,
  type MarketplacePricePeriod,
  type MarketplaceSubtype,
  type MarketplaceType,
  type PingCategoryKey,
} from "@/lib/ping-categories";

type EditablePing = {
  id: string;
  category: PingCategoryKey;
  title: string;
  body: string;
  created_at: string;
  expires_at: string;
  deal_source: DealSource | null;
  deal_kind: DealKind | null;
  merchant_name: string | null;
  marketplace_type: MarketplaceType | null;
  marketplace_intent: MarketplaceIntent | null;
  marketplace_subtype: MarketplaceSubtype | null;
  marketplace_price: number | string | null;
  marketplace_price_period: MarketplacePricePeriod | null;
  marketplace_currency: string | null;
  marketplace_url: string | null;
};

type Props = {
  pingId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) return String((value as { message?: unknown }).message || "");
  return "";
}

function currentExpiryLabel(value: string) {
  const hours = Math.max(1, Math.ceil((new Date(value).getTime() - Date.now()) / 3600000));
  return hours < 24 ? `${hours} hours remaining` : `${Math.ceil(hours / 24)} days remaining`;
}

export default function EditOwnPingModal({ pingId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ping, setPing] = useState<EditablePing | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiryHours, setExpiryHours] = useState<string>("");
  const [dealSource, setDealSource] = useState<DealSource>("spotted");
  const [dealKind, setDealKind] = useState<DealKind>("offer");
  const [merchantName, setMerchantName] = useState("");
  const [marketplaceType, setMarketplaceType] = useState<MarketplaceType>("property");
  const [marketplaceIntent, setMarketplaceIntent] = useState<MarketplaceIntent>("rent");
  const [marketplaceSubtype, setMarketplaceSubtype] = useState<MarketplaceSubtype>("flat");
  const [marketplacePrice, setMarketplacePrice] = useState("");
  const [marketplacePricePeriod, setMarketplacePricePeriod] = useState<MarketplacePricePeriod>("month");
  const [marketplaceUrl, setMarketplaceUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("pings")
        .select("id,category,title,body,created_at,expires_at,deal_source,deal_kind,merchant_name,marketplace_type,marketplace_intent,marketplace_subtype,marketplace_price,marketplace_price_period,marketplace_currency,marketplace_url")
        .eq("id", pingId)
        .single();
      if (cancelled) return;
      if (loadError || !data) {
        setError("This Ping could not be loaded for editing.");
        setLoading(false);
        return;
      }
      const row = data as EditablePing;
      setPing(row);
      setTitle(row.title);
      setBody(row.body);
      setDealSource(row.deal_source || "spotted");
      setDealKind(row.deal_kind || "offer");
      setMerchantName(row.merchant_name || "");
      const normalizedType: MarketplaceType = row.marketplace_type === "parking_space" ? "property" : row.marketplace_type || "property";
      setMarketplaceType(normalizedType);
      setMarketplaceIntent(row.marketplace_intent || "rent");
      setMarketplaceSubtype(row.marketplace_subtype || (normalizedType === "vehicle" ? "car" : "flat"));
      setMarketplacePrice(row.marketplace_price == null ? "" : String(row.marketplace_price));
      setMarketplacePricePeriod(row.marketplace_price_period || (row.marketplace_intent === "sale" ? "total" : "month"));
      setMarketplaceUrl(row.marketplace_url || "");
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [pingId]);

  const parsedPrice = marketplacePrice.trim() === "" ? null : Number(marketplacePrice);
  const urlValid = marketplaceUrl.trim() === "" || /^https?:\/\/\S+/i.test(marketplaceUrl.trim());
  const priceValid = parsedPrice == null || (Number.isFinite(parsedPrice) && parsedPrice >= 0);
  const valid = title.trim().length >= 4 && title.trim().length <= 70 && body.trim().length >= 6 && body.trim().length <= 280 && urlValid && priceValid;
  const category = ping?.category;
  const definition = category ? CATEGORY_DEFINITIONS[category] : null;
  const expiryOptions = useMemo(() => category ? expiryOptionsForCategory(category) : [], [category]);

  const chooseMarketplaceType = (next: MarketplaceType) => {
    if (next === "parking_space") next = "property";
    setMarketplaceType(next);
    const first = marketplaceSubtypeOptions(next)[0]?.value || "flat";
    setMarketplaceSubtype(first);
  };

  const save = async () => {
    if (!ping || !valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase.rpc("update_own_ping", {
        target_ping_id: ping.id,
        new_title: title.trim(),
        new_body: body.trim(),
        new_expires_in_hours: expiryHours ? Number(expiryHours) : null,
        new_deal_source: ping.category === "deals" ? dealSource : null,
        new_deal_kind: ping.category === "deals" ? dealKind : null,
        new_merchant_name: ping.category === "deals" ? merchantName.trim() : null,
        new_marketplace_type: ping.category === "marketplace" ? marketplaceType : null,
        new_marketplace_intent: ping.category === "marketplace" ? marketplaceIntent : null,
        new_marketplace_subtype: ping.category === "marketplace" ? marketplaceSubtype : null,
        new_marketplace_price: ping.category === "marketplace" ? parsedPrice : null,
        new_marketplace_price_period: ping.category === "marketplace" && parsedPrice != null ? marketplacePricePeriod : null,
        new_marketplace_currency: ping.category === "marketplace" && parsedPrice != null ? (ping.marketplace_currency || "GBP") : null,
        new_marketplace_url: ping.category === "marketplace" ? marketplaceUrl.trim() || null : null,
      });
      if (saveError) throw saveError;
      await onSaved();
      onClose();
    } catch (value) {
      setError(errorText(value) || "This Ping could not be saved right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-ping-backdrop" role="dialog" aria-modal="true" aria-label="Edit Ping">
      <section className="edit-ping-sheet">
        <div className="sheet-handle" />
        <header><button type="button" onClick={onClose} disabled={saving}>Cancel</button><strong>Edit Ping</strong><span /></header>
        {loading ? <div className="edit-ping-loading">Loading your Ping…</div> : ping && definition ? <>
          <div className="edit-ping-category"><span><PingIcon name={definition.icon} size={15} /></span><div><small>CATEGORY</small><strong>{definition.label}</strong></div><em>Category stays fixed</em></div>

          {ping.category === "deals" && <section className="edit-ping-special">
            <div className="edit-ping-toggle"><button type="button" className={dealSource === "spotted" ? "selected" : ""} onClick={() => setDealSource("spotted")}>{DEAL_SOURCE_LABEL.spotted}</button><button type="button" className={dealSource === "business" ? "selected" : ""} onClick={() => setDealSource("business")}>{DEAL_SOURCE_LABEL.business}</button></div>
            <label>Shop or business name<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} maxLength={120} /></label>
            <label>Deal type<select value={dealKind} onChange={(event) => setDealKind(event.target.value as DealKind)}>{DEAL_KINDS.map((kind) => <option key={kind} value={kind}>{DEAL_KIND_LABEL[kind]}</option>)}</select></label>
          </section>}

          {ping.category === "marketplace" && <section className="edit-ping-special">
            <div className="edit-ping-market-types">{MARKETPLACE_TYPES.map((value) => <button type="button" key={value} className={marketplaceType === value ? "selected" : ""} onClick={() => chooseMarketplaceType(value)}><PingIcon name={value === "property" ? "property" : "vehicle"} size={14} />{MARKETPLACE_TYPE_LABEL[value]}</button>)}</div>
            <label>Listing type<select value={marketplaceSubtype} onChange={(event) => setMarketplaceSubtype(event.target.value as MarketplaceSubtype)}>{marketplaceSubtypeOptions(marketplaceType).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label>Sale, rent or wanted<select value={marketplaceIntent} onChange={(event) => { const value = event.target.value as MarketplaceIntent; setMarketplaceIntent(value); if (value === "sale") setMarketplacePricePeriod("total"); else if (marketplacePricePeriod === "total") setMarketplacePricePeriod("month"); }}>{MARKETPLACE_INTENTS.map((value) => <option key={value} value={value}>{MARKETPLACE_INTENT_LABEL[value]}</option>)}</select></label>
            <div className="edit-ping-price"><label>Price / budget<div><span>£</span><input inputMode="decimal" value={marketplacePrice} onChange={(event) => setMarketplacePrice(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Optional" /></div></label><label>Period<select value={marketplacePricePeriod} onChange={(event) => setMarketplacePricePeriod(event.target.value as MarketplacePricePeriod)}>{MARKETPLACE_PRICE_PERIODS.map((value) => <option key={value} value={value}>{MARKETPLACE_PRICE_PERIOD_LABEL[value]}</option>)}</select></label></div>
            <label>External listing link<input type="url" value={marketplaceUrl} onChange={(event) => setMarketplaceUrl(event.target.value)} placeholder="https://..." maxLength={500} /></label>
            {!urlValid && <small className="edit-ping-error">Link must start with http:// or https://</small>}
          </section>}

          <label className="edit-ping-field">Headline<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} /></label>
          <label className="edit-ping-field">Details<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={280} /></label>
          <label className="edit-ping-field">Expiry<select value={expiryHours} onChange={(event) => setExpiryHours(event.target.value)}><option value="">Keep current · {currentExpiryLabel(ping.expires_at)}</option>{expiryOptions.map((hours) => <option key={hours} value={hours}>{hours < 24 ? `${hours} hours from now` : `${hours / 24} ${hours === 24 ? "day" : "days"} from now`}</option>)}</select><small>Extensions are capped by the original maximum lifetime for this category.</small></label>
          <div className="edit-ping-location-note"><PingIcon name="location" size={14} /><span>The approximate location stays unchanged when you edit.</span></div>
          <div className="edit-ping-photo-note"><PingIcon name="edit" size={14} /><span>Photo replacement is coming next; this edit does not change the current photo.</span></div>
          {error && <div className="edit-ping-error-box" role="alert">{error}</div>}
          <button type="button" className="edit-ping-save" onClick={() => void save()} disabled={!valid || saving}>{saving ? "Saving…" : "Save changes"}</button>
        </> : <div className="edit-ping-error-box">{error || "This Ping is not available for editing."}</div>}
      </section>
      <style jsx global>{`
        .edit-ping-backdrop{position:fixed;inset:0;z-index:260;background:rgba(12,16,13,.42);display:flex;align-items:flex-end;justify-content:center;padding-top:20px}.edit-ping-sheet{width:min(100%,480px);max-height:92dvh;overflow:auto;border-radius:24px 24px 0 0;background:var(--ping-canvas);padding:10px 18px max(24px,env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(16,19,17,.2)}.edit-ping-sheet header{height:42px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center}.edit-ping-sheet header button{justify-self:start;border:0;background:transparent;color:var(--ping-ink-2);font-size:10px}.edit-ping-sheet header strong{font-size:12px}.edit-ping-loading{padding:50px 0;text-align:center;color:var(--ping-muted);font-size:11px}.edit-ping-category{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;margin:7px 0 13px;padding:11px;border:1px solid var(--ping-line);border-radius:13px;background:#fff}.edit-ping-category>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:var(--ping-surface-soft)}.edit-ping-category small{display:block;color:var(--ping-muted-2);font-size:7px;font-weight:800;letter-spacing:.09em}.edit-ping-category strong{font-size:10px}.edit-ping-category em{font-style:normal;color:var(--ping-muted);font-size:8px}.edit-ping-field,.edit-ping-special label{display:grid;gap:5px;margin-top:11px;color:var(--ping-muted);font-size:9px;font-weight:720}.edit-ping-field input,.edit-ping-field textarea,.edit-ping-field select,.edit-ping-special input,.edit-ping-special select{width:100%;border:1px solid var(--ping-line);border-radius:11px;background:#fff;color:var(--ping-ink);font-size:11px;padding:0 11px}.edit-ping-field input,.edit-ping-field select,.edit-ping-special input,.edit-ping-special select{height:42px}.edit-ping-field textarea{min-height:100px;padding-top:11px;resize:vertical}.edit-ping-field>small{color:var(--ping-muted-2);font-size:7.5px;line-height:1.4}.edit-ping-special{margin:11px 0 4px;padding:11px;border:1px solid var(--ping-line);border-radius:14px;background:#fff}.edit-ping-toggle,.edit-ping-market-types{display:grid;grid-template-columns:1fr 1fr;gap:7px}.edit-ping-toggle button,.edit-ping-market-types button{min-height:38px;border:1px solid var(--ping-line);border-radius:10px;background:#fff;color:var(--ping-ink-2);font-size:8.5px;font-weight:760;display:flex;align-items:center;justify-content:center;gap:6px}.edit-ping-toggle button.selected,.edit-ping-market-types button.selected{background:var(--ping-ink);border-color:var(--ping-ink);color:#fff}.edit-ping-price{display:grid;grid-template-columns:1fr 1fr;gap:7px}.edit-ping-price label>div{height:42px;display:flex;align-items:center;border:1px solid var(--ping-line);border-radius:11px;background:#fff;overflow:hidden}.edit-ping-price label>div>span{padding-left:10px;color:var(--ping-muted)}.edit-ping-price label>div input{border:0!important;height:40px!important;min-width:0}.edit-ping-error{color:var(--ping-danger);font-size:8px}.edit-ping-location-note,.edit-ping-photo-note{display:flex;gap:7px;align-items:flex-start;margin-top:11px;padding:10px;border-radius:11px;background:var(--ping-surface-soft);color:var(--ping-muted);font-size:8.5px;line-height:1.45}.edit-ping-error-box{margin-top:11px;padding:10px 11px;border-radius:11px;background:#fff0ed;color:#9a4038;font-size:9px;font-weight:700}.edit-ping-save{width:100%;height:46px;margin-top:13px;border:0;border-radius:12px;background:var(--ping-ink);color:#fff;font-size:10px;font-weight:800}.edit-ping-save:disabled{opacity:.4}@media(min-width:700px){.edit-ping-backdrop{align-items:center;padding:24px}.edit-ping-sheet{border-radius:24px;max-height:min(86dvh,760px)}}
      `}</style>
    </div>
  );
}
