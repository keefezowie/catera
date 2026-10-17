import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useNavigation, useRoute } from "expo-router";
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
  FormError,
  fontFor,
  PressableScale,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useBusy,
  useColors,
  useToast,
} from "@catera/mobile-ui";
import { issueSteps } from "./exceptions";
import { pushAfterClose, type SheetEvents } from "./handoff";
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
export const mealStatus = (d: SellerOperationsState["deliveries"][number] | undefined, meal: KitchenMeal) =>
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

/** The calendar sheet that moves the stop's day, in place of the stop's sheet: `/pindah-tanggal/{delivery}?meal=…&date=…`. */
export const moveHref = (deliveryId: string, meal: KitchenMeal, date: string) =>
  `/pindah-tanggal/${encodeURIComponent(deliveryId)}?meal=${meal}&date=${date}`;

/**
 * The day Hari ini showed when its "…" was tapped, so the sheet draws that stop at once instead of a skeleton. It is
 * only ever a fresh read (a copy kept from before the connection dropped has no "…"), and the sheet reads the day
 * again anyway; the fresh answer replaces it. One at a time, taken by the sheet that opens next.
 */
let parked: { key: string; ops: SellerOperationsState } | null = null;
export function parkDay(catererId: string, date: string, ops: SellerOperationsState) {
  parked = { key: `${catererId}:${date}`, ops };
}
/** Takes the parked day if it is the one asked for. */
export function takeParkedDay(key: string): SellerOperationsState | null {
  const found = parked?.key === key ? parked.ops : null;
  if (found) parked = null;
  return found;
}

/** The sheet's frame: the stop's name, its portions and package under it, then the scrolling content. */
export function Frame({ title, context, children }: { title: string; context?: string; children: ReactNode }) {
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
 * the meal can still fail), or the day moves ("Pindah tanggal", the kitchen's own customers before the cutoff). Failing a
 * stop saves here and closes the sheet with "Laporan tersimpan". Moving opens the calendar sheet in this one's place
 * (`MoveSheet`), which needs the room.
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
  // This sheet's own route, for the hand-off to the calendar: its "gone" event is targeted at this key.
  const navigation = useNavigation();
  const route = useRoute();
  const day = useData(`stop-sheet:${key}`, () => runtime.api.sellerOperations(catererId, date));
  const ops = day.data ?? seed;

  const delivery = ops?.deliveries.find((d) => d.id === id);
  const stop = ops ? kitchenSession(ops, meal, new Date())?.stops.find((s) => s.deliveryId === id) : undefined;
  // Food that hasn't been sent can't have failed: Gagal diantar is for today's stops only.
  const canFail = date === jakartaDay(new Date()) && canReportFailed(delivery, meal);
  const canMove = canMoveDelivery(delivery);
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const closed = useRef(false);
  const nothing = t("Tidak ada yang bisa dilaporkan untuk alamat ini.", "There is nothing to report for this stop.");

  // Saved: the sheet closes back to Hari ini, which reads the day again, and a toast says it is done.
  useEffect(() => {
    if (!saved || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({ message: t("Laporan tersimpan", "Report saved"), tone: "success" });
  }, [saved, toast, t]);

  const [busy, save] = useBusy(async () => {
    if (!delivery) return;
    const steps = issueSteps(mealStatus(delivery, meal));
    // Never close as if saved when nothing would be sent.
    if (!canFail || !steps.length) {
      setFailure((f) => ({ message: nothing, key: (f?.key ?? 0) + 1 }));
      return;
    }
    setFailure(null);
    try {
      let version = delivery.version;
      for (const next of steps) {
        await command("delivery.status", { id: delivery.id, version, meal, status: next });
        version += 1;
      }
      setSaved(true);
    } catch (e) {
      setFailure((f) => ({
        message:
          errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Laporan belum tersimpan. Coba lagi.", "The report was not saved. Try again."),
        key: (f?.key ?? 0) + 1,
      }));
    }
  });

  if (!ops)
    return (
      <Frame title={t("Pengantaran", "Delivery")}>
        {day.error ? (
          <ReadError message={day.error} onRetry={() => void day.reload()} />
        ) : (
          <SkeletonGroup label={t("Memuat pengantaran", "Loading the delivery")}>
            <View style={{ gap: 8 }}>
              <Skeleton height={64} radius={12} />
              <Skeleton height={64} radius={12} />
              <Skeleton height={48} radius={12} />
            </View>
          </SkeletonGroup>
        )}
      </Frame>
    );

  const openMove = () => {
    parkDay(catererId, date, ops);
    // The calendar is a root-stack sheet: this tab sheet closes, and the root route opens once the native dismissal has
    // ended (the tab stack reports it, see `pushAfterClose`), not when this component unmounts.
    pushAfterClose(moveHref(id, meal, date), {
      sheet: navigation && route ? { events: navigation as unknown as SheetEvents, key: route.key } : undefined,
    });
  };

  return (
    <Frame
      title={stop?.name ?? delivery?.customer.name ?? t("Pengantaran", "Delivery")}
      context={stop ? `${stop.portions} porsi · ${stop.packageName}` : undefined}
    >
      <View style={{ gap: 8 }}>
        {canFail ? (
          <View
            testID="failed-option"
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, gap: 2 }}
          >
            <Text style={{ fontFamily: fontFor("800") }}>{t("Gagal diantar", "Not delivered")}</Text>
            <Text variant="caption">
              {t(
                "Makanan tidak sampai. Hari ini tidak dihitung terkirim dan tidak dibayarkan ke kamu. Hubungi pelanggan untuk menggantinya.",
                "The food didn't arrive. This day isn't counted as delivered or paid to you. Contact the customer to make up for it.",
              )}
            </Text>
          </View>
        ) : null}
        {canMove ? (
          <PressableScale
            haptic="select"
            accessibilityRole="button"
            accessibilityLabel={t("Pindah tanggal", "Move date")}
            onPress={openMove}
            style={{
              minHeight: 48,
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.surface,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fontFor("800") }}>{t("Pindah tanggal", "Move date")}</Text>
              <Text variant="caption">
                {t(
                  "Hari ini dipindah ke tanggal lain. Pelanggan yang memakai aplikasi diberi tahu.",
                  "Move this day to another date. Customers using the app are told.",
                )}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </PressableScale>
        ) : null}
        {!canFail && !canMove ? <Text selectable>{nothing}</Text> : null}
      </View>
      {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
      {canFail ? <Button label={t("Simpan laporan", "Save report")} busy={busy} onPress={() => void save()} /> : null}
    </Frame>
  );
}
