import { File, Paths } from "expo-file-system";
import type { CustomerState } from "@catera/domain";

export type CachedCustomer = { savedAt: string; data: CustomerState };

const fileFor = (key: string) =>
  new File(Paths.document, `catera-customer-${key.replace(/[^a-z0-9-]/gi, "_")}.json`);

/** Keeps the last good customer read on the phone so Beranda still opens without signal. */
export async function saveCachedCustomer(key: string, value: CachedCustomer): Promise<void> {
  try {
    const file = fileFor(key);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    // A full disk must never break the live screen.
  }
}

export async function loadCachedCustomer(key: string): Promise<CachedCustomer | null> {
  try {
    const file = fileFor(key);
    return file.exists ? (JSON.parse(await file.text()) as CachedCustomer) : null;
  } catch {
    return null;
  }
}
