import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { Button, Text } from "./components";
import { themedStyles, useColors } from "./theme";
import { fonts } from "./type";
import { useT } from "./useT";

/** `HH.MM` on the phone's clock, the way Indonesian screens write a time. */
export function bannerTime(at: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(at.getHours())}.${two(at.getMinutes())}`;
}

/** Offline means NetInfo says so: no connection, or a connection with no internet. Unknown reachability is not offline. */
const isOffline = (state: Pick<NetInfoState, "isConnected" | "isInternetReachable">) =>
  state.isConnected === false || state.isInternetReachable === false;

/**
 * "Tidak ada koneksi": an icon, the title, the time of the data on screen (`lastSeen`, left out when nothing is cached)
 * and "Coba lagi". It reads the phone's connection itself and renders only while NetInfo reports the phone offline, so
 * an online phone never reads "Tidak ada koneksi" (a server failure is a `ReadError` or a `FormError`, which say what
 * failed). Nothing renders until NetInfo has reported once, through its first event or `NetInfo.fetch()`, whichever
 * comes first. Each time the phone goes offline the banner shows and is announced once; each time it comes back the
 * banner hides and `onRetry` runs once.
 *
 * How screens mount it (G8, G9): a screen that shows cached data mounts `<ConnectionBanner lastSeen={…} onRetry={reload} />`
 * unconditionally above that data and lets the banner decide when to appear; it needs no state of its own. A screen
 * with nothing cached shows a `ReadError` when its load fails and mounts the banner without `lastSeen` beside it.
 */
export function ConnectionBanner({ lastSeen, onRetry, os = process.env.EXPO_OS }: { lastSeen?: Date; onRetry: () => void; os?: string }) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  // null until NetInfo has reported once.
  const [offline, setOffline] = useState<boolean | null>(null);
  const retry = useRef(onRetry);
  retry.current = onRetry;
  useEffect(() => {
    let known: boolean | null = null;
    let live = true;
    const apply = (state: NetInfoState) => {
      const next = isOffline(state);
      // Only a return from a reported offline state is a reconnect; the first report never retries.
      if (known === true && !next) retry.current();
      known = next;
      setOffline(next);
    };
    const unsubscribe = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then((state) => {
      // An event that arrived first is newer than this answer.
      if (live && known === null) apply(state);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  const title = t("Tidak ada koneksi", "No connection");
  const line = lastSeen ? t(`Menampilkan data terakhir, ${bannerTime(lastSeen)}`, `Showing data from ${bannerTime(lastSeen)}`) : null;
  // Read through a ref so a re-render with new words does not announce the same episode again.
  const spoken = useRef("");
  spoken.current = line ? `${title}. ${line}` : title;
  useEffect(() => {
    // Android speaks through the live region; iOS has none, so each offline episode is announced once here.
    if (offline && os === "ios") AccessibilityInfo.announceForAccessibility(spoken.current);
  }, [offline, os]);
  if (!offline) return null;
  return (
    <View testID="connection-banner" accessibilityLiveRegion="polite" style={styles.box}>
      <Ionicons
        testID="connection-banner-icon"
        name="cloud-offline-outline"
        size={22}
        color={c.danger}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
      <View style={styles.text}>
        <Text style={{ color: c.danger, fontFamily: fonts.bold }}>{title}</Text>
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
    borderCurve: "continuous",
    padding: 12,
  },
  text: { flex: 1, gap: 2 },
}));
