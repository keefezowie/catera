import type { ReactNode } from "react";
import { View } from "react-native";
import { currency, firstOperatingDayAfter, shortDate, type Locale, type Quote } from "@catera/domain";
import { plural } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { Button, fontFor, PressableScale, Text, themedStyles } from "@catera/mobile-ui";
import { FieldRow } from "./BuyParts";
import { BREAKDOWN_PAD, BREAKDOWN_ROW } from "./metrics";

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
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {options.map((o) => {
        const on = o.cycles === value;
        return (
          <PressableScale
            key={o.cycles}
            haptic="select"
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.cycles)}
            style={[styles.option, on ? styles.optionOn : styles.optionOff]}
          >
            <Text style={[styles.optionLabel, on ? styles.optionLabelOn : null]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const styles = useStyles();
  return (
    <View testID="buy-breakdown-row" style={styles.row}>
      <Text variant="bodyL" style={[styles.rowLabel, tabular]}>
        {label}
      </Text>
      <Text variant="bodyL" selectable style={[styles.rowValue, tabular]}>
        {value}
      </Text>
    </View>
  );
}

/** "Rincian": every line verbatim from the server quote, as rows of 40 in `bodyL`; nothing here is computed from prices. */
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
  const styles = useStyles();
  const days = quote.dates.length;
  const unit = quote.trial ? (quote.offer.trialPrice ?? quote.offer.price) : quote.offer.price;
  const minus = (n: number) => `−${currency(n, locale)}`;
  return (
    <View testID="buy-breakdown" style={[styles.breakdown, dimmed && { opacity: 0.45 }]} accessibilityLabel={t("Rincian harga", "Price breakdown")}>
      <Row
        label={t(
          `${days} hari × ${quote.portions} porsi × ${currency(unit, locale)}`,
          `${plural(days, "day")} × ${plural(quote.portions, "portion")} × ${currency(unit, locale)}`,
        )}
        value={currency(quote.subtotal, locale)}
      />
      {quote.discount > 0 ? (
        <Row
          label={t(
            `Hemat ${percent(quote.discountPercent, locale)} untuk ${quote.portions} porsi`,
            `Save ${percent(quote.discountPercent, locale)} for ${plural(quote.portions, "portion")}`,
          )}
          value={minus(quote.discount)}
        />
      ) : null}
      {quote.durationDiscount ? (
        <Row
          label={t(
            `Hemat ${percent(quote.durationDiscountPercent ?? 0, locale)} untuk ${days} hari`,
            `Save ${percent(quote.durationDiscountPercent ?? 0, locale)} for ${plural(days, "day")}`,
          )}
          value={minus(quote.durationDiscount)}
        />
      ) : null}
      {quote.promotion > 0 ? <Row label={t("Promo", "Promotion")} value={minus(quote.promotion)} /> : null}
      <Row label={t("Biaya layanan", "Service fee")} value={currency(quote.serviceFee, locale)} />
      <Row label={t("Pengantaran", "Delivery")} value={t("Termasuk", "Included")} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  options: { flexDirection: "row", gap: 10 },
  option: { flex: 1, minHeight: 56, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 12, justifyContent: "center" },
  optionOn: { backgroundColor: c.forest },
  optionOff: { borderWidth: 1, borderColor: c.secondaryBorder, backgroundColor: c.surface },
  optionLabel: { fontSize: 15, fontFamily: fontFor("700"), color: c.charcoal },
  optionLabelOn: { color: c.cream },
  // A surface card of rows like the choices above it: it stands off the canvas by tone, with no border.
  breakdown: {
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    paddingHorizontal: nativeLayout.cardPadding,
    paddingVertical: BREAKDOWN_PAD,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.space.md, minHeight: BREAKDOWN_ROW },
  rowLabel: { flex: 1, minWidth: 0 },
  rowValue: { flexShrink: 0, textAlign: "right" },
}));

/**
 * The renewal's start line: "Mulai Selasa 13 Okt, tepat setelah paket sekarang" when the start is the first delivery day
 * after the plan being renewed; any later start names the plan that still runs and blocks the earlier dates. A plan that
 * ended before `today` is not running, so it is named neither way: the line is just the start.
 */
export function renewalLine(
  label: string,
  startDate: string,
  currentEnd: string | null | undefined,
  blockingEnd: string | null | undefined,
  blockingName: string | null | undefined,
  weekdays: number[],
  today: string,
  locale: Locale,
  t: (id: string, en: string) => string,
) {
  const named = blockingEnd && currentEnd && blockingEnd > currentEnd ? blockingEnd : currentEnd;
  if (!currentEnd || !named || named < today) return t(`Mulai ${label}`, `Starts ${label}`);
  if (startDate === firstOperatingDayAfter(currentEnd, weekdays)) {
    return t(`Mulai ${label}, tepat setelah paket sekarang`, `Starts ${label}, right after your current package`);
  }
  const end = shortDate(named, locale);
  if (blockingName && named === blockingEnd) {
    return t(`Mulai ${label}. Paketmu ${blockingName} masih berjalan sampai ${end}.`, `Starts ${label}. Your ${blockingName} plan is still running until ${end}.`);
  }
  return t(
    `Mulai ${label}. Paket ini masih berjalan sampai ${end}.`,
    `Starts ${label}. This package is still running until ${end}.`,
  );
}

/**
 * "Mulai": the start date, and once priced, how many delivery days and until when. A renewal says "right after" only
 * when the start really is the day after the running package ends; any later start names the package that still runs.
 */
export function StartLine({
  startDate,
  renew,
  currentEnd,
  blockingEnd,
  blockingName,
  today,
  quote,
  dimmed,
  weekdays,
  onChange,
  locale,
  t,
}: {
  startDate: string | null;
  renew: boolean;
  /** The last day of the package being renewed. */
  currentEnd?: string | null;
  /** The latest end, before the start, of the customer's plans at this caterer. */
  blockingEnd?: string | null;
  /** The name of the blocking plan when it is another package of the same caterer. */
  blockingName?: string | null;
  /** Today in Jakarta (YYYY-MM-DD). */
  today: string;
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
    <FieldRow
      id="start"
      icon="calendar-outline"
      minHeight={nativeLayout.row.media}
      trailing={
        onChange ? (
          <Button variant="text" label={t("Ubah", "Change")} accessibilityLabel={t("Ganti tanggal mulai", "Change start date")} onPress={onChange} />
        ) : null
      }
    >
      {renew && startDate ? null : <Text variant="meta">{t("Mulai", "Starts")}</Text>}
      <Text variant="bodyStrong">
        {!startDate
          ? t("Belum ada tanggal yang bisa dipesan.", "No bookable date yet.")
          : renew
            ? renewalLine(label, startDate, currentEnd, blockingEnd, blockingName, weekdays, today, locale, t)
            : label}
      </Text>
      {quote && last ? (
        <Text variant="meta" style={[tabular, dimmed && { opacity: 0.45 }]}>
          {t(
            `${quote.dates.length} hari antar, ${fullDayRange(weekdays, locale)}, sampai ${shortDate(last, locale)}`,
            `${plural(quote.dates.length, "delivery day")}, ${fullDayRange(weekdays, locale)}, until ${shortDate(last, locale)}`,
          )}
        </Text>
      ) : null}
    </FieldRow>
  );
}
