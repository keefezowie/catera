import { View } from "react-native";
import { router } from "expo-router";
import { currency, nutritionSummary, packageNutrition, WEEK_HEADER, type Locale, type SellerOffer } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { plural, useMobile } from "@catera/mobile-core";
import { Button, KeyValueRow, ListCard, Screen, Text } from "@catera/mobile-ui";
import { photoUri } from "../photo";
import { PackagePhoto } from "./PackagePhoto";

/** Whole day names, Monday first (the index is `(weekday + 6) % 7`, with Sunday as 0). */
const FULL_DAYS = {
  id: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

/**
 * The delivery days as short as they read: a run of three or more in a row is a range ("Senin–Jumat", "Senin–Minggu"),
 * and days apart stay a short list ("Sen, Rab, Jum"). When the days are one group they use whole names; with several
 * groups they use the short ones, so the value stays inside its 40 row at large text (a `KeyValueRow` value never shrinks).
 */
export function weekdayLabel(weekdays: number[], locale: Locale): string {
  const places = [...new Set(weekdays.map((d) => (d + 6) % 7))].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const place of places) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === place - 1) last.push(place);
    else runs.push([place]);
  }
  const names = runs.length === 1 ? FULL_DAYS[locale] : WEEK_HEADER[locale];
  return runs
    .map((run) => (run.length >= 3 ? `${names[run[0]]}–${names[run[run.length - 1]]}` : run.map((place) => names[place]).join(", ")))
    .join(", ");
}

/**
 * A package customers can already buy keeps its terms fixed, so it is shown read-only.
 * Changes go into a new package copied from this one.
 *
 * The name is the screen's title. Under it: the photo at 16:10 (when the package has one), the description, the facts as
 * 40 key-value rows in one card, then what is in a portion and its nutrition as lines under the card (sentences that can
 * run long, so they never share a row with a label), and the copy action.
 */
export function PackageDetail({ offer }: { offer: SellerOffer }) {
  const { runtime, t, locale } = useMobile();
  const groups = offer.menus[0]?.composition ?? [];
  const capacity = offer.weekdays.length ? offer.capacity[String(offer.weekdays[0])] : undefined;
  // The caterer's own estimates as customers see them; nothing when none were entered (a zero is shown).
  const gizi = nutritionSummary(packageNutrition(offer), locale);
  const portion = groups.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ");
  return (
    <Screen nativeTitle={offer.name}>
      <View testID="paket-detail" style={{ gap: nativeLayout.dense.sectionGap }}>
        <View style={{ gap: nativeLayout.space.lg }}>
          {offer.image ? <PackagePhoto uri={photoUri(offer.image, runtime.apiBase)} /> : null}
          <Text variant="bodyL">{offer.description}</Text>
        </View>
        <View style={{ gap: nativeLayout.groupGap }}>
          <ListCard inset={0}>
            <KeyValueRow
              testID="paket-fact-harga"
              label={t("Harga", "Price")}
              value={offer.price === null ? t("Belum ada harga", "No price yet") : `${currency(offer.price, locale)} ${t("per porsi", "per portion")}`}
            />
            <KeyValueRow testID="paket-fact-hari" label={t("Hari antar", "Delivery days")} value={weekdayLabel(offer.weekdays, locale)} />
            {capacity !== undefined ? (
              <KeyValueRow
                testID="paket-fact-kapasitas"
                label={t("Kapasitas", "Capacity")}
                value={t(`${capacity} porsi per hari`, `${plural(capacity, "portion")} a day`)}
              />
            ) : null}
          </ListCard>
          {portion ? <Text variant="meta">{portion}</Text> : null}
          {gizi ? (
            <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
              {`${t("Gizi per porsi", "Nutrition per portion")}: ${gizi}`}
            </Text>
          ) : null}
        </View>
        <View style={{ gap: nativeLayout.space.md }}>
          <Text variant="meta">
            {t(
              "Paket yang sudah tayang dikunci, supaya pelanggan dapat persis yang mereka beli. Mau ganti harga, isi atau kapasitas? Salin jadi paket baru.",
              "Live packages are locked so customers get exactly what they bought. To change the price, contents or capacity, copy it into a new package.",
            )}
          </Text>
          <Button variant="secondary" label={t("Salin jadi paket baru", "Copy into a new package")} onPress={() => router.push(`/paket/baru?from=${offer.id}`)} />
        </View>
      </View>
    </Screen>
  );
}
