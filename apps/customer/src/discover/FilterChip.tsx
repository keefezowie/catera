import { Text as RNText } from "react-native";
import { fontFor, PressableScale, themedStyles, useColors } from "@catera/mobile-ui";

/** Jelajah filter: a 48dp toggle with the same press feel as the shared Chip. */
export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      <RNText style={[styles.label, { color: selected ? c.cream : c.forest }]}>{label}</RNText>
    </PressableScale>
  );
}

const useStyles = themedStyles((c) => ({
  chip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center" },
  on: { backgroundColor: c.forest },
  off: { borderWidth: 1, borderColor: c.secondaryBorder },
  label: { fontSize: 13, fontFamily: fontFor("700") },
}));
