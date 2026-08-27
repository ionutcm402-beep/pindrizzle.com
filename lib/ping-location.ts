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

function hasRememberedLocationChoice() {
  try { return localStorage.getItem(LOCATION_ENABLED_KEY) === "true"; } catch { return false; }
}

function rememberLocationEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(LOCATION_ENABLED_KEY, "true");
    else localStorage.removeItem(LOCATION_ENABLED_KEY);
  } catch {}
}

function currentPosition(markEnabled: boolean): Promise<PingLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ state: "error", coordinates: null });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PingLocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve(result);
    };
    const safetyTimer = setTimeout(() => {
      finish({ state: "error", coordinates: null });
    }, POSITION_SAFETY_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (markEnabled) rememberLocationEnabled(true);
        const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ping:location-changed", { detail: coordinates }));
        finish({ state: "granted", coordinates });
      },
      (error) => {
        if (error.code === 1) rememberLocationEnabled(false);
        finish({ state: error.code === 1 ? "denied" : "error", coordinates: null });
      },
      POSITION_OPTIONS,
    );
  });
}

async function permissionState(): Promise<PermissionState | null> {
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
 * Reuses a location permission that the user has already granted. It never
 * intentionally opens a new browser permission prompt.
 */
export async function getPingLocationSilently(): Promise<PingLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return { state: "unavailable", coordinates: null };

  const state = await permissionState();
  if (state === "granted") return currentPosition(false);
  if (state === "denied") return { state: "denied", coordinates: null };
  if (state === "prompt") return { state: "idle", coordinates: null };

  // Safari and some embedded browsers do not consistently expose geolocation
  // through Permissions API. Only retry silently after the user explicitly
  // enabled Ping location before.
  if (hasRememberedLocationChoice()) return currentPosition(false);
  return { state: "idle", coordinates: null };
}

/** The single explicit Ping-wide location permission action. */
export async function requestPingLocation(): Promise<PingLocationResult> {
  return currentPosition(true);
}
