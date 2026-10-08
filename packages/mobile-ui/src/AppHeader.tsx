import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, RoundButton, Text } from "./components";

/**
 * The one header for pushed screens: round back (or close, for a modal) button and a one-line heading.
 * `backLabel` is the caller's translated accessibility label ("Kembali" / "Tutup"); this package has no i18n.
 */
export function AppHeader({
  title,
  onBack,
  modal = false,
  backLabel,
}: {
  title: string;
  onBack?: () => void;
  modal?: boolean;
  backLabel: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      {onBack ? <RoundButton icon={modal ? "close" : "chevron-back"} label={backLabel} onPress={onBack} /> : null}
      <View style={styles.title}>
        <Text variant="heading" numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.canvas,
  },
  title: { flex: 1 },
});
