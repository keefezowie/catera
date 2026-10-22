import { useCallback } from "react";
import { router } from "expo-router";
import { pushSheet } from "../nav";
import {
  canChangeDay,
  changeDeadline,
  menuIsSet,
  reportableMeals,
  shortDate,
  storyDishes,
  type Delivery,
  type Locale,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { useActionSheet, type ActionSheetInput } from "@catera/mobile-ui";
import { catererPhoneOf, openCatererChat } from "../help/ChatKatering";
import type { DayActionKey } from "./DayActionRow";
import { photoUri } from "../today/photoUri";

type Meal = "lunch" | "dinner";
type Translate = (id: string, en: string) => string;

/** The meal a day's "…" acts on: the one asked for when the day serves it, else the day's first meal not cancelled. */
function mealOf(d: Delivery, wanted?: Meal): Meal {
  const served = (d.meals ?? []).filter((m) => m.status !== "cancelled").map((m) => m.meal);
  return wanted && served.includes(wanted) ? wanted : (served[0] ?? wanted ?? "lunch");
}

/**
 * The action sheet of one delivery day (spec 5.3), from its "…" on Hari, the Beranda hero and the plan's upcoming rows.
 * Each item shows only when the read allows it at `now`:
 * - "Pindah tanggal": before the cutoff, and only on a plan whose days can move (not a fixed plan).
 * - "Ganti alamat hari ini": before the cutoff, on a day still scheduled.
 * - "Chat {katerer}": only when the read carries the caterer's verified number.
 * - "Laporkan masalah" (danger, last): only when this meal can be reported today and has no open report yet.
 * The context names what the actions are about: the meal's photo, its main dish (or "Menu belum ditentukan"), the meal
 * and the caterer, and until when the day can change.
 */
export function dayActionInput(
  d: Delivery,
  now: Date,
  { t, locale, apiBase, meal: wanted }: { t: Translate; locale: Locale; apiBase: string; meal?: Meal },
): { input: ActionSheetInput; meal: Meal } {
  const meal = mealOf(d, wanted);
  const can = canChangeDay(d, now);
  const open = can.date || can.address;
  const deadline = open ? changeDeadline(d.cutoff_at, now, locale) : null;
  const menu = d.offer.menus?.find((m) => m.meal === meal);
  const lead = menu && menuIsSet(menu) ? storyDishes(menu).title : null;
  const photo = menu?.image || d.offer.image || "";
  const reported = (d.meals ?? []).some((m) => m.meal === meal && !!m.issue && m.issue.status !== "resolved");
  const reportable = !reported && reportableMeals(d, now).includes(meal);
  const phone = catererPhoneOf(d);
  const caterer = d.offer.caterer;
  const items: ActionSheetInput["items"] = [
    ...(can.date ? [{ key: "pindah", label: t("Pindah tanggal", "Move to another date"), icon: "calendar-outline" }] : []),
    ...(can.address
      ? [{ key: "alamat", label: t("Ganti alamat pengantaran ini", "Change this delivery's address"), icon: "location-outline" }]
      : []),
    ...(phone ? [{ key: "chat", label: t(`Chat ${caterer}`, `Chat ${caterer}`), icon: "chatbubble-outline" }] : []),
    ...(reportable
      ? [{ key: "lapor", label: t("Laporkan masalah", "Report a problem"), icon: "flag-outline", tone: "danger" as const }]
      : []),
  ];
  return {
    meal,
    input: {
      title: shortDate(d.service_date, locale),
      context: {
        ...(photo ? { image: photoUri(photo, apiBase) } : null),
        title: lead || t("Menu belum diisi", "Menu not set yet"),
        lines: [
          `${meal === "dinner" ? t("Makan malam", "Dinner") : t("Makan siang", "Lunch")} · ${caterer}`,
          deadline
            ? t(`Bisa diubah sampai ${deadline}`, `Can be changed until ${deadline}`)
            : t("Sudah tidak bisa diubah", "Can't be changed anymore"),
        ],
      },
      items,
      closeLabel: t("Tutup", "Close"),
    },
  };
}

/** Whether a day's "…" has anything to offer at `now`; with nothing allowed the "…" is not drawn at all. */
export function dayHasActions(d: Delivery | null | undefined, now: Date, meal?: Meal): boolean {
  if (!d) return false;
  return dayActionInput(d, now, { t: (id) => id, locale: "id", apiBase: "", meal }).input.items.length > 0;
}

/**
 * Opens a day's action sheet and does what was chosen: Pindah tanggal and Ganti alamat open the Ubah hari sheet in that
 * mode, Chat opens WhatsApp, Laporkan masalah opens Ada masalah for the meal. Pass no delivery (signed out, or a copy
 * kept offline) and nothing opens; callers hide the "…" then.
 */
export function useDayActions(delivery: Delivery | null | undefined, meal?: Meal): () => Promise<void> {
  const { t, locale, runtime } = useMobile();
  const ask = useActionSheet();
  return useCallback(async () => {
    if (!delivery) return;
    const { input, meal: target } = dayActionInput(delivery, new Date(), { t, locale, apiBase: runtime.apiBase, meal });
    if (!input.items.length) return;
    const key = await ask(input);
    const id = encodeURIComponent(delivery.id);
    if (key === "pindah") pushSheet(`/ubah-hari/${id}?mode=date` as never);
    else if (key === "alamat") pushSheet(`/ubah-hari/${id}?mode=address` as never);
    else if (key === "chat") openCatererChat(catererPhoneOf(delivery));
    else if (key === "lapor") pushSheet(`/masalah/${id}?meal=${target}` as never);
  }, [delivery, meal, t, locale, runtime.apiBase, ask]);
}

/** Whether a meal has a report that is still open (a resolved one can be followed by a new report). */
const hasOpenReport = (d: Delivery, meal: Meal) =>
  (d.meals ?? []).some((m) => m.meal === meal && !!m.issue && m.issue.status !== "resolved");

/** A day nothing more can happen on: cancelled, or every meal still on has been delivered. */
export function dayClosed(d: Delivery): boolean {
  const meals = (d.meals ?? []).filter((m) => m.status !== "cancelled");
  return d.status === "cancelled" || meals.every((m) => m.status === "delivered");
}

/** The meal Ada masalah opens for: the first due or past meal that has no open report yet. */
export function reportTargetOf(d: Delivery, now: Date): Meal | undefined {
  return reportableMeals(d, now).find((meal) => !hasOpenReport(d, meal));
}

/**
 * What the day sheet offers as visible circles at `now`, in the order they show. Each keeps the condition of its old
 * entry in the day's "…" and footer:
 * - "Ubah hari": the day can move (`canChangeDay.date`: before the cutoff, on a plan whose days can move) and is not closed.
 * - "Pilih menu": a pick-your-own package (its menu choice stays open on a closed day, as before); "Lihat menu" when the
 *   caterer picks and a menu is set for a meal the day serves; neither otherwise.
 * - "Ada masalah": a meal is due or past with no open report.
 * - "Chat": the read carries the caterer's verified number.
 * - "Ganti alamat": before the cutoff on a day still scheduled (`canChangeDay.address`), not closed.
 * `menu` and `report` name the meal they act on.
 */
export function dayVisibleActions(
  d: Delivery,
  now: Date,
  t: Translate,
): { key: DayActionKey; label: string; meal: Meal }[] {
  const served = (d.meals ?? []).filter((m) => m.status !== "cancelled").map((m) => m.meal);
  const first: Meal = served[0] ?? "lunch";
  const can = canChangeDay(d, now);
  const closed = dayClosed(d);
  const picks = d.offer.menuSelectionMode === "customer";
  const menuSet = served.some((meal) => {
    const menu = d.offer.menus?.find((m) => m.meal === meal);
    return !!menu && menuIsSet(menu);
  });
  const target = reportTargetOf(d, now);
  return [
    ...(!closed && can.date ? [{ key: "change" as const, label: t("Ubah hari", "Change day"), meal: first }] : []),
    ...(picks
      ? [{ key: "menu" as const, label: t("Pilih menu", "Choose menu"), meal: first }]
      : menuSet
        ? [{ key: "menu" as const, label: t("Lihat menu", "See menu"), meal: first }]
        : []),
    ...(target ? [{ key: "report" as const, label: t("Ada masalah", "Report a problem"), meal: target }] : []),
    ...(catererPhoneOf(d) ? [{ key: "chat" as const, label: t("Chat", "Chat"), meal: first }] : []),
    ...(!closed && can.address ? [{ key: "address" as const, label: t("Ganti alamat", "Change address"), meal: first }] : []),
  ];
}
