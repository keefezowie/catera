import { Directory, File, Paths } from "expo-file-system";
import type { CustomerState } from "@catera/domain";

export type CachedCustomer = { savedAt: string; data: CustomerState };

const PREFIX = "catera-customer-";

/** One file per account: `actorId` keys it, so another person signed in on this phone never reads it. */
const fileFor = (actorId: string) => new File(Paths.document, `${PREFIX}${actorId.replace(/[^a-z0-9-]/gi, "_")}.json`);

/** Keeps the last good customer read on the phone so Beranda paints at launch and still opens without signal. */
export async function saveCachedCustomer(actorId: string, value: CachedCustomer): Promise<void> {
  try {
    const file = fileFor(actorId);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
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
    const file = fileFor(actorId);
    if (file.exists) file.delete();
  } catch {
    // Nothing kept, or it cannot be reached: there is nothing to show either.
  }
}

/** Forgets every kept Beranda on this phone; called whenever the session ends (logout, sign-out, an expired session). */
export async function clearCachedCustomer(): Promise<void> {
  try {
    for (const entry of new Directory(Paths.document).list())
      if (entry instanceof File && entry.name.startsWith(PREFIX)) entry.delete();
  } catch {
    // Nothing kept, or the folder cannot be read: there is nothing to show either.
  }
}
