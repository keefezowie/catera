import { unstable_cache } from "next/cache";
import { demoEnabled, rpc } from "@catera/backend";
import type { Offer } from "@catera/domain";

export const catalogTag = "catalog";

const read = async () =>
  (
    await rpc<{ items: Offer[] }>(null, null, "catera_v1_read", {
      resource: "catalog",
      params: { limit: 100 },
    })
  ).items;

const cached = unstable_cache(read, ["catalog-100"], {
  revalidate: 30,
  tags: [catalogTag],
});

/**
 * The anonymous catalog every public page starts from. It is the same for everyone, so pages share one read for up to
 * 30 seconds; a committed command clears it at once, and checkout re-checks price and capacity on the server. Demo mode
 * reads straight through, so seeded and reset data shows immediately.
 */
export const catalog = () => (demoEnabled() ? read() : cached());
