import { appleAppSiteAssociation } from "@/lib/app-links";

// Read per request so a deployment's env applies without a rebuild. iOS fetches this
// extensionless path and needs application/json, which Response.json sets.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(appleAppSiteAssociation());
}
