"use client";

import { useCallback, useEffect, useState } from "react";
import { Composer as PingComposer, type PingDraft } from "@/components/PingComposer";
import { MARKETPLACE_LISTING_DEFINITIONS } from "@/lib/ping-categories";
import type { PingCoordinates, PingLocationState } from "@/lib/ping-location";
import { createClient } from "@/lib/supabase/client";

type Props = {
  coordinates: PingCoordinates | null;
  locationState: PingLocationState;
  onRequestLocation: () => Promise<void>;
  onPublished: () => void;
};

function requestAuth(message: string) {
  window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message } }));
}

export default function MapComposeController({ coordinates, locationState, onRequestLocation, onPublished }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [pendingCompose, setPendingCompose] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const beginCompose = useCallback(() => {
    setPendingCompose(true);
    if (!authReady) return;
    if (!userId) {
      requestAuth("Sign in to publish a pin.");
      return;
    }
    if (locationState !== "granted" || !coordinates) void onRequestLocation();
  }, [authReady, coordinates, locationState, onRequestLocation, userId]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash !== "#ping") return;
      window.history.replaceState({}, "", "/");
      beginCompose();
    };
    const openFromEvent = () => beginCompose();

    if (authReady) openFromHash();
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener("ping:compose-request", openFromEvent);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      window.removeEventListener("ping:compose-request", openFromEvent);
    };
  }, [authReady, beginCompose]);

  useEffect(() => {
    if (!pendingCompose || !userId) return;
    if (locationState === "idle" || locationState === "unavailable") {
      void onRequestLocation();
      return;
    }
    if (locationState === "granted" && coordinates) {
      setComposerOpen(true);
      setPendingCompose(false);
    }
  }, [coordinates, locationState, onRequestLocation, pendingCompose, userId]);

  const publishPing = async (draft: PingDraft) => {
    if (!userId) {
      setComposerOpen(false);
      requestAuth("Sign in to publish a pin.");
      return;
    }
    if (!coordinates) {
      setComposerOpen(false);
      setPendingCompose(true);
      void onRequestLocation();
      return;
    }

    try {
      const supabase = createClient();
      const marketplaceDefinition = MARKETPLACE_LISTING_DEFINITIONS[draft.marketplaceListingType];
      const { data, error } = await supabase.rpc("create_ping_v3", {
        ping_category: draft.category,
        ping_title: draft.title,
        ping_body: draft.body,
        ping_lat: coordinates.lat,
        ping_lng: coordinates.lng,
        ping_place_label: "Near your current location",
        ping_expires_in_hours: draft.expiryHours,
        ping_deal_source: draft.category === "deals" ? draft.dealSource : null,
        ping_deal_kind: draft.category === "deals" ? draft.dealKind : null,
        ping_merchant_name: draft.category === "deals" ? draft.merchantName : null,
        ping_marketplace_type: draft.category === "marketplace" ? marketplaceDefinition.marketplaceType : null,
        ping_marketplace_intent: draft.category === "marketplace" ? marketplaceDefinition.marketplaceIntent : null,
        ping_marketplace_subtype: draft.category === "marketplace" ? marketplaceDefinition.marketplaceSubtype : null,
        ping_marketplace_price: draft.category === "marketplace" ? draft.marketplacePrice : null,
        ping_marketplace_price_period: draft.category === "marketplace" && draft.marketplacePrice != null ? marketplaceDefinition.pricePeriod : null,
        ping_marketplace_currency: draft.category === "marketplace" && draft.marketplacePrice != null ? "GBP" : null,
        ping_marketplace_url: draft.category === "marketplace" ? draft.marketplaceUrl || null : null,
      });
      if (error) throw error;

      const createdId = String(data || "");
      if (draft.photo && createdId) {
        const storagePath = `${userId}/${createdId}/photo`;
        const upload = await supabase.storage.from("ping-media").upload(storagePath, draft.photo, {
          cacheControl: "3600",
          contentType: draft.photo.type,
          upsert: false,
        });
        if (upload.error) {
          console.error("Pin photo upload failed", upload.error);
          window.alert("Your pin was published, but the photo could not upload. The text pin is live.");
        } else {
          const attach = await supabase.rpc("attach_ping_media", {
            target_ping_id: createdId,
            object_path: storagePath,
            media_mime_type: draft.photo.type,
            media_byte_size: draft.photo.size,
          });
          if (attach.error) {
            console.error("Pin photo attach failed", attach.error);
            await supabase.storage.from("ping-media").remove([storagePath]);
            window.alert("Your pin was published, but the photo could not be attached. The text pin is live.");
          }
        }
      }

      setComposerOpen(false);
      onPublished();
    } catch (error) {
      console.error("Publish failed", error);
      const message = error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
      window.alert(message || "This pin could not be published. Try again.");
    }
  };

  if (!composerOpen) return null;
  return <>
    <PingComposer onClose={() => { setComposerOpen(false); setPendingCompose(false); }} onPublish={publishPing} />
    <style jsx global>{`
      .composer-v3-sheet{max-height:min(92dvh,760px)!important;overflow-y:auto}.composer-v3-category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.composer-v3-category-grid button{min-height:42px;border:1px solid var(--ping-line);border-radius:12px;background:#fff;color:var(--ping-ink-2);display:flex;align-items:center;justify-content:flex-start;gap:8px;padding:0 10px;font-size:9px;font-weight:720;text-align:left}.composer-v3-category-grid button.selected{border-color:var(--ping-ink);background:var(--ping-ink);color:#fff}
      .composer-v3-deal-panel,.composer-v3-market-panel{margin-top:13px;padding:12px;border:1px solid var(--ping-line);border-radius:14px;background:#fff}.composer-v3-deal-panel{border-color:rgba(184,146,42,.2);background:#fffdf5}.composer-v3-source-toggle,.composer-v3-market-type{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:10px}.composer-v3-listing-type-label{display:block!important;margin:0 0 6px!important}.composer-v3-source-toggle button,.composer-v3-market-type button{min-height:38px;border:1px solid rgba(16,19,17,.1);border-radius:10px;background:#fff;color:var(--ping-ink-2);display:flex;align-items:center;justify-content:center;gap:5px;font-size:8px;font-weight:750}.composer-v3-source-toggle button.selected,.composer-v3-market-type button.selected{background:#202722;color:#fff;border-color:#202722}
      .composer-v3-deal-panel label,.composer-v3-market-panel label{display:grid;gap:5px;margin-top:9px;color:var(--ping-muted);font-size:9px;font-weight:700}.composer-v3-deal-panel input,.composer-v3-deal-panel select,.composer-v3-market-panel input,.composer-v3-market-panel select{height:40px;border:1px solid var(--ping-line);border-radius:10px;background:#fff;padding:0 10px;color:var(--ping-ink);font-size:11px;min-width:0}.composer-v3-price-input,.composer-v3-url{display:flex;align-items:center;height:40px;border:1px solid var(--ping-line);border-radius:10px;background:#fff;padding:0 10px}.composer-v3-price-input input,.composer-v3-url input{height:36px!important;border:0!important;padding:0 6px!important;min-width:0;flex:1;outline:0}.composer-v3-deal-panel small,.composer-v3-market-panel>small{display:block;margin-top:9px;color:var(--ping-muted);font-size:8px;line-height:1.45}.composer-v3-market-error{color:var(--ping-danger)!important;font-weight:700}
      .composer-v3-expiry{margin-top:13px;padding:11px 12px;border:1px solid var(--ping-line);border-radius:13px;background:var(--ping-surface-soft)}.composer-v3-expiry label{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--ping-ink-2);font-size:9px;font-weight:740}.composer-v3-expiry select{height:34px;border:1px solid var(--ping-line);border-radius:9px;background:#fff;padding:0 8px;font-size:9px}.composer-v3-expiry small{display:block;margin-top:5px;color:var(--ping-muted);font-size:7.5px;line-height:1.4}
      .composer-photo-picker{margin-top:14px;display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;border:1px solid #dfe5dc;border-radius:14px;padding:12px;background:#fff;cursor:pointer}.composer-photo-picker input{display:none}.composer-photo-picker>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:var(--ping-surface-soft)}.composer-photo-picker strong{display:block;font-size:11px}.composer-photo-picker small{display:block;margin-top:2px;color:var(--ping-muted);font-size:9px}.composer-photo-preview{position:relative;margin-top:10px}.composer-photo-preview img{display:block;width:100%;max-height:230px;object-fit:cover;border-radius:14px}.composer-photo-preview button{position:absolute;right:8px;top:8px;border:0;border-radius:999px;padding:7px 10px;background:rgba(20,27,21,.82);color:#fff}.composer-photo-error{margin-top:8px;border-radius:12px;padding:9px 11px;background:#fff0ed;color:#9a4038;font-size:10px;font-weight:750}
      @media(max-width:350px){.composer-v3-market-type{grid-template-columns:1fr}}
    `}</style>
  </>;
}
