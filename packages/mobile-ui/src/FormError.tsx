import { useEffect } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Text } from "./components";
import { themedStyles, useColors } from "./theme";
import { useT } from "./useT";

/**
 * A failure at the action it belongs to: an icon and the words on a `surface` card with a `line` edge, in the danger
 * colour. Never loose small text. Android announces a change through the polite live region; iOS has no live regions,
 * so the message is announced when it appears or changes. `retry` adds "Coba lagi".
 */
export function FormError({ message, retry, testID = "form-error" }: { message: string; retry?: () => void; testID?: string }) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  useEffect(() => {
    if (Platform.OS === "ios" && message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={styles.box}>
      <View style={styles.row}>
        <Ionicons name="alert-circle" size={20} color={c.danger} style={styles.icon} />
        <Text selectable style={{ color: c.danger, flex: 1 }}>
          {message}
        </Text>
      </View>
      {retry ? <Button variant="text" label={t("Coba lagi", "Try again")} onPress={retry} style={styles.retry} /> : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  box: { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  icon: { marginTop: 1 },
  retry: { alignSelf: "flex-start" },
}));
