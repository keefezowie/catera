"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import {
  errorLabel,
  type SavedPackage,
  type SavedPackages,
  type SavedPackageResult,
} from "@catera/domain";
import { api, useApp } from "./context";
import { Button } from "./form-controls";
import { safeReturnPath } from "@/lib/navigation";
import "./saved-discovery.css";

const intentKey = "catera-save-intent";
type Intent = { nonce: string; packageId: string; createdAt: number };
function pendingIntent(nonce: string): Intent | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(intentKey) || "null",
    ) as Intent | null;
    return value &&
      value.nonce === nonce &&
      Date.now() - value.createdAt < 86400000 &&
      /^[0-9a-f-]{36}$/i.test(value.packageId)
      ? value
      : null;
  } catch {
    return null;
  }
}
type State = SavedPackages & { owner: string; ready: boolean; error: string };
const empty: State = {
  owner: "",
  ready: false,
  error: "",
  packageIds: [],
  items: [],
  nextCursor: null,
};
type Context = {
  ids: string[];
  items: SavedPackage[];
  ready: boolean;
  error: string;
  busy: string[];
  nextCursor: string | null;
  paging: boolean;
  refresh: () => Promise<void>;
  more: () => Promise<void>;
  set: (packageId: string, saved: boolean) => Promise<boolean>;
};
const SavedContext = createContext<Context>(null!);
export const useSaved = () => useContext(SavedContext);
export function SavedProvider({ children }: { children: ReactNode }) {
  const { actor, revision, locale, notify, t } = useApp();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<State>(empty);
  const [busyState, setBusy] = useState<{ owner: string; ids: string[] }>({
    owner: "",
    ids: [],
  });
  const [paging, setPaging] = useState(false);
  const [intentError, setIntentError] = useState<Intent | null>(null);
  const generation = useRef(0);
  const ownerRef = useRef(actor?.id);
  ownerRef.current = actor?.id;
  const requests = useRef(new Map<string, string>());
  const locks = useRef(new Set<string>());
  const attempted = useRef(new Set<string>());
  const current = state.owner === actor?.id ? state : empty;
  const busy = busyState.owner === actor?.id ? busyState.ids : [];
  // The heart flips before the request; React drops this when the request settles, so a failure rolls it back.
  const [ids, flip] = useOptimistic(
    current.packageIds,
    (previous, change: { packageId: string; saved: boolean }) =>
      change.saved
        ? [...new Set([...previous, change.packageId])]
        : previous.filter((id) => id !== change.packageId),
  );
  const refresh = useCallback(async () => {
    if (!actor) return;
    const owner = actor.id,
      version = ++generation.current;
    try {
      const data = await api.savedPackages();
      if (ownerRef.current === owner && version === generation.current)
        setState({ ...data, owner, ready: true, error: "" });
    } catch (error) {
      if (ownerRef.current === owner && version === generation.current)
        setState((previous) => ({
          ...(previous.owner === owner ? previous : empty),
          owner,
          error: error instanceof Error ? error.message : "REQUEST_FAILED",
        }));
    }
  }, [actor?.id]);
  useEffect(() => {
    generation.current++;
    setIntentError(null);
    requests.current.clear();
    locks.current.clear();
    setBusy({ owner: actor?.id || "", ids: [] });
    if (!actor) setState(empty);
  }, [actor?.id]);
  useEffect(() => {
    void refresh();
  }, [actor?.id, revision, refresh]);
  useEffect(() => {
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  const set = useCallback(
    async (packageId: string, saved: boolean, nonce?: string) => {
      if (!actor) {
        const intent: Intent = {
          packageId,
          nonce: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        try {
          localStorage.setItem(intentKey, JSON.stringify(intent));
        } catch {
          notify(
            t(
              "Penyimpanan browser tidak tersedia. Masuk lalu simpan paket.",
              "Browser storage is unavailable. Sign in, then save the package.",
            ),
          );
          return false;
        }
        const url = new URL(location.href);
        url.searchParams.set("saveIntent", intent.nonce);
        location.assign(
          "/login?next=" +
            encodeURIComponent(
              safeReturnPath(url.pathname + url.search + url.hash) || "/saved",
            ),
        );
        return false;
      }
      const owner = actor.id,
        hash = owner + ":" + packageId + ":" + saved,
        lock = owner + ":" + packageId; // One write per package at a time, so a double tap can't race itself.
      if (locks.current.has(lock)) return false;
      locks.current.add(lock);
      setBusy((previous) => ({
        owner,
        ids: [...(previous.owner === owner ? previous.ids : []), packageId],
      }));
      const requestId =
        requests.current.get(hash) || nonce || crypto.randomUUID();
      requests.current.set(hash, requestId);
      return new Promise<boolean>((resolve) =>
        startTransition(async () => {
          flip({ packageId, saved });
          try {
            const result = await api.command<SavedPackageResult>(
              "savedPackage.set",
              { packageId, saved },
              requestId,
            );
            if (ownerRef.current !== owner) return resolve(false);
            ++generation.current; // Discard reads that began before this confirmed write.
            requests.current.delete(hash);
            setState((previous) =>
              previous.owner !== owner
                ? previous
                : {
                    ...previous,
                    error: "",
                    packageIds: result.saved
                      ? [...new Set([...previous.packageIds, packageId])]
                      : previous.packageIds.filter((id) => id !== packageId),
                    items: result.saved
                      ? previous.items
                      : previous.items.filter(
                          (item) => item.packageId !== packageId,
                        ),
                  },
            );
            // A removal is undone by saving again, so it needs no confirm step.
            if (result.saved) notify(t("Paket disimpan.", "Package saved."));
            else
              notify(
                t(
                  "Paket dihapus dari tersimpan.",
                  "Package removed from Saved.",
                ),
                {
                  label: t("Urungkan", "Undo"),
                  run: () => void set(packageId, true),
                },
              );
            void refresh();
            resolve(true);
          } catch (error) {
            if (ownerRef.current === owner)
              notify(
                errorLabel(
                  error instanceof Error ? error.message : "REQUEST_FAILED",
                  locale,
                ) ||
                  t(
                    "Paket belum bisa diperbarui. Coba lagi.",
                    "Saved could not be updated. Try again.",
                  ),
              );
            resolve(false);
          } finally {
            locks.current.delete(lock);
            if (ownerRef.current === owner)
              setBusy((previous) => ({
                owner,
                ids: previous.ids.filter((id) => id !== packageId),
              }));
          }
        }),
      );
    },
    [actor?.id, locale, notify, refresh],
  );
  function clearIntent(nonce: string) {
    if (pendingIntent(nonce)) localStorage.removeItem(intentKey);
    const url = new URL(location.href);
    if (url.searchParams.get("saveIntent") === nonce) {
      url.searchParams.delete("saveIntent");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    setIntentError(null);
  }
  async function resume(intent: Intent) {
    if (await set(intent.packageId, true, intent.nonce))
      clearIntent(intent.nonce);
    else if (ownerRef.current) setIntentError(intent);
  }
  const nonce = params.get("saveIntent");
  useEffect(() => {
    if (!actor || !current.ready || !nonce) return;
    const intent = pendingIntent(nonce);
    const key = actor.id + ":" + nonce;
    if (!intent || attempted.current.has(key)) return;
    attempted.current.add(key);
    void resume(intent);
  }, [actor?.id, current.ready, nonce, pathname]);
  async function more() {
    if (!actor || !current.nextCursor || paging) return;
    const owner = actor.id,
      version = generation.current;
    setPaging(true);
    try {
      const data = await api.savedPackages(current.nextCursor);
      if (ownerRef.current === owner && generation.current === version)
        setState((previous) => ({
          ...previous,
          packageIds: data.packageIds,
          nextCursor: data.nextCursor,
          error: "",
          items: [
            ...previous.items,
            ...data.items.filter(
              (item) =>
                !previous.items.some((old) => old.packageId === item.packageId),
            ),
          ],
        }));
    } catch (error) {
      if (ownerRef.current === owner)
        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : "REQUEST_FAILED",
        }));
    } finally {
      setPaging(false);
    }
  }
  return (
    <SavedContext.Provider
      value={{
        ids,
        items: current.items,
        ready: current.ready,
        error: current.error,
        busy,
        nextCursor: current.nextCursor,
        paging,
        refresh,
        more,
        set,
      }}
    >
      {intentError && (
        <div className="saved-intent-notice" role="alert">
          <span>
            {t(
              "Paket belum bisa disimpan.",
              "The package could not be saved.",
            )}
          </span>
          <Button
            onClick={() => void resume(intentError)}
            disabled={busy.includes(intentError.packageId)}
          >
            {t("Coba simpan lagi", "Retry saving")}
          </Button>
          <Button onClick={() => clearIntent(intentError.nonce)}>
            {t("Batal", "Cancel")}
          </Button>
        </div>
      )}
      {children}
    </SavedContext.Provider>
  );
}
export function SaveButton({
  packageId,
  name,
  disabled = false,
  className = "",
}: {
  packageId: string;
  name: string;
  disabled?: boolean;
  className?: string;
}) {
  const { actor, t } = useApp();
  const { ids, busy, ready, error, set, refresh } = useSaved();
  const saved = ids.includes(packageId),
    pending = busy.includes(packageId);
  return (
    <Button
      type="button"
      variant="secondary"
      className={"save-package " + className}
      disabled={disabled || (!!actor && !ready && !error)}
      aria-pressed={saved}
      aria-busy={pending || undefined}
      aria-label={
        (saved
          ? t("Hapus dari tersimpan: ", "Remove from Saved: ")
          : t("Simpan paket: ", "Save package: ")) + name
      }
      onClick={() => {
        if (actor && !ready && error) void refresh();
        else void set(packageId, !saved);
      }}
    >
      <Bookmark
        size={17}
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span>
        {actor && !ready && error
          ? t("Coba lagi", "Retry")
          : saved
            ? t("Tersimpan", "Saved")
            : t("Simpan", "Save")}
      </span>
    </Button>
  );
}
