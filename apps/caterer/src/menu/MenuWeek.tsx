import { useState } from "react";
import { ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import {
  addDays,
  errorLabel,
  jakartaDay,
  menuShareText,
  shortDate,
  type MealMenu,
  type MenuMonth,
  type SellerOffer,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Button, Card, Chip, colors, fontFor, PressableRow, RoundButton, Screen, Segmented, Text } from "@catera/mobile-ui";
import { copyWeekBatches, weekDates } from "./logic";

export type MenuDay = { date: string; version: number; editable: boolean; details: MealMenu | null };

/** Saved menus for the given dates, across however many months they span. */
export async function loadMenus(
  runtime: MobileRuntime,
  offer: SellerOffer,
  meal: string,
  dates: string[],
): Promise<MenuDay[]> {
  // The API takes the first day of the month (YYYY-MM-01).
  const months = [...new Set(dates.map((d) => `${d.slice(0, 7)}-01`))];
  const results = await Promise.all(
    months.map((m) => runtime.api.menuMonth(offer.id, offer.contentRevision ?? 0, m, meal)),
  );
  const byDate = new Map<string, MenuMonth["dates"][number]>();
  for (const r of results) for (const d of r.dates) byDate.set(d.date, d);
  return dates.map((date) => {
    const found = byDate.get(date);
    return { date, version: found?.version ?? 0, editable: found?.editable ?? false, details: found?.details ?? null };
  });
}

/** A failed menu read: say so plainly and offer a retry, never an empty week or endless loading. */
export function MenuLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useMobile();
  return (
    <Screen>
      <Text variant="title">{t("Menu", "Menu")}</Text>
      <Text>{t("Menu belum bisa dimuat.", "The menu couldn't be loaded.")}</Text>
      <Button label={t("Coba lagi", "Try again")} onPress={onRetry} />
    </Screen>
  );
}

export const mealOf = (offer: SellerOffer, meal: string) =>
  offer.menus.find((m) => m.meal === meal) ?? offer.menus[0];

/** Menu: this week's dishes per delivery day for one package. */
export function MenuWeek() {
  const { runtime, actor, t, locale, command } = useMobile();
  const catererId = actor?.catererId ?? "";
  const canEdit = actor?.role === "owner";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const offers = (ops.data?.offers ?? []).filter((o) => o.status === "published");
  const [packageId, setPackageId] = useState("");
  const [week, setWeek] = useState(0);
  const offer = offers.find((o) => o.id === packageId) ?? offers[0];
  const meals = offer ? (offer.meal === "both" ? ["lunch", "dinner"] : [offer.meal]) : ["lunch"];
  const [mealChoice, setMeal] = useState("lunch");
  const meal = meals.includes(mealChoice) ? mealChoice : meals[0];
  const today = jakartaDay(new Date());
  const dates = offer ? weekDates(addDays(today, week * 7), offer.weekdays) : [];
  const days = useData(`menu-week:${offer?.id}:${meal}:${dates[0]}`, () =>
    offer ? loadMenus(runtime, offer, meal, dates) : Promise.resolve([]),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const template = offer ? mealOf(offer, meal) : undefined;
  // Copying and sharing both act on the visible week, so they wait for it and for something in it.
  const weekLoaded = !!days.data;
  const hasMenu = (days.data ?? []).some((d) => d.details?.items?.length);
  const copyNote = (copied: number, skipped: number) =>
    skipped
      ? t(`${copied} hari disalin · ${skipped} dilewati karena sudah lewat atau sudah diisi`, `${copied} days copied · ${skipped} skipped (past or already filled)`)
      : t(`${copied} hari disalin`, `${copied} days copied`);

  async function copyLastWeek() {
    if (!offer) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const previous = await loadMenus(runtime, offer, meal, dates.map((d) => addDays(d, -7)));
      const filled = previous.filter((d) => d.details?.items?.length) as { date: string; details: MealMenu }[];
      const targets = new Map(
        (days.data ?? []).map((d) => [d.date, { version: d.version, editable: d.editable, filled: !!d.details?.items?.length }] as const),
      );
      const { batches, skipped } = copyWeekBatches(filled, targets);
      let copied = 0;
      for (const batch of batches) {
        await command("menu.saveBatch", {
          catererId,
          packageId: offer.id,
          contentRevision: offer.contentRevision ?? 0,
          meal,
          dates: batch.dates,
          details: batch.details,
        });
        copied += batch.dates.length;
        setNote(copyNote(copied, skipped));
      }
      setNote(copyNote(copied, skipped));
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum tersimpan.", "Not saved."));
    } finally {
      setBusy(false);
    }
  }

  function shareMenu() {
    if (!offer || !template) return;
    const lines = (days.data ?? [])
      .filter((d) => d.details?.items?.length)
      .map((d) => ({
        date: d.date,
        lines: (template.composition ?? []).map((g) => ({
          category: g.name,
          dishes: (d.details!.items ?? []).filter((i) => i.groupId === g.id).map((i) => i.name),
        })),
      }));
    void Share.share({
      message: menuShareText(lines, { caterer: ops.data?.caterer.name ?? "", packageName: offer.name }, locale),
    });
  }

  if ((ops.error && !ops.data) || (days.error && !days.data))
    return <MenuLoadError onRetry={() => void (ops.error && !ops.data ? ops.reload() : days.reload())} />;

  if (!ops.data)
    return (
      <Screen>
        <Text variant="title">{t("Menu", "Menu")}</Text>
        <Text variant="caption">{t("Memuat…", "Loading…")}</Text>
      </Screen>
    );

  if (!offers.length)
    return (
      <Screen>
        <Text variant="title">{t("Menu", "Menu")}</Text>
        {canEdit ? (
          <>
            <Text>{t("Buat paket dulu, lalu isi menunya di sini.", "Create a package first, then fill its menu here.")}</Text>
            <Button label={t("Buat paket", "Create a package")} onPress={() => router.push("/paket/baru" as never)} />
          </>
        ) : (
          <Text>{t("Belum ada paket.", "No packages yet.")}</Text>
        )}
      </Screen>
    );

  return (
    <Screen>
      <Text variant="title">{t("Menu", "Menu")}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <RoundButton icon="chevron-back" label={t("Minggu sebelumnya", "Previous week")} onPress={() => setWeek((w) => w - 1)} />
        <Text variant="label">
          {week === 0 ? t("Minggu ini", "This week") : week === 1 ? t("Minggu depan", "Next week") : dates[0] ? shortDate(dates[0], locale) : ""}
        </Text>
        <RoundButton icon="chevron-forward" label={t("Minggu berikutnya", "Next week")} onPress={() => setWeek((w) => w + 1)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {offers.map((o) => (
          <Chip key={o.id} label={o.name} selected={o.id === offer?.id} onPress={() => setPackageId(o.id)} />
        ))}
      </ScrollView>
      {meals.length > 1 ? (
        <Segmented
          value={meal}
          onChange={setMeal}
          options={[
            { value: "lunch", label: t("Siang", "Lunch") },
            { value: "dinner", label: t("Malam", "Dinner") },
          ]}
        />
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {canEdit ? (
          <Button style={{ flex: 1 }} variant="secondary" disabled={busy || !weekLoaded} label={t("Salin minggu lalu", "Copy last week")} onPress={() => void copyLastWeek()} />
        ) : null}
        <Button style={{ flex: 1 }} variant="secondary" disabled={!hasMenu} label={t("Bagikan menu", "Share menu")} onPress={shareMenu} />
      </View>
      {weekLoaded && !hasMenu ? (
        <Text variant="caption">{t("Belum ada menu untuk dibagikan", "No menu to share yet")}</Text>
      ) : null}
      {!weekLoaded ? <Text variant="caption">{t("Memuat…", "Loading…")}</Text> : null}
      {note ? <Text variant="caption">{note}</Text> : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {(days.data ?? []).map((d) => {
        const past = d.date < today;
        const items = d.details?.items ?? [];
        const open = () => canEdit && offer && router.push(`/menu/${d.date}?pkg=${offer.id}&meal=${meal}` as never);
        return (
          <Card key={d.date}>
            <PressableRow accessibilityRole="button" onPress={open} disabled={!canEdit} style={{ gap: 6 }}>
              <Text variant="heading">{shortDate(d.date, locale)}</Text>
              {items.length ? (
                (template?.composition ?? []).map((g) => (
                  <Text key={g.id}>
                    <Text variant="caption">{`${g.name}  `}</Text>
                    {items.filter((i) => i.groupId === g.id).map((i) => i.name).join(", ")}
                  </Text>
                ))
              ) : past ? (
                <Text variant="caption" style={{ color: colors.muted }}>
                  {t("Lewat", "Past")}
                </Text>
              ) : (
                <Text style={{ color: colors.sunriseInk, fontFamily: fontFor("700") }}>
                  {canEdit ? t("Belum diisi · isi menu", "Not filled · add menu") : t("Belum diisi", "Not filled")}
                </Text>
              )}
            </PressableRow>
          </Card>
        );
      })}
    </Screen>
  );
}
