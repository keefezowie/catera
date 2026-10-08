import { Pressable, StyleSheet, Text as RNText } from "react-native";
import { colors, fontFor } from "@catera/mobile-ui";

/** The shared Chip is 40pt tall; filters on Jelajah need the full 44pt touch target. */
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      <RNText style={[styles.label, { color: selected ? colors.cream : colors.forest }]}>{label}</RNText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center" },
  on: { backgroundColor: colors.forest },
  off: { borderWidth: 1, borderColor: "#CDD4C4" },
  label: { fontSize: 13, fontFamily: fontFor("700") },
});
