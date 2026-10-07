import type { PayoutSetup } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { paymentsActive } from "./rules";

/** Whether this caterer can take payments (renewals and new customers) through Catera. */
export function usePaymentsActive() {
  const { runtime, actor } = useMobile();
  const id = actor?.catererId ?? "";
  const state = useData(`payments:${id}`, async () => {
    const [ops, setup] = await Promise.all([
      runtime.api.sellerOperations(id),
      runtime.api.request<PayoutSetup>("payout-setup/" + id).catch(() => null),
    ]);
    return paymentsActive(ops.caterer.status, setup);
  });
  return state.data;
}
