import { Capacitor } from "@capacitor/core";

export type PingLocationState = "idle" | "checking" | "requesting" | "granted" | "denied" | "unavailable" | "error";
export type PingCoordinates = { lat: number; lng: number };
export type PingLocationResult = { state: PingLocationState; coordinates: PingCoordinates | null };

const LOCATION_ENABLED_KEY = "ping-location-enabled";
const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 };
const POSITION_SAFETY_TIMEOUT_MS = 12000;
const PERMISSION_SAFETY_TIMEOUT_MS = 1500;
const MEMORY_LOCATION_TTL_MS = 2 * 60 * 1000;

let lastGranted: { coordinates: PingCoordinates; at: number } | null = null;
let inFlightPosition: Promise<PingLocationResult> | null = null;

function hasRememberedLocationChoice() {
  try { return localStorage.getItem(LOCATION_ENABLED_KEY) === "true"; } catch { return false; }
}
function rememberLocationEnabled(enabled: boolean) {
  try { if (enabled) localStorage.setItem(LOCATION_ENABLED_KEY, "true"); else localStorage.removeItem(LOCATION_ENABLED_KEY); } catch {}
}
function cachedLocation(): PingLocationResult | null {
  if (!lastGranted) return null;
  if (Date.now() - lastGranted.at > MEMORY_LOCATION_TTL_MS) { lastGranted = null; return null; }
  return { state: "granted", coordinates: lastGranted.coordinates };
}
function rememberCoordinates(coordinates: PingCoordinates, markEnabled: boolean) {
  if (markEnabled) rememberLocationEnabled(true);
  lastGranted = { coordinates, at: Date.now() };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ping:location-changed", { detail: coordinates }));
}

async function nativePermissionState(): Promise<PingLocationState> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted" || status.coarseLocation === "granted") return "granted";
    if (status.location === "denied" && status.coarseLocation === "denied") return "denied";
    return "idle";
  } catch {
    return "unavailable";
  }
}

async function nativePosition(markEnabled: boolean): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) { if (markEnabled) rememberLocationEnabled(true); return cached; }
  if (inFlightPosition) return inFlightPosition;

  const request = (async (): Promise<PingLocationResult> => {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      if (markEnabled) {
        const permission = await Geolocation.requestPermissions();
        const granted = permission.location === "granted" || permission.coarseLocation === "granted";
        if (!granted) {
          rememberLocationEnabled(false);
          return { state: permission.location === "denied" && permission.coarseLocation === "denied" ? "denied" : "idle", coordinates: null };
        }
      }
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
      const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
      rememberCoordinates(coordinates, markEnabled);
      return { state: "granted", coordinates };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("denied") || message.includes("permission")) {
        rememberLocationEnabled(false);
        return { state: "denied", coordinates: null };
      }
      return { state: "error", coordinates: null };
    }
  })();

  inFlightPosition = request;
  void request.finally(() => { if (inFlightPosition === request) inFlightPosition = null; });
  return request;
}

function browserPosition(markEnabled: boolean): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) { if (markEnabled) rememberLocationEnabled(true); return Promise.resolve(cached); }
  if (inFlightPosition) return inFlightPosition;
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ state: "error", coordinates: null });

  const request = new Promise<PingLocationResult>((resolve) => {
    let settled = false;
    const finish = (result: PingLocationResult) => { if (settled) return; settled = true; clearTimeout(safetyTimer); resolve(result); };
    const safetyTimer = setTimeout(() => finish({ state: "error", coordinates: null }), POSITION_SAFETY_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
        rememberCoordinates(coordinates, markEnabled);
        finish({ state: "granted", coordinates });
      },
      (error) => {
        if (error.code === 1) { rememberLocationEnabled(false); lastGranted = null; }
        finish({ state: error.code === 1 ? "denied" : "error", coordinates: null });
      },
      POSITION_OPTIONS,
    );
  });
  inFlightPosition = request;
  void request.finally(() => { if (inFlightPosition === request) inFlightPosition = null; });
  return request;
}

async function browserPermissionState(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    return await Promise.race([
      navigator.permissions.query({ name: "geolocation" }).then((permission) => permission.state),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PERMISSION_SAFETY_TIMEOUT_MS)),
    ]);
  } catch { return null; }
}

export async function getPingLocationSilently(): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) return cached;

  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    const state = await nativePermissionState();
    if (state === "granted") return nativePosition(false);
    return { state, coordinates: null };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) return { state: "unavailable", coordinates: null };
  const state = await browserPermissionState();
  if (state === "granted") return browserPosition(false);
  if (state === "denied") return { state: "denied", coordinates: null };
  if (state === "prompt") return { state: "idle", coordinates: null };
  if (hasRememberedLocationChoice()) return browserPosition(false);
  return { state: "idle", coordinates: null };
}

export async function requestPingLocation(): Promise<PingLocationResult> {
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) return nativePosition(true);
  return browserPosition(true);
}
