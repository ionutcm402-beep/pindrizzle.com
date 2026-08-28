import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type PingLocationState = "idle" | "checking" | "requesting" | "granted" | "denied" | "unavailable" | "error";
export type PingCoordinates = { lat: number; lng: number };
export type PingLocationResult = { state: PingLocationState; coordinates: PingCoordinates | null };

const LOCATION_ENABLED_KEY = "ping-location-enabled";
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000,
};
const POSITION_SAFETY_TIMEOUT_MS = 12000;
const PERMISSION_SAFETY_TIMEOUT_MS = 1500;
const MEMORY_LOCATION_TTL_MS = 2 * 60 * 1000;

let lastGranted: { coordinates: PingCoordinates; at: number } | null = null;
let inFlightPosition: Promise<PingLocationResult> | null = null;

function hasRememberedLocationChoice() {
  try { return localStorage.getItem(LOCATION_ENABLED_KEY) === "true"; } catch { return false; }
}

function rememberLocationEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(LOCATION_ENABLED_KEY, "true");
    else localStorage.removeItem(LOCATION_ENABLED_KEY);
  } catch {}
}

function cachedLocation(): PingLocationResult | null {
  if (!lastGranted) return null;
  if (Date.now() - lastGranted.at > MEMORY_LOCATION_TTL_MS) {
    lastGranted = null;
    return null;
  }
  return { state: "granted", coordinates: lastGranted.coordinates };
}

function rememberCoordinates(coordinates: PingCoordinates, markEnabled: boolean) {
  if (markEnabled) rememberLocationEnabled(true);
  lastGranted = { coordinates, at: Date.now() };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ping:location-changed", { detail: coordinates }));
  return { state: "granted", coordinates } as PingLocationResult;
}

async function nativePermissionState() {
  try {
    const permissions = await Geolocation.checkPermissions();
    const value = String(permissions.location || permissions.coarseLocation || "prompt");
    if (value === "granted") return "granted" as const;
    if (value === "denied") return "denied" as const;
    return "prompt" as const;
  } catch {
    return null;
  }
}

async function nativeCurrentPosition(markEnabled: boolean): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) {
    if (markEnabled) rememberLocationEnabled(true);
    return cached;
  }

  try {
    if (markEnabled) {
      const state = await nativePermissionState();
      if (state !== "granted") {
        const requested = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
        const granted = requested.location === "granted" || requested.coarseLocation === "granted";
        if (!granted) {
          rememberLocationEnabled(false);
          lastGranted = null;
          return { state: "denied", coordinates: null };
        }
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: POSITION_SAFETY_TIMEOUT_MS,
      maximumAge: POSITION_OPTIONS.maximumAge,
    });
    return rememberCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }, markEnabled);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("denied") || message.includes("permission")) {
      rememberLocationEnabled(false);
      lastGranted = null;
      return { state: "denied", coordinates: null };
    }
    return { state: "error", coordinates: null };
  }
}

function browserCurrentPosition(markEnabled: boolean): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) {
    if (markEnabled) rememberLocationEnabled(true);
    return Promise.resolve(cached);
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ state: "error", coordinates: null });
  }

  return new Promise<PingLocationResult>((resolve) => {
    let settled = false;
    const finish = (result: PingLocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve(result);
    };
    const safetyTimer = setTimeout(() => finish({ state: "error", coordinates: null }), POSITION_SAFETY_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => finish(rememberCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }, markEnabled)),
      (error) => {
        if (error.code === 1) {
          rememberLocationEnabled(false);
          lastGranted = null;
        }
        finish({ state: error.code === 1 ? "denied" : "error", coordinates: null });
      },
      POSITION_OPTIONS,
    );
  });
}

function currentPosition(markEnabled: boolean): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) {
    if (markEnabled) rememberLocationEnabled(true);
    return Promise.resolve(cached);
  }
  if (inFlightPosition) return inFlightPosition;

  const request = Capacitor.isNativePlatform() ? nativeCurrentPosition(markEnabled) : browserCurrentPosition(markEnabled);
  inFlightPosition = request;
  void request.finally(() => {
    if (inFlightPosition === request) inFlightPosition = null;
  });
  return request;
}

async function browserPermissionState(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    return await Promise.race([
      navigator.permissions.query({ name: "geolocation" }).then((permission) => permission.state),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PERMISSION_SAFETY_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

/**
 * Reuses the current in-memory position during normal navigation. Exact
 * coordinates are never persisted. A native build checks the OS permission
 * without prompting; the explicit request action is still the only place that
 * may open the system permission dialog.
 */
export async function getPingLocationSilently(): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) return cached;

  if (Capacitor.isNativePlatform()) {
    const state = await nativePermissionState();
    if (state === "granted") return currentPosition(false);
    if (state === "denied") return { state: "denied", coordinates: null };
    return { state: "idle", coordinates: null };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) return { state: "unavailable", coordinates: null };
  const state = await browserPermissionState();
  if (state === "granted") return currentPosition(false);
  if (state === "denied") return { state: "denied", coordinates: null };
  if (state === "prompt") return { state: "idle", coordinates: null };

  if (hasRememberedLocationChoice()) return currentPosition(false);
  return { state: "idle", coordinates: null };
}

/** The single explicit Pindrizzle-wide location permission action. */
export async function requestPingLocation(): Promise<PingLocationResult> {
  return currentPosition(true);
}
