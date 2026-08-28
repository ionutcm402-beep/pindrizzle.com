import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

type PublishLocationChoice = {
  active: boolean;
  precision: "approximate" | "exact";
  coordinates: { lat: number; lng: number } | null;
};

type LiveDataFailureDetail = {
  reason: "offline" | "timeout" | "network" | "server";
  status?: number;
};

declare global {
  interface Window {
    __pingLocationPublishChoice?: PublishLocationChoice;
    __pindrizzleLiveDataFailure?: LiveDataFailureDetail | null;
  }
}

let browserClient: SupabaseClient | null = null;

const PING_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PING_PHOTO_MAX_BYTES = 6 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const PHOTO_UPLOAD_TIMEOUT_MS = 60_000;
const LIVE_DATA_READ_RPCS = [
  "/rest/v1/rpc/nearby_pings",
  "/rest/v1/rpc/nearby_map_pings",
  "/rest/v1/rpc/search_nearby_pings",
  "/rest/v1/rpc/ping_community_state",
];

function isLiveDataReadRpc(url: string) {
  return LIVE_DATA_READ_RPCS.some((path) => url.includes(path));
}

function announceLiveDataFailure(detail: LiveDataFailureDetail) {
  window.__pindrizzleLiveDataFailure = detail;
  window.dispatchEvent(new CustomEvent("pindrizzle:live-data-failure", { detail }));
}

function announceLiveDataHealthy() {
  window.__pindrizzleLiveDataFailure = null;
  window.dispatchEvent(new Event("pindrizzle:live-data-healthy"));
}

async function fetchWithDeadline(
  baseFetch: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
  url: string,
  method: string,
) {
  const controller = new AbortController();
  const sourceSignal = init?.signal || (input instanceof Request ? input.signal : null);
  const forwardAbort = () => controller.abort();
  const liveReadRpc = isLiveDataReadRpc(url);
  const liveReadGet = method === "GET";
  let timedOut = false;

  if (sourceSignal?.aborted) controller.abort();
  else sourceSignal?.addEventListener("abort", forwardAbort, { once: true });

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await baseFetch(input, { ...init, signal: controller.signal });
    const transientServerFailure = response.status === 408 || response.status === 429 || response.status >= 500;
    if ((!response.ok && liveReadRpc) || (transientServerFailure && (liveReadRpc || liveReadGet))) {
      announceLiveDataFailure({ reason: "server", status: response.status });
    } else if (response.ok && liveReadRpc) {
      announceLiveDataHealthy();
    }
    return response;
  } catch (error) {
    if (!sourceSignal?.aborted && (liveReadRpc || liveReadGet)) {
      announceLiveDataFailure({
        reason: !navigator.onLine ? "offline" : timedOut ? "timeout" : "network",
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    sourceSignal?.removeEventListener("abort", forwardAbort);
  }
}

function timeoutForRequest(url: string, method: string) {
  if ((method === "POST" || method === "PUT") && url.includes("/storage/v1/object/ping-media/")) {
    return PHOTO_UPLOAD_TIMEOUT_MS;
  }
  return DEFAULT_REQUEST_TIMEOUT_MS;
}

async function decodePingPhoto(blob: Blob) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected photo could not be decoded safely."));
      image.src = objectUrl;
    });
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function reencodePingPhoto(blob: Blob) {
  if (!PING_PHOTO_TYPES.has(blob.type)) return blob;

  const decoded = await decodePingPhoto(blob);
  try {
    if (!decoded.width || !decoded.height) throw new Error("The selected photo has invalid dimensions.");
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d", { alpha: blob.type !== "image/jpeg" });
    if (!context) throw new Error("Pindrizzle could not prepare this photo safely.");
    context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);

    const sanitized = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Pindrizzle could not remove photo metadata safely.")),
        blob.type,
        blob.type === "image/png" ? undefined : 0.92,
      );
    });

    if (sanitized.type !== blob.type) throw new Error("This browser cannot safely re-encode that photo format.");
    if (sanitized.size > PING_PHOTO_MAX_BYTES) throw new Error("The privacy-safe photo is larger than 6 MB. Choose a smaller photo.");
    return sanitized;
  } finally {
    decoded.cleanup();
  }
}

async function sanitizePingUploadBody(body: BodyInit | null | undefined) {
  if (body instanceof Blob && PING_PHOTO_TYPES.has(body.type)) {
    return reencodePingPhoto(body);
  }

  if (body instanceof FormData) {
    for (const [key, value] of body.entries()) {
      if (!(value instanceof Blob) || !PING_PHOTO_TYPES.has(value.type)) continue;
      const sanitized = await reencodePingPhoto(value);
      const filename = value instanceof File && value.name ? value.name : "pindrizzle-photo";
      body.set(key, sanitized, filename);
      break;
    }
  }

  return body;
}

function announcePublishedPin(response: Response, choice: PublishLocationChoice) {
  if (response.ok) {
    window.dispatchEvent(new CustomEvent("pindrizzle:pin-published", {
      detail: { precision: choice.precision },
    }));
  }
  return response;
}

const pingAwareFetch: typeof fetch = async (input, init) => {
  const baseFetch = globalThis.fetch.bind(globalThis);
  if (typeof window === "undefined") return baseFetch(input, init);

  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const timeoutMs = timeoutForRequest(url, method);

  if ((method === "POST" || method === "PUT") && url.includes("/storage/v1/object/ping-media/")) {
    const sanitizedBody = await sanitizePingUploadBody(init?.body);
    if (sanitizedBody !== init?.body || sanitizedBody instanceof FormData) {
      return fetchWithDeadline(baseFetch, input, { ...init, body: sanitizedBody }, timeoutMs, url, method);
    }
  }

  const choice = window.__pingLocationPublishChoice;
  if (!choice?.active || !url.includes("/rest/v1/rpc/create_ping_v3")) {
    return fetchWithDeadline(baseFetch, input, init, timeoutMs, url, method);
  }

  let body: Record<string, unknown>;
  try {
    let bodyText = typeof init?.body === "string" ? init.body : "";
    if (!bodyText && input instanceof Request) bodyText = await input.clone().text();
    if (!bodyText) throw new Error("Missing publish request body.");
    body = JSON.parse(bodyText) as Record<string, unknown>;
  } catch (error) {
    console.error("Pindrizzle could not prepare the selected location privacy for publishing", error);
    throw new Error("Pindrizzle could not safely prepare this pin for publishing. Try again.");
  }

  body.ping_location_precision = choice.precision;
  if (choice.coordinates) {
    body.ping_lat = choice.coordinates.lat;
    body.ping_lng = choice.coordinates.lng;
  }

  const nextUrl = url.replace("/rest/v1/rpc/create_ping_v3", "/rest/v1/rpc/create_ping_v4");
  const nextInit = { ...init, body: JSON.stringify(body) };
  const response = input instanceof Request
    ? await fetchWithDeadline(baseFetch, new Request(nextUrl, input), nextInit, timeoutMs, nextUrl, method)
    : await fetchWithDeadline(baseFetch, nextUrl, nextInit, timeoutMs, nextUrl, method);
  return announcePublishedPin(response, choice);
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
