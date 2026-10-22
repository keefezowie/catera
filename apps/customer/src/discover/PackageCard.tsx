import { Image, View } from "react-native";
import { currency, perMealPrice, priceUnitLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, SaveHeart, Text, themedStyles } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { type CatalogOffer } from "./format";
import { calorieHint } from "./NutritionCard";

/** "Dapur Contoh" or, when the catalogue carries a distance, "Dapur Contoh, 2,4 km". */
function catererLine(offer: CatalogOffer, locale: string): string {
  if (typeof offer.distanceKm !== "number") return offer.caterer;
  const text = String(Math.round(offer.distanceKm * 10) / 10);
  return `${offer.caterer}, ${locale === "en" ? text : text.replace(".", ",")} km`;
}

/**
 * A package as one tile of the two column grid (Jelajah and Disimpan): a 4:3 photo with the heart in its corner, the
 * name over up to two lines, the caterer, the price per meal, and one meta line with the calorie estimate and the
 * one-day trial when there are any. The tile has no card behind it; the grid sets its width.
 */
export function PackageCard({
  offer,
  saved,
  onOpen,
  onToggleSaved,
  canSave,
}: {
  offer: CatalogOffer;
  saved: boolean;
  /** The tile is the only layout; callers may still name it. */
  layout?: "tile";
  onOpen: () => void;
  onToggleSaved: () => void;
  /** False when a heart press cannot save here (signed out), so it neither pops nor buzzes. Required, so a new caller
   * cannot forget it and pop a heart before the sign-in redirect. */
  canSave: boolean;
}) {
  const { runtime, t, locale } = useMobile();
  const styles = useStyles();
  const { note } = priceUnitLabel(offer, locale);
  const meta = [calorieHint(offer, locale), offer.trialPrice ? t("coba 1 hari", "1-day trial") : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <View testID="package-tile">
      <PressableRow accessibilityRole="button" accessibilityLabel={`${offer.name}, ${offer.caterer}`} onPress={onOpen}>
        {offer.image ? (
          <Image
            testID="package-photo"
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(offer.image, runtime.apiBase) }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View testID="package-photo" style={styles.photo} />
        )}
        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {offer.name}
          </Text>
          <Text variant="meta" numberOfLines={1}>
            {catererLine(offer, locale)}
          </Text>
          <View style={styles.price}>
            <Text variant="bodyStrong" style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {currency(perMealPrice(offer), locale)}
            </Text>
            <Text variant="meta">{t("/ makan", "/ meal")}</Text>
          </View>
          {note ? <Text variant="meta">{note}</Text> : null}
          {meta ? (
            <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
              {meta}
            </Text>
          ) : null}
        </View>
      </PressableRow>
      <SaveHeart
        compact
        saved={saved}
        canSave={canSave}
        label={saved ? t(`Hapus ${offer.name} dari simpanan`, `Remove ${offer.name} from saved`) : t(`Simpan ${offer.name}`, `Save ${offer.name}`)}
        onToggle={onToggleSaved}
        style={{ position: "absolute", top: 2, right: 2 }}
      />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  photo: {
    width: "100%",
    aspectRatio: nativeLayout.ratio.tile,
    borderRadius: nativeLayout.radius.control,
    borderCurve: "continuous",
    backgroundColor: c.sage,
  },
  body: { paddingTop: nativeLayout.space.sm, gap: nativeLayout.space.xs },
  price: { flexDirection: "row", alignItems: "baseline", gap: nativeLayout.space.xs },
}));
