"use client";

import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { isNativeRuntime } from "@/lib/native-runtime";

function routeNativeAuthUrl(event: URLOpenListenerEvent) {
  let parsed: URL;
  try {
    parsed = new URL(event.url);
  } catch {
    return;
  }

  if (parsed.protocol !== "pindrizzle:") return;
  const target = parsed.hostname === "reset-password" ? "/reset-password" : parsed.hostname === "auth" ? "/" : null;
  if (!target) return;

  const destination = `${window.location.origin}${target}${parsed.search}${parsed.hash}`;
  window.location.assign(destination);
}

export default function NativeRuntimeBridge() {
  useEffect(() => {
    if (!isNativeRuntime()) return;

    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      const urlHandle = await App.addListener("appUrlOpen", routeNativeAuthUrl);
      if (disposed) await urlHandle.remove();
      else handles.push(urlHandle);

      const stateHandle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        window.dispatchEvent(new Event("pindrizzle:native-resume"));
      });
      if (disposed) await stateHandle.remove();
      else handles.push(stateHandle);

      const launch = await App.getLaunchUrl();
      if (!disposed && launch?.url) routeNativeAuthUrl({ url: launch.url });
    })();

    return () => {
      disposed = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, []);

  return null;
}
