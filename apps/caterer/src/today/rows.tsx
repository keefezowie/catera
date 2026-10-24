import type { ComponentProps, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { PressableRow, PressableScale, Text, useColors, DecorativeIcon } from "@catera/mobile-ui";

/** The Dapur touch target for an icon or a text action. */
export const ACTION = 48;

/**
 * A 48 icon button for a section header's trailing slot (Bagikan, Cetak): the glyph in forest on no ground, so a row of
 * them is a line of marks and not a row of discs. `flush` sets the glyph against the target's end (1 in), so it sits at
 * the card's edge as the board draws it while the whole 48 stays inside its parents: Android delivers a touch only inside
 * every ancestor's bounds, so a target pulled past its parent's edge by a negative margin is dead area there.
 */
export function IconAction({
  icon,
  label,
  onPress,
  flush,
  testID,
}: {
  icon: ComponentProps<typeof DecorativeIcon>["name"];
  label: string;
  onPress: () => void;
  /** Sets the glyph against the end of the target, so it reaches the column's edge without the target leaving it. */
  flush?: boolean;
  testID?: string;
}) {
  const c = useColors();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="tap"
      onPress={onPress}
      style={{
        width: ACTION,
        height: ACTION,
        alignItems: flush ? "flex-end" : "center",
        justifyContent: "center",
        paddingRight: flush ? 1 : 0,
      }}
    >
      <DecorativeIcon name={icon} size={22} color={c.forest} />
    </PressableScale>
  );
}

/**
 * A text action in a section header ("Pilih", "Selesai", "Pilih semua"): forest `bodyStrong`, a 48 target at least 48
 * wide. `flush` ends (or starts) the label on the column's edge by taking that side's padding off the target instead of
 * pulling it past the edge, so the whole target stays inside its parents.
 */
export function TextAction({
  label,
  onPress,
  accessibilityLabel,
  flush,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Which edge of the column the label sits on: its padding on that side is dropped and the label is held against it. */
  flush?: "start" | "end";
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColors();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      haptic="tap"
      onPress={onPress}
      style={[
        {
          minHeight: ACTION,
          minWidth: ACTION,
          paddingLeft: flush === "start" ? 0 : 12,
          paddingRight: flush === "end" ? 0 : 12,
          alignItems: flush === "end" ? "flex-end" : flush === "start" ? "flex-start" : "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {/* forest: action */}
      <Text variant="bodyStrong" style={{ color: c.forest }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * A 48 link row ("Lihat 11 alamat lainnya", "2 hal lainnya"): forest `bodyStrong`, started `inset` in from the card's
 * edge so it lines up with the text column above it, with an optional glyph after the label.
 */
export function LinkRow({
  label,
  onPress,
  inset = 0,
  trailing,
  expanded,
  testID,
}: {
  label: string;
  onPress: () => void;
  inset?: number;
  trailing?: ReactNode;
  /** For a row that opens more in place: whether it is open (a screen reader says so). */
  expanded?: boolean;
  testID?: string;
}) {
  const c = useColors();
  return (
    <PressableRow
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={{ minHeight: ACTION, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: inset }}
    >
      {/* forest: action */}
      <Text variant="bodyStrong" style={{ color: c.forest, flexShrink: 1 }}>
        {label}
      </Text>
      {trailing}
    </PressableRow>
  );
}

/** The Dapur section rhythm, so a screen and its skeleton stand on the same numbers. */
export const SECTION_GAP = 24;
/** A `ListCard` row of the dish list, and of the package list under it. */
export const CHECK_HEIGHT = 56;
export const PACKAGE_HEIGHT = 40;
/** The 48 row the cooked meal folds into once it is out for delivery. */
export const SUMMARY_HEIGHT = 48;
/** A section's heading line, and its 12 gap to the content. */
export const HEADING_LINE = 26;
export const HEADING_GAP = 12;

/** Header actions side by side. No negative margin: a target that leaves its parent's bounds is dead area on Android. */
export function ActionPair({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center" }}>{children}</View>;
}

/** The header's figure strip sits 12 under the date (the band's 4 plus 8) and the compact track 12 under the strip. */
export const FIGURE_TOP = 8;
export const FIGURE_GAP = 12;
/** The footer's caption line keeps this much room (two `meta` lines) with or without words, so the footer never changes height. */
export const CAPTION_RESERVE = 36;
