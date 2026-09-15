// Read-only reconciliation: exact normalized definitions, never timestamp matching.
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const normalize = (s) =>
  s
    .replace(/--[^\n]*/g, "")
    .replace(/^\s*(?:begin|commit);\s*$/gm, "")
    .replace(/\s+/g, "");
const rows = [];
for (const file of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const hash = createHash("md5")
    .update(normalize(await readFile("supabase/migrations/" + file, "utf8")))
    .digest("hex");
  rows.push(`('${file.replaceAll("'", "''")}','${hash}')`);
}
console.log(`with repository(file,hash) as(values ${rows.join(",")}), hosted as(
 select version,name,md5(regexp_replace(regexp_replace(regexp_replace(array_to_string(statements,E'\\n'),E'--[^\\n]*','','g'),'^[[:space:]]*(begin|commit);[[:space:]]*$','','gn'),'[[:space:]]+','','g')) hash
 from supabase_migrations.schema_migrations)
select r.file,h.version,h.name,r.hash as repository_definition_hash,h.hash as hosted_definition_hash from repository r left join hosted h on h.hash=r.hash order by r.file;`);
