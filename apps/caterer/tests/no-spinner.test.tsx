import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Dapur's loading rule (Phase F spec 2, task 6): a screen or a section waits behind its skeleton, never behind a bare
 * spinner or a bare "Memuat…" line. Named `.tsx` so the app's Jest run (`tests/**\/*.test.tsx`) picks it up.
 *
 * Allowed `ActivityIndicator` uses: the busy state inside `Button` and `StickyAction` (drawn by `@catera/mobile-ui`, so
 * not in this app), `RefreshControl` (its own spinner, no `ActivityIndicator` in the source), and a photo tile while it
 * uploads (Menu's "Mengunggah…" pill, marked by its `photo-spinner` test id).
 */
const root = join(__dirname, "..");
const APP_ROOT = root;
const scanned = ["src", "app"].map((dir) => join(root, dir));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = scanned.flatMap(sources).map((path) => ({
  file: relative(root, path).replace(/\\/g, "/"),
  lines: readFileSync(path, "utf8").split(/\r?\n/),
}));

/** A spinner use is allowed only as a photo tile's upload spinner: its opening tag names it `menu-photo-spinner-…`. */
function uploadTile(lines: string[], at: number): boolean {
  const tag = lines.slice(at, at + 6).join("\n");
  const end = tag.indexOf(">");
  return /testID=\{?[`"'][^`"']*photo-spinner/.test(end === -1 ? tag : tag.slice(0, end));
}

it("no ActivityIndicator outside an upload tile, a button's busy state or RefreshControl", () => {
  const offending: string[] = [];
  for (const { file, lines } of files) {
    let allowed = 0;
    let imported = -1;
    lines.forEach((line, i) => {
      if (!/\bActivityIndicator\b/.test(line)) return;
      if (/^\s*import\b/.test(line) || /^\s*ActivityIndicator,\s*$/.test(line)) {
        imported = i;
        return;
      }
      if (line.includes("<ActivityIndicator") && uploadTile(lines, i)) allowed += 1;
      else offending.push(`${file}:${i + 1}: ${line.trim()}`);
    });
    // An import with no allowed use left would be a spinner on its way back in.
    if (imported !== -1 && allowed === 0 && !offending.some((o) => o.startsWith(`${file}:`)))
      offending.push(`${file}:${imported + 1}: ActivityIndicator imported but not used as an upload tile`);
  }
  expect(offending).toEqual([]);
});

/** Components that may speak a "Memuat…" wait: a skeleton's progress-bar name, or the mascot's line for a wait with nothing to show. */
const LOADING_TAGS = new Set(["SkeletonGroup", "ListSkeleton", "DetailSkeleton", "MascotLoading"]);

/**
 * Every "Memuat…" string a source file draws: a quoted literal whose nearest opening JSX tag (on its line or the three
 * before) is not a loading component, and any unquoted JSX text such as `<Text>Memuat…</Text>`. Comments are skipped.
 */
export function loadingOffenders(lines: string[], allowed: ReadonlySet<string> = new Set()): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  lines.forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    for (const match of line.matchAll(/["'`](Memuat[^"'`]*)["'`]/g)) {
      if (allowed.has(match[1])) continue;
      const before = [...lines.slice(Math.max(0, i - 3), i), line.slice(0, match.index)].join("\n");
      const tag = [...before.matchAll(/<([A-Z]\w*)/g)].at(-1)?.[1];
      if (!tag || !LOADING_TAGS.has(tag)) found.push({ line: i + 1, text: match[1] });
    }
    for (const match of line.matchAll(/>\s*(Memuat[^<{]*)</g)) found.push({ line: i + 1, text: match[1].trim() });
  });
  return found;
}

it("the Memuat scan catches a button label and bare JSX text, and lets a skeleton's label through", () => {
  const source = [
    '<Button label={t("Memuat…", "Loading…")} onPress={go} />',
    "<Text>Memuat daftar…</Text>",
    '<Text variant="caption">{t("Memuat minggu lalu…", "x")}</Text>',
    '<ListSkeleton rows={3} label={t("Memuat paket", "Loading")} />',
    "<SkeletonGroup",
    '  label={t("Memuat dapur", "Loading")}',
    ">",
    '// label: "Memuat uang"',
  ];
  expect(loadingOffenders(source, new Set(["Memuat minggu lalu…"]))).toEqual([
    { line: 1, text: "Memuat…" },
    { line: 2, text: "Memuat daftar…" },
  ]);
});

it("no bare Memuat line stands in for a screen or a section", () => {
  // "Memuat minggu lalu…" is not a loader: it is the reason "Salin minggu lalu" is still off, beside that button.
  const allowed = new Set(["Memuat minggu lalu…"]);
  const offending = files.flatMap(({ file, lines }) => loadingOffenders(lines, allowed).map((o) => `${file}:${o.line}: ${o.text}`));
  expect(offending).toEqual([]);
});

it("an ActivityIndicator is allowed only inside a busy Button, StickyAction, SettingsRow or the Menu upload tile", () => {
  // The shared package: the busy Button draws the spinner, StickyAction hands `busy` to that Button, and the settings
  // row draws its own while a toggle waits. No other shared component may wait behind a bare spinner.
  const shared = join(APP_ROOT, "..", "..", "packages", "mobile-ui", "src");
  const found = sources(shared)
    .map((path) => relative(shared, path).split("\\").join("/"))
    .filter((file) => /\bActivityIndicator\b/.test(readFileSync(join(shared, file), "utf8")))
    .sort();
  expect(found).toEqual(["components.tsx", "settings/SettingsRows.tsx"]);
  expect(readFileSync(join(shared, "StickyAction.tsx"), "utf8")).toMatch(/<Button\b[^>]*\bbusy=\{busy\}/);
});
