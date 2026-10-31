import { Text as RNText } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { fontFor, PolishArt, PressableScale, useColors, type PolishArtName } from "@catera/mobile-ui";

/** The art inside a 34 chip: 26, so 4 of chip shows around it and the picture still reads at a glance. */
const CHIP_ART = 26;
/** The chip is 34 tall and reaches the 44 target through its hit slop, as every chip in the row does. */
const SLOP = (nativeLayout.control.icon - nativeLayout.control.chip) / 2;

/**
 * A Jelajah category that has canvas art (polish canvas: the category tiles), drawn as a chip in the one chip row with
 * its art leading. The canvas tile row is folded into the chip row so the grid keeps its fold (DESIGN.md: four tiles
 * above the tab bar; a separate 72 tile row pushed the grid about 112 down). A tap filters by the tag, a second clears.
 */
export function ArtChip({
  tag,
  art,
  selected,
  onPress,
}: {
  tag: string;
  art: PolishArtName;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <PressableScale
      testID="category-art-chip"
      accessibilityRole="button"
      accessibilityLabel={t(`Kategori ${tag}`, `Category ${tag}`)}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      hitSlop={{ top: SLOP, bottom: SLOP }}
      style={{
        minHeight: nativeLayout.control.chip,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: 4,
        paddingRight: 14,
        borderRadius: nativeLayout.control.chip / 2,
        // forest: selection — the chosen chip is filled, like the shared Chip (Direction K rule 3).
        backgroundColor: selected ? c.forest : "transparent",
        borderWidth: selected ? 0 : 1,
        borderColor: c.secondaryBorder,
      }}
    >
      <PolishArt name={art} size={CHIP_ART} />
      <RNText style={{ fontFamily: fontFor("700"), fontSize: 13, color: selected ? c.cream : c.charcoal }}>{tag}</RNText>
    </PressableScale>
  );
}
