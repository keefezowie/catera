import { useState } from "react";
import { errorLabel } from "@catera/domain";
import { useBusy } from "@catera/mobile-ui";

/**
 * A failed attempt: the words, a number that changes on every failure so an identical message is announced again, and
 * the server's code (when there was one) so a screen can tell a failure about a field from one about the connection.
 */
export type Failure = { message: string; key: number; code?: string };

/**
 * One awaited action behind a busy button. `run(step)` drops a press that arrives while a step is running, clears the
 * last failure, and turns a rejection into a `Failure` for `FormError` (the server's code through `errorLabel`, else
 * `fallback`). `fail(message)` records one that the step noticed itself.
 */
export function useFormRun(locale: "id" | "en", fallback: string) {
  const [failure, setFailure] = useState<Failure | null>(null);
  const fail = (message: string, code?: string) => setFailure((f) => ({ message, key: (f?.key ?? 0) + 1, code }));
  const [busy, run] = useBusy(async (step: () => Promise<unknown>) => {
    setFailure(null);
    try {
      await step();
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      fail(errorLabel(code, locale) || fallback, code);
    }
  });
  return { busy, failure, run, fail, clear: () => setFailure(null) };
}
