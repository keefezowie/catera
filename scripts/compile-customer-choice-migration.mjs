import { readFile, writeFile, readdir } from "node:fs/promises";
const folder = "supabase/migrations";
const target = (await readdir(folder)).find((f) =>
  f.endsWith("_customer_choice_menus.sql"),
);
if (!target) throw Error("Run supabase migration new customer_choice_menus");
await writeFile(
  `${folder}/${target}`,
  "-- Generated from packages/backend/src/customer-choice.sql. Forward migration only.\n" +
    (await readFile("packages/backend/src/customer-choice.sql", "utf8")),
);
