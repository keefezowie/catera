import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import type { SavedPackage, SavedPackages } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";

const blank: SavedPackages = { packageIds: [], items: [], nextCursor: null };

/**
 * The signed-in customer's saved packages. A heart flips at once and is put back if the
 * server refuses; signed out, it sends the visitor to sign in and back to `next`.
 */
export function useSaved(next: string) {
  const { runtime, actor, command, t } = useMobile();
  const state = useData<SavedPackages>("saved-packages", async () =>
    actor ? runtime.api.savedPackages() : blank,
  );
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState<SavedPackage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(new Set<string>());
  const data = state.data ?? blank;

  // A fresh read is the truth again; drop the optimistic flips and extra pages.
  useEffect(() => {
    setPending({});
    setMore([]);
    setCursor(data.nextCursor);
  }, [state.data]);

  const ids = new Set(data.packageIds);
  const isSaved = (id: string) => pending[id] ?? ids.has(id);

  async function toggle(packageId: string) {
    if (!actor) {
      router.push(`/login?next=${next}` as never);
      return;
    }
    if (busy.current.has(packageId)) return;
    busy.current.add(packageId);
    const saved = !isSaved(packageId);
    setError("");
    setPending((p) => ({ ...p, [packageId]: saved }));
    try {
      await command("savedPackage.set", { packageId, saved });
    } catch {
      setPending((p) => {
        const { [packageId]: _gone, ...rest } = p;
        return rest;
      });
      setError(t("Belum tersimpan. Coba lagi.", "Could not save. Try again."));
    } finally {
      busy.current.delete(packageId);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    try {
      const page = await runtime.api.savedPackages(cursor);
      setMore((m) => [...m, ...page.items.filter((i) => !m.some((x) => x.packageId === i.packageId))]);
      setCursor(page.nextCursor);
    } catch {
      setError(t("Tidak dapat memuat lagi. Coba lagi.", "Could not load more. Try again."));
    }
  }

  return {
    items: [...data.items, ...more].filter((i) => isSaved(i.packageId)),
    hasMore: !!cursor,
    loading: state.loading && !state.data,
    loadError: state.error,
    error,
    isSaved,
    toggle,
    loadMore,
    reload: state.reload,
  };
}
