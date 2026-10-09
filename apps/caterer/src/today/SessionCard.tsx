import { useState } from "react";
import { Linking, Share, View } from "react-native";
import * as Print from "expo-print";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  routeShareText,
  type CookingRecap,
  type KitchenMeal,
  type KitchenSession,
  type SellerOperationsState,
  type Stop,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, fontFor, PressableScale, Text, useColors } from "@catera/mobile-ui";
import { CookingList } from "./CookingList";
import { canMoveDelivery, ExceptionSheet } from "./ExceptionSheet";

/**
 * The slots nobody has filled yet, one entry per package ("2 lauk, 1 nasi, 1 sayur", biggest first). Packages are
 * never summed together: a menu is filled per package, so each needs its own line and its own way in.
 */
function unfilledByPackage(unfilled: CookingRecap["unfilled"]) {
  const packages = new Map<string, { packageId: string; packageName: string; groups: Map<string, number> }>();
  for (const u of unfilled) {
    const entry = packages.get(u.packageId) ?? { packageId: u.packageId, packageName: u.packageName, groups: new Map() };
    const group = u.group.toLowerCase();
    entry.groups.set(group, (entry.groups.get(group) ?? 0) + u.slots);
    packages.set(u.packageId, entry);
  }
  return [...packages.values()].map((p) => ({
    packageId: p.packageId,
    packageName: p.packageName,
    summary: [...p.groups]
      .sort((a, b) => b[1] - a[1])
      .map(([group, n]) => `${n} ${group}`)
      .join(", "),
  }));
}

function recapLines(recap: CookingRecap, title: string, unfilledLines: string[]) {
  return [
    `*${title}* (${recap.total} porsi)`,
    ...recap.byDish.map((d) => `${d.count}× ${d.name}`),
    ...unfilledLines,
  ].join("\n");
}

function Row({ label, value }: { label: string; value: number }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
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
 * One meal session of the day: what to cook, then where to take it. The session (its recap and stops, without the
 * rows marked "Gagal diantar" or cancelled) comes from the screen, which also owns the cook and depart actions.
 */
export function SessionCard({
  ops,
  session,
  catererId,
  meal,
  date,
  report,
  caterer,
}: {
  ops: SellerOperationsState;
  session: KitchenSession;
  /** The kitchen's id, which keys the checklist ticks stored on this phone. */
  catererId: string;
  meal: KitchenMeal;
  date: string;
  report: "today" | "tomorrow" | null;
  caterer: string;
}) {
  const { t, locale, actor } = useMobile();
  const c = useColors();
  const [part, setPart] = useState(0);
  const [reporting, setReporting] = useState<Stop | null>(null);
  const { recap, stops } = session;
  const parts = routeShareText(stops, { date, meal, caterer }, locale);
  // A same-day revision can shorten the route under a part index already advanced past its end.
  const at = Math.min(part, Math.max(parts.length - 1, 0));
  const missing = unfilledByPackage(recap.unfilled);
  // The shared and printed recap is written in Indonesian, like the rest of its text.
  const missingForSharing = missing.map((m) => `Menu belum diisi · ${m.packageName}: ${m.summary}`);
  const title = meal === "lunch" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  return (
    <Card>
      {/* The header's count card already carries the portion count; the card only names its session. */}
      <Text variant="label" style={{ color: c.muted }}>
        {title}
      </Text>
      <View>
        <Text variant="label">{t("Per paket", "By package")}</Text>
        {recap.byPackage.map((p) => (
          <Row key={p.packageId} label={p.name} value={p.portions} />
        ))}
      </View>
      {recap.byDish.length || missing.length ? (
        <View>
          <CookingList session={session} catererId={catererId} date={date} />
          {missing.map((m) => (
            <View key={m.packageId} style={{ paddingTop: 8, alignItems: "flex-start" }}>
              <Text style={{ color: c.sunriseInk }}>
                {`${t("Menu belum diisi", "Menu not filled in")} · ${m.packageName}: ${m.summary}`}
              </Text>
              {actor?.role === "owner" ? (
                <Button
                  variant="text"
                  label={t("Isi menu", "Fill in menu")}
                  accessibilityLabel={`${t("Isi menu", "Fill in menu")} ${m.packageName}`}
                  onPress={() => router.push(`/menu/${date}?pkg=${m.packageId}&meal=${meal}` as never)}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label={t("Bagikan", "Share")}
          onPress={() => void Share.share({ message: `${caterer}\n${recapLines(recap, title, missingForSharing)}` })}
        />
        <Button
          style={{ flex: 1 }}
          variant="secondary"
          label={t("Cetak", "Print")}
          onPress={() =>
            void Print.printAsync({
              html: `<h2>${caterer} · ${title}: ${recap.total} porsi</h2><ul>${recap.byDish
                .map((d) => `<li>${d.count} × ${d.name}</li>`)
                .join("")}</ul>${missingForSharing.map((l) => `<p>${l}</p>`).join("")}`,
            })
          }
        />
      </View>
      <Text variant="label" style={{ marginTop: 8 }}>{`${t("Antar", "Deliver")} · ${stops.length}`}</Text>
      <Card tone="sage">
        <Text variant="caption" style={{ color: c.forest }}>
          {t(
            "Semua dianggap terkirim setelah jam antar selesai. Tandai hanya kalau ada masalah.",
            "Everything counts as delivered after the delivery window. Only flag problems.",
          )}
        </Text>
      </Card>
      {stops.map((s) => (
        <View
          key={s.deliveryId}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: c.forest,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: c.cream, fontFamily: fontFor("800"), fontSize: 13 }}>{String(s.n)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fontFor("800") }}>{s.name}</Text>
            <Text variant="caption">{[s.addressLine, s.area].filter(Boolean).join(", ")}</Text>
            <Text variant="label">{`${s.portions} porsi · ${s.packageName}`}</Text>
            {s.note ? (
              <Text variant="caption" style={{ color: c.sunriseInk }}>
                {s.note}
              </Text>
            ) : null}
          </View>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`${t("Buka peta", "Open map")} ${s.name}`}
            onPress={() => void Linking.openURL(s.mapsUrl)}
            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="location-outline" size={22} color={c.forest} />
          </PressableScale>
          {report === "today" || (report === "tomorrow" && movable(ops, s)) ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${report === "today" ? t("Ada masalah", "Problem") : t("Pindah tanggal", "Move date")}: ${s.name}`}
              onPress={() => setReporting(s)}
              style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={c.muted} />
            </PressableScale>
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
