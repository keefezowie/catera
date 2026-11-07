import { useCallback } from "react";
import { Linking } from "react-native";
import { whatsappUrl, type Delivery } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, useToast } from "@catera/mobile-ui";

/** The caterer's verified WhatsApp number, when the customer's read carries one. */
export const catererPhoneOf = (d?: Pick<Delivery, "catererPhone"> | null): string => d?.catererPhone ?? "";

/** Opens WhatsApp with the caterer's number, the one link of every chat entry; a phone that cannot open it is told so in a toast. */
export function useCatererChat(): (phone: string) => void {
  const { t } = useMobile();
  const toast = useToast();
  return useCallback(
    (phone) =>
      void Linking.openURL(whatsappUrl("", phone)).catch(() =>
        toast.show({ message: t("WhatsApp belum bisa dibuka.", "Couldn't open WhatsApp."), tone: "error" }),
      ),
    [t, toast],
  );
}

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
  const openChat = useCatererChat();
  if (!phone) return null;
  return (
    <Button
      variant={variant}
      label={label ?? t("Chat katering", "Message the caterer")}
      onPress={() => openChat(phone)}
    />
  );
}
