import type { SellerCustomersState } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";

/** The server pages customers 100 at a time; the list and its counts need all of them. */
export async function loadAllCustomers(runtime: MobileRuntime, catererId: string): Promise<SellerCustomersState> {
  const first = await runtime.api.sellerCustomers(catererId);
  const customers = [...first.customers];
  while (customers.length < first.total && customers.length < 5000) {
    const next = await runtime.api.sellerCustomers(catererId, `?offset=${customers.length}`);
    if (!next.customers.length) break;
    customers.push(...next.customers);
  }
  return { ...first, customers };
}

/** One customer with their deliveries (the list leaves the schedule out). */
export async function loadCustomer(runtime: MobileRuntime, catererId: string, recordId: string) {
  const r = await runtime.api.sellerCustomers(catererId, `?customerRecordId=${encodeURIComponent(recordId)}`);
  return r.customers[0] ?? null;
}
