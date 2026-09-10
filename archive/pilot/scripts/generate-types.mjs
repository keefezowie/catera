import { PGlite } from "@electric-sql/pglite";
import { readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";
const db = new PGlite();
await db.exec(
  "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select null::uuid$$;",
);
await db.exec(
  await readFile("supabase/migrations/202609080001_core.sql", "utf8"),
);
const { rows } = await db.query(
  "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
);
const tables = Object.groupBy(rows, (r) => r.table_name);
const type = (r) =>
  r.data_type === "jsonb"
    ? "Json"
    : r.data_type === "boolean"
      ? "boolean"
      : ["integer", "bigint", "numeric"].includes(r.data_type)
        ? "number"
        : r.data_type === "ARRAY"
          ? r.udt_name === "_int4"
            ? "number[]"
            : "string[]"
          : "string";
let code =
  "// Generated from the migration's information_schema by npm run db:types. Do not edit.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n";
for (const [table, columns] of Object.entries(tables)) {
  code += JSON.stringify(table) + ": { Row: {\n";
  for (const r of columns)
    code +=
      JSON.stringify(r.column_name) +
      ": " +
      type(r) +
      (r.is_nullable === "YES" ? " | null" : "") +
      ";\n";
  code += "}; Insert: {\n";
  for (const r of columns)
    code +=
      JSON.stringify(r.column_name) +
      (r.column_default || r.is_nullable === "YES" ? "?" : "") +
      ": " +
      type(r) +
      (r.is_nullable === "YES" ? " | null" : "") +
      ";\n";
  code += "}; Update: {\n";
  for (const r of columns)
    code +=
      JSON.stringify(r.column_name) +
      "?: " +
      type(r) +
      (r.is_nullable === "YES" ? " | null" : "") +
      ";\n";
  code += "}; Relationships: [] };\n";
}
code +=
  "}; Views: Record<string, never>; Functions: { execute_command: { Args: {business_slug:string; action:string; payload:Json; request_id:string}; Returns:Json }; workspace_snapshot: {Args:{business_slug:string};Returns:Json}; list_workspaces:{Args:Record<string,never>;Returns:Json} }; Enums:Record<string,never>; CompositeTypes:Record<string,never> } };\n";
await writeFile(
  "src/lib/database.generated.ts",
  await format(code, { parser: "typescript" }),
);
await db.close();
console.log("Generated database types from migration metadata.");
