import { View } from "react-native";
import { Image } from "expo-image";
import { nativeLayout, nativeMotion } from "@catera/design-tokens";
import { useColors, useReduced } from "@catera/mobile-ui";

/** expo-image's style type predates `borderCurve`; the native view takes it. */
const imageCurve = { borderCurve: "continuous" } as const;

/**
 * A Dapur photo tile whose image rounds its own corners: 40, 48 or 56, radius 8, a backing while the photo loads (or when
 * it has none). No ancestor clips it, and the card around it must not either (`ListCard clip={false}`): on Android a
 * photo that finishes loading inside an `overflow: hidden` rounded view stayed blank until the screen was reopened, which
 * is why the shared `Thumb` (a clipping tile) is not used for rows whose photos arrive late.
 * `testID` names the tile and the image is `${testID}-image` unless `imageTestID` names it. The image is decorative
 * unless `accessibilityLabel` names it. `backdrop="surface"` is for a tile on a sage card, where a sage backing would vanish.
 */
export function PhotoThumb({
  uri,
  size = 48,
  testID = "photo-thumb",
  imageTestID,
  accessibilityLabel,
  backdrop = "sage",
}: {
  uri?: string | null;
  size?: 40 | 48 | 56;
  testID?: string;
  imageTestID?: string;
  accessibilityLabel?: string;
  backdrop?: "sage" | "surface";
}) {
  const c = useColors();
  const reduced = useReduced();
  const radius = nativeLayout.radius.thumb;
  return (
    <View
      testID={testID}
      style={{ width: size, height: size, borderRadius: radius, borderCurve: "continuous", backgroundColor: backdrop === "surface" ? c.surface : c.sage }}
    >
      {uri ? (
        <Image
          testID={imageTestID ?? `${testID}-image`}
          source={{ uri }}
          contentFit="cover"
          transition={reduced ? 0 : nativeMotion.selection}
          accessible={accessibilityLabel !== undefined}
          accessibilityLabel={accessibilityLabel}
          style={{ width: size, height: size, borderRadius: radius, ...imageCurve }}
        />
      ) : null}
    </View>
  );
}
