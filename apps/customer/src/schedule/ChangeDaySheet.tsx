import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDays,
  canChangeDay,
  changeDeadline,
  errorLabel,
  jakartaDay,
  shortDate,
  type Address,
  type Delivery,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  CalendarPanel,
  type CalendarDayState,
  type CalendarReason,
  FadeSwap,
  FONT,
  fontFor,
  FormError,
  PressableScale,
  ReadError,
  Segmented,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  themedStyles,
  useBusy,
  useColors,
  useToast,
} from "@catera/mobile-ui";
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
    return t("Hari itu sudah tidak bisa diubah.", "This day can no longer be changed.");
  return t("Perubahannya belum tersimpan. Coba lagi.", "Your change didn't save. Try again.");
}

/**
 * The frame of the Ubah hari sheet: the title row (the day, with the package and caterer under it) over the scrolling
 * content, which sits in one FadeSwap so the form fades in from its skeleton as one block. The header holds its context
 * line (`holdContextLine`) on every render: while the day is read the title is "Ubah hari" and a skeleton keeps the
 * line (null), then the package and caterer land as one line (read out in full), so the header keeps its height.
 */
function Frame({
  title,
  context,
  swapKey,
  onClose,
  children,
}: {
  title: string;
  context?: string | null;
  swapKey: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} context={context} holdContextLine onClose={onClose} closeLabel={t("Tutup", "Close")} />
      <SheetBody>
        <FadeSwap swapKey={swapKey} style={{ gap: 14 }}>
          {children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

/** The shape of the change sheet while its day loads: the cutoff line, the two sides and a row of dates. */
function ChangeDaySkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat hari", "Loading the day")}>
      <View style={{ gap: 14 }}>
        <Skeleton width="55%" height={14} />
        <Skeleton height={44} radius={10} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={64} height={56} radius={10} />
          ))}
        </View>
        <Skeleton height={48} radius={10} />
      </View>
    </SkeletonGroup>
  );
}

/**
 * `/ubah-hari/{id}?mode=date|address`: Ubah hari as a native form sheet over the page it was opened from (Hari, Beranda,
 * the plan), or over the day's Hari on a cold link. It reads the day itself. A change that goes through closes the sheet
 * and says what happened in a toast ("Hari dipindah ke Senin 12 Okt"); the page under it reads again on its own.
 */
export function ChangeDayRoute() {
  const params = useLocalSearchParams<{ id: string; mode?: string }>();
  const { actor, ready, t } = useMobile();
  const id = String(params.id ?? "");
  const mode: Mode | undefined = params.mode === "address" ? "address" : params.mode === "date" ? "date" : undefined;
  if (!ready || !actor)
    return (
      <Frame title={t("Ubah hari", "Change this day")} context={ready ? undefined : null} swapKey={ready ? "signin" : "loading"}>
        {ready ? (
          <Button
            label={t("Masuk", "Sign in")}
            onPress={() => router.push({ pathname: "/login", params: { next: `/hari/${id}` } } as never)}
          />
        ) : (
          <ChangeDaySkeleton />
        )}
      </Frame>
    );
  return <ChangeDayLoaded key={`${actor.id}:${id}`} id={id} mode={mode} />;
}

function ChangeDayLoaded({ id, mode }: { id: string; mode?: Mode }) {
  const { runtime, t } = useMobile();
  const c = useColors();
  const toast = useToast();
  const state = useData(`ubah-hari:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const d = state.data?.deliveries.find((x) => x.id === id);
  if (!d)
    return (
      <Frame title={t("Ubah hari", "Change this day")} context={state.loading ? null : undefined} swapKey={state.loading ? "loading" : "missing"}>
        {state.loading ? (
          <ChangeDaySkeleton />
        ) : (
          state.error ? (
            <ReadError message={state.error} onRetry={() => void state.reload()} />
          ) : (
            <Text style={{ color: c.muted }}>{t("Pengantaran tidak ditemukan.", "Delivery not found.")}</Text>
          )
        )}
      </Frame>
    );
  return (
    <ChangeDaySheet
      delivery={d}
      addresses={state.data?.addresses ?? []}
      mode={mode}
      onClose={() => router.back()}
      onDone={({ message }) => toast.show({ message, tone: "success" })}
      onStale={() => void state.reload()}
    />
  );
}

/**
 * Ubah hari, the content of the native form sheet `/ubah-hari/{id}` (`ChangeDayRoute`): move one delivery day to another
 * date, or send it to another address. The title is the day, the context line the package and caterer. `mode` is the
 * side it opens on (the day's "…" opens Pindah tanggal or Ganti alamat); a side the day no longer allows falls back to
 * the other. After the cutoff it says so and offers the caterer's chat.
 */
export function ChangeDaySheet({
  delivery: live,
  addresses,
  mode: wanted,
  onClose,
  onDone,
  onStale,
}: {
  delivery: Delivery;
  addresses: Address[];
  mode?: Mode;
  onClose: () => void;
  /** Called after a change went through: the side, what it changed to, and the sentence to show. */
  onDone?: (done: { mode: Mode; label: string; message: string }) => void;
  /** Called when a change failed, so the screen can reload the day. */
  onStale?: () => void;
}) {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const [opened] = useState(() => new Date());
  // What the customer is looking at: captured on open and again whenever the live day moved on.
  const [delivery, setDelivery] = useState(live);
  const today = jakartaDay(opened);
  const can = canChangeDay(delivery, opened);
  const open = can.date || can.address;
  const deadline = changeDeadline(delivery.cutoff_at, opened, locale) ?? "";
  const [mode, setMode] = useState<Mode>(
    wanted === "address" && can.address ? "address" : wanted === "date" && can.date ? "date" : can.date ? "date" : "address",
  );
  const [addressId, setAddressId] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  // Whether the sheet is on screen: true while mounted (again after a remount: Fast Refresh, StrictMode), false once
  // it is gone (swiped down while a change was on its way). `sent` keeps a change that went through to one outcome.
  const mounted = useRef(false);
  const sent = useRef(false);
  const availability = useData(`availability:${delivery.id}:${today}`, () =>
    can.date ? runtime.api.deliveryAvailability(delivery.id, today, addDays(today, 30)) : Promise.resolve([]),
  );
  const oldDay = shortDate(delivery.service_date, locale);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // What the calendar knows of each day: bookable ones, today's delivery day (outlined) and the ones that cannot be
  // chosen, each with the reason the calendar reads out. A day the read leaves out is unavailable with no reason.
  const days: Record<string, CalendarDayState> = { [delivery.service_date]: { state: "current" } };
  for (const r of availability.data ?? []) {
    if (r.date === delivery.service_date) continue;
    days[r.date] = r.available ? { state: "available" } : { state: "unavailable", reason: calendarReason(r.reason) };
  }
  const chosen = addresses.find((a) => a.id === addressId);
  const label = chosen?.label || chosen?.line || "";

  /**
   * Moves the day or sends it to another address. A failure rejects with the sentence to show (the calendar and the
   * address side both put it in a `FormError`), after the screen under the sheet has been told to read again.
   */
  async function perform(kind: Mode, value: string) {
    const stale = () => {
      onStale?.();
      void availability.reload();
    };
    if (live.version !== delivery.version) {
      setDelivery(live);
      stale();
      throw new Error(t("Ada yang berubah di hari itu. Cek lagi sebelum lanjut.", "Something changed on this day. Check it again."));
    }
    try {
      // The minute may have passed while the sheet was open.
      const now = canChangeDay(delivery, new Date());
      if (kind === "date" ? !now.date : !now.address) throw Object.assign(new Error("CUTOFF"), { code: "CUTOFF" });
      if (kind === "date")
        await command("delivery.reschedule", { id: delivery.id, version: delivery.version, date: value, kind: "reschedule" });
      else await command("delivery.address", { id: delivery.id, version: delivery.version, addressId: value });
    } catch (e) {
      stale();
      throw new Error(changeError(e, locale, t));
    }
    if (sent.current) return;
    sent.current = true;
    const to = kind === "date" ? shortDate(value, locale) : chosen?.label || chosen?.line || "";
    // Closing is for a sheet still on screen; once it is gone, a back would leave the page under it.
    if (mounted.current) onClose();
    // The change went through: it is told even when the sheet was swiped away meanwhile, and after the close, so the
    // toast meets the page under the sheet.
    onDone?.({
      mode: kind,
      label: to,
      message:
        kind === "date"
          ? t(`Pengantaran pindah ke ${to}`, `Delivery moved to ${to}`)
          : t(`${oldDay} diantar ke ${to}`, `${oldDay} goes to ${to}`),
    });
  }

  const [sending, sendAddress] = useBusy(async () => {
    setError("");
    try {
      await perform("address", addressId);
    } catch (e) {
      setError(e instanceof Error ? e.message : changeError(e, locale, t));
      setFailures((n) => n + 1);
    }
  });

  return (
    <Frame title={longDay(delivery.service_date, locale)} context={`${delivery.offer.name} · ${delivery.offer.caterer}`} swapKey="ready" onClose={onClose}>
      <Text variant="label" style={{ color: c.charcoal, fontVariant: ["tabular-nums"] }}>
        {open
          ? t(`Bisa diubah sampai ${deadline}`, `Can be changed until ${deadline}`)
          : t("Hari itu sudah tidak bisa diubah", "This day can no longer be changed")}
      </Text>

      {!open ? (
        <>
          <Text style={{ color: c.muted }}>
            {t(`Perlu bantuan? Hubungi ${delivery.offer.caterer}.`, `Need help? Contact ${delivery.offer.caterer}.`)}
          </Text>
          <ChatKatering phone={catererPhoneOf(delivery)} />
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
              // The calendar waits in its own shape: a month of days under the pager.
              <SkeletonGroup label={t("Memuat tanggal", "Loading dates")}>
                <View style={{ gap: 8 }}>
                  <Skeleton height={44} radius={10} />
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} height={48} radius={10} />
                  ))}
                </View>
              </SkeletonGroup>
            ) : availability.error && !availability.data ? (
              <ReadError message={availability.error} onRetry={() => void availability.reload()} />
            ) : (
              // The sheet's day-by-day calendar: a new day is chosen in the grid, and the button under it stays off
              // until one is.
              <CalendarPanel
                month={delivery.service_date.slice(0, 7)}
                days={days}
                current={delivery.service_date}
                onPick={() => setError("")}
                confirmLabel={(date) => t(`Pindah ke ${shortDate(date, locale)}`, `Move to ${shortDate(date, locale)}`)}
                onConfirm={(date) => perform("date", date)}
                window={{ from: today, to: addDays(today, 30) }}
              />
            )
          ) : (
            // The sheet's own scroll view carries the list; each row is a 56dp option.
            <View style={{ gap: 8 }}>
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
            </View>
          )}

          {mode === "address" ? (
            <SheetFooter>
              {error ? <FormError message={error} failureKey={failures} /> : null}
              <Button
                label={addressId ? t(`Antar ke ${label}`, `Deliver to ${label}`) : t("Pilih alamat", "Choose an address")}
                busy={sending}
                disabled={!addressId}
                onPress={() => void sendAddress()}
              />
            </SheetFooter>
          ) : null}
          <Text variant="caption">
            {mode === "date"
              ? t(
                  `Kami pesan tempat di hari baru dulu, baru ${oldDay} dilepas. ${delivery.offer.caterer} otomatis dapat kabar.`,
                  `The new day is booked first, then ${oldDay} is released. ${delivery.offer.caterer} is told automatically.`,
                )
              : t(
                  `Hanya untuk ${oldDay}. Hari lain tetap ke ${delivery.address.label || delivery.address.line}.`,
                  `Only for ${oldDay}. Other days still go to ${delivery.address.label || delivery.address.line}.`,
                )}
          </Text>
        </>
      )}
    </Frame>
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
  const c = useColors();
  const styles = useStyles();
  const ink = selected ? c.cream : disabled ? c.muted : c.charcoal;
  return (
    <PressableScale
      haptic={disabled ? "none" : "select"}
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
    </PressableScale>
  );
}

const useStyles = themedStyles((c) => ({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  rowOn: { backgroundColor: c.forest, borderColor: c.forest },
  rowOff: { borderStyle: "dashed", borderColor: c.fieldBorder, backgroundColor: "transparent" },
  rowLabel: { fontSize: 15, fontFamily: fontFor("700"), fontVariant: ["tabular-nums"] },
  rowSub: { fontFamily: FONT, fontSize: 12 },
}));

/** The calendar's word for why a day cannot be chosen; a reason it has no word for leaves the day without one. */
function calendarReason(reason: string | null): CalendarReason | undefined {
  if (reason === "CAPACITY") return "Penuh";
  if (reason === "DUPLICATE_DATE" || reason === "OVERLAP") return "Terisi";
  if (reason === "CUTOFF") return "Lewat batas waktu";
  if (reason === "INVALID_DATE") return "Dapur libur";
  return undefined;
}
