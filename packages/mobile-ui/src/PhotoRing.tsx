import { useState } from "react";
import { View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { nativeMotion } from "@catera/design-tokens";
import { Rantang } from "./brand/Rantang";
import { PressableScale, useReduced } from "./motion";
import { Text } from "./components";
import { useColors } from "./theme";

/**
 * A remote food photo. It stands on a neutral ground while it loads and fades in over `selection` once it arrives, so
 * a photo never pops in; under reduced motion it appears at once. A photo that fails to load leaves only that ground, the
 * same size, with no broken-image mark. The fade is expo-image's own cross-dissolve, which animates opacity only.
 *
 * The ground (direction K, never sage): a card's photo uses the page neutral `canvas`. A photo with text over it (the
 * plate's hero) passes `ground="photo"` for `photoGround`, the dark neutral under the overlay ink (1.21:1), so a
 * failed photo shows one even slab and no pale band above the overlay (audit 9-24, 9-25).
 */
export function Photo({
  uri,
  style,
  testID,
  ground: groundKind = "neutral",
  headers,
  onFail,
  accessibilityLabel,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  ground?: "neutral" | "photo";
  /** Request headers, for a photo behind the signed-in session (the Sampai proof photo). */
  headers?: Record<string, string>;
  /** Called once when the photo fails to load, so a caller can say so in words next to the ground that remains. */
  onFail?: () => void;
  /** Names the photo for a screen reader (a dish photo that carries its dish name). */
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const reduced = useReduced();
  // Keyed to the uri, so a new photo in the same place gets its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  const ground = { backgroundColor: groundKind === "photo" ? c.photoGround : c.canvas };
  if (failed === uri) return <View testID={testID ?? "photo-ground"} style={[style, ground]} />;
  return (
    <Image
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
      source={headers ? { uri, headers } : { uri }}
      contentFit="cover"
      transition={reduced ? 0 : nativeMotion.selection}
      onError={() => {
        setFailed(uri);
        onFail?.();
      }}
      style={[style, ground] as StyleProp<ImageStyle>}
    />
  );
}

export type PhotoRingKind = "selected" | "lunch" | "dinner" | "none";

const RING = 3;
// The photo sits inside the ring with a thin gap, so the ring reads as a ring and not as a border on the photo.
const GAP = 2;

/**
 * A round photo with a 3dp ring, as in a story row: a Jelajah category, a day's meal, a caterer. The ring is the
 * caller's signal and follows the theme. Direction K keeps forest for selection (rule 3), so only `selected` (the active
 * Jelajah tag) is forest. The meal cue is neutral: `dinner` is the ink ring, `lunch` the quiet control-ring grey, at least
 * 3:1 apart in both themes so the two meals never read as one colour. `none` draws no visible ring.
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
  /** 40 in a list row, 54 in the other-meal row, 60 or 66 in a story row. */
  size: number;
  ring: PhotoRingKind;
  covered?: boolean;
  label?: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const c = useColors();
  const inner = size - (RING + GAP) * 2;
  const ringColor = { selected: c.forest, dinner: c.charcoal, lunch: c.controlRing, none: "transparent" }[ring];

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
        // The disc clips the photo round. A uri of "" (real data for a dish without a photo) has nothing to load, so it
        // is only the neutral ground that a loading or failed photo shows too.
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.canvas, overflow: "hidden" }}>
          {uri ? <Photo uri={uri} style={{ width: inner, height: inner }} /> : null}
        </View>
      )}
    </View>
  );

  // Wide enough that a short label wraps under the ring instead of pushing its neighbours apart.
  const column = { alignItems: "center", gap: 6, width: size + 16 } as const;
  const caption = label ? (
    // forest: selection. The selected tag's label is part of its selection mark (rule 3: ring and label).
    <Text variant={selected ? "label" : "caption"} style={[{ textAlign: "center", lineHeight: 16 }, selected && { color: c.forest }]}>
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
