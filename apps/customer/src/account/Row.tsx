import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, Text } from "@catera/mobile-ui";

/** One plain list row (52pt tall): a label, an optional value and a chevron when it opens something. */
export function Row({
  label,
  caption,
  value,
  onPress,
  first,
  children,
}: {
  label: string;
  caption?: string;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: "700" }}>{label}</Text>
        {caption ? (
          <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
            {caption}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" style={{ color: colors.charcoal, fontVariant: ["tabular-nums"] }}>
          {value}
        </Text>
      ) : null}
      {children}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, !first && styles.divider]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

/** A small forest heading above a group of rows. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="label" style={{ marginTop: 4 }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
});
