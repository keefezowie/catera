import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import type { SavedPackage, SavedPackages } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { useToast } from "@catera/mobile-ui";

const blank: SavedPackages = { packageIds: [], items: [], nextCursor: null };

/**
 * The signed-in customer's saved packages. A heart flips at once and is put back if the
 * server refuses; signed out, it sends the visitor to sign in and back to `next`.
 * Once the server confirms, a save says "Disimpan" with Lihat (Disimpan) and a removal says
 * "Dihapus dari simpanan" with Urungkan, which saves it again without a second toast.
 */
export function useSaved(next: string) {
  const { runtime, actor, command, t } = useMobile();
  const toast = useToast();
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
    await set(packageId, !isSaved(packageId), false);
  }

  /** Writes one heart. `undo` is Urungkan putting a removal back: it says nothing more. */
  async function set(packageId: string, saved: boolean, undo: boolean) {
    if (busy.current.has(packageId)) return;
    busy.current.add(packageId);
    setError("");
    setPending((p) => ({ ...p, [packageId]: saved }));
    try {
      await command("savedPackage.set", { packageId, saved });
      if (undo) return;
      if (saved)
        toast.show({
          message: t("Disimpan", "Saved"),
          action: { label: t("Lihat", "View"), onPress: () => router.push("/disimpan" as never) },
          tone: "success",
        });
      else
        toast.show({
          message: t("Dihapus dari simpanan", "Removed from saved"),
          action: { label: t("Urungkan", "Undo"), onPress: () => void set(packageId, true, true) },
          tone: "success",
        });
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
    /** Whether a heart press can save here; signed out it asks to sign in instead. */
    signedIn: !!actor,
    loadMore,
    reload: state.reload,
  };
}
