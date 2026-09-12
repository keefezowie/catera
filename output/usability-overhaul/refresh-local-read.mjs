import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
// Refresh only the disposable database created by this usability task.
const db = new PGlite("D:/Project/Catera/catera/.data/usability-overhaul");
try {
 const migration = await readFile("supabase/migrations/20260912100853_usability_read_options.sql", "utf8");
 const definition = migration.slice(migration.indexOf("create function public.catera_v1_read(")).replace("create function", "create or replace function");
 await db.exec("begin;\n" + definition + "\ncommit;");
 console.log("Updated disposable usability read function.");
} finally { await db.close(); }
