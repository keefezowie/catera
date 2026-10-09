import { Image, View } from "react-native";
import { Rantang } from "./brand/Rantang";
import { PressableScale } from "./motion";
import { Text } from "./components";
import { useColors } from "./theme";

const RING = 3;
// The photo sits inside the ring with a thin gap, so the ring reads as a ring and not as a border on the photo.
const GAP = 2;

/**
 * A round photo with a 3dp ring, as in a story row: a Jelajah category, a day's meal, a caterer. The ring colour is the
 * caller's signal (sunrise for what needs a look, forest for what is settled, none for neither) and follows the theme.
 * `covered` swaps the photo for a closed lunchbox. With `onPress` the whole thing, label included, is one 48dp button.
 */
export function PhotoRing({
  uri,
  size,
  ring,
  covered = false,
  label,
  selected = false,
  onPress,
  accessibilityLabel,
}: {
  uri: string;
  size: 60 | 66;
  ring: "sunrise" | "forest" | "none";
  covered?: boolean;
  label?: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const c = useColors();
  const inner = size - (RING + GAP) * 2;
  const ringColor = ring === "sunrise" ? c.sunriseInk : ring === "forest" ? c.forest : "transparent";

  const disc = (
    <View
      testID="photo-ring"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: RING,
        borderColor: ringColor,
        padding: GAP,
      }}
    >
      {covered ? (
        <View
          testID="photo-ring-covered"
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: c.cream,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* A closed lunchbox: what a day shows while the caterer's menu is still a surprise. */}
          <Rantang size={Math.round(inner * 0.52)} color={c.forest} testID="photo-ring-lunchbox" />
        </View>
      ) : (
        // The line colour shows while the photo loads or if it never does. A uri of "" (real data for a dish without a
        // photo) has nothing to load, so it is only this ground and no Image.
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.line, overflow: "hidden" }}>
          {uri ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri }}
              resizeMode="cover"
              style={{ width: inner, height: inner }}
            />
          ) : null}
        </View>
      )}
    </View>
  );

  // Wide enough that a short label wraps under the ring instead of pushing its neighbours apart.
  const column = { alignItems: "center", gap: 6, width: size + 16 } as const;
  const caption = label ? (
    <Text variant={selected ? "label" : "caption"} style={{ textAlign: "center", lineHeight: 16 }}>
      {label}
    </Text>
  ) : null;

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={column}>
        {disc}
        {caption}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={{ ...column, minWidth: 48, minHeight: 48 }}
    >
      {disc}
      {caption}
    </PressableScale>
  );
}
