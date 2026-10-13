import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Spec 2.1: no bare `ActivityIndicator` as a screen or section loader. A screen whose shape is known shows its skeleton
 * (`src/skeletons.tsx`); a wait with nothing to show is `MascotLoading`. The only spinners left belong to one control or
 * object, and none of them is written in this app: the busy `Button` and `StickyAction` live in `@catera/mobile-ui`,
 * pull to refresh is the platform `RefreshControl`, and the customer app has no photo upload tile. A file that one day
 * draws an upload tile's spinner is listed in `UPLOAD_TILES` by its path from the app folder.
 *
 * Named `.test.tsx` (not `.ts`) so the app's run (`--testMatch "**\/tests/**\/*.test.tsx"`) picks it up.
 */
const APP = join(__dirname, "..");
const APP_ROOT = APP;
const ROOTS = ["src", "app"];
const UPLOAD_TILES = new Set<string>();

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

it("no screen or section in the customer app waits on a bare ActivityIndicator", () => {
  const found: string[] = [];
  for (const root of ROOTS)
    for (const path of sources(join(APP, root))) {
      const file = relative(APP, path).split("\\").join("/");
      if (UPLOAD_TILES.has(file)) continue;
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/\bActivityIndicator\b/.test(line)) found.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
  expect(found).toEqual([]);
});

it("the scan reads both source folders", () => {
  // Guards the test itself: a renamed folder must not turn the rule into an empty pass.
  for (const root of ROOTS) expect(sources(join(APP, root)).length).toBeGreaterThan(5);
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
