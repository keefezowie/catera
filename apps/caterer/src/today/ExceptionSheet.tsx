import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  errorLabel,
  jakartaDay,
  kitchenSession,
  type KitchenMeal,
  type SellerOperationsState,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Field,
  fontFor,
  PressableScale,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";
import { issueSteps } from "./exceptions";
import { ReadError } from "../ReadError";

/**
 * What customer.deliveryChange accepts for a new date: a day of the caterer's customer record that is
 * still scheduled, before its cutoff, in a package with flexible dates.
 */
export const canMoveDelivery = (d: SellerOperationsState["deliveries"][number] | undefined) =>
  !!(d?.customerRecordId ?? d?.customer.recordId) &&
  d!.status === "scheduled" &&
  d!.offer?.flexible === true &&
  new Date(d!.cutoff_at).getTime() > Date.now();

/** The meal's own status on that delivery; a meal with no row of its own counts as scheduled. */
const mealStatus = (d: SellerOperationsState["deliveries"][number] | undefined, meal: KitchenMeal) =>
  d?.meals.find((m) => m.meal === meal)?.status ?? "scheduled";

/**
 * Whether "Gagal diantar" would send anything: delivery.status walks a meal forward to "issue", so a meal that is
 * already delivered or failed has no steps and cannot be reported here.
 */
export const canReportFailed = (d: SellerOperationsState["deliveries"][number] | undefined, meal: KitchenMeal) =>
  !!d && issueSteps(mealStatus(d, meal)).length > 0;

/** The stop's sheet, over Hari ini: `/atur-antaran/{delivery}?meal=…&date=…`. */
export const stopHref = (deliveryId: string, meal: KitchenMeal, date: string) =>
  `/atur-antaran/${encodeURIComponent(deliveryId)}?meal=${meal}&date=${date}`;

/**
 * The day Hari ini showed when its "…" was tapped, so the sheet draws that stop at once instead of a skeleton. It is
 * only ever a fresh read (a copy kept from before the connection dropped has no "…"), and the sheet reads the day
 * again anyway; the fresh answer replaces it. One at a time, taken by the sheet that opens next.
 */
let parked: { key: string; ops: SellerOperationsState } | null = null;
export function parkDay(catererId: string, date: string, ops: SellerOperationsState) {
  parked = { key: `${catererId}:${date}`, ops };
}

type Kind = "failed" | "move";

/** A move typed in a stop's sheet: the new date and the reason, as typed. */
type Draft = { newDate: string; reason: string };

/**
 * Moves typed and not saved, per person and stop (`{actor}:{delivery}:{date}`), in memory only. Android's bottom sheet
 * closes on a swipe before anything can ask (`useUnsavedGuard`), so the move waits here and comes back when this
 * stop's sheet opens again, as the reply sheet keeps a reply. Saving or choosing "Buang" drops it; closing the app
 * forgets it.
 */
const moveDrafts = new Map<string, Draft>();

/** The sheet's frame: the stop's name, its portions and package under it, then the scrolling content. */
function Frame({ title, context, children }: { title: string; context?: string; children: ReactNode }) {
  const { t } = useMobile();
  return (
    <View testID="exception-sheet" style={{ flex: 1 }}>
      <SheetHeader title={title} context={context} closeLabel={t("Tutup", "Close")} />
      <SheetBody>{children}</SheetBody>
    </View>
  );
}

/**
 * The only per-stop actions, as a form sheet over Hari ini: the food did not arrive ("Gagal diantar", today only, while
 * the meal can still fail), or the day moves ("Pindah tanggal", the kitchen's own customers before the cutoff). Saving
 * closes the sheet with "Laporan tersimpan"; a typed move asks before it is dropped, and one an Android swipe closed
 * comes back the next time this person opens this stop.
 */
export function ExceptionSheet({ id, meal, date }: { id: string; meal: KitchenMeal; date: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  const c = useColors();
  const toast = useToast();
  const catererId = actor?.catererId ?? "";
  const key = `${catererId}:${date}`;
  const [seed] = useState(() => (parked?.key === key ? parked.ops : null));
  // Taken: the next sheet opens from its own tap, never from this one's day.
  useEffect(() => {
    if (parked?.key === key) parked = null;
  }, [key]);
  const day = useData(`stop-sheet:${key}`, () => runtime.api.sellerOperations(catererId, date));
  const ops = day.data ?? seed;

  const delivery = ops?.deliveries.find((d) => d.id === id);
  const stop = ops ? kitchenSession(ops, meal, new Date())?.stops.find((s) => s.deliveryId === id) : undefined;
  // Food that hasn't been sent can't have failed: Gagal diantar is for today's stops only.
  const canFail = date === jakartaDay(new Date()) && canReportFailed(delivery, meal);
  const canMove = canMoveDelivery(delivery);
  const [chosen, setChosen] = useState<Kind | null>(null);
  // What the sheet sends: the caterer's choice while it is still allowed, else the first one that is. Null when the
  // sheet has nothing to send (the fresh read may have taken a choice away).
  const kind: Kind | null =
    chosen === "failed" && canFail ? "failed" : chosen === "move" && canMove ? "move" : canFail ? "failed" : canMove ? "move" : null;
  const [newDate, setNewDateState] = useState("");
  const [reason, setReasonState] = useState("");
  // A move this person typed for this stop and lost to a swipe comes back, chosen, with what was typed: once the
  // session knows who is signed in, and once per person.
  const draftKey = actor?.id ? `${actor.id}:${id}:${date}` : null;
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  if (draftKey && restoredFor !== draftKey) {
    setRestoredFor(draftKey);
    const draft = moveDrafts.get(draftKey);
    if (draft) {
      setChosen("move");
      setNewDateState(draft.newDate);
      setReasonState(draft.reason);
    }
  }
  const keep = (move: Draft) => {
    if (!draftKey) return;
    if (move.newDate.trim() || move.reason.trim()) moveDrafts.set(draftKey, move);
    else moveDrafts.delete(draftKey);
  };
  const drop = () => {
    if (draftKey) moveDrafts.delete(draftKey);
  };
  const setNewDate = (value: string) => {
    setNewDateState(value);
    keep({ newDate: value, reason });
  };
  const setReason = (value: string) => {
    setReasonState(value);
    keep({ newDate, reason: value });
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const closed = useRef(false);
  const nothing = t("Tidak ada yang bisa dilaporkan untuk alamat ini.", "There is nothing to report for this stop.");

  // A move half typed asks before the sheet drops it; choosing an option alone does not.
  useUnsavedGuard(!saved && kind === "move" && (newDate.trim() !== "" || reason.trim() !== ""), t("laporan", "report"), {
    t,
    nounEn: "report",
    voice: "kamu",
    onDiscard: drop,
  });

  // Saved: the sheet closes back to Hari ini, which reads the day again, and a toast says it is done. After the guard
  // has seen `saved`, so closing never asks.
  useEffect(() => {
    if (!saved || closed.current) return;
    closed.current = true;
    toast.show({ message: t("Laporan tersimpan", "Report saved"), tone: "success" });
    router.back();
  }, [saved, toast, t]);

  if (!ops)
    return (
      <Frame title={t("Antaran", "Delivery")}>
        {day.error ? (
          <ReadError message={day.error} onRetry={() => void day.reload()} />
        ) : (
          <SkeletonGroup label={t("Memuat antaran", "Loading the delivery")}>
            <View style={{ gap: 8 }}>
              <Skeleton height={64} radius={12} />
              <Skeleton height={64} radius={12} />
              <Skeleton height={48} radius={12} />
            </View>
          </SkeletonGroup>
        )}
      </Frame>
    );

  async function save() {
    if (!delivery) return;
    const steps = issueSteps(mealStatus(delivery, meal));
    // Never close as if saved when nothing would be sent.
    if (kind === null || (kind === "failed" && !steps.length)) {
      setError(nothing);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (kind === "failed") {
        let version = delivery.version;
        for (const next of steps) {
          await command("delivery.status", { id: delivery.id, version, meal, status: next });
          version += 1;
        }
      } else
        await command("customer.deliveryChange", {
          catererId,
          id: delivery.id,
          version: delivery.version,
          date: newDate,
          reason: reason.trim(),
        });
      drop();
      setSaved(true);
    } catch (e) {
      setError(
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Belum tersimpan. Coba lagi.", "Not saved. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  const option = (value: Kind, title: string, body: string) => (
    <PressableScale
      haptic="select"
      accessibilityRole="radio"
      accessibilityState={{ checked: kind === value }}
      onPress={() => setChosen(value)}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: kind === value ? 2 : 1,
        borderColor: kind === value ? c.forest : c.line,
        backgroundColor: kind === value ? c.sage : c.surface,
        gap: 2,
      }}
    >
      <Text style={{ fontFamily: fontFor("800") }}>{title}</Text>
      <Text variant="caption">{body}</Text>
    </PressableScale>
  );

  return (
    <Frame
      title={stop?.name ?? delivery?.customer.name ?? t("Antaran", "Delivery")}
      context={stop ? `${stop.portions} porsi · ${stop.packageName}` : undefined}
    >
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {canFail
          ? option(
              "failed",
              t("Gagal diantar", "Not delivered"),
              t(
                "Makanan tidak sampai. Hari ini tidak dihitung terkirim dan tidak dibayarkan ke kamu. Hubungi pelanggan untuk menggantinya.",
                "The food didn't arrive. This day isn't counted as delivered or paid to you. Contact the customer to make up for it.",
              ),
            )
          : null}
        {canMove
          ? option(
              "move",
              t("Pindah tanggal", "Move date"),
              t("Hari ini dipindah ke tanggal lain. Pelanggan diberi tahu.", "Move this day to another date. The customer is told."),
            )
          : null}
        {kind === null ? <Text selectable>{nothing}</Text> : null}
      </View>
      {kind === "move" ? (
        <>
          <Field label={t("Tanggal baru (TTTT-BB-HH)", "New date (YYYY-MM-DD)")} value={newDate} onChangeText={setNewDate} />
          <Field label={t("Alasan", "Reason")} value={reason} onChangeText={setReason} />
        </>
      ) : null}
      {error ? <Text selectable style={{ color: c.danger }}>{error}</Text> : null}
      <Button
        label={t("Simpan laporan", "Save report")}
        disabled={
          busy || kind === null || (kind === "move" && (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || reason.trim().length < 5))
        }
        onPress={() => void save()}
      />
    </Frame>
  );
}
