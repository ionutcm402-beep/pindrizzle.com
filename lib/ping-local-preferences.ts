import type { MarketplaceIntent, MarketplaceType, PingCategoryKey, Radius } from "@/lib/ping-categories";
import { isPingCategory, MARKETPLACE_INTENTS, MARKETPLACE_TYPES } from "@/lib/ping-categories";

export type PingLocalFilter = "all" | PingCategoryKey;
export type MarketplaceTypeFilter = "all" | MarketplaceType;
export type MarketplaceIntentFilter = "all" | MarketplaceIntent;
export type PingLocalPreferences = {
  radius: Radius;
  category: PingLocalFilter;
  marketplaceType: MarketplaceTypeFilter;
  marketplaceIntent: MarketplaceIntentFilter;
  marketplaceMaxPrice: number | null;
};

const RADIUS_KEY = "ping-radius";
const CATEGORY_KEY = "ping-category-filter";
const MARKETPLACE_TYPE_KEY = "ping-marketplace-type-filter";
const MARKETPLACE_INTENT_KEY = "ping-marketplace-intent-filter";
const MARKETPLACE_MAX_PRICE_KEY = "ping-marketplace-max-price-filter";
const EVENT_NAME = "ping:local-preferences-changed";
const RADII: Radius[] = [0.5, 1, 3, 5];

export function readPingRadius(): Radius {
  if (typeof window === "undefined") return 1;
  try {
    const value = Number(localStorage.getItem(RADIUS_KEY) || 1);
    return RADII.includes(value as Radius) ? value as Radius : 1;
  } catch {
    return 1;
  }
}

export function readPingCategory(): PingLocalFilter {
  if (typeof window === "undefined") return "all";
  try {
    const value = localStorage.getItem(CATEGORY_KEY) || "all";
    return value === "all" || isPingCategory(value) ? value : "all";
  } catch {
    return "all";
  }
}

export function readMarketplaceType(): MarketplaceTypeFilter {
  if (typeof window === "undefined") return "all";
  try {
    const value = localStorage.getItem(MARKETPLACE_TYPE_KEY) || "all";
    return value === "all" || MARKETPLACE_TYPES.includes(value as MarketplaceType) ? value as MarketplaceTypeFilter : "all";
  } catch {
    return "all";
  }
}

export function readMarketplaceIntent(): MarketplaceIntentFilter {
  if (typeof window === "undefined") return "all";
  try {
    const value = localStorage.getItem(MARKETPLACE_INTENT_KEY) || "all";
    return value === "all" || MARKETPLACE_INTENTS.includes(value as MarketplaceIntent) ? value as MarketplaceIntentFilter : "all";
  } catch {
    return "all";
  }
}

export function readMarketplaceMaxPrice(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MARKETPLACE_MAX_PRICE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

export function readPingLocalPreferences(): PingLocalPreferences {
  return {
    radius: readPingRadius(),
    category: readPingCategory(),
    marketplaceType: readMarketplaceType(),
    marketplaceIntent: readMarketplaceIntent(),
    marketplaceMaxPrice: readMarketplaceMaxPrice(),
  };
}

function announce() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: readPingLocalPreferences() }));
}

export function writePingRadius(radius: Radius) {
  try { localStorage.setItem(RADIUS_KEY, String(radius)); } catch {}
  announce();
}

export function writePingCategory(category: PingLocalFilter) {
  try { localStorage.setItem(CATEGORY_KEY, category); } catch {}
  announce();
}

export function writeMarketplaceType(value: MarketplaceTypeFilter) {
  try { localStorage.setItem(MARKETPLACE_TYPE_KEY, value); } catch {}
  announce();
}

export function writeMarketplaceIntent(value: MarketplaceIntentFilter) {
  try { localStorage.setItem(MARKETPLACE_INTENT_KEY, value); } catch {}
  announce();
}

export function writeMarketplaceMaxPrice(value: number | null) {
  try {
    if (value == null) localStorage.removeItem(MARKETPLACE_MAX_PRICE_KEY);
    else localStorage.setItem(MARKETPLACE_MAX_PRICE_KEY, String(value));
  } catch {}
  announce();
}

export function resetMarketplaceFilters() {
  try {
    localStorage.removeItem(MARKETPLACE_TYPE_KEY);
    localStorage.removeItem(MARKETPLACE_INTENT_KEY);
    localStorage.removeItem(MARKETPLACE_MAX_PRICE_KEY);
  } catch {}
  announce();
}

export function subscribePingLocalPreferences(callback: (value: PingLocalPreferences) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback(readPingLocalPreferences());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
