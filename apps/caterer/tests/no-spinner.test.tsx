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

it("no bare Memuat line stands in for a screen or a section", () => {
  // Any "Memuat" literal (with or without an ellipsis, three dots included) must be a skeleton's spoken `label=`, not
  // visible text. "Memuat minggu lalu…" is not a loader: it is the reason "Salin minggu lalu" is still off, beside it.
  const allowed = new Set(["Memuat minggu lalu…"]);
  const offending: string[] = [];
  for (const { file, lines } of files)
    lines.forEach((line, i) => {
      for (const match of line.matchAll(/["'`](Memuat[^"'`]*)["'`]/g))
        if (!allowed.has(match[1]) && !line.includes("label=") && !/^\s*(\*|\/\/)/.test(line))
          offending.push(`${file}:${i + 1}: ${match[1]}`);
    });
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
