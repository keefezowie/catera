import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps an async action for a `Button busy`: `busy` is true from the press until the call settles, and a press that
 * arrives meanwhile is dropped (nothing is sent twice). The wrapped call returns the result, or undefined when it was
 * dropped. `busy` never sets state after the screen has gone.
 */
export function useBusy<Args extends unknown[], Result>(
  run: (...args: Args) => Promise<Result> | Result,
): [boolean, (...args: Args) => Promise<Result | undefined>] {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const wrapped = useCallback(async (...args: Args): Promise<Result | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await latest.current(...args);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  return [busy, wrapped];
}
