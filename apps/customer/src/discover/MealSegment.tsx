import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { PressableScale, Text, useColors, useMood } from "@catera/mobile-ui";
import { useMobile } from "@catera/mobile-core";

/** The visible track is a 34 chip; its two tabs are 44 tall touch targets, so the hit area is real (a hitSlop never
 * reaches past its parent, and the parent here is the 44 row). */
const TRACK = nativeLayout.control.chip;
const TARGET = nativeLayout.control.icon;
const INSET = 2;
const PILL = TRACK - INSET * 2;
const RING = 1.5;

/**
 * The Siang / Malam segmented chip that opens Jelajah's chip row: a 34 surface track with a 2 inset, holding two 30
 * pills with a sun or moon before the label. The chosen pill has a 1.5 forest ring and a forest 700 label (forest marks a
 * selection, never a fill); the idle one is a 500 label with no ring. It is the app's mood, so choosing a meal here is
 * what the Beranda arc and the header tint follow, and the list is filtered to that meal.
 */
export function MealSegment() {
  const { t } = useMobile();
  const c = useColors();
  const { mood, setMood } = useMood();
  const options = [
    { value: "siang", label: t("Siang", "Lunch"), icon: "sunny" },
    { value: "malam", label: t("Malam", "Dinner"), icon: "moon" },
  ] as const;
  return (
    <View
      testID="meal-segment"
      accessibilityRole="tablist"
      accessibilityLabel={t("Waktu makan", "Meal time")}
      style={{ flexDirection: "row", height: TARGET, alignItems: "center" }}
    >
      <View
        testID="meal-track"
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (TARGET - TRACK) / 2,
          height: TRACK,
          borderRadius: TRACK / 2,
          backgroundColor: c.surface,
        }}
      />
      {options.map((option) => {
        const selected = option.value === mood;
        const ink = selected ? c.forest : c.charcoal;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            // The meal that is already chosen has nothing to confirm.
            haptic={selected ? "none" : "select"}
            onPress={() => setMood(option.value)}
            style={{ minHeight: TARGET, paddingHorizontal: INSET, alignItems: "center", justifyContent: "center" }}
          >
            <View
              testID={`meal-pill-${option.value}`}
              style={{
                height: PILL,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: PILL / 2,
                borderCurve: "continuous",
                borderWidth: RING,
                borderColor: selected ? c.forest : "transparent",
              }}
            >
              <Ionicons name={option.icon} size={14} color={ink} />
              <Text variant="label" style={{ fontSize: 13, fontWeight: selected ? "700" : "500", color: ink }}>
                {option.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
