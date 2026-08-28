import { pindrizzleApiUrl } from "@/lib/pindrizzle-api";

export type PlaceLabel = {
  label: string;
  locality?: string | null;
  town?: string | null;
  region?: string | null;
  countryCode?: string | null;
  attribution?: string;
};

const PLACE_GRID = 0.004;

function coarseCell(value: number) {
  return Number((Math.floor(value / PLACE_GRID) * PLACE_GRID + PLACE_GRID / 2).toFixed(6));
}

export async function resolvePlaceLabel(lat: number, lng: number): Promise<PlaceLabel> {
  try {
    const response = await fetch(pindrizzleApiUrl("/api/location/place"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only a neighbourhood-scale cell centre leaves the device for place lookup.
      body: JSON.stringify({ lat: coarseCell(lat), lng: coarseCell(lng) }),
    });
    if (!response.ok) return { label: "Nearby" };
    const data = await response.json() as Partial<PlaceLabel>;
    return {
      label: String(data.label || "Nearby").slice(0, 120),
      locality: data.locality || null,
      town: data.town || null,
      region: data.region || null,
      countryCode: data.countryCode || null,
      attribution: data.attribution,
    };
  } catch {
    return { label: "Nearby" };
  }
}
