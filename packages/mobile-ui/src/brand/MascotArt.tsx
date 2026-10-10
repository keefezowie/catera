import { Image, View } from "react-native";
import { visibleBox, type MascotPose, type PhaseFBox } from "../../../brand/phaseF";
import { decorative } from "./decorative";

export type { MascotPose } from "../../../brand/phaseF";

/** The runtime copies (600px downscales of the processed exports). Apps never import the 1254px files. */
const stills: Record<MascotPose, number> = {
  merayakan: require("../../../brand/assets/phase-f/runtime/mascot-merayakan.png"),
  membaca: require("../../../brand/assets/phase-f/runtime/mascot-membaca.png"),
  tidur: require("../../../brand/assets/phase-f/runtime/mascot-tidur.png"),
  bingung: require("../../../brand/assets/phase-f/runtime/mascot-bingung.png"),
  melambai: require("../../../brand/assets/phase-f/runtime/mascot-melambai.png"),
  mencari: require("../../../brand/assets/phase-f/runtime/mascot-mencari.png"),
  memasak: require("../../../brand/assets/phase-f/runtime/mascot-memasak.png"),
};

/**
 * Where a square canvas sits so that its visible box is exactly `size` tall: the canvas is scaled to `canvas` points,
 * the box's top meets the frame's top and the frame is as wide as the box (width follows height), so only transparent
 * padding falls outside it. Shared by the stills and the rigs so every pose and rig renders at one optical size.
 */
export function mascotArtFrame(box: PhaseFBox, size: number) {
  const canvas = size / box.h;
  return { width: box.w * canvas, height: size, left: -box.x * canvas, top: -box.y * canvas, canvas };
}

/**
 * One of the seven delivered mascot stills at one optical size: the pose's visible height equals `size` whatever
 * empty space its canvas carries, and the frame's width follows the pose (most poses are wider than tall, so a square
 * frame would cut the drawing). The same file is shown in the light and the dark theme.
 */
export function MascotArt({ pose, size }: { pose: MascotPose; size: number }) {
  const frame = mascotArtFrame(visibleBox[pose], size);
  return (
    <View testID="mascot-art" {...decorative} style={{ width: frame.width, height: frame.height, overflow: "hidden" }}>
      <Image
        testID="mascot-art-image"
        source={stills[pose]}
        fadeDuration={0}
        style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.canvas, height: frame.canvas }}
      />
    </View>
  );
}
