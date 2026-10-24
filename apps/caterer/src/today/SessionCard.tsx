import { Share, View } from "react-native";
import * as Print from "expo-print";
import { router } from "expo-router";
import {
  type CookingRecap,
  type KitchenMeal,
  type KitchenSession,
  type SellerOperationsState,
} from "@catera/domain";
import { useMobile, plural } from "@catera/mobile-core";
import { DecorativeIcon, KeyValueRow, ListCard, SectionHeader, Text, useColors } from "@catera/mobile-ui";
import { CookingList } from "./CookingList";
import { ActionPair, IconAction, SECTION_GAP, SUMMARY_HEIGHT, TextAction } from "./rows";
import type { Ticks } from "./ticks";
import { DeliveryOrder, type RouteView } from "./DeliveryOrder";
import type { Selection } from "./selection";

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

/**
 * One meal session of the day, as sections down the page (spec 3.1). Before departure: "Daftar masak" (the checklist, with
 * the lines about menus nobody has filled in directly under it) and "Per paket", then the delivery order. Once the meal is
 * out for delivery the cooking part folds into one 48 row, "Sudah dimasak · n porsi", and the order stands under it. The
 * session (its recap and stops, without the rows marked "Gagal diantar" or cancelled) comes from the screen, which also
 * owns the cook and depart actions and carries the count in its header.
 */
export function SessionCard({
  ops,
  session,
  ticks,
  meal,
  date,
  report,
  caterer,
  selection,
  route,
}: {
  ops: SellerOperationsState;
  session: KitchenSession;
  /** The checklist ticks, owned by the screen so a stage change does not read them again. */
  ticks: Ticks;
  meal: KitchenMeal;
  date: string;
  report: "today" | "tomorrow" | null;
  caterer: string;
  /** "Pilih" mode for the delivery order, owned by the screen. */
  selection?: Selection;
  /** The order's expanded list and next WhatsApp part, owned by the screen like `ticks` and `selection`. */
  route?: RouteView;
}) {
  const { t, actor } = useMobile();
  const c = useColors();
  const { recap, stops } = session;
  const departed = ["out_for_delivery", "arrived", "delivered"].includes(session.journey.stage);
  const missing = unfilledByPackage(recap.unfilled);
  // The shared and printed recap is written in Indonesian, like the rest of its text.
  const missingForSharing = missing.map((m) => `Menu belum diisi · ${m.packageName}: ${m.summary}`);
  // The shared and printed text is Indonesian whatever the app language, so its title is too.
  const sharedTitle = meal === "lunch" ? "Makan siang" : "Makan malam";
  return (
    <View testID="session-card" style={{ gap: SECTION_GAP }}>
      {departed ? (
        <ListCard>
          <View
            testID="cooked-summary"
            accessible
            accessibilityLabel={t(`Sudah dimasak · ${session.portions} porsi`, `Cooked · ${plural(session.portions, "portion")}`)}
            style={{ minHeight: SUMMARY_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <DecorativeIcon name="checkmark" size={20} color={c.forest} />
            <Text variant="bodyL" style={{ flex: 1 }}>
              {t(`Sudah dimasak · ${session.portions} porsi`, `Cooked · ${plural(session.portions, "portion")}`)}
            </Text>
          </View>
        </ListCard>
      ) : (
        <>
          <CookingList
            session={session}
            ticks={ticks}
            actions={
              <ActionPair>
                <IconAction
                  icon="share-outline"
                  flush
                  label={t("Bagikan", "Share")}
                  onPress={() => void Share.share({ message: `${caterer}
${recapLines(recap, sharedTitle, missingForSharing)}` })}
                />
                <IconAction
                  icon="print-outline"
                  label={t("Cetak", "Print")}
                  flush
                  onPress={() =>
                    void Print.printAsync({
                      html: `<h2>${caterer} · ${sharedTitle}: ${recap.total} porsi</h2><ul>${recap.byDish
                        .map((d) => `<li>${d.count} × ${d.name}</li>`)
                        .join("")}</ul>${missingForSharing.map((l) => `<p>${l}</p>`).join("")}`,
                    })
                  }
                />
              </ActionPair>
            }
            after={
              missing.length ? (
                <View style={{ gap: 4 }}>
                  {missing.map((m) => (
                    <View key={m.packageId} style={{ alignItems: "flex-start" }}>
                      {/* A to-do status, not an error: bold charcoal, never a bare danger caption (spec 5.2). */}
                      <Text variant="bodyStrong">
                        {`${t("Menu belum diisi", "Menu not filled in")} · ${m.packageName}: ${m.summary}`}
                      </Text>
                      {actor?.role === "owner" ? (
                        <TextAction
                          label={t("Isi menu", "Fill in menu")}
                          accessibilityLabel={`${t("Isi menu", "Fill in menu")} ${m.packageName}`}
                          flush="start"
                          onPress={() => router.push(`/menu/${date}?pkg=${m.packageId}&meal=${meal}` as never)}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null
            }
          />
          {recap.byPackage.length ? (
            <View testID="per-package">
              <SectionHeader title={t("Per paket", "By package")} />
              <ListCard inset={0}>
                {recap.byPackage.map((p) => (
                  <KeyValueRow
                    key={p.packageId}
                    testID={`per-package-${p.packageId}`}
                    label={p.name}
                    value={t(`${p.portions} porsi`, plural(p.portions, "portion"))}
                  />
                ))}
              </ListCard>
            </View>
          ) : null}
        </>
      )}
      {/* One order per meal: its expanded list and WhatsApp part belong to the day and meal they were opened on (the
          screen keeps them by `${date}:${meal}`, so a stage change does not reset them). */}
      <DeliveryOrder key={meal} ops={ops} stops={stops} meal={meal} date={date} report={report} caterer={caterer} selection={selection} view={route} />
    </View>
  );
}
