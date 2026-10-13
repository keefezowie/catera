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

// Errors are never loose text (spec 5.2). A `Text` coloured `danger` or `heroWarn` belongs only inside `FormError`, a
// `Field` error, `ReadError` and `ConnectionBanner`, which add the icon and the ground. Everything else routes its
// message through one of them. The scan reads each opening `<Text …>` / `<RNText …>` tag. A tag counts when it names
// `danger` or `heroWarn` itself, or when it reads a style that sets `color` to one: an entry of a style object
// (`error: { color: c.danger }`, read as `styles.error`) or a plain constant (`const warn = { color: … }`). A danger
// border or a danger style on a View is not text and does not count.
const ERROR_OWNERS = new Set([
  "packages/mobile-ui/src/FormError.tsx",
  "packages/mobile-ui/src/ReadError.tsx",
  "packages/mobile-ui/src/ConnectionBanner.tsx",
  "packages/mobile-ui/src/settings/SettingsRows.tsx", // Keluar, a destructive action label, not an error
]);
const DANGER_INK = String.raw`\bcolor\s*:\s*[^,}]*\b(?:danger|heroWarn)\b`;
const bareErrorTexts = (source: string) => {
  const entries = [...source.matchAll(new RegExp(String.raw`(\w+)\s*:\s*\{[^{}]*${DANGER_INK}`, "g"))].map((m) => m[1]);
  const constants = [...source.matchAll(new RegExp(String.raw`\bconst\s+(\w+)\s*=\s*\{[^{}]*${DANGER_INK}`, "g"))].map((m) => m[1]);
  const readsDanger = (tag: string) =>
    /\b(?:danger|heroWarn)\b/.test(tag) ||
    entries.some((name) => new RegExp(String.raw`\.${name}\b`).test(tag)) ||
    constants.some((name) => new RegExp(String.raw`[{\[,\s]${name}\b`).test(tag));
  return [...source.matchAll(/<(?:RNText|Text)\b[^>]*>/g)].filter((m) => readsDanger(m[0])).length;
};
// components.tsx owns one error line, Field's. Only the Field function is lifted out; the rest of the file is scanned.
const withoutField = (source: string) =>
  source.replace(/export function Field\b[\s\S]*?(?=\nexport function |$)/, "");

test("a bare danger caption fails the scan", () => {
  expect(bareErrorTexts(`<Text selectable style={{ color: c.danger }}>{error}</Text>`)).toBe(1);
  expect(bareErrorTexts(`<Text variant="caption" style={{ color: palette.danger }}>x</Text>`)).toBe(1);
  expect(bareErrorTexts(`<RNText style={{ color: moodColors.heroWarn }}>x</RNText>`)).toBe(1);
  expect(bareErrorTexts(`<Text\n  selectable\n  style={{ color: c.danger, textAlign: "center" }}\n>x</Text>`)).toBe(1);
  expect(bareErrorTexts(`<FormError message={error} />`)).toBe(0);
  expect(bareErrorTexts(`<Text style={{ color: c.muted }}>danger zone</Text>`)).toBe(0);
});

test("a danger colour moved into a style entry still fails the scan", () => {
  const sheet = `const useStyles = themedStyles((c) => ({\n  error: { color: c.danger, marginTop: 4 },\n  note: { color: c.muted },\n  edge: { borderColor: c.danger },\n}));\n`;
  expect(bareErrorTexts(`${sheet}<Text selectable style={styles.error}>{error}</Text>`)).toBe(1);
  expect(bareErrorTexts(`${sheet}<RNText style={[styles.caption, styles.error]}>x</RNText>`)).toBe(1);
  expect(bareErrorTexts(`const warn = { color: moodColors.heroWarn };\n<Text style={warn}>x</Text>`)).toBe(1);
  // A danger border, a muted entry and a danger entry on a View are not loose text.
  expect(bareErrorTexts(`${sheet}<Text style={styles.note}>x</Text><View style={styles.edge} /><View style={styles.error} />`)).toBe(0);
  // One tag counts once, whichever way it reaches danger.
  expect(bareErrorTexts(`${sheet}<Text style={[styles.error, { color: c.danger }]}>x</Text>`)).toBe(1);
});

test("components.tsx is exempt only inside Field", () => {
  const field = `export function Field() {\n  return error ? <RNText style={[styles.caption, { color: c.danger }]}>{error}</RNText> : null;\n}\n`;
  const after = `export function Stepper() {\n  return null;\n}\n`;
  expect(bareErrorTexts(withoutField(`${field}${after}`))).toBe(0);
  expect(bareErrorTexts(withoutField(`${field}${after.replace("null;", "<Text style={{ color: c.danger }}>x</Text>;")}`))).toBe(1);
  expect(bareErrorTexts(withoutField(`export function Chip() {\n  return <Text style={{ color: c.danger }}>x</Text>;\n}\n${field}`))).toBe(1);
});

// Existing call sites that still draw their own error text. G8 and G9 route them through `FormError` / `ReadError` as
// they adopt `Button busy`; each file leaves this table when its count reaches zero, and the test fails if a count
// drops without the table following, or if a file outside the table gains one.
const LEGACY_BARE_ERRORS: Record<string, number> = {
  "apps/customer/src/account/Addresses.tsx": 1,
  "apps/customer/src/account/AddressForm.tsx": 2,
  "apps/customer/src/account/AuthCallback.tsx": 1,
  "apps/customer/src/account/Masuk.tsx": 1,
  "apps/customer/src/account/Notifications.tsx": 1,
  "apps/customer/src/account/Payments.tsx": 2,
  "apps/customer/src/account/Recover.tsx": 1,
  "apps/customer/src/account/Register.tsx": 1,
  "apps/customer/src/buy/BuyParts.tsx": 2,
  "apps/customer/src/buy/BuyScreen.tsx": 2,
  "apps/customer/src/buy/PaymentOutcome.tsx": 1,
  "apps/customer/src/buy/PaymentScreen.tsx": 1,
  "apps/customer/src/claim/ClaimScreen.tsx": 2,
  "apps/customer/src/discover/Jelajah.tsx": 2,
  "apps/customer/src/discover/PackageDetail.tsx": 2,
  "apps/customer/src/discover/SavedList.tsx": 2,
  "apps/customer/src/help/HelpForm.tsx": 4,
  "apps/customer/src/help/ReportList.tsx": 3,
  "apps/customer/src/help/ReportProblem.tsx": 2,
  "apps/customer/src/plan/PlanDetail.tsx": 2,
  "apps/customer/src/plan/PlanList.tsx": 1,
  "apps/customer/src/schedule/ChangeDaySheet.tsx": 3,
  "apps/customer/src/schedule/ChooseMenu.tsx": 5,
  "apps/customer/src/schedule/DayScreen.tsx": 1,
  "apps/customer/src/schedule/Jadwal.tsx": 1,
  "apps/customer/src/shell.tsx": 1,
  "apps/customer/src/today/Beranda.tsx": 2,
  "apps/customer/src/today/EmptyHome.tsx": 1,
  "apps/customer/src/today/Plate.tsx": 1,
  "apps/customer/src/today/ReviewSheet.tsx": 2,
  "apps/caterer/src/auth/Daftar.tsx": 1,
  "apps/caterer/src/auth/Masuk.tsx": 1,
  "apps/caterer/src/business/AktifkanScreen.tsx": 2,
  "apps/caterer/src/business/PackageEditor.tsx": 4,
  "apps/caterer/src/business/TimScreen.tsx": 1,
  "apps/caterer/src/customers/CustomerDetail.tsx": 1,
  "apps/caterer/src/menu/MenuDayScreen.tsx": 1,
  "apps/caterer/src/today/ExceptionSheet.tsx": 1,
  "apps/caterer/src/today/TodayScreen.tsx": 2,
};

test("no error text is loose outside FormError, Field error, ReadError and ConnectionBanner", () => {
  const found: Record<string, number> = {};
  for (const file of appDirs.flatMap((d) => walk(join(root, d))).map(rel)) {
    if (ERROR_OWNERS.has(file)) continue;
    const source = readFileSync(join(root, file), "utf8");
    const count = bareErrorTexts(file === "packages/mobile-ui/src/components.tsx" ? withoutField(source) : source);
    if (count) found[file] = count;
  }
  expect(found).toEqual(LEGACY_BARE_ERRORS);
});
