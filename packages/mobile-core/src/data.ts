import { useCallback, useEffect, useRef, useState } from "react";
import { errorLabel } from "@catera/domain";
import { useMobile } from "./provider";

/** Loads data for the signed-in actor and reloads whenever a command or push bumps the revision. */
export function useData<T>(key: string, loader: () => Promise<T>) {
  const { revision, locale, actor } = useMobile();
  const identity = (actor?.id || "guest") + ":" + key;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key: identity, data: null, error: "", loading: true });
  const load = useRef(loader);
  load.current = loader;
  const generation = useRef(0);
  const currentKey = useRef(identity);
  currentKey.current = identity;
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setState((s) => ({
      key: identity,
      data: s.key === identity ? s.data : null,
      error: "",
      loading: true,
    }));
    try {
      const data = await load.current();
      if (request === generation.current && currentKey.current === identity)
        setState({ key: identity, data, error: "", loading: false });
    } catch (e) {
      if (request === generation.current && currentKey.current === identity)
        setState((s) => ({
          ...s,
          loading: false,
          error:
            errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
            (locale === "en"
              ? "Unable to load. Check your connection and try again."
              : "Tidak dapat memuat. Periksa koneksi dan coba lagi."),
        }));
    }
  }, [identity, locale]);
  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload, revision]);
  const active = state.key === identity ? state : { data: null, error: "", loading: true };
  return {
    ...active,
    reload,
    stale: !!active.error && active.data !== null,
  };
}
