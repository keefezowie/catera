import { useCallback, useEffect, useRef, useState } from "react";
import { errorLabel } from "@catera/domain";
import { useMobile } from "./provider";

export type DataOptions<T> = {
  /**
   * The last confirmed read this phone kept for the same account and key. When the screen has nothing yet, it paints
   * first (`fromCache: true`) and the loader's answer replaces it. A failed or empty read of it is ignored.
   */
  cached?: () => Promise<T | null>;
};

type DataState<T> = {
  key: string;
  data: T | null;
  error: string;
  loading: boolean;
  fromCache: boolean;
};

/**
 * Loads data for the signed-in actor and reloads whenever a command or push bumps the revision. With `cached`, a
 * screen with nothing to show paints the kept copy while the loader runs; `fromCache` stays true until the loader
 * answers, so the screen can hide what must not be acted on from a copy that may be out of date.
 */
export function useData<T>(key: string, loader: () => Promise<T>, options?: DataOptions<T>) {
  const { revision, locale, actor } = useMobile();
  const identity = (actor?.id || "guest") + ":" + key;
  const [state, setState] = useState<DataState<T>>({
    key: identity,
    data: null,
    error: "",
    loading: true,
    fromCache: false,
  });
  const load = useRef(loader);
  load.current = loader;
  const cache = useRef(options?.cached);
  cache.current = options?.cached;
  const generation = useRef(0);
  const currentKey = useRef(identity);
  currentKey.current = identity;
  // Whether this identity already has something on screen (fresh or kept); only an empty screen reads the copy.
  const shown = useRef({ key: identity, has: false });
  const reload = useCallback(async () => {
    const request = ++generation.current;
    const live = () => request === generation.current && currentKey.current === identity;
    if (shown.current.key !== identity) shown.current = { key: identity, has: false };
    const kept = !shown.current.has && cache.current ? cache.current().catch(() => null) : null;
    let answered = false;
    setState((s) =>
      s.key === identity
        ? { ...s, error: "", loading: true }
        : { key: identity, data: null, error: "", loading: true, fromCache: false },
    );
    if (kept)
      void kept.then((value) => {
        if (value === null || value === undefined || answered || !live()) return;
        shown.current = { key: identity, has: true };
        setState((s) => (s.key === identity && s.data === null ? { ...s, data: value, fromCache: true } : s));
      });
    try {
      const data = await load.current();
      answered = true;
      if (live()) {
        shown.current = { key: identity, has: true };
        setState({ key: identity, data, error: "", loading: false, fromCache: false });
      }
    } catch (e) {
      answered = true;
      // A copy that arrives only after the loader failed still beats an empty screen.
      const value = kept ? await kept : null;
      if (!live()) return;
      const error =
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
        (locale === "en"
          ? "Unable to load. Check your connection and try again."
          : "Tidak dapat memuat. Periksa koneksi dan coba lagi.");
      setState((s) => {
        if (s.key === identity && s.data !== null) return { ...s, loading: false, error };
        const fallback = value !== null && value !== undefined;
        if (fallback) shown.current = { key: identity, has: true };
        return { key: identity, data: fallback ? value : null, fromCache: fallback, loading: false, error };
      });
    }
  }, [identity, locale]);
  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload, revision]);
  const active =
    state.key === identity ? state : { data: null, error: "", loading: true, fromCache: false };
  return {
    ...active,
    reload,
    stale: !!active.error && active.data !== null,
  };
}
