export type PingLocationState = "idle" | "checking" | "requesting" | "granted" | "denied" | "unavailable";
export type PingCoordinates = { lat: number; lng: number };
export type PingLocationResult = { state: PingLocationState; coordinates: PingCoordinates | null };

const LOCATION_ENABLED_KEY = "ping-location-enabled";
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000,
};

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
    return Promise.resolve({ state: "unavailable", coordinates: null });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (markEnabled) rememberLocationEnabled(true);
        const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ping:location-changed", { detail: coordinates }));
        resolve({ state: "granted", coordinates });
      },
      (error) => {
        if (error.code === 1) rememberLocationEnabled(false);
        resolve({ state: error.code === 1 ? "denied" : "unavailable", coordinates: null });
      },
      POSITION_OPTIONS,
    );
  });
}

/**
 * Reuses a location permission that the user has already granted. It never
 * intentionally opens a new browser permission prompt.
 */
export async function getPingLocationSilently(): Promise<PingLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return { state: "unavailable", coordinates: null };

  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") return currentPosition(false);
      if (permission.state === "denied") return { state: "denied", coordinates: null };
      return { state: "idle", coordinates: null };
    } catch {}
  }

  // Safari does not consistently expose geolocation through Permissions API.
  // Only retry there when the user has explicitly enabled Ping location before.
  if (hasRememberedLocationChoice()) return currentPosition(false);
  return { state: "idle", coordinates: null };
}

/** The single explicit Ping-wide location permission action. */
export async function requestPingLocation(): Promise<PingLocationResult> {
  return currentPosition(true);
}
