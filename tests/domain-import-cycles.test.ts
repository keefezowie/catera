import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../packages/domain/src");
describe("domain modules", () => {
  it("import only types from ./index", () => {
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts")
      .filter((f) => {
        const src = readFileSync(join(dir, f), "utf8");
        return [...src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"\.\/index"/g)].some(
          ([, typeOnly, names]) => !typeOnly && names.split(",").some((n) => n.trim() && !n.trim().startsWith("type ")),
        );
      });
    expect(offenders).toEqual([]);
  });
});
