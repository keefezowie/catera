import { Image, View } from "react-native";
import { stillRuntime, type MascotPose, type PhaseFBox } from "../../../brand/phaseF";
import { decorative } from "./decorative";

export type { MascotPose } from "../../../brand/phaseF";

/**
 * The runtime stills: each trimmed to its visible box plus a 3% transparent margin and downscaled so the subject is
 * at most 540px tall (180pt on a 3x screen). Apps never import the 1254px files.
 */
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
 * Where an image sits so that its visible box is exactly `size` tall: the image is drawn `canvas` points tall and
 * `canvasWidth` wide (`aspect` is its width over height, 1 for the square rig canvases), the box's top meets the
 * frame's top and the frame is as wide as the box (width follows height), so only transparent padding falls outside
 * it. Shared by the stills and the rigs so every pose and rig renders at one optical size.
 */
export function mascotArtFrame(box: PhaseFBox, size: number, aspect = 1) {
  const canvas = size / box.h;
  const canvasWidth = canvas * aspect;
  return { width: box.w * canvasWidth, height: size, left: -box.x * canvasWidth, top: -box.y * canvas, canvas, canvasWidth };
}

/**
 * One of the seven delivered mascot stills at one optical size: the pose's visible height equals `size` whatever
 * empty space its canvas carries, and the frame's width follows the pose (most poses are wider than tall, so a square
 * frame would cut the drawing). The same file is shown in the light and the dark theme.
 */
export function MascotArt({ pose, size }: { pose: MascotPose; size: number }) {
  const { box, aspect } = stillRuntime[pose];
  const frame = mascotArtFrame(box, size, aspect);
  return (
    <View testID="mascot-art" {...decorative} style={{ width: frame.width, height: frame.height, overflow: "hidden" }}>
      <Image
        testID="mascot-art-image"
        source={stills[pose]}
        fadeDuration={0}
        // The style carries the crop's true aspect; the file's whole-pixel size can differ from it by under a pixel.
        resizeMode="stretch"
        style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.canvasWidth, height: frame.canvas }}
      />
    </View>
  );
}
