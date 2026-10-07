import { File, Paths } from "expo-file-system";
import type { SellerOperationsState } from "@catera/domain";

export type CachedDay = { savedAt: string; data: SellerOperationsState };

const fileFor = (key: string) => new File(Paths.document, `dapur-day-${key.replace(/[^a-z0-9-]/gi, "_")}.json`);

/** Keeps the last good day on the phone so the kitchen still has its list without signal. */
export async function saveCachedDay(key: string, value: CachedDay): Promise<void> {
  try {
    const file = fileFor(key);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    // A full disk must never break the live screen.
  }
}

export async function loadCachedDay(key: string): Promise<CachedDay | null> {
  try {
    const file = fileFor(key);
    return file.exists ? (JSON.parse(await file.text()) as CachedDay) : null;
  } catch {
    return null;
  }
}
