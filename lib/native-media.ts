import { Capacitor } from "@capacitor/core";

export function isPindrizzleNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export async function pickNativePingPhoto(): Promise<File | null> {
  if (!isPindrizzleNativeApp()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      correctOrientation: true,
      saveToGallery: false,
    });
    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    if (!response.ok) throw new Error("Pindrizzle could not read the selected photo.");
    const blob = await response.blob();
    const format = String(photo.format || "jpeg").toLowerCase();
    const mime = blob.type || (format === "png" ? "image/png" : "image/jpeg");
    if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") {
      throw new Error("Use a JPEG, PNG or WebP image.");
    }
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    return new File([blob], `pindrizzle-photo-${Date.now()}.${extension}`, { type: mime, lastModified: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("cancel") || message.includes("canceled")) return null;
    throw error;
  }
}
