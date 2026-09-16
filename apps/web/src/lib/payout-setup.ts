import type { PayoutSetup } from "@catera/domain";
import { demoEnabled } from "@catera/backend";
export function enrichPayoutSetup(
  state: PayoutSetup,
  catererId: string,
): PayoutSetup {
  const config = JSON.parse(process.env.CATERA_PAYOUT_RECIPIENTS_JSON || "{}")[
    catererId
  ];
  const account = config?.recipient?.account_details;
  const route = JSON.parse(process.env.CATERA_XENDIT_ROUTING_JSON || "{}")[
    catererId
  ];
  return {
    ...state,
    providerReady:
      !demoEnabled() &&
      !!process.env.XENDIT_SECRET_KEY &&
      !!process.env.XENDIT_BUSINESS_ID &&
      !!process.env.XENDIT_WEBHOOK_TOKEN &&
      !!process.env.CRON_SECRET &&
      process.env.CATERA_CONTROLLED_COLLECTION === "true" &&
      !route?.accountId &&
      !route?.splitRuleId,
    legacyDestination:
      !state.active && config?.purposeCode && account?.account_number
        ? {
            bank: account.routing_value_1 || "Bank",
            holder: account.account_holder_name || "",
            maskedAccount: "•••• " + String(account.account_number).slice(-4),
          }
        : null,
  };
}
