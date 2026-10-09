import { useEffect, useState } from "react";
import { router } from "expo-router";
import { errorLabel, type Dish, type LibraryDish } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Screen, Text, useColors } from "@catera/mobile-ui";
import { dishUsage, mealOf, saveMenuDay } from "./logic";
import { loadMenus, MenuLoadError } from "./MenuWeek";
import { SlotEditor } from "./SlotEditor";

/** Fill one day's menu for one package and meal. */
export function MenuDayScreen({ date, packageId, meal }: { date: string; packageId: string; meal: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  const c = useColors();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const offer = ops.data?.offers.find((o) => o.id === packageId);
  const day = useData(`menu-day:${offer?.id}:${meal}:${date}`, () =>
    offer ? loadMenus(runtime, offer, meal, [date]) : Promise.resolve([]),
  );
  const [items, setItems] = useState<Dish[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = day.data?.[0];
  useEffect(() => {
    if (current && items === null) setItems(current.details?.items ?? []);
  }, [current, items]);
  if ((ops.error && !ops.data) || (day.error && !day.data))
    return <MenuLoadError title={false} onRetry={() => void (ops.error && !ops.data ? ops.reload() : day.reload())} />;
  if (ops.data && !offer)
    return (
      <Screen>
        <Text>{t("Paket ini tidak ditemukan.", "This package wasn't found.")}</Text>
        <Button label={t("Kembali", "Back")} onPress={() => router.back()} />
      </Screen>
    );
  if (!offer || !current || items === null)
    return <Screen><Text variant="caption">{t("Memuat…", "Loading…")}</Text></Screen>;
  const template = mealOf(offer, meal);

  async function create(name: string, categoryId: string | undefined) {
    return command<LibraryDish>("dish.save", {
      catererId,
      details: { name, description: "", image: "", serving: "", categoryId },
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await saveMenuDay({ command }, { catererId, offer: offer!, meal, day: current!, items: items! });
      router.back();
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum tersimpan.", "Not saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text variant="caption">{offer.name}</Text>
      <SlotEditor
        composition={template.composition ?? []}
        items={items}
        library={ops.data?.dishes ?? []}
        usage={dishUsage((ops.data?.datedMenus ?? []).map((m) => m.details))}
        onChange={setItems}
        onCreate={create}
        onSave={() => void save()}
        saving={saving}
        canEdit={actor?.role === "owner"}
      />
      {error ? <Text selectable style={{ color: c.danger }}>{error}</Text> : null}
    </Screen>
  );
}
