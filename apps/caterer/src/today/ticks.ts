import { useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { jakartaDay } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";

type Meal = "lunch" | "dinner";
/** `{ [date]: { lunch: string[]; dinner: string[] } }`, as kept in SecureStore under one key per caterer. */
type TickStore = Record<string, Partial<Record<Meal, string[]>>>;

/** How a dish is named in the kitchen's tick list: its category and its name, as the cooking recap keys it. */
export const dishKey = (dish: { category: string; name: string }) => `${dish.category}\u0000${dish.name}`;

function parse(raw: string | null): TickStore {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as TickStore) : {};
  } catch {
    return {};
  }
}

function flip(store: TickStore, date: string, meal: Meal, dish: string): TickStore {
  const current = store[date]?.[meal] ?? [];
  const next = current.includes(dish) ? current.filter((d) => d !== dish) : [...current, dish];
  return { ...store, [date]: { ...store[date], [meal]: next } };
}

/** Every date before today (Jakarta) is gone; today and later days stay. */
function dropPast(store: TickStore): TickStore {
  const today = jakartaDay(new Date());
  return Object.fromEntries(Object.entries(store).filter(([date]) => date >= today));
}

/**
 * The kitchen's checklist ticks for one caterer, date and meal. They are a note for the kitchen: kept in SecureStore
 * under `ticks.<catererId>` (never sent to the server), read once, and written whole on each toggle, which also drops
 * the dates before today. Nothing reads them to allow or block an action. A failed read or write only loses the note.
 */
export function useTicks(catererId: string, date: string, meal: Meal): { ticked: Set<string>; toggle: (dish: string) => void } {
  const { runtime } = useMobile();
  const key = runtime.storageKey(`ticks.${catererId}`);
  const [store, setStore] = useState<TickStore>({});
  const latest = useRef<TickStore>({});
  // Toggles made before the stored note has been read, replayed onto it once it arrives.
  const early = useRef<{ date: string; meal: Meal; dish: string }[] | null>([]);

  useEffect(() => {
    let live = true;
    early.current = [];
    latest.current = {};
    setStore({});
    void SecureStore.getItemAsync(key)
      .then(parse, () => ({}) as TickStore)
      .then((stored) => {
        if (!live) return;
        const replayed = (early.current ?? []).reduce((all, t) => flip(all, t.date, t.meal, t.dish), stored);
        const pending = (early.current ?? []).length > 0;
        early.current = null;
        latest.current = replayed;
        setStore(replayed);
        if (pending) void SecureStore.setItemAsync(key, JSON.stringify(dropPast(replayed))).catch(() => undefined);
      });
    return () => {
      live = false;
    };
  }, [key]);

  const toggle = useCallback(
    (dish: string) => {
      latest.current = flip(latest.current, date, meal, dish);
      setStore(latest.current);
      if (early.current) {
        early.current.push({ date, meal, dish });
        return;
      }
      latest.current = dropPast(latest.current);
      void SecureStore.setItemAsync(key, JSON.stringify(latest.current)).catch(() => undefined);
    },
    [key, date, meal],
  );

  return { ticked: new Set(store[date]?.[meal] ?? []), toggle };
}
