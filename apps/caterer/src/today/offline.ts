import { Directory, File, Paths } from "expo-file-system";
import type { SellerOperationsState } from "@catera/domain";

export type CachedDay = { savedAt: string; data: SellerOperationsState };

const PREFIX = "dapur-day-";

/**
 * One file per account, kitchen and day. The actor id leads the key, so a helper and the owner on one phone, or a
 * person who signs in after another, never read each other's copy.
 */
const fileFor = (actorId: string, catererId: string, date: string) =>
  new File(Paths.document, `${PREFIX}${`${actorId}-${catererId}-${date}`.replace(/[^a-z0-9-]/gi, "_")}.json`);

/**
 * Which session the kept days belong to: it moves on every time they are forgotten (`clearCachedDays`, run whenever the
 * session ends). A read takes it when it starts, and its answer is kept only if no session ended in between.
 */
let session = 0;
export function cacheSession(): number {
  return session;
}

/**
 * Keeps the last good day on the phone so Hari ini paints at launch and the kitchen still has its list without signal.
 * `since` is the `cacheSession()` taken when the read started: an answer that lands after a logout (or any other end of
 * the session) belongs to the account that left, so it is dropped instead of written back after the clear. A read made
 * before any account was known (no actor or kitchen id) is never kept either.
 */
export async function saveCachedDay(
  actorId: string,
  catererId: string,
  date: string,
  value: CachedDay,
  since: number,
): Promise<void> {
  if (since !== session || !actorId || !catererId) return;
  try {
    const file = fileFor(actorId, catererId, date);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    // A full disk must never break the live screen.
  }
}

export async function loadCachedDay(actorId: string, catererId: string, date: string): Promise<CachedDay | null> {
  try {
    const file = fileFor(actorId, catererId, date);
    return file.exists ? (JSON.parse(await file.text()) as CachedDay) : null;
  } catch {
    return null;
  }
}

/** Forgets every kept day on this phone; called whenever the session ends (logout, sign-out, an expired session). */
export async function clearCachedDays(): Promise<void> {
  // First, so a read still in flight from the session that ended cannot write its day back after the clear.
  session += 1;
  try {
    for (const entry of new Directory(Paths.document).list())
      if (entry instanceof File && entry.name.startsWith(PREFIX)) entry.delete();
  } catch {
    // Nothing kept, or the folder cannot be read: there is nothing to show either.
  }
}
