import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import {
  addDays,
  availabilityReasonLabel,
  canChangeDay,
  changeDeadline,
  dayLabel,
  errorLabel,
  jakartaDay,
  shortDate,
  type Address,
  type Delivery,
  type DeliveryAvailability,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, FONT, fontFor, PressableScale, Segmented, Sheet, Text } from "@catera/mobile-ui";
import { ChatKatering, catererPhoneOf } from "../help/ChatKatering";
import { longDay } from "./dates";

type Mode = "date" | "address";

/** Plain Indonesian for a failed change: the shared label first, then the cases it does not cover. */
function changeError(e: unknown, locale: "id" | "en", t: (id: string, en: string) => string): string {
  const code = (e as { code?: string }).code || (e as Error).message;
  // The shared CAPACITY label talks about a start date, which is checkout wording.
  if (code === "CAPACITY" || code === "FULL")
    return t("Hari itu sudah penuh. Pilih tanggal lain.", "That day is full. Choose another date.");
  const shared = errorLabel(code, locale);
  if (shared) return shared;
  if (code === "NOT_AVAILABLE")
    return t("Hari ini sudah tidak bisa diubah.", "This day can no longer be changed.");
  return t("Belum berhasil. Coba lagi.", "That did not work. Try again.");
}

/** Bottom sheet to move one delivery day to another date or send it to another address. */
export function ChangeDaySheet({
  delivery: live,
  addresses,
  onClose,
  onDone,
  onStale,
}: {
  delivery: Delivery;
  addresses: Address[];
  onClose: () => void;
  /** Called after a change went through, with a sentence to show. */
  onDone?: (message: string) => void;
  /** Called when a change failed, so the screen can reload the day. */
  onStale?: () => void;
}) {
  const { runtime, command, t, locale } = useMobile();
  const [opened] = useState(() => new Date());
  // What the customer is looking at: captured on open and again whenever the live day moved on.
  const [delivery, setDelivery] = useState(live);
  const today = jakartaDay(opened);
  const can = canChangeDay(delivery, opened);
  const open = can.date || can.address;
  const deadline = changeDeadline(delivery.cutoff_at, opened, locale) ?? "";
  const [mode, setMode] = useState<Mode>(can.date ? "date" : "address");
  const [target, setTarget] = useState("");
  const [addressId, setAddressId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const availability = useData(`availability:${delivery.id}:${today}`, () =>
    can.date ? runtime.api.deliveryAvailability(delivery.id, today, addDays(today, 30)) : Promise.resolve([]),
  );
  const oldDay = shortDate(delivery.service_date, locale);

  const reasons: Record<string, string> = {
    DUPLICATE_DATE: t("Sudah ada pengantaran", "Already has a delivery"),
    CAPACITY: t("Katering penuh", "Caterer is full"),
    OVERLAP: availabilityReasonLabel("OVERLAP", locale),
  };
  // Bookable dates, plus full or double-booked ones with their reason. Non-operating days and
  // passed cutoffs are left out rather than listed as dead rows.
  const dates = (availability.data ?? []).filter(
    (r) => r.date !== delivery.service_date && (r.available || (r.reason ?? "") in reasons),
  );
  const chosen = addresses.find((a) => a.id === addressId);
  const label = mode === "date" ? shortDate(target || delivery.service_date, locale) : chosen?.label || chosen?.line || "";

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (live.version !== delivery.version) {
        setDelivery(live);
        setError(t("Detail hari ini berubah. Periksa lagi.", "This day changed. Please check again."));
        onStale?.();
        void availability.reload();
        return;
      }
      // The minute may have passed while the sheet was open.
      const now = canChangeDay(delivery, new Date());
      if (mode === "date" ? !now.date : !now.address) throw Object.assign(new Error("CUTOFF"), { code: "CUTOFF" });
      if (mode === "date")
        await command("delivery.reschedule", { id: delivery.id, version: delivery.version, date: target, kind: "reschedule" });
      else await command("delivery.address", { id: delivery.id, version: delivery.version, addressId });
      onDone?.(
        mode === "date"
          ? t(`Sudah dipindah ke ${label}.`, `Moved to ${label}.`)
          : t(`${oldDay} diantar ke ${label}.`, `${oldDay} will be delivered to ${label}.`),
      );
      onClose();
    } catch (e) {
      setError(changeError(e, locale, t));
      onStale?.();
      void availability.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible onClose={onClose} title="" closeLabel={t("Tutup", "Close")}>
      {/* Sheet always draws a title line; the date header takes its place. */}
      <View style={{ gap: 14, marginTop: -14 }}>
        <View style={{ gap: 2 }}>
          <RNText style={styles.date} accessibilityRole="header">
            {longDay(delivery.service_date, locale)}
          </RNText>
          <Text variant="caption">
            {delivery.offer.name} · {delivery.offer.caterer}
          </Text>
          <Text
            variant="label"
            style={{ color: open ? colors.sunriseInk : colors.charcoal, fontVariant: ["tabular-nums"], marginTop: 4 }}
          >
            {open
              ? t(`Bisa diubah sampai ${deadline}`, `Can be changed until ${deadline}`)
              : t("Hari ini sudah tidak bisa diubah", "This day can no longer be changed")}
          </Text>
        </View>

        {!open ? (
          <>
            <Text style={{ color: colors.muted }}>
              {t(`Perlu bantuan? Hubungi ${delivery.offer.caterer}.`, `Need help? Contact ${delivery.offer.caterer}.`)}
            </Text>
            <ChatKatering phone={catererPhoneOf(delivery)} />
            <Button variant="text" label={t("Tutup", "Close")} onPress={onClose} />
          </>
        ) : (
          <>
            <Segmented<Mode>
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError("");
              }}
              options={[
                ...(can.date ? [{ value: "date" as const, label: t("Pindah tanggal", "Move date") }] : []),
                ...(can.address ? [{ value: "address" as const, label: t("Ganti alamat", "Change address") }] : []),
              ]}
            />
            {mode === "date" ? (
              availability.loading && !availability.data ? (
                <Text style={{ color: colors.muted }}>{t("Memuat tanggal…", "Loading dates…")}</Text>
              ) : availability.error && !availability.data ? (
                <Text style={{ color: colors.danger }}>{availability.error}</Text>
              ) : (
                <>
                  {dates.some((r) => r.available) ? null : (
                    <Text style={{ color: colors.muted }}>
                      {t("Belum ada tanggal yang tersedia dalam 30 hari ke depan.", "No dates are available in the next 30 days.")}
                    </Text>
                  )}
                  {dates.length ? (
                    <DateChips dates={dates} selected={target} onSelect={setTarget} reasons={reasons} today={today} locale={locale} />
                  ) : null}
                </>
              )
            ) : (
              <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
                {addresses.map((a) => {
                  const here = a.id === delivery.address.id;
                  const outside = !delivery.offer.areas.includes(a.area);
                  return (
                    <OptionRow
                      key={a.id}
                      label={a.label || a.line}
                      sub={a.label ? a.line : a.area}
                      note={here ? t("Alamat sekarang", "Current address") : outside ? t("Di luar area antar", "Outside delivery area") : ""}
                      selected={addressId === a.id}
                      disabled={here || outside}
                      onPress={() => setAddressId(a.id)}
                    />
                  );
                })}
              </ScrollView>
            )}

            {error ? (
              <Text variant="caption" style={{ color: colors.danger }}>
                {error}
              </Text>
            ) : null}
            <Button
              label={
                mode === "date"
                  ? target
                    ? t(`Pindah ke ${label}`, `Move to ${label}`)
                    : t("Pilih tanggal", "Choose a date")
                  : addressId
                    ? t(`Antar ke ${label}`, `Deliver to ${label}`)
                    : t("Pilih alamat", "Choose an address")
              }
              disabled={busy || (mode === "date" ? !target : !addressId)}
              onPress={() => void confirm()}
            />
            <Text variant="caption">
              {mode === "date"
                ? t(
                    `Tempat di hari baru dipesan dulu, baru ${oldDay} dilepas. ${delivery.offer.caterer} otomatis tahu.`,
                    `The new day is booked first, then ${oldDay} is released. ${delivery.offer.caterer} is told automatically.`,
                  )
                : t(
                    `Hanya untuk ${oldDay}. Hari lain tetap ke ${delivery.address.label || delivery.address.line}.`,
                    `Only for ${oldDay}. Other days still go to ${delivery.address.label || delivery.address.line}.`,
                  )}
            </Text>
          </>
        )}
      </View>
    </Sheet>
  );
}

/** One strip of dates: bookable ones are chips, full or double-booked ones stay visible but dimmed. */
function DateChips({
  dates,
  selected,
  onSelect,
  reasons,
  today,
  locale,
}: {
  dates: DeliveryAvailability[];
  selected: string;
  onSelect: (date: string) => void;
  reasons: Record<string, string>;
  today: string;
  locale: "id" | "en";
}) {
  const { t } = useMobile();
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {dates.map((r) => {
          const full = shortDate(r.date, locale);
          // "Senin 12 Okt" -> weekday on top, "12 Okt" below.
          const [weekday, ...rest] = full.split(" ");
          const on = selected === r.date;
          const off = !r.available;
          const ink = on ? colors.cream : off ? colors.muted : colors.forest;
          return (
            <PressableScale
              key={r.date}
              accessibilityRole="button"
              accessibilityLabel={off ? `${full}, ${reasons[r.reason ?? ""]}` : full}
              accessibilityState={{ selected: on, disabled: off }}
              disabled={off}
              haptic={off ? "none" : "select"}
              onPress={() => onSelect(r.date)}
              style={[styles.chip, on && styles.chipOn, off && styles.chipOff]}
            >
              <RNText style={[styles.chipDay, { color: ink }]}>{weekday.slice(0, 3)}</RNText>
              <RNText style={[styles.chipDate, { color: ink }]}>{rest.join(" ")}</RNText>
              {off ? (
                // State is paired with text, not only a dimmed look.
                <Text variant="caption" style={styles.chipWhy}>
                  {r.reason === "CAPACITY" ? t("Penuh", "Full") : t("Terisi", "Taken")}
                </Text>
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>
      {selected ? (
        <Text testID="chosen-day" variant="label" style={{ color: colors.forest }}>
          {dayLabel(selected, today, locale)}
        </Text>
      ) : null}
    </View>
  );
}

function OptionRow({
  label,
  sub,
  note,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  sub?: string;
  note?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const ink = selected ? colors.cream : disabled ? colors.muted : colors.charcoal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, sub, note].filter(Boolean).join(", ")}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, selected && styles.rowOn, disabled && styles.rowOff]}
    >
      <View style={{ flex: 1 }}>
        <RNText style={[styles.rowLabel, { color: ink }]}>{label}</RNText>
        {sub ? <RNText style={[styles.rowSub, { color: ink }]}>{sub}</RNText> : null}
      </View>
      {note ? <RNText style={[styles.rowSub, { color: ink }]}>{note}</RNText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  date: { fontSize: 22, fontFamily: fontFor("800"), color: colors.forest },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  rowOff: { borderStyle: "dashed", borderColor: "#B9BFB0", backgroundColor: "transparent" },
  chip: {
    minWidth: 64,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipOff: { borderStyle: "dashed", borderColor: "#B9BFB0", backgroundColor: "transparent" },
  chipWhy: { color: colors.muted, lineHeight: 16 },
  chipDay: { fontFamily: FONT, fontSize: 11, lineHeight: 16 },
  chipDate: { fontFamily: fontFor("700"), fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  rowLabel: { fontSize: 15, fontFamily: fontFor("700"), fontVariant: ["tabular-nums"] },
  rowSub: { fontFamily: FONT, fontSize: 12 },
});
