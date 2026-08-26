import { createPingPwaIcon } from "@/lib/pwaIcon";

export const dynamic = "force-static";

export function GET() {
  return createPingPwaIcon(192);
}
