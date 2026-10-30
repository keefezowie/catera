import type { StyleProp, ImageStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { decorative } from "./decorative";

/**
 * The polish artwork the apps use, by file stem. Each entry is a runtime derivative written by
 * packages/brand/build-polish-runtime.mjs (sized for 3x screens; see assets/polish/runtime/manifest.json), never a
 * 1254px original. dapur-rak-kosong is superseded by dapur-kosong and is not shipped.
 */
export const POLISH_ART = {
  // spot
  "spot-cabai": require("../../../brand/assets/polish/runtime/spot-cabai.png"),
  "spot-calendar-tote": require("../../../brand/assets/polish/runtime/spot-calendar-tote.png"),
  "spot-lid-heart": require("../../../brand/assets/polish/runtime/spot-lid-heart.png"),
  "spot-menu-card-pencil": require("../../../brand/assets/polish/runtime/spot-menu-card-pencil.png"),
  "spot-nota": require("../../../brand/assets/polish/runtime/spot-nota.png"),
  "spot-pin-lid": require("../../../brand/assets/polish/runtime/spot-pin-lid.png"),
  "spot-plate-empty-pencil": require("../../../brand/assets/polish/runtime/spot-plate-empty-pencil.png"),
  "spot-plate-leaf": require("../../../brand/assets/polish/runtime/spot-plate-leaf.png"),
  "spot-plate-pause": require("../../../brand/assets/polish/runtime/spot-plate-pause.png"),
  "spot-rantang": require("../../../brand/assets/polish/runtime/spot-rantang.png"),
  "spot-rantang-clock": require("../../../brand/assets/polish/runtime/spot-rantang-clock.png"),
  "spot-rantang-dikemas": require("../../../brand/assets/polish/runtime/spot-rantang-dikemas.png"),
  "spot-rantang-gift": require("../../../brand/assets/polish/runtime/spot-rantang-gift.png"),
  "spot-rantang-open": require("../../../brand/assets/polish/runtime/spot-rantang-open.png"),
  "spot-rantang-sampai": require("../../../brand/assets/polish/runtime/spot-rantang-sampai.png"),
  "spot-saringan": require("../../../brand/assets/polish/runtime/spot-saringan.png"),
  "spot-scooter": require("../../../brand/assets/polish/runtime/spot-scooter.png"),
  "spot-wok": require("../../../brand/assets/polish/runtime/spot-wok.png"),
  // empty
  "empty-area": require("../../../brand/assets/polish/runtime/empty-area.png"),
  "empty-kentongan-lid": require("../../../brand/assets/polish/runtime/empty-kentongan-lid.png"),
  // onboarding
  "plate-ayam": require("../../../brand/assets/polish/runtime/plate-ayam.png"),
  "plate-daging": require("../../../brand/assets/polish/runtime/plate-daging.png"),
  "plate-ikan": require("../../../brand/assets/polish/runtime/plate-ikan.png"),
  "plate-pedas": require("../../../brand/assets/polish/runtime/plate-pedas.png"),
  "plate-sayur": require("../../../brand/assets/polish/runtime/plate-sayur.png"),
  "plate-tanpa-santan": require("../../../brand/assets/polish/runtime/plate-tanpa-santan.png"),
  "primer-area": require("../../../brand/assets/polish/runtime/primer-area.png"),
  "primer-notifikasi": require("../../../brand/assets/polish/runtime/primer-notifikasi.png"),
  "welcome-meja": require("../../../brand/assets/polish/runtime/welcome-meja.jpg"),
  // moment
  "moment-langganan-aktif": require("../../../brand/assets/polish/runtime/moment-langganan-aktif.png"),
  "moment-rantang-meledak": require("../../../brand/assets/polish/runtime/moment-rantang-meledak.png"),
  // token
  "token-es-teh": require("../../../brand/assets/polish/runtime/token-es-teh.png"),
  "token-gado-gado": require("../../../brand/assets/polish/runtime/token-gado-gado.png"),
  "token-nasi-kotak": require("../../../brand/assets/polish/runtime/token-nasi-kotak.png"),
  "token-pisang-goreng": require("../../../brand/assets/polish/runtime/token-pisang-goreng.png"),
  "token-sate": require("../../../brand/assets/polish/runtime/token-sate.png"),
  // category
  "category-kantor": require("../../../brand/assets/polish/runtime/category-kantor.png"),
  "category-keluarga": require("../../../brand/assets/polish/runtime/category-keluarga.png"),
  "category-nusantara": require("../../../brand/assets/polish/runtime/category-nusantara.png"),
  "category-sehat": require("../../../brand/assets/polish/runtime/category-sehat.png"),
  // compliment
  "compliment-hangat": require("../../../brand/assets/polish/runtime/compliment-hangat.png"),
  "compliment-porsi-pas": require("../../../brand/assets/polish/runtime/compliment-porsi-pas.png"),
  "compliment-rumahan": require("../../../brand/assets/polish/runtime/compliment-rumahan.png"),
  // dapur
  "dapur-kosong": require("../../../brand/assets/polish/runtime/dapur-kosong.png"),
  "dapur-selesai": require("../../../brand/assets/polish/runtime/dapur-selesai.png"),
} as const satisfies Record<string, number>;

export type PolishArtName = keyof typeof POLISH_ART;

/**
 * One polish artwork. Contained in its box by default (cutouts carry their own transparent margin); welcome-meja, the
 * opaque photo, covers. Decorative unless `accessibilityLabel` is given: the surrounding text carries the meaning.
 * `width`/`height` override `size` (a square side).
 */
export function PolishArt({
  name,
  size,
  width,
  height,
  contentFit,
  style,
  accessibilityLabel,
}: {
  name: PolishArtName;
  size?: number;
  width?: number;
  height?: number;
  contentFit?: ImageContentFit;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}) {
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel, importantForAccessibility: "yes" as const }
    : decorative;
  return (
    <Image
      testID="polish-art"
      source={POLISH_ART[name]}
      contentFit={contentFit ?? (name === "welcome-meja" ? "cover" : "contain")}
      style={[{ width: width ?? size, height: height ?? size }, style]}
      {...a11y}
    />
  );
}
