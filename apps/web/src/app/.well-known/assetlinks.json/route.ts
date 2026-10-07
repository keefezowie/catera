import { assetLinks } from "@/lib/app-links";

// Read per request so a deployment's env applies without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(assetLinks());
}
