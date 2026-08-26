"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

async function detachLocalPush() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (subscription) await subscription.unsubscribe();
  } catch (error) {
    console.error("Local push cleanup failed", error);
  }
}

export default function Phase16PushSafetyBridge() {
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") void detachLocalPush();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
