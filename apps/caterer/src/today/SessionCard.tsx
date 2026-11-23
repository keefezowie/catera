import { Fragment, useState } from "react";
import { Share, View } from "react-native";
import * as Print from "expo-print";
import {
  type CookingRecap,
  type KitchenMeal,
  type KitchenSession,
  type SellerOperationsState,
} from "@catera/domain";
import { useMobile, plural } from "@catera/mobile-core";
import { DecorativeIcon, KeyValueRow, ListCard, RollingNumber, SectionHeader, Segmented, Text, useColors } from "@catera/mobile-ui";
import { BelanjaLink } from "./BelanjaLink";
import { CookingList } from "./CookingList";
import { ActionPair, IconAction, SECTION_GAP, SUMMARY_HEIGHT, TextAction } from "./rows";
import type { Ticks } from "./ticks";
import { DeliveryOrder, type RouteView } from "./DeliveryOrder";
import type { Selection } from "./selection";
import { pushScreen } from "../nav";

export type TodayMode = "cook" | "deliver";

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

/** Whether the session still shows its cooking list (before departure); Belanja 7 hari then rides in that list's heading. */
export const cookingListShown = (session: KitchenSession) =>
  !["out_for_delivery", "arrived", "delivered"].includes(session.journey.stage);

/**
 * One meal session of the day, cleanly separated into two explicit modes:
 * - `cook` (Masak): Daftar masak checklist, missing-menu reminders, and Per paket breakdown.
 * - `deliver` (Antar): full Urutan antar route with area filters, 1-tap WhatsApp, 1-tap Sampai, Maps and WA route share.
 * Defaults to `cook` while preparing and auto-selects `deliver` once stops head out (or while Pilih is active), while
 * always allowing the cook to peek at either mode freely.
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
  mode: controlledMode,
  onModeChange,
}: {
  ops: SellerOperationsState;
  session: KitchenSession;
  /** The checklist ticks, owned by the screen so a stage change does not read them again. */
  ticks: Ticks;
  meal: KitchenMeal;
  date: string;
  report: "today" | "later" | null;
  caterer: string;
  /** "Pilih" mode for the delivery order, owned by the screen. */
  selection?: Selection;
  /** The order's expanded list and next WhatsApp part, owned by the screen like `ticks` and `selection`. */
  route?: RouteView;
  /** Controlled Masak | Antar mode from TodayScreen; falls back to stage-driven internal mode when omitted. */
  mode?: TodayMode;
  onModeChange?: (mode: TodayMode) => void;
}) {
  const { t, actor } = useMobile();
  const c = useColors();
  const { recap, stops } = session;
  const departed = !cookingListShown(session);
  const onTheRoad = session.counts.out_for_delivery + session.counts.arrived + session.counts.delivered > 0;
  const [ownMode, setOwnMode] = useState<TodayMode | null>(null);
  const autoMode: TodayMode = onTheRoad || selection?.active ? "deliver" : "cook";
  const activeMode: TodayMode = selection?.active ? "deliver" : (controlledMode ?? ownMode ?? autoMode);
  const setMode = (next: TodayMode) => {
    if (onModeChange) onModeChange(next);
    else setOwnMode(next);
  };

  const arrivedCount = session.counts.arrived + session.counts.delivered;
  const missing = unfilledByPackage(recap.unfilled);
  // The shared and printed recap is written in Indonesian, like the rest of its text.
  const missingForSharing = missing.map((m) => `Menu belum diisi · ${m.packageName}: ${m.summary}`);
  // The shared and printed text is Indonesian whatever the app language, so its title is too.
  const sharedTitle = meal === "lunch" ? "Makan siang" : "Makan malam";
  // One order per meal: its expanded list and WhatsApp part belong to the day and meal they were opened on (the screen keeps
  // them by `${date}:${meal}`, so a stage change does not reset them).
  const order = (
    <DeliveryOrder
      key={`order-${meal}`}
      ops={ops}
      stops={stops}
      meal={meal}
      date={date}
      report={report}
      caterer={caterer}
      selection={selection}
      view={route}
    />
  );
  const cooking = (
    <Fragment key="cooking">
      {departed ? (
        <ListCard>
          <View
            testID="cooked-summary"
            accessible
            accessibilityLabel={t(`Sudah dimasak · ${session.portions} porsi`, `Cooked · ${plural(session.portions, "portion")}`)}
            style={{ minHeight: SUMMARY_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <DecorativeIcon name="checkmark" size={20} color={c.forest} />
            <View style={{ flex: 1 }}>
              <RollingNumber
                variant="bodyL"
                style={{ fontVariant: ["tabular-nums"] }}
                value={t(`Sudah dimasak · ${session.portions} porsi`, `Cooked · ${plural(session.portions, "portion")}`)}
              />
            </View>
          </View>
        </ListCard>
      ) : null}
      <CookingList
        session={session}
        ticks={ticks}
        actions={
          <ActionPair>
            <BelanjaLink />
            <IconAction
              icon="share-outline"
              flush
              label={t("Bagikan", "Share")}
              onPress={() => void Share.share({ message: [caterer, recapLines(recap, sharedTitle, missingForSharing)].join("\n") })}
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
                      onPress={() => pushScreen(`/menu/${date}?pkg=${m.packageId}&meal=${meal}`)}
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
    </Fragment>
  );

  const cookLabel = t(`Masak · ${session.portions}`, `Cook · ${session.portions}`);
  const deliverLabel =
    arrivedCount > 0
      ? t(`Antar · ${arrivedCount}/${stops.length}`, `Deliver · ${arrivedCount}/${stops.length}`)
      : t(`Antar · ${stops.length}`, `Deliver · ${stops.length}`);

  return (
    <View testID="session-card" style={{ gap: SECTION_GAP }}>
      {!selection?.active ? (
        <View testID="today-mode-switch">
          <Segmented<TodayMode>
            value={activeMode}
            onChange={setMode}
            options={[
              { value: "cook", label: cookLabel },
              { value: "deliver", label: deliverLabel },
            ]}
          />
        </View>
      ) : null}
      {activeMode === "cook" ? cooking : order}
    </View>
  );
}
