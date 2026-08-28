"use client";

import { useEffect } from "react";
import { isPindrizzleNativeApp, pickNativePingPhoto } from "@/lib/native-media";

export default function Phase25NativeMediaBridge() {
  useEffect(() => {
    if (!isPindrizzleNativeApp()) return;
    document.body.dataset.pindrizzleNative = "true";
    let busy = false;

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      const picker = target?.closest<HTMLLabelElement>(".composer-photo-picker");
      if (!picker || busy) return;
      const input = picker.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input || input.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      busy = true;
      try {
        const file = await pickNativePingPhoto();
        if (!file) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        console.error("Native photo picker failed", error);
        window.alert(error instanceof Error ? error.message : "Pindrizzle could not open the camera or photo library.");
      } finally {
        busy = false;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      delete document.body.dataset.pindrizzleNative;
    };
  }, []);

  return null;
}
