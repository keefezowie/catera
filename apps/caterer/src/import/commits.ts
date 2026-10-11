import { useSyncExternalStore } from "react";

/**
 * How many imports this phone has committed since the app started. Pelanggan reads it to tell its own arrivals (the
 * customers the caterer just imported here, which enter as rows) from customers who arrive any other way: a push, a
 * marketplace purchase, an import made on the web. In memory only; a fresh start counts from zero.
 */
let commits = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * Commits an import and, once the server has taken it, counts it as this phone's. The count lands before the list's
 * fresh read can answer: the command's revision bump only starts that read.
 */
export async function commitImport(
  command: (action: string, payload: unknown) => Promise<unknown>,
  catererId: string,
  id: string,
) {
  await command("import.commit", { catererId, id });
  commits += 1;
  for (const listener of listeners) listener();
}

/** The number of imports this phone has committed. */
export function useImportCommits() {
  return useSyncExternalStore(subscribe, () => commits);
}
