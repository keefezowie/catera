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
 *
 * `failureKey` tells a repeat apart from a re-render: pass something that changes on every failed attempt (a counter,
 * a timestamp). When it changes, an identical message is announced again on iOS and its text is mounted afresh inside
 * the Android live region, so TalkBack reads it again. Without it, the same message stays silent after the first time.
 */
export function FormError({
  message,
  retry,
  failureKey,
  testID = "form-error",
}: {
  message: string;
  retry?: () => void;
  failureKey?: string | number;
  testID?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  useEffect(() => {
    if (Platform.OS === "ios" && message) AccessibilityInfo.announceForAccessibility(message);
  }, [message, failureKey]);
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={styles.box}>
      <View key={failureKey === undefined ? "once" : `failure-${failureKey}`} style={styles.row}>
        <Ionicons
          testID={`${testID}-icon`}
          name="alert-circle"
          size={20}
          color={c.danger}
          style={styles.icon}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
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
