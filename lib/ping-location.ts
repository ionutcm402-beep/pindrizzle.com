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
  return { state: "granted", coordinates } satisfies PingLocationResult;
}

async function nativePlatformActive() {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function nativePermissionState(): Promise<PermissionState | null> {
  if (!(await nativePlatformActive())) return null;
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.checkPermissions();
    const value = status.location;
    if (value === "granted") return "granted";
    if (value === "denied") return "denied";
    return "prompt";
  } catch {
    return null;
  }
}

async function nativeCurrentPosition(markEnabled: boolean): Promise<PingLocationResult> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    if (markEnabled) {
      const status = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (status.location === "denied") {
        rememberLocationEnabled(false);
        lastGranted = null;
        return { state: "denied", coordinates: null };
      }
      if (status.location !== "granted") return { state: "error", coordinates: null };
    } else {
      const status = await Geolocation.checkPermissions();
      if (status.location === "denied") return { state: "denied", coordinates: null };
      if (status.location !== "granted") return { state: "idle", coordinates: null };
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: POSITION_SAFETY_TIMEOUT_MS,
      maximumAge: POSITION_OPTIONS.maximumAge,
    });
    return rememberCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }, markEnabled);
  } catch (error) {
    const text = error instanceof Error ? error.message.toLowerCase() : "";
    if (text.includes("permission") && (text.includes("denied") || text.includes("not granted"))) {
      rememberLocationEnabled(false);
      lastGranted = null;
      return { state: "denied", coordinates: null };
    }
    return { state: "error", coordinates: null };
  }
}

function browserCurrentPosition(markEnabled: boolean): Promise<PingLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ state: "unavailable", coordinates: null });
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

  const request = (async () => {
    if (await nativePlatformActive()) return nativeCurrentPosition(markEnabled);
    return browserCurrentPosition(markEnabled);
  })();

  inFlightPosition = request;
  void request.finally(() => {
    if (inFlightPosition === request) inFlightPosition = null;
  });
  return request;
}

async function browserPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
  try {
    return await Promise.race([
      navigator.permissions.query({ name: "geolocation" }).then((permission) => permission.state),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PERMISSION_SAFETY_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

async function permissionState(): Promise<PermissionState | null> {
  if (await nativePlatformActive()) return nativePermissionState();
  return browserPermissionState();
}

/**
 * Reuses the current in-memory position during normal Pindrizzle navigation.
 * Exact coordinates are never persisted. In the native app, this checks the
 * operating-system permission without intentionally opening a new prompt.
 */
export async function getPingLocationSilently(): Promise<PingLocationResult> {
  const cached = cachedLocation();
  if (cached) return cached;
  if (typeof window === "undefined") return { state: "unavailable", coordinates: null };

  const state = await permissionState();
  if (state === "granted") return currentPosition(false);
  if (state === "denied") return { state: "denied", coordinates: null };
  if (state === "prompt") return { state: "idle", coordinates: null };

  // Some embedded browser engines do not expose permission state reliably.
  // Only retry silently after the user explicitly enabled Pindrizzle location.
  if (hasRememberedLocationChoice()) return currentPosition(false);
  return { state: "idle", coordinates: null };
}

/** The single explicit Pindrizzle-wide location permission action. */
export async function requestPingLocation(): Promise<PingLocationResult> {
  return currentPosition(true);
}
