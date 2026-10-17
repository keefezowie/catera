import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { errorLabel, jakartaDay, kitchenSession, monthOf, type DeliveryAvailability, type KitchenMeal } from "@catera/domain";
import { useData, useMobile, plural } from "@catera/mobile-core";
import {
  CalendarSheet,
  Field,
  Skeleton,
  SkeletonGroup,
  useToast,
  useUnsavedGuard,
  type CalendarDayState,
  type CalendarReason,
} from "@catera/mobile-ui";
import { Frame, canMoveDelivery, takeParkedDay } from "./ExceptionSheet";
import { ReadError } from "../ReadError";

/** The days the caterer can pick from: today and the sixty after it, the most the availability read answers for. */
const WINDOW_DAYS = 60;
const MIN_REASON = 5;

/** What `deliveryAvailability` says about a day, in the words the calendar shows. A fixed package has no reason to give. */
function reasonOf(code: string | null): CalendarReason | undefined {
  if (code === "CAPACITY") return "Penuh";
  if (code === "DUPLICATE_DATE" || code === "OVERLAP") return "Terisi";
  if (code === "INVALID_DATE") return "Dapur libur";
  if (code === "CUTOFF") return "Lewat batas waktu";
  return undefined;
}

/** The calendar's day map from the read, with the stop's own day marked as the current one. */
export function calendarDays(rows: DeliveryAvailability[], current: string): Record<string, CalendarDayState> {
  const days: Record<string, CalendarDayState> = {};
  for (const row of rows) {
    days[row.date] = row.available
      ? { state: "available" }
      : { state: "unavailable", reason: reasonOf(row.reason) };
  }
  days[current] = { state: "current" };
  return days;
}

/**
 * Moves per person and stop (`{actor}:{delivery}:{date}`) that were typed and not saved: only the reason, in memory.
 * Android's bottom sheet closes on a swipe before anything can ask (`useUnsavedGuard`), so the reason comes back when
 * this stop's sheet opens again. Saving or choosing "Buang" drops it; closing the app forgets it.
 */
const reasonDrafts = new Map<string, string>();

/**
 * "Pindah tanggal" (spec 5.5): the calendar for moving one stop's day, a large form sheet over Hari ini. The days come
 * from `deliveryAvailability`, which the server answers for the kitchen's staff as it does for the customer (it checks
 * `is_staff` for the package's caterer). The reason is asked below the grid, and the consequence line says who is told:
 * only customers with the app.
 */
export function MoveSheet({ id, meal, date }: { id: string; meal: KitchenMeal; date: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  const toast = useToast();
  const catererId = actor?.catererId ?? "";
  const key = `${catererId}:${date}`;
  const [seed] = useState(() => takeParkedDay(key));
  const day = useData(`stop-sheet:${key}`, () => runtime.api.sellerOperations(catererId, date));
  const ops = day.data ?? seed;
  const delivery = ops?.deliveries.find((d) => d.id === id);
  const stop = ops ? kitchenSession(ops, meal, new Date())?.stops.find((s) => s.deliveryId === id) : undefined;
  const from = jakartaDay(new Date());
  const to = jakartaDay(new Date(), WINDOW_DAYS);
  const availability = useData(`move-days:${id}:${from}`, () => runtime.api.deliveryAvailability(id, from, to));

  const draftKey = actor?.id ? `${actor.id}:${id}:${date}` : null;
  const [reason, setReasonState] = useState("");
  // A reason this person typed for this stop and lost to a swipe comes back: once the session knows who is signed in.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  if (draftKey && restoredFor !== draftKey) {
    setRestoredFor(draftKey);
    const draft = reasonDrafts.get(draftKey);
    if (draft) setReasonState(draft);
  }
  const setReason = (value: string) => {
    setReasonState(value);
    if (!draftKey) return;
    if (value.trim()) reasonDrafts.set(draftKey, value);
    else reasonDrafts.delete(draftKey);
  };
  const [saved, setSaved] = useState(false);
  const closed = useRef(false);
  useUnsavedGuard(!saved && reason.trim() !== "", t("alasan", "reason"), {
    t,
    nounEn: "reason",
    voice: "kamu",
    onDiscard: () => {
      if (draftKey) reasonDrafts.delete(draftKey);
    },
  });
  useEffect(() => {
    if (!saved || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({ message: t("Tanggal dipindah", "Date moved"), tone: "success" });
  }, [saved, toast, t]);

  const title = stop?.name ?? delivery?.customer.name;
  const context = stop ? t(`${stop.portions} porsi · ${stop.packageName}`, `${plural(stop.portions, "portion")} · ${stop.packageName}`) : undefined;
  if (!ops || !availability.data) {
    const error = day.error || availability.error;
    return (
      <Frame title={title ?? t("Pindah tanggal", "Move date")} context={context}>
        {error ? (
          <ReadError
            message={error}
            onRetry={() => {
              void day.reload();
              void availability.reload();
            }}
          />
        ) : (
          <SkeletonGroup label={t("Memuat tanggal", "Loading the dates")}>
            <View style={{ gap: 8 }}>
              <Skeleton height={48} radius={12} />
              <Skeleton height={240} radius={12} />
              <Skeleton height={48} radius={12} />
            </View>
          </SkeletonGroup>
        )}
      </Frame>
    );
  }
  if (!delivery || !canMoveDelivery(delivery)) {
    return (
      <Frame title={title ?? t("Pindah tanggal", "Move date")} context={context}>
        <ReadError
          message={t("Hari ini tidak bisa dipindah lagi.", "This day can no longer be moved.")}
          onRetry={() => void day.reload()}
        />
      </Frame>
    );
  }

  const sheetDate = (d: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <CalendarSheet
      month={monthOf(date)}
      days={calendarDays(availability.data, date)}
      current={date}
      window={{ from, to }}
      context={context ? `${title} · ${context}` : title}
      note={t("Pelanggan yang memakai aplikasi diberi tahu.", "Customers who use the app are told.")}
      onPick={() => undefined}
      confirmLabel={(d) => t(`Pindah ke ${sheetDate(d)}`, `Move to ${sheetDate(d)}`)}
      confirmDisabled={reason.trim().length < MIN_REASON}
      extra={
        <Field
          label={t("Alasan", "Reason")}
          value={reason}
          onChangeText={setReason}
          hint={t(`Minimal ${MIN_REASON} karakter.`, `At least ${MIN_REASON} characters.`)}
        />
      }
      onConfirm={async (newDate) => {
        try {
          await command("customer.deliveryChange", {
            catererId,
            id: delivery.id,
            version: delivery.version,
            date: newDate,
            reason: reason.trim(),
          });
        } catch (e) {
          throw new Error(
            errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
              t("Tanggal belum bisa dipindah. Coba lagi.", "The date could not be moved. Try again."),
          );
        }
        if (draftKey) reasonDrafts.delete(draftKey);
        setSaved(true);
      }}
    />
  );
}
