import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "vitest";

const root = join(__dirname, "..");
const appDirs = ["apps/customer/src", "apps/customer/app"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const rel = (f: string) => relative(root, f).split(sep).join("/");

// The static palette is light-only; native screens read the active palette through useColors/themedStyles.
test("customer native sources read the theme, never colors", () => {
  const offenders = appDirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => /\bcolors\b/.test(readFileSync(f, "utf8")))
    .map(rel)
    .sort();
  expect(offenders).toEqual([]);
});
