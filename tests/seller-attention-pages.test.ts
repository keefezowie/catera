import { expect, it } from "vitest";
import type { SellerAttentionItem } from "@catera/domain";
import { withPageOne } from "../apps/web/src/components/seller-attention";

/** A refresh of page one (a tab coming back, a realtime event) keeps the pages the seller loaded after it. */
const item = (n: number): SellerAttentionItem => ({
  id: "a-" + n,
  kind: "support",
  priority: 1,
  at_time: "2026-10-26T03:00:00.000Z",
  context: "Permintaan " + n,
  href: "/seller/support",
});
const ids = (items: SellerAttentionItem[]) => items.map((i) => i.id);

it("a refreshed page one keeps the later pages, without repeating what moved up", () => {
  const loaded = [1, 2, 3, 4, 5, 6].map(item);
  // Item 2 was handled; item 5 moved up into page one.
  expect(ids(withPageOne(loaded, 4, [1, 3, 4, 5].map(item)))).toEqual(["a-1", "a-3", "a-4", "a-5", "a-6"]);
});

it("with nothing loaded past page one, the refresh is the whole list", () => {
  expect(ids(withPageOne([1, 2].map(item), 2, [3].map(item)))).toEqual(["a-3"]);
});
