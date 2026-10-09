import { View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Button, Text, useColors } from "@catera/mobile-ui";

/** A failed read: the message in the error colour and a way to try again, never a dead end. */
export function ReadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <View style={{ gap: 4, alignItems: "flex-start" }}>
      <Text selectable style={{ color: c.danger }}>{message}</Text>
      <Button variant="text" label={t("Coba lagi", "Try again")} onPress={onRetry} />
    </View>
  );
}
