import { StyleSheet, Text as RNText } from "react-native";
import { colors, fontFor, PressableScale } from "@catera/mobile-ui";

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
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      <RNText style={[styles.label, { color: selected ? colors.cream : colors.forest }]}>{label}</RNText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center" },
  on: { backgroundColor: colors.forest },
  off: { borderWidth: 1, borderColor: colors.secondaryBorder },
  label: { fontSize: 13, fontFamily: fontFor("700") },
});
