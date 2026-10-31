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
  "spot-cabai": require("../../../brand/assets/polish/runtime/spot-cabai.webp"),
  "spot-calendar-tote": require("../../../brand/assets/polish/runtime/spot-calendar-tote.webp"),
  "spot-lid-heart": require("../../../brand/assets/polish/runtime/spot-lid-heart.webp"),
  "spot-menu-card-pencil": require("../../../brand/assets/polish/runtime/spot-menu-card-pencil.webp"),
  "spot-nota": require("../../../brand/assets/polish/runtime/spot-nota.webp"),
  "spot-pin-lid": require("../../../brand/assets/polish/runtime/spot-pin-lid.webp"),
  "spot-plate-empty-pencil": require("../../../brand/assets/polish/runtime/spot-plate-empty-pencil.webp"),
  "spot-plate-leaf": require("../../../brand/assets/polish/runtime/spot-plate-leaf.webp"),
  "spot-plate-pause": require("../../../brand/assets/polish/runtime/spot-plate-pause.webp"),
  "spot-rantang": require("../../../brand/assets/polish/runtime/spot-rantang.webp"),
  "spot-rantang-clock": require("../../../brand/assets/polish/runtime/spot-rantang-clock.webp"),
  "spot-rantang-dikemas": require("../../../brand/assets/polish/runtime/spot-rantang-dikemas.webp"),
  "spot-rantang-gift": require("../../../brand/assets/polish/runtime/spot-rantang-gift.webp"),
  "spot-rantang-open": require("../../../brand/assets/polish/runtime/spot-rantang-open.webp"),
  "spot-rantang-sampai": require("../../../brand/assets/polish/runtime/spot-rantang-sampai.webp"),
  "spot-saringan": require("../../../brand/assets/polish/runtime/spot-saringan.webp"),
  "spot-scooter": require("../../../brand/assets/polish/runtime/spot-scooter.webp"),
  "spot-wok": require("../../../brand/assets/polish/runtime/spot-wok.webp"),
  // empty
  "empty-area": require("../../../brand/assets/polish/runtime/empty-area.webp"),
  "empty-kentongan-lid": require("../../../brand/assets/polish/runtime/empty-kentongan-lid.webp"),
  // onboarding
  "plate-ayam": require("../../../brand/assets/polish/runtime/plate-ayam.webp"),
  "plate-daging": require("../../../brand/assets/polish/runtime/plate-daging.webp"),
  "plate-ikan": require("../../../brand/assets/polish/runtime/plate-ikan.webp"),
  "plate-pedas": require("../../../brand/assets/polish/runtime/plate-pedas.webp"),
  "plate-sayur": require("../../../brand/assets/polish/runtime/plate-sayur.webp"),
  "plate-tanpa-santan": require("../../../brand/assets/polish/runtime/plate-tanpa-santan.webp"),
  "primer-area": require("../../../brand/assets/polish/runtime/primer-area.webp"),
  "primer-notifikasi": require("../../../brand/assets/polish/runtime/primer-notifikasi.webp"),
  "welcome-meja": require("../../../brand/assets/polish/runtime/welcome-meja.jpg"),
  // moment
  "moment-langganan-aktif": require("../../../brand/assets/polish/runtime/moment-langganan-aktif.webp"),
  "moment-rantang-meledak": require("../../../brand/assets/polish/runtime/moment-rantang-meledak.webp"),
  // token
  "token-es-teh": require("../../../brand/assets/polish/runtime/token-es-teh.webp"),
  "token-gado-gado": require("../../../brand/assets/polish/runtime/token-gado-gado.webp"),
  "token-nasi-kotak": require("../../../brand/assets/polish/runtime/token-nasi-kotak.webp"),
  "token-pisang-goreng": require("../../../brand/assets/polish/runtime/token-pisang-goreng.webp"),
  "token-sate": require("../../../brand/assets/polish/runtime/token-sate.webp"),
  // category
  "category-kantor": require("../../../brand/assets/polish/runtime/category-kantor.webp"),
  "category-keluarga": require("../../../brand/assets/polish/runtime/category-keluarga.webp"),
  "category-nusantara": require("../../../brand/assets/polish/runtime/category-nusantara.webp"),
  "category-sehat": require("../../../brand/assets/polish/runtime/category-sehat.webp"),
  // compliment
  "compliment-hangat": require("../../../brand/assets/polish/runtime/compliment-hangat.webp"),
  "compliment-porsi-pas": require("../../../brand/assets/polish/runtime/compliment-porsi-pas.webp"),
  "compliment-rumahan": require("../../../brand/assets/polish/runtime/compliment-rumahan.webp"),
  // dapur
  "dapur-kosong": require("../../../brand/assets/polish/runtime/dapur-kosong.webp"),
  "dapur-selesai": require("../../../brand/assets/polish/runtime/dapur-selesai.webp"),
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
