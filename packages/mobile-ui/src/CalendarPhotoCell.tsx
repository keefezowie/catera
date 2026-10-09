import { Image, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "./motion";
import { Text } from "./components";
import { useMoodColors } from "./mood";
import { useColors } from "./theme";

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

  const number = (
    <Text
      variant="label"
      style={{ color: mood.headerMeta, fontSize: 14, lineHeight: 18, textAlign: "center", fontVariant: ["tabular-nums"] }}
    >
      {String(day)}
    </Text>
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
              bottom: 4,
              minHeight: BADGE,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: BADGE / 2,
              justifyContent: "center",
              backgroundColor: past ? c.forest : c.cream,
            }}
          >
            <Text
              variant="label"
              style={{ color: past ? c.cream : c.forest, fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] }}
            >
              {String(day)}
            </Text>
          </View>
        </>
      ) : (
        <View style={{ ...fill, alignItems: "center", justifyContent: "center", gap: 3 }}>
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
      ) : null}
    </PressableScale>
  );
}
