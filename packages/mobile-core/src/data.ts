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
 * Loads data for the signed-in actor and reloads whenever a command or push bumps the revision, and quietly (keeping
 * what is shown, no `loading`) when the app returns or the network comes back. With `cached`, a
 * screen with nothing to show paints the kept copy while the loader runs; `fromCache` stays true until the loader
 * answers, so the screen can hide what must not be acted on from a copy that may be out of date.
 *
 * `key` names the read: hooks of one account with the same key and revision, and no command finished between them,
 * share one in-flight request, so one key must always mean one loader. A read begun before a command finished never
 * serves a hook that asks after it. `reload()` always starts a new request, for a caller that just wrote something.
 */
export function useData<T>(key: string, loader: () => Promise<T>, options?: DataOptions<T>) {
  const { revision, resumed, locale, actor, reads } = useMobile();
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
  const asked = useRef(revision);
  asked.current = revision;
  const read = useCallback(
    (join: boolean): Promise<T> => {
      const slot = `${reads.epoch}|${asked.current}|${identity}`;
      const running = join ? reads.inFlight.get(slot) : undefined;
      if (running) return running as Promise<T>;
      const started = Promise.resolve(load.current());
      reads.inFlight.set(slot, started);
      const done = () => {
        if (reads.inFlight.get(slot) === started) reads.inFlight.delete(slot);
      };
      started.then(done, done);
      return started;
    },
    [identity, reads],
  );
  const run = useCallback(async (join: boolean) => {
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
      const data = await read(join);
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
          ? "Couldn't load. Check your connection and try again."
          : "Belum bisa memuat. Cek koneksi lalu coba lagi.");
      setState((s) => {
        if (s.key === identity && s.data !== null) return { ...s, loading: false, error };
        const fallback = value !== null && value !== undefined;
        if (fallback) shown.current = { key: identity, has: true };
        return { key: identity, data: fallback ? value : null, fromCache: fallback, loading: false, error };
      });
    }
  }, [identity, locale, read]);
  // `reload` is handed straight to press handlers, so it takes no argument.
  const reload = useCallback(() => run(false), [run]);
  useEffect(() => {
    void run(true);
    return () => {
      generation.current += 1;
    };
  }, [run, revision]);
  // A return to the app or a network that came back: a screen already showing this identity's data reads it again
  // without `loading`, so nothing on it flashes. A failure keeps what is shown; the next resume tries again.
  // Not while a read is running: that read answers with the newer data anyway.
  const shownData = state.key === identity && state.data !== null && !state.loading;
  // A screen that failed with nothing to show reads again in full: there is nothing on it to keep.
  const failedEmpty = state.key === identity && state.data === null && !!state.error && !state.loading;
  const firstResume = useRef(resumed);
  useEffect(() => {
    if (resumed === firstResume.current) return;
    if (failedEmpty) {
      void run(true);
      return;
    }
    if (!shownData) return;
    const request = ++generation.current;
    void read(true).then(
      (data) => {
        if (request !== generation.current || currentKey.current !== identity) return;
        setState((s) => (s.key === identity ? { ...s, data, error: "", fromCache: false } : s));
      },
      () => undefined,
    );
    // Only `resumed` starts a quiet read; the identity and data are read as they are at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumed]);
  const active =
    state.key === identity ? state : { data: null, error: "", loading: true, fromCache: false };
  return {
    ...active,
    reload,
    stale: !!active.error && active.data !== null,
  };
}
