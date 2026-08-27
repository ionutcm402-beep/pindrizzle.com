import type { PingCategoryKey, Radius } from "@/lib/ping-categories";
import { isPingCategory } from "@/lib/ping-categories";

export type PingLocalFilter = "all" | PingCategoryKey;

const RADIUS_KEY = "ping-radius";
const CATEGORY_KEY = "ping-category-filter";
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

function announce() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { radius: readPingRadius(), category: readPingCategory() },
  }));
}

export function writePingRadius(radius: Radius) {
  try { localStorage.setItem(RADIUS_KEY, String(radius)); } catch {}
  announce();
}

export function writePingCategory(category: PingLocalFilter) {
  try { localStorage.setItem(CATEGORY_KEY, category); } catch {}
  announce();
}

export function subscribePingLocalPreferences(callback: (value: { radius: Radius; category: PingLocalFilter }) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback({ radius: readPingRadius(), category: readPingCategory() });
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
