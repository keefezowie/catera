import { Linking } from "react-native";
import { whatsappUrl, type CustomerSubscription, type SellerCustomer } from "@catera/domain";
import type { useMobile } from "@catera/mobile-core";
import { renewalAction } from "./rules";

type Mobile = ReturnType<typeof useMobile>;

/**
 * Prepares the renewal link for one package and opens it in WhatsApp for the customer's number. The customer detail and the
 * list's "Kirim tautan" both send it. Throws what the command throws; the caller words the failure.
 */
export async function sendRenewalLink(
  { command, runtime, t }: Pick<Mobile, "command" | "runtime" | "t">,
  catererId: string,
  c: SellerCustomer,
  s: CustomerSubscription,
) {
  const followup = renewalAction(c) === "followup";
  const result = followup
    ? await command<{ path: string }>("customer.followup", { catererId, subscriptionId: s.id, kind: "prepared" })
    : await command<{ path: string }>("customer.invite", { catererId, customerRecordId: c.id });
  const message = followup
    ? t("Paket kateringmu hampir selesai. Perpanjang di sini:", "Your catering package is nearly finished. Renew here:")
    : t(
        "Paket kateringmu hampir selesai. Buat akun Catera lalu perpanjang di sini:",
        "Your catering package is nearly finished. Create your Catera account and renew here:",
      );
  await Linking.openURL(whatsappUrl(`${message} ${runtime.apiBase}${result.path}`, c.phone!));
}
