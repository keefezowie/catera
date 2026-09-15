import { readFile, writeFile } from "node:fs/promises";
const source = await readFile("packages/backend/src/paid-pilot.sql", "utf8");
await writeFile(
  "supabase/migrations/20260914160856_paid_seller_pilot.sql",
  source,
);
