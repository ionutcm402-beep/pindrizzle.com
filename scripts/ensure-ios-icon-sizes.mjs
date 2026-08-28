import { execFileSync } from "node:child_process";
import { access, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const iconDir = path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const generated1024 = path.join(iconDir, "AppIcon-512@2x.png");
const fallback = path.join(root, "public/pindrizzle-icon-512.png");

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

const source = await exists(generated1024) ? generated1024 : fallback;
if (!(await exists(source))) throw new Error("Existing Pindrizzle icon source was not found.");

const slots = [
  { idiom: "iphone", size: "20x20", scale: "2x", px: 40, filename: "AppIcon-iPhone-20@2x.png" },
  { idiom: "iphone", size: "20x20", scale: "3x", px: 60, filename: "AppIcon-iPhone-20@3x.png" },
  { idiom: "iphone", size: "29x29", scale: "2x", px: 58, filename: "AppIcon-iPhone-29@2x.png" },
  { idiom: "iphone", size: "29x29", scale: "3x", px: 87, filename: "AppIcon-iPhone-29@3x.png" },
  { idiom: "iphone", size: "40x40", scale: "2x", px: 80, filename: "AppIcon-iPhone-40@2x.png" },
  { idiom: "iphone", size: "40x40", scale: "3x", px: 120, filename: "AppIcon-iPhone-40@3x.png" },
  { idiom: "iphone", size: "60x60", scale: "2x", px: 120, filename: "AppIcon-iPhone-60@2x.png" },
  { idiom: "iphone", size: "60x60", scale: "3x", px: 180, filename: "AppIcon-iPhone-60@3x.png" },
  { idiom: "ipad", size: "20x20", scale: "1x", px: 20, filename: "AppIcon-iPad-20@1x.png" },
  { idiom: "ipad", size: "20x20", scale: "2x", px: 40, filename: "AppIcon-iPad-20@2x.png" },
  { idiom: "ipad", size: "29x29", scale: "1x", px: 29, filename: "AppIcon-iPad-29@1x.png" },
  { idiom: "ipad", size: "29x29", scale: "2x", px: 58, filename: "AppIcon-iPad-29@2x.png" },
  { idiom: "ipad", size: "40x40", scale: "1x", px: 40, filename: "AppIcon-iPad-40@1x.png" },
  { idiom: "ipad", size: "40x40", scale: "2x", px: 80, filename: "AppIcon-iPad-40@2x.png" },
  { idiom: "ipad", size: "76x76", scale: "1x", px: 76, filename: "AppIcon-iPad-76@1x.png" },
  { idiom: "ipad", size: "76x76", scale: "2x", px: 152, filename: "AppIcon-iPad-76@2x.png" },
  { idiom: "ipad", size: "83.5x83.5", scale: "2x", px: 167, filename: "AppIcon-iPad-83.5@2x.png" },
  { idiom: "ios-marketing", size: "1024x1024", scale: "1x", px: 1024, filename: "AppIcon-AppStore-1024.png" },
];

for (const name of await readdir(iconDir)) {
  if (/^AppIcon-.*\.png$/i.test(name) && path.join(iconDir, name) !== source) {
    await unlink(path.join(iconDir, name));
  }
}

for (const slot of slots) {
  execFileSync("sips", ["-z", String(slot.px), String(slot.px), source, "--out", path.join(iconDir, slot.filename)], { stdio: "ignore" });
}

const contents = {
  images: slots.map(({ idiom, size, scale, filename }) => ({ idiom, size, scale, filename })),
  info: { author: "xcode", version: 1 },
};
await writeFile(path.join(iconDir, "Contents.json"), `${JSON.stringify(contents, null, 2)}\n`, "utf8");
console.log("Exported required iPhone, iPad and App Store icon sizes from the existing Pindrizzle artwork.");
