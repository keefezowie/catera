import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "vitest";

const root = join(__dirname, "..");
const appDirs = ["apps/customer/src", "apps/customer/app", "apps/caterer/src", "apps/caterer/app", "packages/mobile-ui/src"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const rel = (f: string) => relative(root, f).split(sep).join("/");

// The static palette is light-only; native screens read the active palette through useColors/themedStyles.
// theme.tsx is the one place allowed to touch the palette tables directly.
test("native sources read the theme, never colors", () => {
  const offenders = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => rel(f) !== "packages/mobile-ui/src/theme.tsx")
    .filter((f) => /\bcolors\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(offenders).toEqual([]);
});

test("mobile-ui does not re-export colors", () => {
  const source = readFileSync(join(root, "packages/mobile-ui/src/components.tsx"), "utf8");
  expect(source).not.toMatch(/export \{ colors \}/);
});

// Fixed inks (the plate, the story cover, the story viewer and the Menu besok story page, all over a photo or black) are the
// one reason to read a palette without following the theme. Anything else that imports nativeThemes would bypass the
// active theme, so it is named here rather than allowed by default.
test("only the plate, the story cover, the story viewer, the Menu besok story and the theme module import nativeThemes", () => {
  const importers = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /\bnativeThemes\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(importers).toEqual([
    "apps/customer/src/today/Plate.tsx",
    "apps/customer/src/tomorrow/TomorrowStory.tsx",
    "packages/mobile-ui/src/StoryCover.tsx",
    "packages/mobile-ui/src/StoryViewer.tsx",
    "packages/mobile-ui/src/theme.tsx",
  ]);
});

// Mood colours belong to mood surfaces only. Tab bars and the shared Screen body read theme colours, so a mood can
// never tint them; the mood tables are reachable through mood.tsx and nowhere else.
test("mood colours never reach tab bars or shared bodies", () => {
  const tabDirs = readdirSync(join(root, "apps"))
    .map((app) => join(root, "apps", app, "app", "(tabs)"))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    });
  expect(tabDirs.length).toBeGreaterThan(0);
  const tabOffenders = tabDirs
    .flatMap(walk)
    .filter((f) => /\b(useMoodColors|nativeMood)\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(tabOffenders).toEqual([]);

  const components = readFileSync(join(root, "packages/mobile-ui/src/components.tsx"), "utf8");
  expect(components).not.toMatch(/\b(useMoodColors|nativeMood)\b/);

  const importers = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /\bnativeMood\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(importers).toEqual(["packages/mobile-ui/src/mood.tsx"]);
});
