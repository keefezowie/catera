import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import { Button, Text } from "./components";
import { themedStyles, useColors } from "./theme";
import { useT } from "./useT";

/** `HH.MM` on the phone's clock, the way Indonesian screens write a time. */
export function bannerTime(at: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(at.getHours())}.${two(at.getMinutes())}`;
}

/**
 * Shown by a screen that could not reach the server: an icon, "Tidak ada koneksi", the time of the data on screen
 * (`lastSeen`, left out when nothing is cached) and "Coba lagi". Announced once when it appears. It watches the
 * connection: when the phone comes back online it hides itself and calls `onRetry` once. A phone that was already
 * online (the server is the problem) keeps the banner until "Coba lagi" is pressed.
 */
export function ConnectionBanner({ lastSeen, onRetry }: { lastSeen?: Date; onRetry: () => void }) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  const [visible, setVisible] = useState(true);
  const retry = useRef(onRetry);
  retry.current = onRetry;
  useEffect(() => {
    let wasOffline = false;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        wasOffline = true;
        setVisible(true);
      } else if (state.isConnected === true && wasOffline) {
        wasOffline = false;
        setVisible(false);
        retry.current();
      }
    });
  }, []);
  const title = t("Tidak ada koneksi", "No connection");
  const line = lastSeen ? t(`Menampilkan data terakhir, ${bannerTime(lastSeen)}`, `Showing the last data, ${bannerTime(lastSeen)}`) : null;
  useEffect(() => {
    if (visible && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(line ? `${title}. ${line}` : title);
  }, [visible, title, line]);
  if (!visible) return null;
  return (
    <View testID="connection-banner" accessibilityLiveRegion="polite" style={styles.box}>
      <Ionicons name="cloud-offline-outline" size={22} color={c.danger} />
      <View style={styles.text}>
        <Text style={{ color: c.danger, fontWeight: "700" }}>
          {title}
        </Text>
        {line ? <Text variant="caption">{line}</Text> : null}
      </View>
      <Button variant="text" label={t("Coba lagi", "Try again")} onPress={onRetry} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surface,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  text: { flex: 1, gap: 2 },
}));
