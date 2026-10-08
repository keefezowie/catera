import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "vitest";

const root = join(__dirname, "..");
const dirs = ["apps/customer/src", "apps/customer/app", "apps/caterer/src", "apps/caterer/app"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

// Android cannot pick weights from a variable TTF; native text must name a static family instead.
test("native app sources never set fontWeight (use fonts.* or fontFor from @catera/mobile-ui)", () => {
  const offenders = dirs
    .flatMap((d) => walk(join(root, d)))
    .filter((f) => readFileSync(f, "utf8").includes("fontWeight"))
    .map((f) => relative(root, f).split(sep).join("/"))
    .sort();
  expect(offenders).toEqual([]);
});
