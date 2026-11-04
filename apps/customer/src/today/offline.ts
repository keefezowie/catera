import { Directory, File, Paths } from "expo-file-system";
import type { CustomerState } from "@catera/domain";

export type CachedCustomer = { savedAt: string; data: CustomerState };

const PREFIX = "catera-customer-";

/**
 * The kept copies live in the caches folder: iOS leaves it out of iCloud and computer backups, and Android backup is off
 * (app.config.ts), so the account's addresses and deliveries never leave the phone in a backup. Builds before that kept them in
 * the documents folder, so clearing sweeps both.
 */
const folders = () => [Paths.cache, Paths.document];

/** One file per account: `actorId` keys it, so another person signed in on this phone never reads it. */
const fileFor = (actorId: string) => new File(Paths.cache, `${PREFIX}${actorId.replace(/[^a-z0-9-]/gi, "_")}.json`);
const legacyFileFor = (actorId: string) =>
  new File(Paths.document, `${PREFIX}${actorId.replace(/[^a-z0-9-]/gi, "_")}.json`);

/** Keeps the last good customer read on the phone so Beranda paints at launch and still opens without signal. */
export async function saveCachedCustomer(actorId: string, value: CachedCustomer): Promise<void> {
  try {
    const file = fileFor(actorId);
    if (!file.exists) file.create();
    await file.write(JSON.stringify(value));
  } catch {
    // A full disk must never break the live screen.
  }
}

export async function loadCachedCustomer(actorId: string): Promise<CachedCustomer | null> {
  try {
    const file = fileFor(actorId);
    return file.exists ? (JSON.parse(await file.text()) as CachedCustomer) : null;
  } catch {
    return null;
  }
}

/** Forgets the Beranda kept for one account: a save that landed after that account's session had ended. */
export async function forgetCachedCustomer(actorId: string): Promise<void> {
  try {
    for (const file of [fileFor(actorId), legacyFileFor(actorId)]) if (file.exists) file.delete();
  } catch {
    // Nothing kept, or it cannot be reached: there is nothing to show either.
  }
}

/** Forgets every kept Beranda on this phone; called whenever the session ends (logout, sign-out, an expired session). */
export async function clearCachedCustomer(): Promise<void> {
  for (const folder of folders())
    try {
      for (const entry of new Directory(folder).list())
        if (entry instanceof File && entry.name.startsWith(PREFIX)) entry.delete();
    } catch {
      // Nothing kept, or the folder cannot be read: there is nothing to show either.
    }
}
