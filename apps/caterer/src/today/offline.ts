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

/** Keeps the last good day on the phone so Hari ini paints at launch and the kitchen still has its list without signal. */
export async function saveCachedDay(actorId: string, catererId: string, date: string, value: CachedDay): Promise<void> {
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
  try {
    for (const entry of new Directory(Paths.document).list())
      if (entry instanceof File && entry.name.startsWith(PREFIX)) entry.delete();
  } catch {
    // Nothing kept, or the folder cannot be read: there is nothing to show either.
  }
}
