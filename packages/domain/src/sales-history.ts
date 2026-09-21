import type { SellerState } from "./index";
type Transaction = SellerState["transactions"][number];
export type Sale = { transaction: Transaction; attempts: Transaction[] };

/** Group retries of the same order; each successful financial event stays separate. */
export function salesHistory(rows: Transaction[]): Sale[] {
  const buckets = new Map<string, Transaction[]>();
  for (const row of new Map(rows.map((row) => [row.id, row])).values()) {
    const key = row.user_id
      ? JSON.stringify([
          row.user_id,
          row.package_id || row.quote.packageId,
          row.address_id,
          row.quote.address,
          row.quote.portions,
          row.quote.dates,
          row.quote.trial,
          row.quote.total,
          row.quote.renewedFrom,
        ])
      : row.id;
    const bucket = buckets.get(key) || [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  const sales: Sale[] = [];
  for (const bucket of buckets.values()) {
    let attempts: Transaction[] = [];
    for (const row of bucket.sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )) {
      attempts.push(row);
      if (
        [
          "paid",
          "refunded",
          "partially_refunded",
          "payment_exception",
        ].includes(row.state)
      ) {
        sales.push({ transaction: row, attempts });
        attempts = [];
      }
    }
    if (attempts.length)
      sales.push({ transaction: attempts.at(-1)!, attempts });
  }
  return sales.sort((a, b) =>
    b.transaction.created_at.localeCompare(a.transaction.created_at),
  );
}
