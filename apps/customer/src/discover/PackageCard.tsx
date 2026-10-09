import { Image, View } from "react-native";
import { currency, perMealPrice, priceUnitLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { PressableRow, RoundButton, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { cardLine, type CatalogOffer } from "./format";

/**
 * A package as food first: photo, name, price per portion, who cooks and when. The default is the tall photo card;
 * `layout="row"` is the Jelajah list row, a 112 point square photo beside the name, the caterer line and the price.
 */
export function PackageCard({
  offer,
  saved,
  layout,
  onOpen,
  onToggleSaved,
}: {
  offer: CatalogOffer;
  saved: boolean;
  layout?: "row";
  onOpen: () => void;
  onToggleSaved: () => void;
}) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const { unit, note } = priceUnitLabel(offer, locale);
  const row = layout === "row";
  const photoStyle = row ? styles.rowPhoto : styles.photo;
  const price = (
    <>
      <View style={styles.price}>
        <Text variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
          {currency(perMealPrice(offer), locale)}
        </Text>
        <Text variant="caption">{unit}</Text>
      </View>
      {note ? <Text variant="caption">{note}</Text> : null}
    </>
  );
  const line = (
    <Text variant="caption" style={{ fontSize: 13 }}>
      {cardLine(offer, locale)}
    </Text>
  );
  return (
    <View style={row ? styles.rowCard : styles.card}>
      <PressableRow
        accessibilityRole="button"
        accessibilityLabel={`${offer.name}, ${offer.caterer}`}
        onPress={onOpen}
        style={row ? styles.rowPress : undefined}
      >
        {offer.image ? (
          <Image
            testID="package-photo"
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(offer.image, runtime.apiBase) }}
            style={photoStyle}
            resizeMode="cover"
          />
        ) : (
          <View testID="package-photo" style={photoStyle} />
        )}
        <View style={row ? styles.rowBody : styles.body}>
          {/* The heart rides over the top right corner of a row, so its first line stays clear of it. */}
          <Text variant="heading" numberOfLines={row ? undefined : 2} style={row ? { paddingRight: 44 } : undefined}>
            {offer.name}
          </Text>
          {/* A row reads name, who and when, then the price; the tall card keeps its price right under the name. */}
          {row ? line : price}
          {row ? price : line}
          {offer.trialPrice ? (
            <Text variant="label" style={{ color: c.sunriseInk }}>
              {t("Bisa coba 1 hari dulu", "One-day trial available")}
            </Text>
          ) : null}
        </View>
      </PressableRow>
      <RoundButton
        icon={saved ? "heart" : "heart-outline"}
        label={saved ? t(`Hapus ${offer.name} dari simpanan`, `Remove ${offer.name} from saved`) : t(`Simpan ${offer.name}`, `Save ${offer.name}`)}
        selected={saved}
        onPress={onToggleSaved}
        style={{ position: "absolute", top: row ? 4 : 10, right: row ? 4 : 10 }}
      />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  rowCard: {
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  rowPress: { flexDirection: "row", alignItems: "stretch" },
  rowPhoto: { width: 112, height: 112, backgroundColor: c.sage },
  rowBody: { flex: 1, minWidth: 0, padding: 12, gap: 4 },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  photo: { height: 196, width: "100%", backgroundColor: c.sage },
  body: { padding: 14, gap: 4 },
  price: { flexDirection: "row", alignItems: "baseline", gap: 6 },
}));
