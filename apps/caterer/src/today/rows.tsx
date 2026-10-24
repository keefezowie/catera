import type { ComponentProps, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { PressableRow, PressableScale, Text, useColors, DecorativeIcon } from "@catera/mobile-ui";

/** The Dapur touch target for an icon or a text action. */
export const ACTION = 48;

/**
 * A 48 icon button for a section header's trailing slot (Bagikan, Cetak): the glyph in forest on no ground, so a row of
 * them is a line of marks and not a row of discs. The first of two sits 8 from the count; the last passes `edge` (-12) to
 * pull its glyph to the card's edge, as the board draws it.
 */
export function IconAction({
  icon,
  label,
  onPress,
  edge,
  testID,
}: {
  icon: ComponentProps<typeof DecorativeIcon>["name"];
  label: string;
  onPress: () => void;
  /** A negative right margin that pulls the last button's glyph to the edge of the column. */
  edge?: number;
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
      style={{ width: ACTION, height: ACTION, alignItems: "center", justifyContent: "center", marginRight: edge }}
    >
      <DecorativeIcon name={icon} size={22} color={c.forest} />
    </PressableScale>
  );
}

/** A text action in a section header ("Pilih", "Selesai", "Pilih semua"): forest `bodyStrong`, a 48 target. */
export function TextAction({
  label,
  onPress,
  accessibilityLabel,
  edge,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** A negative right margin that pulls the label's end to the card's edge. */
  edge?: number;
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
      style={[{ minHeight: ACTION, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", marginRight: edge }, style]}
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

/** Space a flexible row of icons gets from the view: a plain wrapper used where a header lays two actions side by side. */
export function ActionPair({ children }: { children: ReactNode }) {
  // The count and the first action sit 8 apart (the board's 4 + 4), where `SectionHeader` leaves 12.
  return <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -4 }}>{children}</View>;
}

/** The header's figure strip sits 12 under the date (the band's 4 plus 8) and the compact track 12 under the strip. */
export const FIGURE_TOP = 8;
export const FIGURE_GAP = 12;
/** The footer's caption line keeps this much room (two `meta` lines) with or without words, so the footer never changes height. */
export const CAPTION_RESERVE = 36;
