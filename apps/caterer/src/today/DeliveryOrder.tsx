import { useEffect, useState } from "react";
import { AccessibilityInfo, Linking, Share, View } from "react-native";
import { router } from "expo-router";
import {
  routeMapsUrl,
  routeShareText,
  type KitchenMeal,
  type SellerOperationsState,
  type Stop,
} from "@catera/domain";
import { useMobile, plural } from "@catera/mobile-core";
import {
  Button,
  ListCard,
  SectionHeader,
  STOP_ROW_INSET,
  STOP_ROW_PICKING_INSET,
  StopRow,
  Text,
} from "@catera/mobile-ui";
import { ACTION, ActionPair, HEADING_GAP, LinkRow, TextAction } from "./rows";
import { canMoveDelivery, canReportFailed, parkDay, stopHref } from "./ExceptionSheet";
import { areaRuns, selectableStops, stopChoices, type Selection } from "./selection";

/** The stops shown before "Lihat {n} alamat lainnya": enough to start the route, short enough to see the buttons below. */
const FIRST_STOPS = 3;
/** Where `routeMapsUrl` cuts the route: a Google Maps directions link takes at most this many addresses. */
const ROUTE_LIMIT = 10;

/** How much of the order is open: every stop shown (`all`), and the WhatsApp part the next share sends (`part`). */
export type RouteView = { all: boolean; part: number; showAll(): void; setPart(part: number): void };

/**
 * The order's view state for one day and meal, reset when `resetKey` changes. Hari ini holds it above its FadeSwap: a
 * stage change re-keys the swap and mounts the order afresh, and a caterer who shared part 1 and then tapped Berangkat
 * antar must not send part 1 again.
 */
export function useRouteView(resetKey: string): RouteView {
  const [all, setAll] = useState(false);
  const [part, setPart] = useState(0);
  const [keyed, setKeyed] = useState(resetKey);
  if (keyed !== resetKey) {
    setKeyed(resetKey);
    setAll(false);
    setPart(0);
  }
  return { all, part, showAll: () => setAll(true), setPart };
}

/** Move it, on today or tomorrow, while the cutoff is ahead. */
const movable = (ops: SellerOperationsState, stop: Stop) =>
  canMoveDelivery(ops.deliveries.find((d) => d.id === stop.deliveryId));

/** Report it failed, on today only, while its meal still has a step to "issue" (not delivered, not failed). */
const failable = (ops: SellerOperationsState, stop: Stop, meal: KitchenMeal) =>
  canReportFailed(ops.deliveries.find((d) => d.id === stop.deliveryId), meal);

/**
 * "Urutan antar": a section whose heading carries how many addresses ("14 alamat") and "Pilih", over one `ListCard` of the
 * session's stops in route order, as numbered rows with a map button and, where the sheet would
 * send something, a "…" button for the stop's exception sheet, a form sheet over Hari ini (a failed delivery, or moving
 * the day). A delivered stop has
 * neither, so it has no "…". The first three show; the rest are one tap away. Under them: the whole route in Maps, the
 * route as WhatsApp text, and for today a line saying arrival is recorded by itself. The stops come from the session,
 * so a row marked "Gagal diantar" or cancelled is not in the list.
 */
export function DeliveryOrder({
  ops,
  stops,
  meal,
  date,
  report,
  caterer,
  selection,
  view,
}: {
  ops: SellerOperationsState;
  stops: Stop[];
  meal: KitchenMeal;
  date: string;
  /** Which exceptions the day allows; null on a copy kept from before the connection dropped, which cannot be acted on. */
  report: "today" | "tomorrow" | null;
  caterer: string;
  /** "Pilih" mode, owned by the screen so its bottom bar can read it. Left out, the list has no selection. */
  selection?: Selection;
  /** The expanded list and the next WhatsApp part, owned by the screen so they outlive a stage change. Left out, the
   * order keeps its own. */
  view?: RouteView;
}) {
  const { t, locale, actor } = useMobile();
  const own = useRouteView(`${date}:${meal}`);
  const { all, part, showAll, setPart } = view ?? own;
  const parts = routeShareText(stops, { date, meal, caterer }, locale);
  // A same-day revision can shorten the route under a part index already advanced past its end.
  const at = Math.min(part, Math.max(parts.length - 1, 0));
  const route = routeMapsUrl(stops);
  // Picking needs the whole list in view, and only today's stops on a fresh read can take an action.
  const picking = !!selection?.active && report === "today";
  // Android reads the title through its live region; iOS has none, so a change of the count is announced here.
  const pickedCount = selection?.selected.size ?? 0;
  useEffect(() => {
    if (process.env.EXPO_OS === "ios" && picking)
      AccessibilityInfo.announceForAccessibility(pickedCount ? t(`${pickedCount} dipilih`, `${pickedCount} selected`) : t("Pilih pengantaran", "Select deliveries"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedCount, picking]);
  const canPick = !!selection && report === "today" && selectableStops(stops).length > 0;
  const shown = all || picking ? stops : stops.slice(0, FIRST_STOPS);
  const hidden = stops.length - shown.length;

  // The "…" shows only when its sheet would send something, and its label says what: "Gagal diantar" (today, while the
  // meal can still fail), "Pindah tanggal" (while the day can move), or both. The label ends with the customer's name,
  // like the map button, so a screen reader hears which stop each "…" belongs to.
  const canFail = (s: Stop) => report === "today" && failable(ops, s, meal);
  const hasMore = (s: Stop) => report !== null && (canFail(s) || movable(ops, s));
  // The sheet draws from the day on screen at once, and reads it again itself.
  const openSheet = (s: Stop) => {
    parkDay(actor?.catererId ?? "", date, ops);
    router.push(stopHref(s.deliveryId, meal, date) as never);
  };
  const moreLabel = (s: Stop) =>
    `${
      canFail(s)
        ? movable(ops, s)
          ? t("Laporkan masalah atau pindah tanggal", "Report a problem or move the date")
          : t("Laporkan masalah", "Report a problem")
        : t("Pindah tanggal", "Move date")
    }: ${s.name}`;

  const count = t(`${stops.length} alamat`, plural(stops.length, "address", "addresses"));
  // One row of the list: the stop, its title "name · n porsi" over "package · address", and the customer's note for this
  // stop as one more line of the row where it has one.
  const stopRow = (s: Stop) => {
    const choice = stopChoices(s, t);
    const portions = t(`${s.portions} porsi`, plural(s.portions, "portion"));
    return (
      <StopRow
        key={s.deliveryId}
        testID={`stop-${s.n}`}
        n={s.n}
        name={s.name}
        detail={`${portions} · ${s.packageName}`}
        portions={portions}
        packageName={s.packageName}
        note={s.note || undefined}
        address={[s.addressLine, s.area].filter(Boolean).join(", ")}
        mapLabel={`${t("Buka peta", "Open map")} ${s.name}`}
        onMap={() => void Linking.openURL(s.mapsUrl)}
        onMore={hasMore(s) ? () => openSheet(s) : undefined}
        moreLabel={hasMore(s) ? moreLabel(s) : undefined}
        selection={
          picking
            ? {
                selected: selection!.selected.has(s.deliveryId),
                disabled: !choice.selectable,
                onToggle: () => selection!.toggle(s.deliveryId),
                note: choice.note ?? undefined,
              }
            : undefined
        }
      />
    );
  };
  const moreLink = hidden > 0 && !picking;

  return (
    <View testID="delivery-order">
      {picking ? (
        // Picking has its own heading: a live title ("Pilih pengantaran", then "n dipilih") and Selesai, on the same lines
        // as the section header it takes the place of.
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: ACTION,
            marginBottom: HEADING_GAP,
          }}
        >
          <View testID="order-live" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
            <Text testID="order-title" variant="section" accessibilityRole="header">
              {selection!.selected.size
                ? t(`${selection!.selected.size} dipilih`, `${selection!.selected.size} selected`)
                : t("Pilih pengantaran", "Select deliveries")}
            </Text>
          </View>
          <View style={{ flexShrink: 0 }}>
            <TextAction label={t("Selesai", "Done")} flush="end" onPress={selection!.stop} />
          </View>
        </View>
      ) : (
        <View testID="order-live" accessibilityLiveRegion="none">
          <SectionHeader
            // Pilih can arrive any time today (when cooking starts), so today's header keeps its 48 either way.
            reserveAction={!!selection && report === "today"}
            title={t("Urutan antar", "Delivery order")}
            count={stops.length ? count : undefined}
            action={
              canPick ? (
                <ActionPair>
                  <TextAction label={t("Pilih", "Select")} flush="end" onPress={selection!.start} />
                </ActionPair>
              ) : undefined
            }
          />
        </View>
      )}
      {stops.length ? (
        <>
          <View style={{ gap: HEADING_GAP }}>
            {(picking ? areaRuns(shown) : [{ area: "", stops: shown }]).map((run) => {
              const open = run.stops.filter((x) => stopChoices(x, t).selectable);
              const every = open.length > 0 && open.every((x) => selection!.selected.has(x.deliveryId));
              return (
                <View key={`${run.area}-${run.stops[0].deliveryId}`}>
                  {picking ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: ACTION }}>
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {run.area || t("Tanpa area", "No area")}
                      </Text>
                      {open.length ? (
                        <TextAction
                          label={every ? t("Lepas semua", "Clear all") : t("Pilih semua", "Select all")}
                          accessibilityLabel={`${every ? t("Lepas semua", "Clear all") : t("Pilih semua", "Select all")}: ${run.area || t("Tanpa area", "No area")}`}
                          flush="end"
                          onPress={() => selection!.setMany(open.map((x) => x.deliveryId), !every)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <ListCard inset={picking ? STOP_ROW_PICKING_INSET : STOP_ROW_INSET}>
                    {run.stops.map(stopRow)}
                    {moreLink ? (
                      <LinkRow
                        key="more"
                        inset={STOP_ROW_INSET}
                        label={
                          hidden === 1
                            ? t("Lihat 1 alamat lainnya", "Show 1 more address")
                            : t(`Lihat ${hidden} alamat lainnya`, `Show ${hidden} more addresses`)
                        }
                        onPress={showAll}
                      />
                    ) : null}
                  </ListCard>
                </View>
              );
            })}
          </View>
          {picking ? null : (
            <View style={{ gap: 8, marginTop: HEADING_GAP }}>
              {route ? (
                <Button
                  variant="secondary"
                  label={
                    // Only a route cut at the link's limit is "the first n"; stops with no address are left out quietly.
                    stops.length > route.count && route.count >= ROUTE_LIMIT
                      ? t(`Buka ${route.count} alamat pertama di Peta`, `Open the first ${route.count} addresses in Maps`)
                      : t("Buka semua di Peta", "Open all in Maps")
                  }
                  onPress={() => void Linking.openURL(route.url)}
                />
              ) : null}
              <Button
                variant="secondary"
                label={
                  at === 0
                    ? t("Bagikan rute ke WhatsApp", "Share route to WhatsApp")
                    : `${t("Bagikan bagian", "Share part")} ${at + 1}`
                }
                onPress={async () => {
                  await Share.share({ message: parts[at] });
                  setPart(at + 1 < parts.length ? at + 1 : 0);
                }}
              />
            </View>
          )}
          {report === "today" && !picking ? (
            <Text variant="meta" style={{ marginTop: HEADING_GAP }}>
              {t(
                "Tandai Sampai dengan foto bukti. Pelanggan lalu mengonfirmasi, dan tanpa laporan pengantaran ditandai sampai otomatis.",
                "Mark Arrived with a proof photo. The customer then confirms, and with no report the delivery is marked as arrived automatically.",
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <Text>{t("Tidak ada pengantaran untuk waktu makan ini.", "No deliveries for this meal.")}</Text>
      )}
    </View>
  );
}
