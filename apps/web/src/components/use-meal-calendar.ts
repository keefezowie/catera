"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CalendarStore } from "../lib/calendar-store";
import { api, useApp } from "./context";

export function useMealCalendar(requiredMonths: string[]) {
  const { actor, revision } = useApp();
  const store = useMemo(
    () => new CalendarStore((query) => api.customer(query)),
    [actor?.id, revision],
  );
  useSyncExternalStore(store.subscribe, store.snapshot, () => 0);
  const key = [...new Set(requiredMonths)].sort().join(",");
  useEffect(() => {
    if (!actor) return;
    const months = key.split(",").filter(Boolean);
    months.forEach((month) => {
      void store.ensure(month);
    });
    store.prune(new Set(months));
  }, [store, key, actor]);
  return store;
}
