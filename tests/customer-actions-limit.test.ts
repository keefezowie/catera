import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `/api/v1/customer-actions` accepts `limit` from 1 to 20 (apps/web/src/app/api/v1/[...path]/route.ts) and answers 400
// above it. Bantuan once asked for 50, so its payment-help feed failed on every visit without a word on screen.
const MAX = 20;
const ROOTS = ["apps/customer/src", "apps/caterer/src", "packages/mobile-core/src"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("customer-actions limit", () => {
  it(`no native client asks the action feed for more than ${MAX} items`, () => {
    const calls = ROOTS.flatMap(sources).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/customerActions\((\d+)\)/g)].map((m) => ({ file, limit: Number(m[1]) })),
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.limit < 1 || c.limit > MAX)).toEqual([]);
  });
});
