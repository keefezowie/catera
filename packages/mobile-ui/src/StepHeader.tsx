import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text as RNText, View } from "react-native";
import { themedStyles, useColors } from "./theme";
import { fontFor } from "./type";
import { useT } from "./useT";

/**
 * The head of a stepped sign-up: a 48 back button (none on a first step with no way back) (the platform's back glyph: iOS chevron, Material arrow), a
 * segmented bar with one segment per step (forest up to and including the current step, the line tone after it) and
 * an "n/N" count. The bar is one progressbar for a screen reader, "Langkah n dari N" with its value; the count is
 * hidden from it, since the bar already says it.
 */
export function StepHeader({
  step,
  total,
  onBack,
  backLabel,
  os = process.env.EXPO_OS,
}: {
  step: number;
  total: number;
  /** Leave out on a first step that has nowhere to go back to: the bar then starts at the edge. */
  onBack?: () => void;
  /** The back button's spoken name; "Kembali" by default. */
  backLabel?: string;
  /** The running platform, for tests. */
  os?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  const ios = os === "ios";
  const label = t(`Langkah ${step} dari ${total}`, `Step ${step} of ${total}`);
  return (
    <View style={styles.row}>
      {onBack ? (
      <Pressable
        testID="step-back"
        accessibilityRole="button"
        accessibilityLabel={backLabel ?? t("Kembali", "Back")}
        onPress={onBack}
        android_ripple={{ color: c.line, borderless: true, radius: 24 }}
        style={({ pressed }) => [styles.back, { opacity: ios && pressed ? 0.5 : 1 }]}
      >
        <Ionicons name={ios ? "chevron-back" : "arrow-back"} size={24} color={c.charcoal} />
      </Pressable>
      ) : null}
      <View
        testID="step-bar"
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: total, now: step }}
        style={styles.bar}
      >
        {Array.from({ length: total }, (_, i) => (
          <View key={i} testID={`step-segment-${i + 1}`} style={[styles.segment, { backgroundColor: i < step ? c.forest : c.line }]} />
        ))}
      </View>
      <RNText accessible={false} importantForAccessibility="no" style={styles.count}>
        {`${step}/${total}`}
      </RNText>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 48, height: 48, alignItems: "flex-start", justifyContent: "center" },
  bar: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  count: { fontFamily: fontFor("700"), fontSize: 13, color: c.muted, paddingEnd: 4 },
}));
