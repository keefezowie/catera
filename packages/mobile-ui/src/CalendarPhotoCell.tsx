import { Image, Text as RNText, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "./motion";
import { useMoodColors } from "./mood";
import { useColors } from "./theme";
import { fontFor } from "./type";

export type CalendarCellState = {
  /** The day of the month. */
  day: number;
  /** The meal's photo, or null when that day has no meal at all. */
  uri: string | null;
  /** Whether the caterer has set that day's menu. A meal without one is still a surprise, so its photo stays hidden. */
  menuSet: boolean;
  /** The day also has a dinner. */
  dinnerToo: boolean;
  past: boolean;
  today: boolean;
  selected: boolean;
};

const HEIGHT = 52;
const RADIUS = 12;
const OUTLINE = 2.5;
const BADGE = 18;
const BAR = 4;
// The selection bar lifts clear of the rings: above the selected ring, and above the today ring as well when both show.
const barBottom = (today: boolean) => (today ? 2 * OUTLINE : OUTLINE) + 1;
// The number pill sits on every cell at the height that leaves 2dp of photo above the highest the bar can go, so it does
// not jump when a day is selected.
const PILL_BOTTOM = barBottom(true) + BAR + 2;
const NUMBER_MAX_SCALE = 1.5;
const PILL_MAX_SCALE = 1.15;
// From this font scale up a photo cell gives up the photo: the number no longer fits in its pill over a 52dp photo.
const LARGE_FONT_SCALE = 1.3;

const fill = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

/**
 * One day of the Jadwal calendar, drawn as its meal. A set menu shows the photo with the day in a pill and a moon when
 * dinner is also on; an unset one is a dashed outline with a sun, and a day without a meal is only its number. Sits on
 * a mood surface (the header), so the bare number, the dashed outline and both outlines (today, selected) read the mood
 * palette, which keeps them at 3:1 on every header; the photo, its pill and the moon badge sit on the photo and read
 * the theme. A meal with no photo (`uri` of "") is drawn like the large-font fallback: the number and a dot.
 */
export function CalendarPhotoCell({
  day,
  uri,
  menuSet,
  dinnerToo,
  past,
  today,
  selected,
  onPress,
  accessibilityLabel,
  style,
}: CalendarCellState & {
  onPress: () => void;
  accessibilityLabel: string;
  /** Sizing from the grid that holds the cell (a flex share, a column width). The cell is always 52dp tall. */
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const mood = useMoodColors();
  const { fontScale } = useWindowDimensions();

  // A meal exists when there is a uri; real data also gives "" for a meal without a photo, which is no photo to draw.
  const meal = uri !== null;
  const revealed = meal && menuSet;
  const photo = revealed && uri !== "" ? uri : null;
  const showPhoto = photo !== null && fontScale < LARGE_FONT_SCALE;
  const unset = meal && !menuSet;

  // The cell is a fixed 52dp, so the bare number stops growing at 1.5x: number, gap and dot row then always fit above the
  // selection bar.
  const number = (
    <RNText
      maxFontSizeMultiplier={NUMBER_MAX_SCALE}
      style={{
        color: mood.headerMeta,
        fontFamily: fontFor("700"),
        fontSize: 14,
        lineHeight: 18,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
      }}
    >
      {String(day)}
    </RNText>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={[{ height: HEIGHT, minWidth: 48, borderRadius: RADIUS, borderCurve: "continuous" }, style]}
    >
      {showPhoto ? (
        <>
          <Image
            testID="cell-photo"
            accessibilityIgnoresInvertColors
            source={{ uri: photo }}
            resizeMode="cover"
            // The line colour shows while the photo loads or if it never does.
            style={{ ...fill, borderRadius: RADIUS, backgroundColor: c.line, opacity: past ? 0.5 : 1 }}
          />
          <View
            testID="cell-number-pill"
            style={{
              position: "absolute",
              left: 4,
              bottom: PILL_BOTTOM,
              minHeight: BADGE,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: BADGE / 2,
              justifyContent: "center",
              backgroundColor: past ? c.forest : c.cream,
            }}
          >
            {/* Capped at 1.15x: past that, on a narrow cell, the pill grows into the moon badge before the photo gives way
                (at 1.3). */}
            <RNText
              maxFontSizeMultiplier={PILL_MAX_SCALE}
              style={{
                color: past ? c.cream : c.forest,
                fontFamily: fontFor("700"),
                fontSize: 12,
                lineHeight: 16,
                fontVariant: ["tabular-nums"],
              }}
            >
              {String(day)}
            </RNText>
          </View>
        </>
      ) : (
        // The column ends above the selection bar's zone on every cell (not only a selected one), so the number and the
        // dots sit in the same place whether or not the day is selected, and never under the bar.
        <View
          testID="cell-content"
          style={{ ...fill, alignItems: "center", justifyContent: "center", gap: 3, paddingBottom: barBottom(true) + BAR }}
        >
          {number}
          {revealed ? (
            // Without the photo the dot says there is a meal, and a small moon beside it says dinner too. The corner
            // badge would sit on top of a two-digit number at this size, so it is not drawn here.
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: past ? 0.5 : 1 }}>
              <View
                testID="cell-photo-dot"
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mood.headerMeta }}
              />
              {dinnerToo ? (
                <View testID="cell-moon-dot">
                  <Ionicons name="moon" size={9} color={mood.headerMeta} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {unset ? (
        <>
          <View
            testID="cell-dashed"
            pointerEvents="none"
            style={{
              ...fill,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: mood.markerIdle,
              borderRadius: RADIUS,
              borderCurve: "continuous",
            }}
          />
          <View testID="cell-sun" style={{ position: "absolute", top: 4, right: 4 }}>
            <Ionicons name="sunny" size={12} color={mood.markerIdle} />
          </View>
        </>
      ) : null}

      {showPhoto && dinnerToo ? (
        <View
          testID="cell-moon"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: BADGE,
            height: BADGE,
            borderRadius: BADGE / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.forest,
          }}
        >
          <Ionicons name="moon" size={11} color={c.cream} />
        </View>
      ) : null}

      {today ? (
        <View
          testID="cell-outline-today"
          pointerEvents="none"
          style={{ ...fill, borderWidth: OUTLINE, borderColor: mood.todayRing, borderRadius: RADIUS, borderCurve: "continuous" }}
        />
      ) : null}
      {selected ? (
        <>
          <View
            testID="cell-outline-selected"
            pointerEvents="none"
            style={{
              ...fill,
              // Today's outline keeps the edge, so a selected today shows both: the today ring, then this one inside.
              top: today ? OUTLINE : 0,
              right: today ? OUTLINE : 0,
              bottom: today ? OUTLINE : 0,
              left: today ? OUTLINE : 0,
              borderWidth: OUTLINE,
              borderColor: mood.headerText,
              borderRadius: today ? RADIUS - OUTLINE : RADIUS,
              borderCurve: "continuous",
            }}
          />
          {/* The two rings can sit close in tone on a header, so selection also has a shape: a bar along the bottom edge.
              Today has none. It floats just inside the ring(s), under the number pill with photo between, and inside the
              corner radius. */}
          <View
            testID="cell-selected-bar"
            pointerEvents="none"
            style={{
              position: "absolute",
              left: RADIUS + 2,
              right: RADIUS + 2,
              bottom: barBottom(today),
              height: BAR,
              borderRadius: BAR / 2,
              backgroundColor: mood.headerText,
            }}
          />
        </>
      ) : null}
    </PressableScale>
  );
}
