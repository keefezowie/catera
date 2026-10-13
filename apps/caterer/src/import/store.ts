import { useMemo, useSyncExternalStore } from "react";
import type { AssistantRow } from "./rows";

/**
 * A file the caterer attached for the assistant to read. `data` is the base64 that is uploaded; a photo also keeps the
 * picked file's `uri`, on the phone only, for its thumbnail and the photo viewer.
 */
export type Attachment =
  | { kind: "image"; name: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string; uri: string }
  | { kind: "pdf"; name: string; data: string }
  | { kind: "csv" | "xlsx"; name: string; data: string };

/** A row on the review list, numbered for its import reference (`n` never repeats while Impor is open). */
export type ImportRow = AssistantRow & { n: number };

/** The kitchen's packages as the import options read returns them: the row editor's choices and its checks. */
export type ImportPackage = { id: string; name: string; days: number };

type State = {
  text: string;
  files: Attachment[];
  rows: ImportRow[] | null;
  /** The packages Impor read, so the row sheet checks a row by the same rules without a read of its own. */
  packages: ImportPackage[] | null;
  /** The last row number handed out. */
  counter: number;
  /** The row "Hapus baris ini" took off last and Urungkan has not put back. */
  removed: number | null;
};

const EMPTY: State = { text: "", files: [], rows: null, packages: null, counter: 0, removed: null };

/**
 * What Impor holds while it is open, shared with the row sheet (`/impor-baris`), which is a route of its own above it:
 * the pasted text, the attachments and the rows under review. In memory only, and emptied when Impor closes, as its
 * screen state always was. Signing out closes Impor (its route is guarded by role), so the next person on this phone
 * starts empty.
 */
let current: State = EMPTY;
const listeners = new Set<() => void>();

const read = () => current;
function write(next: State) {
  current = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

type Update<T> = T | ((current: T) => T);
const apply = <T,>(update: Update<T>, current: T) => (typeof update === "function" ? (update as (c: T) => T)(current) : update);

export type ImportStore = State & {
  setText(text: string): void;
  setFiles(update: Update<Attachment[]>): void;
  setRows(update: Update<ImportRow[] | null>): void;
  setPackages(packages: ImportPackage[]): void;
  /** Numbers new rows with numbers not used before in this import. */
  number(rows: AssistantRow[]): ImportRow[];
  /** Replaces row `n` (its number is kept). */
  setRow(n: number, update: Update<AssistantRow>): void;
  /** Takes row `n` off the list and returns it with the place it held, so a restore can put it back. */
  removeRow(n: number): { row: ImportRow; index: number } | null;
  /** Puts a removed row back at its place with the edits it had; a row already there is left alone. */
  restoreRow(row: ImportRow, index: number): void;
  /** The row taken off last and not put back, read at call time, so a save that ends after a render still sees it. */
  lastRemoved(): number | null;
  /** Forgets everything: Impor closed. */
  reset(): void;
};

/** The changers never change, so a screen can depend on them (Impor's reset when it closes). */
const patch = (change: Partial<State>) => write({ ...read(), ...change });
const actions: Omit<ImportStore, keyof State> = {
  setText: (text) => patch({ text }),
  setFiles: (update) => patch({ files: apply(update, read().files) }),
  setRows: (update) => patch({ rows: apply(update, read().rows) }),
  setPackages: (packages) => patch({ packages }),
  number(rows) {
    const start = read().counter;
    patch({ counter: start + rows.length });
    return rows.map((row, i) => ({ ...row, n: start + i + 1 }));
  },
  setRow: (n, update) =>
    patch({ rows: read().rows?.map((row) => (row.n === n ? { ...apply<AssistantRow>(update, row), n } : row)) ?? null }),
  removeRow(n) {
    const rows = read().rows;
    const index = rows?.findIndex((row) => row.n === n) ?? -1;
    if (!rows || index < 0) return null;
    patch({ rows: rows.filter((row) => row.n !== n), removed: n });
    return { row: rows[index], index };
  },
  restoreRow(row, index) {
    const { rows, removed } = read();
    if (!rows || rows.some((r) => r.n === row.n)) return;
    patch({ rows: [...rows.slice(0, index), row, ...rows.slice(index)], removed: removed === row.n ? null : removed });
  },
  lastRemoved: () => read().removed,
  reset: () => write(EMPTY),
};

/** The import in progress; Impor and its row sheet read and change the same one. */
export function useImportStore(): ImportStore {
  const state = useSyncExternalStore(subscribe, read);
  return useMemo(() => ({ ...state, ...actions }), [state]);
}
