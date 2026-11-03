// Generates SQL that gives food photos uploaded before ThumbHash placeholders their `#th=` fragment.
// Step 1: run the query printed by `node --import tsx scripts/photo-placeholders.mts query` on the target project and
//         save its single JSON column as urls.json (an array of public URLs).
// Step 2: `node --import tsx scripts/photo-placeholders.mts urls.json > photo-placeholders.sql` downloads each photo,
//         hashes it, and writes one transaction that swaps each exact JSON string for the same URL with its fragment.
// Review and apply the SQL yourself; nothing here writes to a database. Re-running is safe: hashed URLs are skipped.
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

const bucket = "/storage/v1/object/public/catera-v1-food/";
const str = (x: string) => `'${x.replaceAll("'", "''")}'`;

// Every jsonb column in schema v1, scanned for photo URLs that have no fragment yet.
export const query = `create or replace function pg_temp.photo_urls() returns setof text language plpgsql as $$
declare c record;
begin
  for c in select table_schema, table_name, column_name from information_schema.columns
           where table_schema = 'v1' and data_type = 'jsonb' loop
    return query execute format('select (regexp_matches(%I::text, %L, ''g''))[1] from %I.%I',
      c.column_name, '"(https://[^"#]*${bucket}[^"#]+)"', c.table_schema, c.table_name);
  end loop;
end $$;
select coalesce(jsonb_agg(distinct u), '[]') urls from pg_temp.photo_urls() u;`;

async function hash(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${response.status} ${url}`);
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()), { limitInputPixels: 40000000 })
    .resize(100, 100, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString("base64");
}

export const placeholderSql = (pairs: [string, string][], total = pairs.length) => !pairs.length ? `-- 0 of ${total} photos need a placeholder.` : `-- ${pairs.length} of ${total} photos. Swaps the exact JSON string "url" in every v1 jsonb column.
begin;
create temp table photo_placeholders(old text primary key, new text not null) on commit drop;
insert into photo_placeholders values
${pairs.map(([a, b]) => `  (${str(a)}, ${str(b)})`).join(",\n")};
do $$
declare c record; p record;
begin
  for c in select table_schema, table_name, column_name from information_schema.columns
           where table_schema = 'v1' and data_type = 'jsonb' loop
    for p in select * from photo_placeholders loop
      execute format('update %I.%I set %I = replace(%I::text, %L, %L)::jsonb where %I::text like %L',
        c.table_schema, c.table_name, c.column_name, c.column_name,
        to_jsonb(p.old)::text, to_jsonb(p.new)::text, c.column_name, '%' || to_jsonb(p.old)::text || '%');
    end loop;
  end loop;
end $$;
commit;`;

const [arg] = process.argv.slice(2);
if (!process.argv[1]?.endsWith("photo-placeholders.mts")) {
  // Imported by a test.
} else if (arg === "query") {
  console.log(query);
} else if (arg) {
  const urls = (JSON.parse(await readFile(arg, "utf8")) as string[]).filter((u) => u.includes(bucket) && !u.includes("#"));
  const pairs: [string, string][] = [];
  for (const url of urls) {
    try {
      pairs.push([url, `${url}#th=${await hash(url)}`]);
    } catch (error) {
      console.error(`-- skipped: ${(error as Error).message}`);
    }
  }
  console.log(placeholderSql(pairs, urls.length));
} else {
  console.error("Usage: photo-placeholders.mts query | <urls.json>");
  process.exit(1);
}
