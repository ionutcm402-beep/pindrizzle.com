"use client";

import { useEffect, useMemo, useState } from "react";
import PingIcon from "@/components/PingIcon";
import {
  CATEGORY_DEFINITIONS,
  CREATE_CATEGORY_ORDER,
  DEAL_KIND_LABEL,
  DEAL_KINDS,
  MARKETPLACE_LISTING_DEFINITIONS,
  MARKETPLACE_LISTING_TYPE_ORDER,
  expiryOptionsForCategory,
  type DealKind,
  type DealSource,
  type MarketplaceListingType,
  type PingCategoryKey,
} from "@/lib/ping-categories";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

export type PingDraft = {
  category: PingCategoryKey;
  title: string;
  body: string;
  photo: File | null;
  expiryHours: number;
  dealSource: DealSource;
  dealKind: DealKind;
  merchantName: string;
  marketplaceListingType: MarketplaceListingType;
  marketplacePrice: number | null;
  marketplaceUrl: string;
};

export function requestAuth(message: string) {
  window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message } }));
}

export function Composer({ onClose, onPublish }: { onClose: () => void; onPublish: (draft: PingDraft) => void | Promise<void> }) {
  const [category, setCategory] = useState<PingCategoryKey>("free");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [expiryHours, setExpiryHours] = useState(CATEGORY_DEFINITIONS.free.recommendedExpiryHours);
  const [dealSource, setDealSource] = useState<DealSource>("spotted");
  const [dealKind, setDealKind] = useState<DealKind>("offer");
  const [merchantName, setMerchantName] = useState("");
  const [marketplaceListingType, setMarketplaceListingType] = useState<MarketplaceListingType>("for_sale");
  const [marketplacePrice, setMarketplacePrice] = useState("");
  const [marketplaceUrl, setMarketplaceUrl] = useState("");
  const photoPreview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  const parsedMarketplacePrice = marketplacePrice.trim() === "" ? null : Number(marketplacePrice);
  const dealReady = category !== "deals" || merchantName.trim().length >= 2;
  const marketplaceUrlReady = marketplaceUrl.trim() === "" || /^https?:\/\/\S+/i.test(marketplaceUrl.trim());
  const marketplacePriceReady = parsedMarketplacePrice == null || (Number.isFinite(parsedMarketplacePrice) && parsedMarketplacePrice >= 0);
  const marketplaceReady = category !== "marketplace" || (Boolean(marketplaceListingType) && marketplaceUrlReady && marketplacePriceReady);
  const canPublish = title.trim().length >= 4 && body.trim().length >= 6 && dealReady && marketplaceReady && !publishing;

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const chooseCategory = (next: PingCategoryKey) => { setCategory(next); setExpiryHours(CATEGORY_DEFINITIONS[next].recommendedExpiryHours); };
  const choosePhoto = (file: File | null) => {
    setPhotoError("");
    if (!file) { setPhoto(null); return; }
    if (!PHOTO_TYPES.includes(file.type)) { setPhoto(null); setPhotoError("Use a JPEG, PNG or WebP image."); return; }
    if (file.size > PHOTO_MAX_BYTES) { setPhoto(null); setPhotoError("Photo must be 6 MB or smaller."); return; }
    setPhoto(file);
  };

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await onPublish({ category, title: title.trim(), body: body.trim(), photo, expiryHours, dealSource, dealKind, merchantName: merchantName.trim(), marketplaceListingType, marketplacePrice: parsedMarketplacePrice, marketplaceUrl: marketplaceUrl.trim() });
    } finally { setPublishing(false); }
  };

  const marketplaceDefinition = MARKETPLACE_LISTING_DEFINITIONS[marketplaceListingType];
  const marketplacePlaceholder = marketplaceListingType === "for_sale" ? "e.g. Dining table for sale" : marketplaceListingType === "to_rent" ? "e.g. Flat to rent near town centre" : marketplaceListingType === "car" ? "e.g. 2018 Ford Focus for sale" : "e.g. Secure parking space to rent";

  return <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Drop a pin"><div className="composer-sheet composer-v3-sheet">
    <div className="sheet-handle" /><div className="composer-header"><button onClick={onClose} disabled={publishing}>Cancel</button><strong>New pin</strong><span /></div><h2>Share something useful nearby</h2>
    <div className="composer-v3-category-grid" aria-label="Pin category">{CREATE_CATEGORY_ORDER.map((key) => { const item = CATEGORY_DEFINITIONS[key]; return <button type="button" key={key} className={category === key ? "selected" : ""} onClick={() => chooseCategory(key)} disabled={publishing}><PingIcon name={item.icon} size={16} /><span>{item.label}</span></button>; })}</div>

    {category === "deals" && <section className="composer-v3-deal-panel"><div className="composer-v3-source-toggle"><button type="button" className={dealSource === "spotted" ? "selected" : ""} onClick={() => setDealSource("spotted")}><PingIcon name="deals" size={15} />I found this deal</button><button type="button" className={dealSource === "business" ? "selected" : ""} onClick={() => setDealSource("business")}><PingIcon name="business" size={15} />Business post</button></div><label>Shop or business name<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} maxLength={120} placeholder="e.g. Tesco, local café, Currys" /></label><label>Deal type<select value={dealKind} onChange={(event) => setDealKind(event.target.value as DealKind)}>{DEAL_KINDS.map((kind) => <option key={kind} value={kind}>{DEAL_KIND_LABEL[kind]}</option>)}</select></label>{dealSource === "business" && <small>Business posts are self-identified and are not shown as verified.</small>}</section>}

    {category === "marketplace" && <section className="composer-v3-market-panel">
      <label className="composer-v3-listing-type-label">Listing type</label>
      <div className="composer-v3-market-type">{MARKETPLACE_LISTING_TYPE_ORDER.map((value) => { const item = MARKETPLACE_LISTING_DEFINITIONS[value]; return <button type="button" key={value} className={marketplaceListingType === value ? "selected" : ""} onClick={() => setMarketplaceListingType(value)}><PingIcon name={item.icon} size={15}/>{item.label}</button>; })}</div>
      <div className="composer-v3-market-price"><label>{marketplaceDefinition.priceFieldLabel} (optional)<div className="composer-v3-price-input"><span>£</span><input inputMode="decimal" value={marketplacePrice} onChange={(event) => setMarketplacePrice(event.target.value.replace(/[^0-9.]/g, ""))} placeholder={marketplaceDefinition.pricePeriod === "month" ? "e.g. 1200 per month" : "e.g. 1200"} /></div></label></div>
      <label>External listing link (optional)<div className="composer-v3-url"><PingIcon name="link" size={15}/><input type="url" value={marketplaceUrl} onChange={(event) => setMarketplaceUrl(event.target.value)} maxLength={500} placeholder="https://rightmove.co.uk/..." /></div></label>
      {!marketplaceUrlReady && <small className="composer-v3-market-error">Link must start with http:// or https://</small>}
      <small>Add a link when the full listing is hosted elsewhere.</small>
    </section>}

    <label className="composer-label">Headline</label><input className="composer-input" placeholder={category === "deals" ? "e.g. Air fryer reduced to £39" : category === "marketplace" ? marketplacePlaceholder : "Add a clear headline"} maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} disabled={publishing} />
    <label className="composer-label">Details</label><textarea placeholder={category === "deals" ? "Add the price, availability and location." : category === "marketplace" ? "Add the details people need before opening the listing." : "Add the details people need."} maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} disabled={publishing} />
    <div className="composer-v3-expiry"><label><span>Keep this pin live for</span><select value={expiryHours} onChange={(event) => setExpiryHours(Number(event.target.value))}>{expiryOptionsForCategory(category).map((hours) => <option key={hours} value={hours}>{hours < 24 ? `${hours} hours` : `${hours / 24} ${hours === 24 ? "day" : "days"}`}</option>)}</select></label><small>{category === "marketplace" ? "Marketplace listings can stay live for up to 30 days. Resolve them when they are no longer available." : "Shorter durations suit traffic, parking and alerts. Lost & Found can stay live longer."}</small></div>
    <label className="composer-photo-picker"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0] || null)} disabled={publishing} /><span><PingIcon name="plus" size={18} /></span><div><strong>{photo ? "Change photo" : "Add a photo"}</strong><small>Optional · JPEG, PNG or WebP · max 6 MB</small></div><b>{photo ? "Change" : "Add"}</b></label>
    {photoPreview && <div className="composer-photo-preview"><img src={photoPreview} alt="Selected pin photo preview" /><button type="button" onClick={() => choosePhoto(null)} disabled={publishing}>Remove</button></div>}{photoError && <div className="composer-photo-error">{photoError}</div>}
    <div className="expiry-note">New pins use an approximate public area by default.</div><button className="publish-button" disabled={!canPublish} onClick={publish}>{publishing ? "Publishing…" : "Publish"}</button>
  </div></div>;
}
