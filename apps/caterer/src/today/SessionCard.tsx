import { useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import * as Print from "expo-print";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  cookingRecap,
  deliveryRoute,
  routeShareText,
  type CookingRecap,
  type KitchenMeal,
  type SellerOperationsState,
  type Stop,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, colors, fontFor, Text } from "@catera/mobile-ui";
import { canMoveDelivery, ExceptionSheet } from "./ExceptionSheet";

function recapLines(recap: CookingRecap, title: string) {
  return [
    `*${title}* (${recap.total} porsi)`,
    ...recap.byDish.map((d) => `${d.count}× ${d.name}`),
  ].join("\n");
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <Text>{label}</Text>
      <Text style={{ fontFamily: fontFor("800"), fontVariant: ["tabular-nums"] }}>{String(value)}</Text>
    </View>
  );
}

/** Today: report a failed stop or move it. Tomorrow: only move, while the cutoff is ahead. */
const movable = (ops: SellerOperationsState, stop: Stop) => canMoveDelivery(ops.deliveries.find((d) => d.id === stop.deliveryId));

/**
 * One meal session of the day: what to cook, then where to take it. The header's right side is
 * left free for the session's own actions (cook, depart).
 */
export function SessionCard({
  ops,
  meal,
  date,
  report,
  caterer,
}: {
  ops: SellerOperationsState;
  meal: KitchenMeal;
  date: string;
  report: "today" | "tomorrow" | null;
  caterer: string;
}) {
  const { t, locale } = useMobile();
  const [part, setPart] = useState(0);
  const [reporting, setReporting] = useState<Stop | null>(null);
  const recap = cookingRecap(ops, meal);
  const stops = deliveryRoute(ops, meal);
  const parts = routeShareText(stops, { date, meal, caterer }, locale);
  // A same-day revision can shorten the route under a part index already advanced past its end.
  const at = Math.min(part, Math.max(parts.length - 1, 0));
  const title = meal === "lunch" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View>
          <Text variant="label" style={{ color: colors.muted }}>
            {title}
          </Text>
          <Text variant="number">{`${recap.total} porsi`}</Text>
        </View>
      </View>
      <View>
        <Text variant="label">{t("Per paket", "By package")}</Text>
        {recap.byPackage.map((p) => (
          <Row key={p.packageId} label={p.name} value={p.portions} />
        ))}
      </View>
      <View>
        <Text variant="label">{t("Yang dimasak", "To cook")}</Text>
        {recap.byDish.map((d) => (
          <Row key={d.category + d.name} label={d.name} value={d.count} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label={t("Bagikan", "Share")}
          onPress={() => void Share.share({ message: `${caterer}\n${recapLines(recap, title)}` })}
        />
        <Button
          style={{ flex: 1 }}
          variant="secondary"
          label={t("Cetak", "Print")}
          onPress={() =>
            void Print.printAsync({
              html: `<h2>${caterer} · ${title}: ${recap.total} porsi</h2><ul>${recap.byDish
                .map((d) => `<li>${d.count} × ${d.name}</li>`)
                .join("")}</ul>`,
            })
          }
        />
      </View>
      <Text variant="label" style={{ marginTop: 8 }}>{`${t("Antar", "Deliver")} · ${stops.length}`}</Text>
      <Card tone="sage">
        <Text variant="caption" style={{ color: colors.forest }}>
          {t(
            "Semua dianggap terkirim setelah jam antar selesai. Tandai hanya kalau ada masalah.",
            "Everything counts as delivered after the delivery window. Only flag problems.",
          )}
        </Text>
      </Card>
      {stops.map((s) => (
        <View
          key={s.deliveryId}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.forest,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.cream, fontFamily: fontFor("800"), fontSize: 13 }}>{String(s.n)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fontFor("800") }}>{s.name}</Text>
            <Text variant="caption">{[s.addressLine, s.area].filter(Boolean).join(", ")}</Text>
            <Text variant="label">{`${s.portions} porsi · ${s.packageName}`}</Text>
            {s.note ? (
              <Text variant="caption" style={{ color: colors.sunriseInk }}>
                {s.note}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${t("Buka peta", "Open map")} ${s.name}`}
            onPress={() => void Linking.openURL(s.mapsUrl)}
            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="location-outline" size={22} color={colors.forest} />
          </Pressable>
          {report === "today" || (report === "tomorrow" && movable(ops, s)) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${report === "today" ? t("Ada masalah", "Problem") : t("Pindah tanggal", "Move date")}: ${s.name}`}
              onPress={() => setReporting(s)}
              style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {stops.length ? (
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
    </Card>
  );
}
