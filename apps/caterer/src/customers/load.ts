import type { SellerCustomersState } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";

/** Pages read at once after the first; enough to stop a large kitchen waiting on one round trip per page. */
const PARALLEL_PAGES = 4;

/**
 * The server pages customers 100 at a time; the list and its counts need all of them. The first page gives the total
 * and the page size, so the rest are read a few at a time instead of one after another, and joined in offset order.
 */
export async function loadAllCustomers(runtime: MobileRuntime, catererId: string): Promise<SellerCustomersState> {
  const first = await runtime.api.sellerCustomers(catererId);
  const size = first.customers.length;
  const end = Math.min(first.total, 5000);
  const offsets: number[] = [];
  if (size) for (let offset = size; offset < end; offset += size) offsets.push(offset);
  const pages: SellerCustomersState["customers"][] = [];
  for (let i = 0; i < offsets.length; i += PARALLEL_PAGES) {
    const batch = await Promise.all(
      offsets
        .slice(i, i + PARALLEL_PAGES)
        .map((offset) => runtime.api.sellerCustomers(catererId, `?offset=${offset}`)),
    );
    pages.push(...batch.map((page) => page.customers));
    // A page that came back empty means the list shrank while it was read: stop where it ends.
    if (batch.some((page) => !page.customers.length)) break;
  }
  return { ...first, customers: [...first.customers, ...pages.flat()] };
}

/** One customer with their deliveries (the list leaves the schedule out). */
export async function loadCustomer(runtime: MobileRuntime, catererId: string, recordId: string) {
  const r = await runtime.api.sellerCustomers(catererId, `?customerRecordId=${encodeURIComponent(recordId)}`);
  return r.customers[0] ?? null;
}
