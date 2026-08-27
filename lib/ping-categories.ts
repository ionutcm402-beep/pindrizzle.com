import type { PingIconName } from "@/components/PingIcon";

export type PingCategoryKey =
  | "alert"
  | "traffic"
  | "lost_found"
  | "free"
  | "help"
  | "deals"
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
  | "Parking"
  | "Events"
  | "Outages"
  | "Other local";

export type DealSource = "spotted" | "business";
export type DealKind = "offer" | "new_in" | "restock" | "clearance" | "limited_time";
export type Radius = 0.5 | 1 | 3 | 5;

export type CategoryDefinition = {
  key: PingCategoryKey;
  label: PingCategoryLabel;
  shortLabel: string;
  icon: PingIconName;
  tone: "urgent" | "warm" | "helpful" | "neutral" | "deal";
  usefulnessWeight: number;
  recommendedExpiryHours: number;
  maxExpiryHours: number;
};

export const CATEGORY_ORDER: PingCategoryKey[] = [
  "alert",
  "traffic",
  "lost_found",
  "free",
  "help",
  "deals",
  "parking",
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

export const EXPIRY_OPTIONS = [6, 12, 24, 48, 72, 168] as const;

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
