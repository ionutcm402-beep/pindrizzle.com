import { access, mkdir, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const holdingRoot = path.join(root, ".capacitor-build-excluded");
const excluded = [
  "app/api",
  "app/moderation",
  "app/ops",
  "app/profile/[id]",
  "app/pwa-icon-192",
  "app/pwa-icon-512",
];
const moved = [];

async function exists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function moveOut(relative) {
  const source = path.join(root, relative);
  if (!(await exists(source))) return;
  const destination = path.join(holdingRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await rename(source, destination);
  moved.push({ source, destination });
}

async function restore() {
  for (const item of [...moved].reverse()) {
    if (!(await exists(item.destination))) continue;
    await mkdir(path.dirname(item.source), { recursive: true });
    await rename(item.destination, item.source);
  }
  await rm(holdingRoot, { recursive: true, force: true });
}

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(executable, ["next", "build"], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        CAPACITOR_BUILD: "1",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Native web export failed with exit code ${code}`))));
  });
}

try {
  await rm(holdingRoot, { recursive: true, force: true });
  for (const relative of excluded) await moveOut(relative);
  await runNextBuild();
} finally {
  await restore();
}
