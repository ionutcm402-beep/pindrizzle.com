import { Capacitor } from "@capacitor/core";

const configuredOrigin = (process.env.NEXT_PUBLIC_PINDRIZZLE_API_ORIGIN || "").trim().replace(/\/$/, "");

export function pindrizzleApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    if (!configuredOrigin) {
      throw new Error("Pindrizzle native backend origin is not configured.");
    }
    return `${configuredOrigin}${normalizedPath}`;
  }
  return normalizedPath;
}

export function nativeBackendConfigured() {
  return Boolean(configuredOrigin);
}
