import { useEffect, useState } from "react";
import { router } from "expo-router";
import { errorLabel, type Dish, type LibraryDish } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, FadeSwap, FormError, Screen, Text, useBusy, useToast } from "@catera/mobile-ui";
import { dayComplete, dishUsage, mealOf, saveMenuDay, weekdayName } from "./logic";
import { loadMenus, MenuLoadError } from "./MenuWeek";
import { SlotEditor } from "./SlotEditor";
import { DetailSkeleton } from "../skeletons";

/** Fill one day's menu for one package and meal. */
export function MenuDayScreen({ date, packageId, meal }: { date: string; packageId: string; meal: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  const toast = useToast();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const offer = ops.data?.offers.find((o) => o.id === packageId);
  const day = useData(`menu-day:${offer?.id}:${meal}:${date}`, () =>
    offer ? loadMenus(runtime, offer, meal, [date]) : Promise.resolve([]),
  );
  const [items, setItems] = useState<Dish[] | null>(null);
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  const current = day.data?.[0];
  useEffect(() => {
    if (current && items === null) setItems(current.details?.items ?? []);
  }, [current, items]);
  const [saving, save] = useBusy(async () => {
    setFailure(null);
    try {
      await saveMenuDay({ command }, { catererId, offer: offer!, meal, day: current!, items: items! });
      router.back();
      toast.show({
        message: t(`Menu ${weekdayName(date, "id")} tersimpan`, `${weekdayName(date, "en")} menu saved`),
        tone: "success",
      });
    } catch (e) {
      setFailure((f) => ({
        message: errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Menu belum tersimpan. Coba lagi.", "The menu was not saved. Try again."),
        key: (f?.key ?? 0) + 1,
      }));
    }
  });
  if ((ops.error && !ops.data) || (day.error && !day.data))
    return <MenuLoadError title={false} onRetry={() => void (ops.error && !ops.data ? ops.reload() : day.reload())} />;
  if (ops.data && !offer)
    return (
      <Screen>
        <Text>{t("Paket ini tidak ditemukan.", "This package wasn't found.")}</Text>
        <Button label={t("Kembali", "Back")} onPress={() => router.back()} />
      </Screen>
    );
  // The loaded page draws in the same FadeSwap, so the day's slots enter from this skeleton as one block.
  if (!offer || !current || items === null)
    return (
      <Screen>
        <FadeSwap swapKey="loading" style={{ gap: 16 }}>
          <DetailSkeleton label={t("Memuat menu", "Loading the menu")} />
        </FadeSwap>
      </Screen>
    );
  const template = mealOf(offer, meal);
  const canEdit = actor?.role === "owner";

  async function create(name: string, categoryId: string | undefined) {
    return command<LibraryDish>("dish.save", {
      catererId,
      details: { name, description: "", image: "", serving: "", categoryId },
    });
  }

  return (
    // Simpan menu is pinned under the scrolling groups (owner only); a helper reads the day without it.
    <Screen
      footer={
        canEdit ? (
          <Button
            label={t("Simpan menu", "Save menu")}
            busy={saving}
            disabled={!dayComplete(template.composition ?? [], items)}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      <FadeSwap swapKey="day" style={{ gap: nativeLayout.dense.sectionGap }}>
        <Text variant="meta">{offer.name}</Text>
        <SlotEditor
          composition={template.composition ?? []}
          items={items}
          library={ops.data?.dishes ?? []}
          usage={dishUsage((ops.data?.datedMenus ?? []).map((m) => m.details))}
          onChange={setItems}
          onCreate={create}
          canEdit={canEdit}
        />
        {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
      </FadeSwap>
    </Screen>
  );
}
