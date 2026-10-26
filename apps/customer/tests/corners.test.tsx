import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Continuous corners (spec 2026-10-26, item 18): every rounded rectangle in the shared UI and both apps pairs its
 * `borderRadius` with `borderCurve: "continuous"`, the iOS squircle (Android ignores it). Circles (a radius half the
 * size, `/ 2`, 999) are left alone, and so are pills, which keep the plain curve.
 */

const repo = join(__dirname, "..", "..", "..");
const roots = ["packages/mobile-ui/src", "apps/customer/src", "apps/customer/app", "apps/caterer/src", "apps/caterer/app"];
/** Pills: the radius is half a min-height the object doesn't state as `height`. */
const PILLS = ["apps/customer/src/help/ReportList.tsx: 14", "packages/mobile-ui/src/Toast.tsx: ios ? 22 : 4"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return /node_modules|android|ios/.test(name) ? [] : files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}
/** The innermost `{ … }` around position `at`. */
function objectAt(source: string, at: number) {
  let depth = 0;
  let start = at;
  for (; start >= 0; start--) {
    if (source[start] === "}") depth++;
    else if (source[start] === "{" && depth-- === 0) break;
  }
  depth = 0;
  let end = at;
  for (; end < source.length; end++) {
    if (source[end] === "{") depth++;
    else if (source[end] === "}" && depth-- === 0) break;
  }
  return source.slice(start, end + 1);
}

it("every rounded rectangle has a continuous corner", () => {
  const missing: string[] = [];
  for (const file of roots.flatMap((root) => files(join(repo, root)))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/borderRadius:\s*([^,}\n]+)/g)) {
      const radius = match[1].trim();
      const object = objectAt(source, match.index!);
      if (/borderCurve|imageCurve/.test(object) || /\/\s*2\b|999|^0$/.test(radius)) continue;
      const size = object.match(/\b(?:width|height):\s*([0-9.]+)/g)?.map((s) => Number(s.split(":")[1])) ?? [];
      if (/^[0-9.]+$/.test(radius) && size.includes(2 * Number(radius))) continue;
      const name = relative(repo, file).split(sep).join("/") + ": " + radius;
      if (!PILLS.includes(name)) missing.push(name + " (line " + source.slice(0, match.index).split("\n").length + ")");
    }
  }
  expect(missing).toEqual([]);
});
