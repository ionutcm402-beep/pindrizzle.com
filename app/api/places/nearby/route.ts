import { NextRequest, NextResponse } from "next/server";
import type { NearbyPlace, NearbyPlaceCategory } from "@/lib/nearby-places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RADIUS_METERS = 8047;
const MAX_RESULTS = 500;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type CacheEntry = { expiresAt: number; places: NearbyPlace[] };

const responseCache = new Map<string, CacheEntry>();

function numericParam(value: string | null) {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryFor(tags: Record<string, string>): NearbyPlaceCategory | null {
  if (tags.amenity === "toilets") return "toilets";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.leisure === "park") return "park";
  if (tags.leisure === "playground") return "playground";
  return null;
}

function fallbackName(category: NearbyPlaceCategory) {
  if (category === "toilets") return "Public toilets";
  if (category === "restaurant") return "Restaurant";
  if (category === "park") return "Park";
  return "Playground";
}

function buildQuery(lat: number, lng: number, radiusMeters: number) {
  return `[out:json][timeout:20];
(
  nwr(around:${radiusMeters},${lat},${lng})["amenity"="toilets"];
  nwr(around:${radiusMeters},${lat},${lng})["amenity"="restaurant"];
  nwr(around:${radiusMeters},${lat},${lng})["leisure"="park"];
  nwr(around:${radiusMeters},${lat},${lng})["leisure"="playground"];
);
out center tags;`;
}

function normalizeElements(elements: OverpassElement[], viewerLat: number, viewerLng: number) {
  const seen = new Set<string>();
  const places: NearbyPlace[] = [];

  for (const element of elements) {
    const tags = element.tags || {};
    const category = categoryFor(tags);
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!category || typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (tags.access === "private" || tags.access === "no") continue;

    const name = (tags.name || tags["name:en"] || fallbackName(category)).trim();
    const duplicateKey = `${category}:${name.toLowerCase()}:${Number(lat).toFixed(5)}:${Number(lng).toFixed(5)}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);

    places.push({
      id: `osm-${element.type}-${element.id}`,
      osmType: element.type,
      osmId: element.id,
      category,
      name,
      lat: Number(lat),
      lng: Number(lng),
      distanceMeters: Math.round(haversineMeters(viewerLat, viewerLng, Number(lat), Number(lng))),
    });
  }

  return places.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, MAX_RESULTS);
}

function jsonResponse(places: NearbyPlace[], cacheState: "hit" | "miss") {
  return NextResponse.json(
    { source: "OpenStreetMap via Overpass", cache: cacheState, fetchedAt: new Date().toISOString(), places },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } },
  );
}

export async function GET(request: NextRequest) {
  const latValue = numericParam(request.nextUrl.searchParams.get("lat"));
  const lngValue = numericParam(request.nextUrl.searchParams.get("lng"));
  const radiusValue = numericParam(request.nextUrl.searchParams.get("radius"));
  if (latValue == null || lngValue == null || radiusValue == null
    || latValue < -90 || latValue > 90 || lngValue < -180 || lngValue > 180
    || radiusValue < 100 || radiusValue > MAX_RADIUS_METERS) {
    return NextResponse.json({ error: "Valid lat, lng and radius are required." }, { status: 400 });
  }

  const lat = Number(latValue.toFixed(3));
  const lng = Number(lngValue.toFixed(3));
  const radiusMeters = Math.round(radiusValue);
  const cacheKey = `${lat}:${lng}:${radiusMeters}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return jsonResponse(cached.places, "hit");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Pindrizzle/1.0 (https://pindrizzle.com; nearby places map)",
      },
      body: new URLSearchParams({ data: buildQuery(lat, lng, radiusMeters) }).toString(),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = await response.json() as { elements?: OverpassElement[] };
    const places = normalizeElements(payload.elements || [], lat, lng);
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, places });
    return jsonResponse(places, "miss");
  } catch (error) {
    console.error("Nearby places query failed", error);
    return NextResponse.json({ error: "Nearby public places are temporarily unavailable." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
