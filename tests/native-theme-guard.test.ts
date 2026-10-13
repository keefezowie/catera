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
// theme.tsx is the one place allowed to touch the palette tables directly. A `<RefreshControl … />` tag's own
// `colors={…}` prop (the Android pull spinner's ink, handed a themed value) is not the palette, so inside that tag, and
// only there, the prop is not counted. `colors` anywhere else, a prop on another element included, still is.
const readsPalette = (source: string) =>
  /\bcolors\b/.test(source.replace(/<RefreshControl\b[\s\S]*?\/>/g, (tag) => tag.replace(/\bcolors=\{/g, "")));

test("only RefreshControl's own colors prop is exempt", () => {
  expect(readsPalette("<RefreshControl refreshing={pulling} onRefresh={() => void pull()} colors={[c.forest]} />")).toBe(false);
  expect(readsPalette("<View colors={[c.forest]} />")).toBe(true);
  expect(readsPalette("<RefreshControl colors={[colors.forest]} />")).toBe(true);
  expect(readsPalette("import { colors } from './theme';")).toBe(true);
});

test("native sources read the theme, never colors", () => {
  const offenders = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => rel(f) !== "packages/mobile-ui/src/theme.tsx")
    .filter((f) => readsPalette(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(offenders).toEqual([]);
});

test("mobile-ui does not re-export colors", () => {
  const source = readFileSync(join(root, "packages/mobile-ui/src/components.tsx"), "utf8");
  expect(source).not.toMatch(/export \{ colors \}/);
});

// Fixed inks (the plate, the story cover, the story viewer and the Menu besok story page, all over a photo or black) are the
// one reason to read a palette without following the theme. The package detail's bar reads it only while it sits over
// the photo; past the photo it takes the stack header's themed tint. Anything else that imports nativeThemes would
// bypass the active theme, so it is named here rather than allowed by default. The launch cover repeats the native
// splash, which the system draws in its own scheme whatever theme the app stores, so it reads that scheme's palette.
// The Tampilan thumbnails in Pengaturan draw the light and the dark app side by side, whichever theme is active.
test("only the plate, the story cover, the story viewer, the Menu besok story, the package photo header, the launch cover, the Tampilan thumbnails and the theme module import nativeThemes", () => {
  const importers = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /\bnativeThemes\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(importers).toEqual([
    "apps/customer/src/discover/PackageDetail.tsx",
    "apps/customer/src/today/Plate.tsx",
    "apps/customer/src/tomorrow/TomorrowStory.tsx",
    "packages/mobile-ui/src/LaunchCover.tsx",
    "packages/mobile-ui/src/StoryCover.tsx",
    "packages/mobile-ui/src/StoryViewer.tsx",
    "packages/mobile-ui/src/settings/ThemeChoice.tsx",
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

// siangHeaderFill(scheme) reads a fixed theme's mood fill whatever theme is active, so it bypasses both guards above
// by name. It is public only because mobile-ui re-exports mood.tsx; the Tampilan thumbnails are its one caller.
test("only mood.tsx and the Tampilan thumbnails name siangHeaderFill", () => {
  const callers = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /\bsiangHeaderFill\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(callers).toEqual(["packages/mobile-ui/src/mood.tsx", "packages/mobile-ui/src/settings/ThemeChoice.tsx"]);
});

// Direction K (spec 2.6): Sunrise is spent in four places only. The tracker's current stop (which reads `stopActive`,
// the mood's own Sunrise step), `nativeArt` (the success ring, the sparkles and the reading highlight, in the tokens
// package), the confetti file and the launch hand-off sparkles. Nothing else reads the theme's `sunrise` or
// `sunriseInk`: a caption, a price, a pill or a ring in Sunrise would again make it the colour of the whole app.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const readsSunrise = (source: string) => /\bsunriseInk\b|\.sunrise\b|\bsunrise\??\s*:/.test(stripComments(source));

test("the Sunrise matcher sees a palette read but not a ring prop or a comment", () => {
  expect(readsSunrise("const x = c.sunriseInk;")).toBe(true);
  expect(readsSunrise("const x = palette.sunrise;")).toBe(true);
  expect(readsSunrise("styles: { sunrise: {} }")).toBe(true);
  expect(readsSunrise('ring: "sunrise" | "forest"')).toBe(false);
  expect(readsSunrise("// the sunrise ink: c.sunriseInk\nconst x = 1;")).toBe(false);
});

test("sunrise and sunriseInk are read only by RantangTrack, nativeArt, Confetti and LaunchCover", () => {
  const readers = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => readsSunrise(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  // nativeArt lives in packages/design-tokens, outside the scanned folders.
  const allowed = new Set([
    "packages/mobile-ui/src/RantangTrack.tsx",
    "packages/mobile-ui/src/Confetti.tsx",
    "packages/mobile-ui/src/LaunchCover.tsx",
  ]);
  expect(readers.filter((f) => !allowed.has(f))).toEqual([]);
});

// Direction K rules 1, 2 and 6: forest fills only the primary button and marks selection. A forest card (the old
// `tone="brand"`) is a coloured block behind content, so the tone is gone and no source may bring it back.
test("no card is filled in forest: the brand tone is gone", () => {
  const components = stripComments(readFileSync(join(root, "packages/mobile-ui/src/components.tsx"), "utf8"));
  const tones = components.match(/const useCardTones = themedStyles\(\(c\) => \(\{([\s\S]*?)\}\)\);/);
  expect(tones).not.toBeNull();
  expect(tones?.[1]).not.toMatch(/c\.forest/);
  expect(components).not.toMatch(/"brand"/);
  const callers = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /\btone=\{?["']brand["']/.test(readFileSync(f, "utf8")))
    .map(rel);
  expect(callers).toEqual([]);
});

test("the Malam pattern is gone", () => {
  const sources = appDirs.flatMap((d) => walk(join(root, d)));
  expect(sources.map(rel).filter((f) => /MalamPattern/.test(f))).toEqual([]);
  expect(sources.filter((f) => /\bMalamPattern\b/.test(readFileSync(f, "utf8"))).map(rel)).toEqual([]);
});
