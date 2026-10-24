import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, type DimensionValue } from "react-native";
import { router, useNavigation, useRoute } from "expo-router";
import {
  errorLabel,
  jakartaDay,
  kitchenSession,
  type KitchenMeal,
  type SellerOperationsState,
} from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile, plural } from "@catera/mobile-core";
import {
  Button,
  DecorativeIcon,
  FormError,
  GLYPH_BARE,
  GLYPH_INSET,
  GlyphCircle,
  ListCard,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  TwoLineRow,
  useBusy,
  useColors,
  useHaptic,
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

/** The pinned primary action's loading block: the 50 button the footer will hold, drawn in the footer so it does not pop in. */
export function FooterSkeleton({ testID }: { testID: string }) {
  return (
    <SheetFooter>
      <SkeletonGroup>
        <Skeleton testID={testID} height={nativeLayout.control.button} radius={nativeLayout.radius.control} />
      </SkeletonGroup>
    </SheetFooter>
  );
}

/** One text line as a block: the line's own height with the block centred in it, like the glyphs it stands for. `onMood` draws it in the darker track tone, for a block on a sage card, where the plain fill is the card's own colour. */
export function SkeletonLine({ width, block, line, onMood }: { width: DimensionValue; block: number; line: number; onMood?: boolean }) {
  return (
    <View style={{ height: line, justifyContent: "center" }}>
      <Skeleton width={width} height={block} radius={block / 2} onMood={onMood} />
    </View>
  );
}

/**
 * One option of the stop's sheet: a `TwoLineRow` (64 min, growing with the text, since the copy is two sentences and
 * wraps instead of ending in an ellipsis) whose leading glyph is a 40 circle on the surface, because the card it sits
 * in is the sage one. `onPress` makes it a button with a chevron; without one it is the report's own description,
 * which the footer's button sends.
 */
function OptionRow({
  testID,
  glyph,
  title,
  body,
  onPress,
  accessibilityLabel,
}: {
  testID: string;
  glyph: "warning-outline" | "calendar-outline";
  title: string;
  body: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const haptic = useHaptic();
  return (
    <TwoLineRow
      testID={testID}
      wrap
      leading={
        <GlyphCircle testID={`${testID}-glyph`} tone={c.surface}>
          <DecorativeIcon name={glyph} size={GLYPH_BARE} color={c.forest} />
        </GlyphCircle>
      }
      title={title}
      meta={body}
      trailing={onPress ? <DecorativeIcon name="chevron-forward" size={20} color={c.muted} /> : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
    />
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
    toast.show({ message: t("Ditandai gagal diantar", "Marked not delivered"), tone: "success" });
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
          <>
            <SkeletonGroup label={t("Memuat pengantaran", "Loading the delivery")}>
              <View testID="exception-skeleton">
                <ListCard inset={GLYPH_INSET} tone="sage">
                  {[0, 1].map((i) => (
                    <View
                      key={i}
                      testID={`exception-skeleton-row-${i}`}
                      style={{ height: nativeLayout.row.compact, flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}
                    >
                      <Skeleton width={40} height={40} radius={20} onMood />
                      <View style={{ flex: 1 }}>
                        {/* rowTitle's 22 line and meta's 18 line, centred in the 64 row as the loaded text is. */}
                        <SkeletonLine width={i ? "45%" : "55%"} block={12} line={22} onMood />
                        <SkeletonLine width={i ? "75%" : "85%"} block={10} line={18} onMood />
                      </View>
                    </View>
                  ))}
                </ListCard>
              </View>
            </SkeletonGroup>
            <FooterSkeleton testID="exception-skeleton-footer" />
          </>
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
      context={stop ? t(`${stop.portions} porsi · ${stop.packageName}`, `${plural(stop.portions, "portion")} · ${stop.packageName}`) : undefined}
    >
      {canFail || canMove ? (
        <ListCard inset={GLYPH_INSET} tone="sage">
          {canFail ? (
            <OptionRow
              testID="failed-option"
              glyph="warning-outline"
              title={t("Gagal diantar", "Not delivered")}
              body={t(
                "Makanan tidak sampai. Hari ini tidak dihitung sebagai pengantaran dan tidak dibayar ke kamu. Hubungi pelanggan untuk atur penggantinya.",
                "The food didn't arrive. This day isn't counted as a delivery or paid to you. Contact the customer to arrange a replacement.",
              )}
            />
          ) : null}
          {canMove ? (
            <OptionRow
              testID="move-option"
              glyph="calendar-outline"
              title={t("Pindah tanggal", "Move date")}
              body={t(
                "Pindahkan pengantaran ini ke tanggal lain. Pelanggan yang memakai aplikasi diberi tahu.",
                "Move this delivery to another date. Customers who use the app get notified.",
              )}
              accessibilityLabel={t("Pindah tanggal", "Move date")}
              onPress={openMove}
            />
          ) : null}
        </ListCard>
      ) : (
        <Text selectable>{nothing}</Text>
      )}
      {/* The primary (and the failed save above it) is pinned to the sheet's foot: an Android form sheet opens at full height, so a button in the body would float mid-sheet. */}
      {canFail || failure ? (
        <SheetFooter>
          {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
          {canFail ? <Button label={t("Tandai gagal diantar", "Mark not delivered")} busy={busy} onPress={() => void save()} /> : null}
        </SheetFooter>
      ) : null}
    </Frame>
  );
}
