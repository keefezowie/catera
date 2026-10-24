import { useStackedLayout } from "@catera/mobile-ui";

/** Below this effective width (`width / fontScale`) two side-by-side 50 buttons stack, one full-width line each. */
export const ACTION_PAIR_STACK_BELOW = 400;

/**
 * The one rule for two 50 buttons that would share a row (a customer's WhatsApp and renewal link, Menu's copy and share):
 * under `threshold` effective dp their labels would wrap inside the pill, so they stack. From 400 up they share a row.
 * Antar's pair does not use this: its labels are too long for any row, so it always stacks.
 */
export function useActionPairStacked(threshold: number = ACTION_PAIR_STACK_BELOW): boolean {
  return useStackedLayout(threshold);
}
