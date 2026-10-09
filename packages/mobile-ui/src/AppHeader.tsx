import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoundButton, Text } from "./components";
import { themedStyles } from "./theme";
import { useTopInsetOwned } from "./TopInset";

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
  const styles = useStyles();
  // The demo strip owns the status-bar inset while it is shown.
  const topOwned = useTopInsetOwned();
  return (
    <View style={[styles.bar, { paddingTop: (topOwned ? 0 : insets.top) + 8 }]}>
      {onBack ? <RoundButton icon={modal ? "close" : "chevron-back"} label={backLabel} onPress={onBack} /> : null}
      <View style={styles.title}>
        <Text variant="heading" numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: c.canvas,
  },
  title: { flex: 1 },
}));
