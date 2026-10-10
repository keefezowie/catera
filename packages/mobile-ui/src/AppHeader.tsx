import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoundButton, Text } from "./components";
import { useMoodColors } from "./mood";
import { useTopInsetOwned } from "./TopInset";

/**
 * Dapur's header for pushed screens until it moves to the native header (`nativeHeaderOptions`); the customer app no
 * longer uses it. Round back (or close, for a modal) button and a heading, on the mood header fill with rounded bottom
 * corners. The button stays on the theme surface. `backLabel` is the caller's translated
 * accessibility label ("Kembali" / "Tutup"); this package has no i18n.
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
  const palette = useMoodColors();
  // The demo strip owns the status-bar inset while it is shown.
  const topOwned = useTopInsetOwned();
  return (
    <View
      testID="app-header"
      style={{
        paddingTop: (topOwned ? 0 : insets.top) + 8,
        paddingBottom: 16,
        backgroundColor: palette.header,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        borderCurve: "continuous",
      }}
    >
      <View
        style={{
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
        }}
      >
        {onBack ? <RoundButton icon={modal ? "close" : "chevron-back"} label={backLabel} onPress={onBack} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="heading" style={{ color: palette.headerText }}>
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}
