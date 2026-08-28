const raw = (process.env.CAPACITOR_SERVER_URL || "").trim();

if (!raw) {
  console.error("CAPACITOR_SERVER_URL is required for a native beta build.");
  console.error("Use a stable HTTPS beta deployment such as https://beta.pindrizzle.com.");
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error("CAPACITOR_SERVER_URL must be a valid absolute URL.");
  process.exit(1);
}

if (url.protocol !== "https:") {
  console.error("Native beta builds require an HTTPS CAPACITOR_SERVER_URL.");
  process.exit(1);
}

if (url.searchParams.has("_vercel_share")) {
  console.error("Do not distribute a temporary Vercel share URL in TestFlight or Play Internal Testing.");
  process.exit(1);
}

const host = url.hostname.toLowerCase();
if ((host === "pindrizzle.com" || host === "www.pindrizzle.com") && process.env.ALLOW_NATIVE_PRODUCTION_URL !== "true") {
  console.error("Refusing to wrap the public Pindrizzle production URL for beta testing.");
  console.error("Use a dedicated beta hostname or explicitly set ALLOW_NATIVE_PRODUCTION_URL=true.");
  process.exit(1);
}

if ((host === "localhost" || host === "127.0.0.1") && process.env.ALLOW_NATIVE_LOCAL_URL !== "true") {
  console.error("Localhost is not suitable for distributed TestFlight / Play Internal Testing builds.");
  process.exit(1);
}

console.log(`Native beta target: ${url.origin}`);
console.log("Capacitor app id: com.pindrizzle.app");
