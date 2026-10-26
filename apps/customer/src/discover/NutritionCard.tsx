import { StyleSheet, View } from "react-native";
import { nutrientBounds, nutritionMetrics, packageNutrition, type Locale, type Offer } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { fonts, Text, themedStyles, useColors, useStackedLayout, withAlpha, cardEdge, cardEdgeWidth } from "@catera/mobile-ui";

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

/** "± 620 kkal" on a Jelajah row when calories are filled; a range gives its lower bound. */
export function calorieHint(offer: Offer, locale: Locale): string | null {
  const bounds = nutrientBounds(packageNutrition(offer)?.caloriesKcal);
  if (!bounds) return null;
  return `± ${bounds.min} ${locale === "en" ? "kcal" : "kkal"}`;
}

/** Under this effective width (`width / fontScale`) the macro columns stack into lines instead of sharing a row. */
const STACK_BELOW = 340;

/** kkal per gram: protein and carbohydrate 4, fat 9. */
const KCAL_PER_G = { proteinG: 4, carbsG: 4, fatG: 9 } as const;
/** The three forest steps of the energy bar and its dots, protein to fat. */
const STEPS = { proteinG: 1, carbsG: 0.6, fatG: 0.3 } as const;

/**
 * Each macro's share of the energy the three give together, from the middle of each range, rounded to sum to 100.
 * Null unless protein, carbs and fat are all filled: two of the three would make a share that is not true.
 */
function energyShares(offer: Offer): Record<keyof typeof KCAL_PER_G, number> | null {
  const n = packageNutrition(offer);
  const keys = ["proteinG", "carbsG", "fatG"] as const;
  const kcal = keys.map((key) => {
    const b = nutrientBounds(n?.[key]);
    return b ? ((b.min + b.max) / 2) * KCAL_PER_G[key] : null;
  });
  if (kcal.some((v) => v === null)) return null;
  const total = (kcal as number[]).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const protein = Math.round(((kcal[0] as number) / total) * 100);
  const carbs = Math.round(((kcal[1] as number) / total) * 100);
  return { proteinG: protein, carbsG: carbs, fatG: 100 - protein - carbs };
}

/**
 * The nutrition card under the package name (spec 3.4): one card holding the calories in `section` at 800 with "kkal"
 * and "per porsi", a to-scale bar of where the energy comes from, the macros as columns (grams at 800 over a `meta`
 * label with the bar's dot and share), and the caterer's caveat under a hairline. A metric the caterer left empty is
 * not a value and is left out; zero is a value ("0 g"). The bar and the shares need all three macros; without them
 * the columns stand alone. Nothing renders when no metric is filled. At large text on a narrow phone the columns
 * become lines, label left and grams right, so a range ("610–640") is never cut.
 */
export function StatStrip({ offer }: { offer: Offer }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const stacked = useStackedLayout(STACK_BELOW);
  const metrics = filledMetrics(offer, locale);
  if (!metrics.length) return null;
  const kcal = metrics.find((m) => m.key === "caloriesKcal");
  const macros = metrics.filter((m) => m.key !== "caloriesKcal") as (Metric & { key: keyof typeof KCAL_PER_G })[];
  const shares = energyShares(offer);
  const perPortion = t("per porsi", "per portion");
  return (
    <View testID="nutrition" style={styles.card}>
      {kcal ? (
        <View
          testID="stat-kcal"
          accessible
          accessibilityLabel={`${kcal.amount} ${kcal.unit} ${perPortion}`}
          style={styles.head}
        >
          <Text variant="section" style={styles.value}>
            {kcal.amount}
            <Text variant="meta">{` ${kcal.unit}`}</Text>
          </Text>
          <Text variant="meta">{perPortion}</Text>
        </View>
      ) : null}
      {shares ? (
        <View testID="energy-bar" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.bar}>
          {macros.map((m) => (
            <View key={m.key} style={{ flex: shares[m.key], backgroundColor: withAlpha(c.forest, STEPS[m.key]) }} />
          ))}
        </View>
      ) : null}
      {macros.length ? (
        <View testID="stat-strip" style={stacked ? styles.colsStacked : styles.cols}>
          {macros.map((m) => {
            const share = shares ? ` ${shares[m.key]}%` : "";
            return (
              <View
                key={m.key}
                testID="stat-cell"
                accessible
                accessibilityLabel={`${m.label} ${m.amount} ${m.unit}${share ? `,${share} ${t("energi", "of energy")}` : ""}`}
                style={stacked ? styles.cellStacked : styles.cell}
              >
                <Text variant="section" style={styles.value}>{`${m.amount} ${m.unit}`}</Text>
                <View style={styles.label}>
                  {shares ? <View style={[styles.dot, { backgroundColor: withAlpha(c.forest, STEPS[m.key]) }]} /> : null}
                  <Text variant="meta" style={{ flexShrink: 1 }}>{`${m.short}${share}`}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      <Text variant="meta" style={styles.caveat}>
        {t("Perkiraan dari katering. Bisa berbeda tiap menu.", "The caterer's estimate. It can differ from menu to menu.")}
      </Text>
    </View>
  );
}

const BAR = 10;
const DOT = 8;

const useStyles = themedStyles((c) => ({
  card: {
    gap: nativeLayout.space.md,
    padding: nativeLayout.cardPadding - cardEdgeWidth(c),
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    backgroundColor: c.surface,
    ...cardEdge(c),
  },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: nativeLayout.space.sm },
  bar: { flexDirection: "row", height: BAR, gap: 2, borderRadius: BAR / 2, overflow: "hidden" },
  cols: { flexDirection: "row", gap: nativeLayout.space.sm },
  colsStacked: { gap: nativeLayout.space.sm },
  cell: { flex: 1, minWidth: 0 },
  // Stacked, a column is a line: the label first on the left, the grams at the right.
  cellStacked: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.space.md },
  value: { fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] },
  label: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  caveat: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: nativeLayout.space.sm },
}));
