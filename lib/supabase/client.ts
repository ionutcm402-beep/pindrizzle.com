import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

type PublishLocationChoice = {
  active: boolean;
  precision: "approximate" | "exact";
  coordinates: { lat: number; lng: number } | null;
};

declare global {
  interface Window {
    __pingLocationPublishChoice?: PublishLocationChoice;
  }
}

let browserClient: SupabaseClient | null = null;

const pingAwareFetch: typeof fetch = async (input, init) => {
  const baseFetch = globalThis.fetch.bind(globalThis);
  if (typeof window === "undefined") return baseFetch(input, init);

  const choice = window.__pingLocationPublishChoice;
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!choice?.active || !url.includes("/rest/v1/rpc/create_ping_v3")) return baseFetch(input, init);

  try {
    let bodyText = typeof init?.body === "string" ? init.body : "";
    if (!bodyText && input instanceof Request) bodyText = await input.clone().text();
    if (!bodyText) return baseFetch(input, init);

    const body = JSON.parse(bodyText) as Record<string, unknown>;
    body.ping_location_precision = choice.precision;
    if (choice.coordinates) {
      body.ping_lat = choice.coordinates.lat;
      body.ping_lng = choice.coordinates.lng;
    }

    const nextUrl = url.replace("/rest/v1/rpc/create_ping_v3", "/rest/v1/rpc/create_ping_v4");
    const nextInit = { ...init, body: JSON.stringify(body) };
    if (input instanceof Request) {
      const nextRequest = new Request(nextUrl, input);
      return baseFetch(nextRequest, nextInit);
    }
    return baseFetch(nextUrl, nextInit);
  } catch (error) {
    console.error("Ping could not prepare the selected location privacy for publishing", error);
    return baseFetch(input, init);
  }
};

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured yet.");
  }

  if (!browserClient) {
    browserClient = createSupabaseClient(url, key, {
      auth: {
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: pingAwareFetch,
      },
    });
  }

  return browserClient;
}
