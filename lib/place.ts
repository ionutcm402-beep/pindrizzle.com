export type PlaceLabel = {
  label: string;
  locality?: string | null;
  town?: string | null;
  region?: string | null;
  countryCode?: string | null;
  attribution?: string;
};

export async function resolvePlaceLabel(lat: number, lng: number): Promise<PlaceLabel> {
  try {
    const response = await fetch("/api/location/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
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
