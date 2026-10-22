import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { PressableScale, Text, useColors, useMood } from "@catera/mobile-ui";
import { useMobile } from "@catera/mobile-core";

const HEIGHT = nativeLayout.control.chip;
const RING = 1.5;
/** A 34 control keeps a 44 touch target through its hit area, like every chip. */
const HIT_SLOP = { top: (nativeLayout.control.icon - HEIGHT) / 2, bottom: (nativeLayout.control.icon - HEIGHT) / 2 };

/**
 * The Siang / Malam segmented chip that opens Jelajah's chip row: a 34 pill track of two tabs, the chosen one in the
 * card colour with a 1.5 forest ring and a forest label (forest marks a selection, never a fill). It is the app's mood,
 * so choosing a meal here is what the Beranda arc and the header tint follow, and the list is filtered to that meal.
 */
export function MealSegment() {
  const { t } = useMobile();
  const c = useColors();
  const { mood, setMood } = useMood();
  const options = [
    { value: "siang", label: t("Siang", "Lunch") },
    { value: "malam", label: t("Malam", "Dinner") },
  ] as const;
  return (
    <View
      testID="meal-segment"
      accessibilityRole="tablist"
      accessibilityLabel={t("Waktu makan", "Meal time")}
      style={{ flexDirection: "row", height: HEIGHT, borderRadius: HEIGHT / 2, backgroundColor: c.sage }}
    >
      {options.map((option) => {
        const selected = option.value === mood;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            // The meal that is already chosen has nothing to confirm.
            haptic={selected ? "none" : "select"}
            hitSlop={HIT_SLOP}
            onPress={() => setMood(option.value)}
            style={{
              minHeight: HEIGHT,
              paddingHorizontal: 16,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: HEIGHT / 2,
              borderCurve: "continuous",
              backgroundColor: selected ? c.surface : "transparent",
              borderWidth: RING,
              borderColor: selected ? c.forest : "transparent",
            }}
          >
            <Text variant="label" style={{ fontSize: 13, color: selected ? c.forest : c.charcoal }}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
