import { View } from "react-native";
import { Button, Text } from "./components";
import { StateArt } from "./brand/StateArt";
import { useColors } from "./theme";
import { useT } from "./useT";

/**
 * A failed read: the message in the error colour and a way to try again, never a dead end. A read whose failure
 * stands in for the whole page (`art`) leads with the puzzled mascot, centred above the message (spec 7.2); a sheet's
 * failed read stays the compact line.
 */
export function ReadError({ message, onRetry, art = false }: { message: string; onRetry: () => void; art?: boolean }) {
  const t = useT();
  const c = useColors();
  return (
    <View style={{ gap: 4, alignItems: art ? "center" : "flex-start" }}>
      {art ? <StateArt pose="bingung" style={{ marginBottom: 12 }} /> : null}
      <Text selectable style={{ color: c.danger, textAlign: art ? "center" : undefined }}>
        {message}
      </Text>
      <Button variant="text" label={t("Coba lagi", "Try again")} onPress={onRetry} />
    </View>
  );
}
