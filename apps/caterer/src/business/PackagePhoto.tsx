import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { HeroPhotoFrame, heroPhotoInset, Photo } from "@catera/mobile-ui";

/** The radius the image draws for itself: the card radius, every corner. */
const RADIUS = nativeLayout.radius.card;

/**
 * A package's photo at 16:10 across the screen's width (spec 3.6), in a `HeroPhotoFrame`. The frame carries the 1.5
 * inset a hero card's edge needs, and here there is no card, so it is pulled back out by the same 1.5 and the photo
 * runs margin to margin.
 *
 * The image rounds its own four corners (`borderRadius` on the `Photo`, which also paints the neutral ground while it
 * loads and if it fails) and leans on no clipping ancestor for them: a photo that finishes loading after the screen has
 * mounted (the editor's pick, the detail's first paint) inside a rounded `overflow: hidden` parent can stay blank on
 * Android (the Menu dish tile, fixed in 1df68830). The frame still clips its square edge, as it does for Beranda and
 * Paket in the customer app, where expo-image loads inside it without that fault. Without a `uri` the frame holds
 * `children`: the editor's empty tile.
 *
 * `testID` names the frame's photo layer (the 16:10 box); the image is `{testID}-image`.
 */
export function PackagePhoto({ uri, children, testID = "paket-photo" }: { uri?: string; children?: ReactNode; testID?: string }) {
  return (
    <View style={{ margin: -heroPhotoInset.margin }}>
      <HeroPhotoFrame ratio={nativeLayout.ratio.card} testID={testID}>
        {uri ? (
          <Photo testID={`${testID}-image`} uri={uri} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS, borderCurve: "continuous" }]} />
        ) : (
          children
        )}
      </HeroPhotoFrame>
    </View>
  );
}
