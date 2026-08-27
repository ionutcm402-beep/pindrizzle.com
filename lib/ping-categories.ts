import type { PingIconName } from "@/components/PingIcon";

export type PingCategoryKey =
  | "alert"
  | "traffic"
  | "lost_found"
  | "free"
  | "help"
  | "deals"
  | "marketplace"
  | "parking"
  | "events"
  | "outages"
  | "local";

export type PingCategoryLabel =
  | "Alert"
  | "Traffic"
  | "Lost & Found"
  | "Free"
  | "Help"
  | "Deals"
  | "Marketplace"
  | "Parking"
  | "Events"
  | "Outages"
  | "Other local";

export type DealSource = "spotted" | "business";
export type DealKind = "offer" | "new_in" | "restock" | "clearance" | "limited_time";

// `parking_space` remains a legacy Marketplace type so existing preview data can
// still render safely. New listings expose Parking space under Property instead.
export type MarketplaceType = "property" | "vehicle" | "parking_space";
export type MarketplaceIntent = "sale" | "rent" | "wanted";
export type PropertySubtype =
  | "house"
  | "flat"
  | "room"
  | "land"
  | "warehouse"
  | "commercial"
  | "garage"
  | "parking_space"
  | "business"
  | "other";
export type VehicleSubtype = "car" | "van" | "motorbike" | "bicycle" | "other";
export type MarketplaceSubtype = PropertySubtype | VehicleSubtype;
export type MarketplacePricePeriod = "total" | "month" | "week" | "day" | "hour";
export type Radius = 0.5 | 1 | 3 | 5;

export type CategoryDefinition = {
  key: PingCategoryKey;
  label: PingCategoryLabel;
  shortLabel: string;
  icon: PingIconName;
  tone: "urgent" | "warm" | "helpful" | "neutral" | "deal" | "marketplace";
  usefulnessWeight: number;
  recommendedExpiryHours: number;
  maxExpiryHours: number;
};

// Parking is deliberately no longer a main user-facing category. The legacy
// category definition remains below so historical Parking Pings can still load.
export const CATEGORY_ORDER: PingCategoryKey[] = [
  "alert",
  "traffic",
  "lost_found",
  "free",
  "help",
  "deals",
  "marketplace",
  "events",
  "outages",
  "local",
];

export const CATEGORY_DEFINITIONS: Record<PingCategoryKey, CategoryDefinition> = {
  alert: { key: "alert", label: "Alert", shortLabel: "Alert", icon: "alert", tone: "urgent", usefulnessWeight: 46, recommendedExpiryHours: 6, maxExpiryHours: 24 },
  traffic: { key: "traffic", label: "Traffic", shortLabel: "Traffic", icon: "traffic", tone: "urgent", usefulnessWeight: 42, recommendedExpiryHours: 6, maxExpiryHours: 24 },
  lost_found: { key: "lost_found", label: "Lost & Found", shortLabel: "Lost & Found", icon: "lostFound", tone: "warm", usefulnessWeight: 25, recommendedExpiryHours: 72, maxExpiryHours: 168 },
  free: { key: "free", label: "Free", shortLabel: "Free", icon: "free", tone: "helpful", usefulnessWeight: 18, recommendedExpiryHours: 48, maxExpiryHours: 72 },
  help: { key: "help", label: "Help", shortLabel: "Help", icon: "help", tone: "helpful", usefulnessWeight: 28, recommendedExpiryHours: 24, maxExpiryHours: 72 },
  deals: { key: "deals", label: "Deals", shortLabel: "Deals", icon: "deals", tone: "deal", usefulnessWeight: 26, recommendedExpiryHours: 24, maxExpiryHours: 72 },
  marketplace: { key: "marketplace", label: "Marketplace", shortLabel: "Market", icon: "marketplace", tone: "marketplace", usefulnessWeight: 15, recommendedExpiryHours: 168, maxExpiryHours: 720 },
  parking: { key: "parking", label: "Parking", shortLabel: "Parking", icon: "parking", tone: "neutral", usefulnessWeight: 35, recommendedExpiryHours: 6, maxExpiryHours: 24 },
  events: { key: "events", label: "Events", shortLabel: "Events", icon: "events", tone: "neutral", usefulnessWeight: 20, recommendedExpiryHours: 24, maxExpiryHours: 72 },
  outages: { key: "outages", label: "Outages", shortLabel: "Outages", icon: "outages", tone: "urgent", usefulnessWeight: 40, recommendedExpiryHours: 12, maxExpiryHours: 48 },
  local: { key: "local", label: "Other local", shortLabel: "Other", icon: "local", tone: "neutral", usefulnessWeight: 10, recommendedExpiryHours: 24, maxExpiryHours: 72 },
};

export const DEAL_SOURCE_LABEL: Record<DealSource, string> = {
  spotted: "Deal spotted",
  business: "Business post",
};

export const DEAL_KIND_LABEL: Record<DealKind, string> = {
  offer: "Offer / discount",
  new_in: "New in",
  restock: "New delivery / restock",
  clearance: "Clearance",
  limited_time: "Limited time",
};

export const DEAL_KINDS = Object.keys(DEAL_KIND_LABEL) as DealKind[];

export const MARKETPLACE_TYPE_LABEL: Record<MarketplaceType, string> = {
  property: "Property",
  vehicle: "Vehicles",
  parking_space: "Parking space",
};

export const MARKETPLACE_INTENT_LABEL: Record<MarketplaceIntent, string> = {
  sale: "For sale",
  rent: "For rent",
  wanted: "Wanted",
};

export const PROPERTY_SUBTYPE_LABEL: Record<PropertySubtype, string> = {
  house: "House",
  flat: "Flat",
  room: "Room",
  land: "Land",
  warehouse: "Warehouse",
  commercial: "Commercial space",
  garage: "Garage",
  parking_space: "Parking space",
  business: "Business",
  other: "Other property",
};

export const VEHICLE_SUBTYPE_LABEL: Record<VehicleSubtype, string> = {
  car: "Car",
  van: "Van",
  motorbike: "Motorbike",
  bicycle: "Bicycle",
  other: "Other vehicle",
};

export const MARKETPLACE_PRICE_PERIOD_LABEL: Record<MarketplacePricePeriod, string> = {
  total: "Total price",
  month: "Per month",
  week: "Per week",
  day: "Per day",
  hour: "Per hour",
};

// Only these two groups are offered for new Marketplace posts. Parking space is
// now one of the Property listing types rather than a third Marketplace group.
export const MARKETPLACE_TYPES: MarketplaceType[] = ["property", "vehicle"];
export const MARKETPLACE_INTENTS = Object.keys(MARKETPLACE_INTENT_LABEL) as MarketplaceIntent[];
export const PROPERTY_SUBTYPES = Object.keys(PROPERTY_SUBTYPE_LABEL) as PropertySubtype[];
export const VEHICLE_SUBTYPES = Object.keys(VEHICLE_SUBTYPE_LABEL) as VehicleSubtype[];
export const MARKETPLACE_PRICE_PERIODS = Object.keys(MARKETPLACE_PRICE_PERIOD_LABEL) as MarketplacePricePeriod[];

export function marketplaceSubtypeOptions(type: MarketplaceType): Array<{ value: MarketplaceSubtype; label: string }> {
  if (type === "property") return PROPERTY_SUBTYPES.map((value) => ({ value, label: PROPERTY_SUBTYPE_LABEL[value] }));
  if (type === "vehicle") return VEHICLE_SUBTYPES.map((value) => ({ value, label: VEHICLE_SUBTYPE_LABEL[value] }));
  return [{ value: "parking_space", label: "Parking space" }];
}

export function marketplaceSubtypeLabel(type?: MarketplaceType | null, subtype?: string | null) {
  if (!type || !subtype) return "Marketplace";
  if (type === "property" && subtype in PROPERTY_SUBTYPE_LABEL) return PROPERTY_SUBTYPE_LABEL[subtype as PropertySubtype];
  if (type === "vehicle" && subtype in VEHICLE_SUBTYPE_LABEL) return VEHICLE_SUBTYPE_LABEL[subtype as VehicleSubtype];
  if (type === "parking_space") return "Parking space";
  return MARKETPLACE_TYPE_LABEL[type];
}

export function formatMarketplacePrice(price?: number | null, period?: MarketplacePricePeriod | null, currency = "GBP", compact = false) {
  if (price == null || Number.isNaN(price)) return "Price not stated";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  let amount: string;
  if (compact && price >= 1000000) amount = `${(price / 1000000).toFixed(price >= 10000000 ? 0 : 1).replace(/\.0$/, "")}m`;
  else if (compact && price >= 1000) amount = `${(price / 1000).toFixed(price >= 100000 ? 0 : 1).replace(/\.0$/, "")}k`;
  else amount = new Intl.NumberFormat("en-GB", { maximumFractionDigits: price % 1 === 0 ? 0 : 2 }).format(price);
  const suffix = period === "month" ? "/mo" : period === "week" ? "/wk" : period === "day" ? "/day" : period === "hour" ? "/hr" : "";
  return `${symbol}${amount}${suffix}`;
}

export const EXPIRY_OPTIONS = [6, 12, 24, 48, 72, 168, 336, 720] as const;

export function expiryOptionsForCategory(category: PingCategoryKey) {
  const max = CATEGORY_DEFINITIONS[category].maxExpiryHours;
  return EXPIRY_OPTIONS.filter((hours) => hours <= max);
}

export function categoryLabel(category: PingCategoryKey) {
  return CATEGORY_DEFINITIONS[category]?.label || "Other local";
}

export function isPingCategory(value: string): value is PingCategoryKey {
  return value in CATEGORY_DEFINITIONS;
}

export function usefulnessScore(input: {
  category: PingCategoryKey;
  ageMinutes: number;
  distanceMiles: number;
  confirmations: number;
}) {
  const definition = CATEGORY_DEFINITIONS[input.category];
  const recency = Math.max(0, 32 * (1 - input.ageMinutes / (24 * 60)));
  const proximity = Math.max(0, 24 * (1 - input.distanceMiles / 5));
  const trust = Math.min(18, Math.max(0, input.confirmations) * 3);
  return definition.usefulnessWeight + recency + proximity + trust;
}
