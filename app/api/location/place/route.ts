import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const GRID = 0.004;
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const NOMINATIM_TIMEOUT_MS = 8000;
let adminClient: SupabaseClient | null | undefined;

type PlaceRequest = { lat?: number; lng?: number };
type NominatimAddress = Record<string, string | undefined>;
type NominatimResult = {
  display_name?: string;
  address?: NominatimAddress;
};

function coarseCell(value: number) {
  return Math.floor(value / GRID) * GRID + GRID / 2;
}

function clean(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 100);
}

function makeLabel(address: NominatimAddress, displayName?: string) {
  const locality = clean(
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.city_district ||
    address.village ||
    address.hamlet,
  );
  const town = clean(address.town || address.city || address.municipality || address.village || address.county);
  const parts = [locality, town].filter((value, index, all) => value && all.indexOf(value) === index);
  if (parts.length) return { locality, town, label: parts.slice(0, 2).join(", ") };

  const fallback = clean(displayName?.split(",").slice(0, 2).join(",")) || "Nearby";
  return { locality: "", town: "", label: fallback };
}

function getAdminClient() {
  if (adminClient !== undefined) return adminClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as PlaceRequest | null;
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Valid coordinates are required." }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ label: "Nearby", source: "fallback" });
    }

    // Only the centre of the same approximate 0.004° privacy cell used by Pindrizzle is sent upstream.
    const centerLat = Number(coarseCell(lat).toFixed(6));
    const centerLng = Number(coarseCell(lng).toFixed(6));
    const gridKey = `${centerLat.toFixed(3)}:${centerLng.toFixed(3)}`;

    const cached = await admin
      .from("place_cells")
      .select("display_label,locality,town,region,country_code,provider,refreshed_at")
      .eq("grid_key", gridKey)
      .maybeSingle();

    if (!cached.error && cached.data) {
      const age = Date.now() - new Date(cached.data.refreshed_at).getTime();
      if (age < CACHE_MS) {
        return NextResponse.json({
          label: cached.data.display_label,
          locality: cached.data.locality,
          town: cached.data.town,
          region: cached.data.region,
          countryCode: cached.data.country_code,
          source: "cache",
          attribution: "© OpenStreetMap contributors",
        });
      }
    }

    const reserved = await admin.rpc("reserve_place_provider_lookup");
    if (reserved.error || reserved.data !== true) {
      return NextResponse.json({ label: cached.data?.display_label || "Nearby", source: "throttled" });
    }

    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(centerLat),
      lon: String(centerLng),
      zoom: "14",
      addressdetails: "1",
      layer: "address",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        "User-Agent": "Pindrizzle/1.0 (+https://pindrizzle.com)",
        "Accept-Language": "en",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json({ label: cached.data?.display_label || "Nearby", source: "fallback" });
    }

    const result = await response.json() as NominatimResult;
    const address = result.address || {};
    const resolved = makeLabel(address, result.display_name);
    const region = clean(address.state || address.region || address.county);
    const countryCode = clean(address.country_code).toLowerCase();

    await admin.from("place_cells").upsert({
      grid_key: gridKey,
      center_lat: centerLat,
      center_lng: centerLng,
      locality: resolved.locality || null,
      town: resolved.town || null,
      region: region || null,
      country_code: countryCode || null,
      display_label: resolved.label,
      provider: "openstreetmap_nominatim",
      refreshed_at: new Date().toISOString(),
    }, { onConflict: "grid_key" });

    return NextResponse.json({
      label: resolved.label,
      locality: resolved.locality || null,
      town: resolved.town || null,
      region: region || null,
      countryCode: countryCode || null,
      source: "openstreetmap_nominatim",
      attribution: "© OpenStreetMap contributors",
    });
  } catch (error) {
    console.error("Place resolution failed", error);
    return NextResponse.json({ label: "Nearby", source: "fallback" });
  }
}
