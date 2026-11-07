import type { PayoutSetup } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { paymentsActive } from "./rules";

/** The read of whether this caterer can take payments (renewals and new customers) through Catera. */
export function usePayments() {
  const { runtime, actor } = useMobile();
  const id = actor?.catererId ?? "";
  return useData(`payments:${id}`, async () => {
    const [ops, setup] = await Promise.all([
      runtime.api.sellerOperations(id),
      // Only the owner may read this: a helper's refusal means "not active", any other failure is unknown.
      runtime.api.request<PayoutSetup>("payout-setup/" + id).catch((e: { code?: string }) => {
        if (e?.code === "FORBIDDEN") return null;
        throw e;
      }),
    ]);
    return paymentsActive(ops.caterer.status, setup);
  });
}

/** The answer alone: null while the read runs or after it failed. */
export const usePaymentsActive = () => usePayments().data;
