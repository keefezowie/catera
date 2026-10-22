import { View } from "react-native";
import { nutrientBounds, nutritionMetrics, packageNutrition, type Locale, type Offer } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { Text, themedStyles, useStackedLayout } from "@catera/mobile-ui";

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

/** Under this effective width (`width / fontScale`) the three cells stack under each other instead of sharing a row. */
const STACK_BELOW = 340;

/**
 * The strip under the package name (spec 3.4): one card of up to three cells, kkal, protein and meals a day, the
 * number in `section` at 800 over a `meta` label, with carbs and fat as one `meta` line under it and the caterer's
 * caveat. A metric the caterer left empty is not a value and is left out; zero is a value ("Lemak 0 g"). The strip needs
 * calories or protein (meals a day alone says nothing about nutrition); without either it is hidden, and a package with
 * only carbs or fat keeps just the line. Nothing renders when no metric is filled. At large text on a narrow phone the
 * cells stack, so a range ("610–640") is never cut.
 */
export function StatStrip({ offer }: { offer: Offer }) {
  const { t, locale } = useMobile();
  const styles = useStyles();
  const stacked = useStackedLayout(STACK_BELOW);
  const metrics = filledMetrics(offer, locale);
  if (!metrics.length) return null;
  const metric = (key: string) => metrics.find((m) => m.key === key);
  const kcal = metric("caloriesKcal");
  const protein = metric("proteinG");
  const meals = offer.meal === "both" ? 2 : 1;
  const cells = [
    kcal ? { key: "kcal", value: kcal.amount, label: kcal.unit } : null,
    protein ? { key: "protein", value: `${protein.amount} ${protein.unit}`, label: "protein" } : null,
    kcal || protein ? { key: "meals", value: `${meals}×`, label: t("makan sehari", "meals a day") } : null,
  ].filter((c) => c !== null);
  const rest = (["carbsG", "fatG"] as const)
    .map((key) => {
      const m = metric(key);
      return m ? `${m.short} ${m.amount} ${m.unit}` : null;
    })
    .filter((part) => part !== null);
  return (
    <View testID="nutrition" style={styles.group}>
      {cells.length ? (
        <View testID="stat-strip" style={[styles.strip, stacked ? styles.stripStacked : styles.stripRow]}>
          {cells.map((cell) => (
            <View
              key={cell.key}
              testID="stat-cell"
              accessible
              accessibilityLabel={`${cell.value} ${cell.label}`}
              style={stacked ? styles.cellStacked : styles.cell}
            >
              <Text variant="section" style={styles.value}>
                {cell.value}
              </Text>
              <Text variant="meta" style={styles.label}>
                {cell.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {rest.length ? <Text variant="meta">{`${rest.join(" · ")} ${t("per porsi", "per portion")}`}</Text> : null}
      <Text variant="meta">
        {t("Perkiraan dari katering. Bisa berbeda tiap menu.", "The caterer's estimate. It can differ from menu to menu.")}
      </Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  group: { gap: nativeLayout.groupGap },
  strip: {
    padding: nativeLayout.cardPadding,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    backgroundColor: c.surface,
  },
  stripRow: { flexDirection: "row", gap: nativeLayout.space.sm },
  stripStacked: { flexDirection: "column", gap: nativeLayout.space.md },
  cell: { flex: 1, minWidth: 0, alignItems: "center" },
  // Stacked, a cell is a line: the label first on the left, the number at the right.
  cellStacked: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.space.md },
  value: { fontWeight: "800", fontVariant: ["tabular-nums"], textAlign: "center" },
  label: { textAlign: "center", flexShrink: 1 },
}));
