import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { nutrientBounds, nutritionMetrics, packageNutrition, type Locale, type Offer } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Card, Text, themedStyles } from "@catera/mobile-ui";

type Metric = { key: string; label: string; short: string; amount: string; unit: string };

/**
 * The metrics the caterer filled, in the order Kalori, Protein, Karbohidrat, Lemak. A metric left empty is not a value
 * and is left out; zero is a value ("0 g"). Ranges read "580–640".
 */
function filledMetrics(offer: Offer, locale: Locale): Metric[] {
  const id = locale !== "en";
  const names = {
    caloriesKcal: [id ? "Kalori" : "Calories", id ? "Kalori" : "Calories"],
    proteinG: ["Protein", "Protein"],
    carbsG: [id ? "Karbohidrat" : "Carbohydrates", id ? "Karbo" : "Carbs"],
    fatG: [id ? "Lemak" : "Fat", id ? "Lemak" : "Fat"],
  } as const;
  return nutritionMetrics(packageNutrition(offer), locale)
    .filter((m) => m.available)
    .map((m) => {
      // The domain value is "{amount} {unit}"; the tiles set the two apart.
      const split = m.value.lastIndexOf(" ");
      return {
        key: m.key,
        label: names[m.key][0],
        short: names[m.key][1],
        amount: m.value.slice(0, split),
        unit: m.value.slice(split + 1),
      };
    });
}

/** "620 kkal · 32 g protein per porsi" under the package name, only when both calories and protein are filled. */
export function nutritionLine(offer: Offer, locale: Locale): string | null {
  const metrics = filledMetrics(offer, locale);
  const kcal = metrics.find((m) => m.key === "caloriesKcal");
  const protein = metrics.find((m) => m.key === "proteinG");
  if (!kcal || !protein) return null;
  return locale === "en"
    ? `${kcal.amount} ${kcal.unit} · ${protein.amount} g protein per portion`
    : `${kcal.amount} ${kcal.unit} · ${protein.amount} g protein per porsi`;
}

/** "± 620 kkal" on a Jelajah row when calories are filled; a range gives its lower bound. */
export function calorieHint(offer: Offer, locale: Locale): string | null {
  const bounds = nutrientBounds(packageNutrition(offer)?.caloriesKcal);
  if (!bounds) return null;
  return `± ${bounds.min} ${locale === "en" ? "kcal" : "kkal"}`;
}

/**
 * Tile text widths in Plus Jakarta Sans, in em per character: tabular digits and units at the value size, mixed-case
 * words at the 12 point label. An estimate errs wide, so a tight row falls back to fewer columns instead of cutting.
 */
const VALUE_EM = 0.6;
const LABEL_EM = 0.55;
const LABEL_SIZE = 12;
const GAP = 8;
/** Value sizes: the heading step on iOS, one step down for ranges that need it, and Android's compact value. */
const IOS_VALUE = 21;
const IOS_RANGE_VALUE = 17;
const ANDROID_VALUE = 18;

/**
 * "Gizi per porsi": the caterer's estimates as tiles. iOS sets a label over each value, two by two (range values step
 * down to 17 when that keeps the pairs; one column is left for larger text). Android sets four
 * compact tiles in one row, the value over a short label, and falls back to two by two (then one) when the measured
 * row cannot hold every value and label at the current text size, so nothing is ever cut. Nothing renders when no
 * metric is filled.
 */
export function NutritionCard({ offer, os = process.env.EXPO_OS }: { offer: Offer; os?: string }) {
  const { t, locale } = useMobile();
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const metrics = filledMetrics(offer, locale);
  if (!metrics.length) return null;
  const ios = os === "ios";
  const tiles = metrics.map((m) => ({
    ...m,
    // iOS: label over "620 kkal". Android: "620" over "kkal", "32 g" over "Protein".
    value: ios || m.key !== "caloriesKcal" ? `${m.amount} ${m.unit}` : m.amount,
    caption: ios ? m.label : m.key === "caloriesKcal" ? m.unit : m.short,
  }));
  // The widest tile a value size needs at this text size; the row is measured, so the layout follows the real screen.
  const pad = ios ? 12 : 6;
  const need = (valueSize: number) =>
    Math.max(
      ...tiles.map(
        (m) => Math.max(m.value.length * valueSize * VALUE_EM, m.caption.length * LABEL_SIZE * LABEL_EM) * fontScale + pad * 2,
      ),
    );
  const fits = (cols: number, valueSize: number) => !width || cols * need(valueSize) + (cols - 1) * GAP <= width;
  // iOS keeps two by two: ranges ("610–640 kkal") that do not fit at the 21 heading step down once to 17 (the card
  // title's size) before a single column, which is left for larger text. Android keeps its 18 and goes 4, 2, 1.
  const hasRange = metrics.some((m) => m.amount.includes("–"));
  const layouts: [number, number][] = ios
    ? [[2, IOS_VALUE], ...(hasRange ? [[2, IOS_RANGE_VALUE] as [number, number]] : []), [1, IOS_VALUE]]
    : [[4, ANDROID_VALUE], [2, ANDROID_VALUE], [1, ANDROID_VALUE]];
  const [cols, valueSize] = layouts.find(([n, size]) => fits(n, size)) ?? layouts[layouts.length - 1];
  const small = ios && valueSize === IOS_RANGE_VALUE;
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));
  return (
    <Card style={styles.card}>
      <Text variant="heading" style={styles.title}>
        {t("Gizi per porsi", "Nutrition per portion")}
      </Text>
      <View testID="gizi-grid" style={{ gap: GAP }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {rows.map((row, r) => (
          <View key={r} testID="gizi-row" style={styles.row}>
            {row.map((m) => (
              <View
                key={m.key}
                testID="gizi-tile"
                accessible
                accessibilityLabel={`${m.label} ${m.amount} ${m.unit}`}
                style={[styles.tile, !ios && styles.tileCompact]}
              >
                {ios ? (
                  <>
                    <Text variant="label" style={styles.tileLabel}>
                      {m.caption}
                    </Text>
                    <Text variant="heading" style={[styles.value, small && styles.valueRange]}>
                      {m.value}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text variant="heading" style={[styles.value, styles.valueCompact]}>
                      {m.value}
                    </Text>
                    {/* The calorie tile's unit is its label, as on the approved board; the reader hears "Kalori". */}
                    <Text variant="label" style={[styles.tileLabel, styles.centered]}>
                      {m.caption}
                    </Text>
                  </>
                )}
              </View>
            ))}
            {/* A short last row keeps its tiles the width of the rows above. */}
            {Array.from({ length: cols - row.length }, (_, i) => (
              <View key={`gap-${i}`} style={styles.spacer} />
            ))}
          </View>
        ))}
      </View>
      <Text variant="caption" style={styles.caption}>
        {t("Perkiraan dari katering. Bisa berbeda tiap menu.", "The caterer's estimate. It can differ from menu to menu.")}
      </Text>
    </Card>
  );
}

const useStyles = themedStyles((c) => ({
  card: { gap: 12 },
  title: { fontSize: 17, lineHeight: 24 },
  row: { flexDirection: "row", gap: GAP },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: c.sage,
  },
  tileCompact: { paddingVertical: 10, paddingHorizontal: 6, alignItems: "center" },
  spacer: { flex: 1 },
  tileLabel: { color: c.muted, lineHeight: 18 },
  value: { fontSize: IOS_VALUE, lineHeight: 28, fontVariant: ["tabular-nums"] },
  valueRange: { fontSize: IOS_RANGE_VALUE, lineHeight: 24 },
  valueCompact: { fontSize: ANDROID_VALUE, lineHeight: 24, textAlign: "center" },
  centered: { textAlign: "center" },
  caption: { fontSize: 13, lineHeight: 18 },
}));
