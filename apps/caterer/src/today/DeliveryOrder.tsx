import { useState } from "react";
import { Linking, Share, View } from "react-native";
import {
  routeMapsUrl,
  routeShareText,
  type KitchenMeal,
  type SellerOperationsState,
  type Stop,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, StopRow, Text, useColors } from "@catera/mobile-ui";
import { canMoveDelivery, ExceptionSheet } from "./ExceptionSheet";

/** The stops shown before "Lihat {n} alamat lainnya": enough to start the route, short enough to see the buttons below. */
const FIRST_STOPS = 3;
/** Where `routeMapsUrl` cuts the route: a Google Maps directions link takes at most this many addresses. */
const ROUTE_LIMIT = 10;
/** The width of the number badge and its gap in `StopRow`, so a note lines up under the name. */
const NOTE_INDENT = 40;

/** Today: report a failed stop or move it. Tomorrow: only move, while the cutoff is ahead. */
const movable = (ops: SellerOperationsState, stop: Stop) =>
  canMoveDelivery(ops.deliveries.find((d) => d.id === stop.deliveryId));

/**
 * "Urutan antar": the session's stops in route order, as numbered rows with a map button and, where the kitchen can act
 * on that day, a "…" button for the exception sheet (a failed delivery, or moving the day). The first three show;
 * the rest are one tap away. Under them: the whole route in Maps, the route as WhatsApp text, and for today a line
 * saying arrival is recorded by itself. The stops come from the session, so a row marked "Gagal diantar" or cancelled is
 * not in the list.
 */
export function DeliveryOrder({
  ops,
  stops,
  meal,
  date,
  report,
  caterer,
}: {
  ops: SellerOperationsState;
  stops: Stop[];
  meal: KitchenMeal;
  date: string;
  /** Which exceptions the day allows; null on a copy kept from before the connection dropped, which cannot be acted on. */
  report: "today" | "tomorrow" | null;
  caterer: string;
}) {
  const { t, locale } = useMobile();
  const c = useColors();
  const [all, setAll] = useState(false);
  const [part, setPart] = useState(0);
  const [reporting, setReporting] = useState<Stop | null>(null);
  const parts = routeShareText(stops, { date, meal, caterer }, locale);
  // A same-day revision can shorten the route under a part index already advanced past its end.
  const at = Math.min(part, Math.max(parts.length - 1, 0));
  const route = routeMapsUrl(stops);
  const shown = all ? stops : stops.slice(0, FIRST_STOPS);
  const hidden = stops.length - shown.length;

  const hasMore = (s: Stop) => report === "today" || (report === "tomorrow" && movable(ops, s));
  // The label says what the sheet can do: today it always has "Gagal diantar", and "Pindah tanggal" while the day can move.
  const moreLabel = (s: Stop) =>
    report === "today"
      ? movable(ops, s)
        ? t("Laporkan masalah atau pindah hari", "Report a problem or move the day")
        : t("Laporkan masalah", "Report a problem")
      : t("Pindah hari", "Move the day");

  return (
    <View testID="delivery-order" style={{ gap: 12 }}>
      <Text variant="label">{t("Urutan antar", "Delivery order")}</Text>
      {stops.length ? (
        <>
          <View>
            {shown.map((s, i) => (
              <View
                key={s.deliveryId}
                style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingVertical: 4 }}
              >
                <StopRow
                  testID={`stop-${s.n}`}
                  n={s.n}
                  name={s.name}
                  detail={`${s.portions} porsi · ${s.packageName}`}
                  address={[s.addressLine, s.area].filter(Boolean).join(", ")}
                  mapLabel={`${t("Buka peta", "Open map")} ${s.name}`}
                  onMap={() => void Linking.openURL(s.mapsUrl)}
                  onMore={hasMore(s) ? () => setReporting(s) : undefined}
                  moreLabel={hasMore(s) ? moreLabel(s) : undefined}
                />
                {s.note ? (
                  <View style={{ paddingLeft: NOTE_INDENT, paddingBottom: 8 }}>
                    <Text variant="caption" style={{ color: c.sunriseInk }}>
                      {s.note}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          {hidden > 0 ? (
            <Button
              variant="text"
              label={
                hidden === 1
                  ? t("Lihat 1 alamat lainnya", "Show 1 more address")
                  : t(`Lihat ${hidden} alamat lainnya`, `Show ${hidden} more addresses`)
              }
              onPress={() => setAll(true)}
            />
          ) : null}
          <View style={{ gap: 8 }}>
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
          {report === "today" ? (
            <Text variant="caption">
              {t(
                "Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah di alamatnya.",
                "Deliveries are recorded as arrived automatically, unless you report a problem at the address.",
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <Text>{t("Tidak ada pengantaran untuk waktu ini.", "No deliveries for this meal.")}</Text>
      )}
      {reporting ? (
        <ExceptionSheet
          stop={reporting}
          meal={meal}
          ops={ops}
          allowFailed={report === "today"}
          onClose={() => setReporting(null)}
        />
      ) : null}
    </View>
  );
}
