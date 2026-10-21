import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Phase G copy pass (G18): the words the glossary retired never come back in the native apps, the shared packages they
 * read, the push dispatcher or the push migration. Comments are not UI text and are skipped.
 */
const root = join(__dirname, "..");
const SOURCE_DIRS = [
  "apps/customer/src",
  "apps/customer/app",
  "apps/caterer/src",
  "apps/caterer/app",
  "packages/mobile-ui/src",
  "packages/mobile-core/src",
  "packages/domain/src",
];
const EXTRA_FILES = ["apps/web/src/lib/push-dispatch.ts"];
const PUSH_MIGRATION = "supabase/migrations/20261014130000_push_copy.sql";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}
const rel = (f: string) => relative(root, f).split(sep).join("/");
const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);

type Hit = { file: string; line: number; text: string };
const files = [...SOURCE_DIRS.flatMap((d) => walk(join(root, d))), ...EXTRA_FILES.map((f) => join(root, f))];
const code: { file: string; lines: string[] }[] = files.map((f) => ({
  file: rel(f),
  lines: readFileSync(f, "utf8").split("\n"),
}));

function scan(pattern: RegExp, where: (file: string) => boolean = () => true): Hit[] {
  const hits: Hit[] = [];
  for (const { file, lines } of code) {
    if (!where(file)) continue;
    lines.forEach((text, i) => {
      if (!isComment(text) && pattern.test(text)) hits.push({ file, line: i + 1, text: text.trim().slice(0, 140) });
    });
  }
  return hits;
}
const names = (hits: Hit[]) => hits.map((h) => `${h.file}:${h.line} ${h.text}`);

describe("scan helper", () => {
  test("skips comment lines and finds code lines", () => {
    expect(isComment("  // Anda")).toBe(true);
    expect(isComment(" * Anda")).toBe(true);
    expect(isComment('{t("Anda", "you")}')).toBe(false);
  });
});

describe("native copy glossary", () => {
  test("no em dash in any string", () => {
    expect(names(scan(/—/))).toEqual([]);
  });
  test("no en dash used as a spaced separator or a lone placeholder", () => {
    // A numeric range test in code (`includes("–")`) is logic, not copy.
    expect(names(scan(/ – |["'`]–["'`]/)).filter((hit) => !hit.includes(".includes("))).toEqual([]);
  });
  test("\"Anda\" is never a UI word", () => {
    expect(names(scan(/\bAnda\b/))).toEqual([]);
  });
  test("\"katerer\" is always \"katering\"", () => {
    expect(names(scan(/katerer/i))).toEqual([]);
  });
  test("the second Dapur role is \"staf dapur\", never Pembantu or a visible helper", () => {
    expect(names(scan(/Pembantu/))).toEqual([]);
    // A label with the word in it; the stored value "helper" is a bare literal and stays.
    expect(names(scan(/["'`][^"'`\n]* helpers?\b[^"'`\n]*["'`]/i))).toEqual([]);
  });
  test("the noun for a delivery is \"pengantaran\", not \"antaran\"", () => {
    // `atur-antaran` is a route segment, so a letter or hyphen before the word is not the noun.
    expect(names(scan(/(?<![\w-])antaran(?!\w)/i))).toEqual([]);
  });
  test("\"HP\", not \"ponsel\"", () => {
    expect(names(scan(/ponsel/i))).toEqual([]);
  });
  test("the auto-closed meal reads \"Ditandai sampai otomatis\"", () => {
    expect(names(scan(/Tercatat sampai/i))).toEqual([]);
    expect(names(scan(/Recorded as arrived/i))).toEqual([]);
  });
  test("demo labels say \"data contoh\"", () => {
    expect(names(scan(/data sintetis|synthetic data/i))).toEqual([]);
  });
  test("Beranda's section is \"Perlu kamu urus\" and the move is \"Pindah tanggal\"", () => {
    expect(names(scan(/Menunggu Anda|Menunggu kamu|Waiting on you/))).toEqual([]);
    expect(names(scan(/Pindah hari|Move the day/))).toEqual([]);
  });
  test("the package button publishes", () => {
    expect(names(scan(/["'`]Simpan paket["'`]/))).toEqual([]);
  });
  test("no formal register in the shared error map or the screens", () => {
    expect(names(scan(/Silakan|terlebih dahulu|tidak dapat\b|Please /))).toEqual([]);
  });
  test("the three unbacked claims are gone", () => {
    expect(names(scan(/1 menit|1 minute|tanpa jeda|dari bank|checked with the bank/))).toEqual([]);
  });
  test("the search placeholder invents no caterer", () => {
    expect(names(scan(/Bu Rini/))).toEqual([]);
  });
  test("the generic failure is the last resort, not a habit", () => {
    const generic = scan(/Belum berhasil\. Coba lagi\./);
    expect(generic.length).toBeLessThanOrEqual(2);
  });
  test("a failed delivery reads \"Gagal diantar\" everywhere", () => {
    expect(names(scan(/Tidak bisa diantar|Couldn't be delivered/))).toEqual([]);
  });
  test("English Dapur copy uses the English button names, not the Indonesian ones", () => {
    // The English side of each pair: Sampai is "Arrived", Berangkat is "Head out".
    expect(names(scan(/Mark (it )?Sampai|Mark Berangkat|Leave with \$\{|["'`]Leave(?: \(|["'`])|and Leave come/, (f) => f.startsWith("apps/caterer/")))).toEqual([]);
  });
  test("calques are gone", () => {
    expect(names(scan(/Leave to deliver|Try retyping/))).toEqual([]);
  });
});

describe("push copy migration", () => {
  const sql = existsSync(join(root, PUSH_MIGRATION)) ? readFileSync(join(root, PUSH_MIGRATION), "utf8") : "";
  // Everything before the first replacement list is the header; the bodies the customer and the caterer read follow it.
  const newBodies = [
    "Paketmu sudah aktif",
    "Pesanan baru: ",
    "Ada pertanyaan baru dari pelanggan.",
    "Ada pesan baru dari katering.",
    "Pelanggan melaporkan masalah pengantaran. Buka untuk membalas.",
    "Perpanjang kalau mau lanjut",
  ];
  test("exists and replaces every body in place", () => {
    expect(sql).not.toBe("");
    expect(sql).toMatch(/PUSH_COPY_ANCHOR_MISSING/);
    for (const body of newBodies) expect(sql).toContain(body);
  });
  test("prints a day as a name, never as a raw ISO date", () => {
    expect(sql).toMatch(/function v1\.push_day\(/);
    const news = [...sql.matchAll(/\$n\$([\s\S]*?)\$n\$/g)].map((m) => m[1]);
    for (const body of news) expect(body).not.toMatch(/service_date\|\|/);
    expect(sql).toContain("v1.push_day(r.service_date)");
  });
  test("its new bodies have no retired words", () => {
    // The old side of each pair is the only place the retired words may appear: the new side follows `$n$`.
    const news = [...sql.matchAll(/\$n\$([\s\S]*?)\$n\$/g)].map((m) => m[1]);
    expect(news.length).toBeGreaterThan(10);
    for (const body of news) {
      expect(body).not.toMatch(/\bAnda\b|katerer|—|tanpa jeda|tinjau|Silakan/i);
    }
  });
  test("is registered with the other migrations", () => {
    const database = readFileSync(join(root, "packages/backend/src/database.ts"), "utf8");
    expect(database).toContain("20261014130000_push_copy.sql");
  });
});
