import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/public-url";

/** Crawlers index the public catalog; account, workspace, payment and API routes stay out of search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dev/",
        "/return/",
        "/admin",
        "/seller",
        "/account",
        "/addresses",
        "/calendar",
        "/checkout",
        "/claim",
        "/deliveries",
        "/home",
        "/messages",
        "/notifications",
        "/payment",
        "/renew",
        "/saved",
        "/subscriptions",
        "/support",
      ],
    },
    sitemap: publicOrigin() + "/sitemap.xml",
  };
}
