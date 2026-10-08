import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "vitest";

const root = join(__dirname, "..");
const appDirs = ["apps/customer/src", "apps/customer/app", "apps/caterer/src", "apps/caterer/app"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const rel = (f: string) => relative(root, f).split(sep).join("/");

// Android cannot pick weights from a variable TTF; native text must name a static family instead.
test("native app sources never set fontWeight (use fonts.* or fontFor from @catera/mobile-ui)", () => {
  const offenders = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => readFileSync(f, "utf8").includes("fontWeight"))
    .map(rel)
    .sort();
  expect(offenders).toEqual([]);
});

// Only the Text variants may declare a weight; Text maps it to a family. Any other style
// property in mobile-ui (Stepper, labels, raw RNText) must use fontFor/fonts.
test("mobile-ui sets fontWeight only inside the textVariants table", () => {
  const offenders = walk(join(root, "packages/mobile-ui/src"))
    .filter((f) => {
      const source = readFileSync(f, "utf8").replace(/const textVariants = \{[\s\S]*?\n\} satisfies/, "");
      return /fontWeight\s*:/.test(source);
    })
    .map(rel)
    .sort();
  expect(offenders).toEqual([]);
});

test("the mobile-ui guard strips the textVariants table (it does exist)", () => {
  const source = readFileSync(join(root, "packages/mobile-ui/src/components.tsx"), "utf8");
  expect(source).toMatch(/const textVariants = \{[\s\S]*?\n\} satisfies/);
  expect(source).toMatch(/fontWeight\s*:/);
});

// Palette colours live in @catera/design-tokens; native sources reference colors.*, never a pasted hex.
test("Dapur app sources use colors.* tokens instead of literal hex values", () => {
  const offenders = ["apps/caterer/src", "apps/caterer/app"]
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /#[0-9A-Fa-f]{6}\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(offenders).toEqual([]);
});
