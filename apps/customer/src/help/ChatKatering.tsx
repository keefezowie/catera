import { Linking } from "react-native";
import { whatsappUrl, type Delivery } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button } from "@catera/mobile-ui";

/** The caterer's verified WhatsApp number, when the customer's read carries one. */
export const catererPhoneOf = (d?: Pick<Delivery, "catererPhone"> | null): string => d?.catererPhone ?? "";

/** Opens WhatsApp with the caterer. Renders nothing while the number is unknown. */
export function ChatKatering({
  phone,
  label,
  variant = "secondary",
}: {
  phone?: string | null;
  label?: string;
  variant?: "secondary" | "text";
}) {
  const { t } = useMobile();
  if (!phone) return null;
  return (
    <Button
      variant={variant}
      label={label ?? t("Chat katering", "Chat caterer")}
      onPress={() => void Linking.openURL(whatsappUrl("", phone)).catch(() => undefined)}
    />
  );
}
