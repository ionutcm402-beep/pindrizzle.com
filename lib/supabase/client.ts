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

const PING_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PING_PHOTO_MAX_BYTES = 6 * 1024 * 1024;

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

const pingAwareFetch: typeof fetch = async (input, init) => {
  const baseFetch = globalThis.fetch.bind(globalThis);
  if (typeof window === "undefined") return baseFetch(input, init);

  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

  if ((method === "POST" || method === "PUT") && url.includes("/storage/v1/object/ping-media/")) {
    const uploadBody = init?.body instanceof Blob
      ? init.body
      : input instanceof Request
        ? await input.clone().blob()
        : null;

    if (uploadBody && PING_PHOTO_TYPES.has(uploadBody.type)) {
      const sanitizedBody = await reencodePingPhoto(uploadBody);
      if (input instanceof Request) {
        const nextRequest = new Request(input, { body: sanitizedBody });
        return baseFetch(nextRequest, init ? { ...init, body: sanitizedBody } : undefined);
      }
      return baseFetch(input, { ...init, body: sanitizedBody });
    }
  }

  const choice = window.__pingLocationPublishChoice;
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
