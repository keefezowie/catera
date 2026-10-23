import { View, type ViewStyle } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Photo, PressableScale, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { DecorativeIcon } from "../layout/DecorativeIcon";

/** One grid cell: two columns at every width and text size, so a long name wraps inside its half instead. */
export const DISH_CELL: ViewStyle = { flexBasis: "40%", flexGrow: 1, maxWidth: "50%", minWidth: 0 };

/**
 * A dish the customer can pick on Pilih menu: a 4:3 photo (or, without one, the utensil tile at the same size), the
 * name over up to two lines and the serving under it. The selected card carries a 2dp forest ring and a check on the
 * photo; every card keeps the 2dp edge, clear when unselected, so a selection never moves the grid. `label` is the
 * card's accessible name. `disabled` (the cutoff passed while editing) ignores presses.
 */
export function DishCard({
  id,
  name,
  serving,
  uri,
  label,
  selected,
  disabled = false,
  onPress,
}: {
  id: string;
  name: string;
  serving?: string;
  uri?: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View testID={`dish-cell-${id}`} style={DISH_CELL}>
      <PressableScale
        testID={`dish-card-${id}`}
        haptic="select"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.card, selected && styles.on, disabled && styles.off]}
      >
        <View>
          {uri ? (
            <Photo testID={`dish-photo-${id}`} uri={uri} style={styles.photo} />
          ) : (
            <View testID={`dish-fallback-${id}`} style={[styles.photo, styles.fallback]}>
              <DecorativeIcon name="restaurant-outline" size={28} color={c.controlRing} />
            </View>
          )}
          {selected ? (
            <View testID={`dish-check-${id}`} style={styles.check}>
              <DecorativeIcon name="checkmark" size={16} color={c.cream} />
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {name}
          </Text>
          {serving ? (
            <Text variant="meta" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>
              {serving}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // The ring wraps the whole card; 4 inside it keeps the photo's corners clear of the ring.
  card: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: nativeLayout.radius.control + 4,
    borderCurve: "continuous",
    padding: 4,
  },
  on: { borderColor: c.forest },
  off: { opacity: 0.45 },
  photo: {
    width: "100%",
    aspectRatio: nativeLayout.ratio.tile,
    borderRadius: nativeLayout.radius.control,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  fallback: { backgroundColor: c.fill, alignItems: "center", justifyContent: "center" },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingTop: nativeLayout.space.sm, paddingHorizontal: 2, gap: 2 },
}));
