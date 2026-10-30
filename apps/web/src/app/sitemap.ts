import type { MetadataRoute } from "next";
import { rpc } from "@catera/backend";
import type { Offer } from "@catera/domain";
import { publicOrigin } from "@/lib/public-url";

// The catalog changes as caterers publish, so the sitemap is read per request instead of at build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin();
  const entries: MetadataRoute.Sitemap = ["", "/login", "/register"].map((path) => ({
    url: origin + path,
    changeFrequency: path ? "yearly" : "daily",
    priority: path ? 0.3 : 1,
  }));
  let offers: Offer[] = [];
  try {
    offers = (
      await rpc<{ items: Offer[] }>(null, null, "catera_v1_read", {
        resource: "catalog",
        params: { limit: 100 },
      })
    ).items;
  } catch {
    return entries; // Unconfigured or unreachable database: the static routes still index.
  }
  const paths = new Set<string>();
  for (const offer of offers) {
    paths.add("/packages/" + offer.slug);
    paths.add("/caterers/" + offer.catererSlug);
  }
  for (const path of paths)
    entries.push({ url: origin + path, changeFrequency: "weekly", priority: 0.7 });
  return entries;
}
