import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { fontFor, PressableScale, Text, useColors, useMood } from "@catera/mobile-ui";
import { useMobile } from "@catera/mobile-core";
import { SelectionRing } from "../selectionRing";

/** The visible track is a 34 chip; its two tabs are 44 tall touch targets, so the hit area is real (a hitSlop never
 * reaches past its parent, and the parent here is the 44 row). */
const TRACK = nativeLayout.control.chip;
const TARGET = nativeLayout.control.icon;
const INSET = 2;
const PILL = TRACK - INSET * 2;
const RING = 1.5;
/** The room above and below the track inside the 44 row (5), and above and below a pill inside its tab (7). */
const TRACK_SLOP = (TARGET - TRACK) / 2;
const PILL_SLOP = (TARGET - PILL) / 2;

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
      style={{ flexDirection: "row", minHeight: TARGET, alignItems: "center" }}
    >
      {/* The track sits 5 inside the row top and bottom: 34 in the 44 row, and as much taller as large text makes the pills. */}
      <View testID="meal-track-frame" pointerEvents="none" style={{ position: "absolute", top: TRACK_SLOP, bottom: TRACK_SLOP, left: 0, right: 0 }}>
        <View testID="meal-track" style={{ flex: 1, minHeight: TRACK, borderRadius: TRACK / 2, backgroundColor: c.inputFill }} />
      </View>
      {options.map((option) => {
        const selected = option.value === mood;
        const ink = selected ? c.forest : c.charcoal;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            // Named from the label alone: the glyph has no text, and a name built from the tree would start with a comma.
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            // The meal that is already chosen has nothing to confirm.
            haptic={selected ? "none" : "select"}
            pressFeedback={!selected}
            onPress={() => setMood(option.value)}
            style={{ minHeight: TARGET, paddingHorizontal: INSET, paddingVertical: PILL_SLOP, alignItems: "center", justifyContent: "center" }}
          >
            <View
              testID={`meal-pill-${option.value}`}
              style={{
                minHeight: PILL,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: PILL / 2,
                borderCurve: "continuous",
                // The ring is drawn by SelectionRing over the pill, so it fades instead of snapping; the transparent
                // border keeps the pill the same size whichever meal is chosen.
                borderWidth: RING,
                borderColor: "transparent",
              }}
            >
              <SelectionRing
                testID={`meal-ring-${option.value}`}
                selected={selected}
                radius={PILL / 2}
                fill={c.surface}
                inset={{ x: RING, y: RING }}
              />
              <Ionicons name={option.icon} size={14} color={ink} accessible={false} importantForAccessibility="no" />
              <Text variant="label" style={{ fontSize: 13, fontFamily: fontFor(selected ? "700" : "500"), color: ink }}>
                {option.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
