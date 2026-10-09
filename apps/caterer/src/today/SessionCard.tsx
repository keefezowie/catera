import { Share, View } from "react-native";
import * as Print from "expo-print";
import { router } from "expo-router";
import {
  type CookingRecap,
  type KitchenMeal,
  type KitchenSession,
  type SellerOperationsState,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, fontFor, Text, useColors } from "@catera/mobile-ui";
import { CookingList } from "./CookingList";
import { DeliveryOrder } from "./DeliveryOrder";

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

/**
 * One meal session of the day. Before departure it is what to cook (the portions by package, the checklist, the share
 * and print buttons) with the delivery order below it, so a stop can still be reported or moved. Once the meal is out
 * for delivery the cooking part is gone and the order stands alone. The session (its recap and stops, without the rows
 * marked "Gagal diantar" or cancelled) comes from the screen, which also owns the cook and depart actions.
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
  const { t, actor } = useMobile();
  const c = useColors();
  const { recap, stops } = session;
  const departed = session.journey.stage === "out_for_delivery" || session.journey.stage === "delivered";
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
      {departed ? null : (
        <>
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
        </>
      )}
      <DeliveryOrder ops={ops} stops={stops} meal={meal} date={date} report={report} caterer={caterer} />
    </Card>
  );
}
