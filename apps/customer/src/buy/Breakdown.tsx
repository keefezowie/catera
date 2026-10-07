import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { currency, shortDate, type Locale, type Quote } from "@catera/domain";
import { Button, colors, FONT, Text } from "@catera/mobile-ui";

const FULL_DAYS = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** "Senin–Jumat" for a run of three or more days in week order, otherwise the names listed. */
export function fullDayRange(weekdays: number[], locale: Locale): string {
  const names = FULL_DAYS[locale === "en" ? "en" : "id"];
  const week = WEEK.filter((d) => weekdays.includes(d));
  if (week.length === 7) return locale === "en" ? "every day" : "setiap hari";
  const first = WEEK.indexOf(week[0]);
  const run = week.length >= 3 && week.every((d, i) => WEEK.indexOf(d) === first + i);
  return run ? `${names[week[0]]}–${names[week[week.length - 1]]}` : week.map((d) => names[d]).join(", ");
}

/** "5%" or "2,5%" in Indonesian. */
export function percent(n: number, locale: Locale): string {
  const text = String(n);
  return `${locale === "en" ? text : text.replace(".", ",")}%`;
}

const tabular = { fontVariant: ["tabular-nums" as const] };

/** Radio cards for the package length; the selected one is forest with cream text. */
export function LengthOptions({
  options,
  value,
  onChange,
}: {
  options: { cycles: number; label: string }[];
  value: number;
  onChange: (cycles: number) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {options.map((o) => {
        const on = o.cycles === value;
        return (
          <Pressable
            key={o.cycles}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.cycles)}
            style={[styles.option, on ? styles.optionOn : styles.optionOff]}
          >
            <Text style={[styles.optionLabel, { color: on ? colors.cream : colors.forest }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, tone ? { color: tone } : null, tabular]}>{label}</Text>
      <Text style={[styles.rowValue, tone ? { color: tone } : null, tabular]}>{value}</Text>
    </View>
  );
}

/** Every line verbatim from the server quote; nothing here is computed from prices. */
export function Breakdown({
  quote,
  dimmed,
  locale,
  t,
}: {
  quote: Quote;
  dimmed: boolean;
  locale: Locale;
  t: (id: string, en: string) => string;
}) {
  const days = quote.dates.length;
  const unit = quote.trial ? (quote.offer.trialPrice ?? quote.offer.price) : quote.offer.price;
  const minus = (n: number) => `−${currency(n, locale)}`;
  return (
    <View style={[styles.breakdown, dimmed && { opacity: 0.45 }]} accessibilityLabel={t("Rincian harga", "Price breakdown")}>
      <Row
        label={t(
          `${days} hari × ${quote.portions} porsi × ${currency(unit, locale)}`,
          `${days} days × ${quote.portions} portions × ${currency(unit, locale)}`,
        )}
        value={currency(quote.subtotal, locale)}
      />
      {quote.discount > 0 ? (
        <Row
          label={t(
            `Hemat ${percent(quote.discountPercent, locale)} untuk ${quote.portions} porsi`,
            `Save ${percent(quote.discountPercent, locale)} for ${quote.portions} portions`,
          )}
          value={minus(quote.discount)}
          tone={colors.sunriseInk}
        />
      ) : null}
      {quote.durationDiscount ? (
        <Row
          label={t(
            `Hemat ${percent(quote.durationDiscountPercent ?? 0, locale)} untuk ${days} hari`,
            `Save ${percent(quote.durationDiscountPercent ?? 0, locale)} for ${days} days`,
          )}
          value={minus(quote.durationDiscount)}
          tone={colors.sunriseInk}
        />
      ) : null}
      {quote.promotion > 0 ? <Row label={t("Promo", "Promotion")} value={minus(quote.promotion)} tone={colors.sunriseInk} /> : null}
      <Row label={t("Biaya layanan", "Service fee")} value={currency(quote.serviceFee, locale)} />
      <Row label={t("Pengantaran", "Delivery")} value={t("Termasuk", "Included")} />
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: "row", gap: 10 },
  option: { flex: 1, minHeight: 56, borderRadius: 12, paddingHorizontal: 12, justifyContent: "center" },
  optionOn: { backgroundColor: colors.forest },
  optionOff: { borderWidth: 1, borderColor: "#CDD4C4", backgroundColor: colors.surface },
  optionLabel: { fontFamily: FONT, fontSize: 15, fontWeight: "700" },
  breakdown: { gap: 10, paddingVertical: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { flex: 1, color: colors.charcoal },
  rowValue: { color: colors.charcoal, fontWeight: "600" },
});

/** "Mulai": the start date, and once priced, how many delivery days and until when. */
export function StartLine({
  startDate,
  renew,
  quote,
  dimmed,
  weekdays,
  onChange,
  locale,
  t,
}: {
  startDate: string | null;
  renew: boolean;
  quote: Quote | null;
  dimmed: boolean;
  weekdays: number[];
  onChange?: () => void;
  locale: Locale;
  t: (id: string, en: string) => string;
}) {
  const last = quote?.dates[quote.dates.length - 1];
  const label = startDate ? shortDate(startDate, locale) : "";
  return (
    <View style={{ gap: 4 }}>
      <Text variant="caption">{t("Mulai", "Starts")}</Text>
      <Text style={{ fontWeight: "800", color: colors.forest }}>
        {!startDate
          ? t("Belum ada tanggal yang bisa dipesan.", "No bookable date yet.")
          : renew
            ? t(`${label}, tepat setelah paket sekarang`, `${label}, right after your current package`)
            : label}
      </Text>
      {quote && last ? (
        <Text variant="caption" style={[tabular, dimmed && { opacity: 0.45 }]}>
          {t(
            `${quote.dates.length} hari antar, ${fullDayRange(weekdays, locale)}, sampai ${shortDate(last, locale)}`,
            `${quote.dates.length} delivery days, ${fullDayRange(weekdays, locale)}, until ${shortDate(last, locale)}`,
          )}
        </Text>
      ) : null}
      {onChange ? (
        <Button variant="text" label={t("Ganti tanggal mulai", "Change start date")} onPress={onChange} style={{ alignSelf: "flex-start" }} />
      ) : null}
    </View>
  );
}
