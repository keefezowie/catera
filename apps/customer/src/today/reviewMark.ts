import * as SecureStore from "expo-secure-store";

/**
 * Whether a plan's review row has been dealt with ("done" or "dismissed"), kept on the phone under
 * `runtime.storageKey("review.{subscriptionId}")`. The review sheet (`/ulasan/{id}`) writes it; Beranda's "Menunggu
 * Anda" hears it at once, so its row leaves while the sheet closes over it.
 */
const listeners = new Set<(key: string) => void>();

export function markReview(key: string, value: "dismissed" | "done") {
  for (const listener of listeners) listener(key);
  void SecureStore.setItemAsync(key, value).catch(() => undefined);
}

/** Calls `hear(key)` whenever a review is marked; returns the unsubscribe. */
export function onReviewMarked(hear: (key: string) => void): () => void {
  listeners.add(hear);
  return () => void listeners.delete(hear);
}
