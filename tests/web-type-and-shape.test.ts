import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

/** Typography and shape details in the web stylesheet (spec 2026-10-26, section B). */
const css = readFileSync("apps/web/src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
/** The declarations of every rule whose selector list includes `selector`, inside or outside an at-rule. */
function declarations(selector: string) {
  const out: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    if (m[1].split(",").some((s) => s.trim() === selector)) out.push(m[2]);
  return out.join(";");
}

it("prices, totals and amounts use tabular figures", () => {
  for (const selector of [
    ".card-price",
    ".package-price-summary",
    ".package-unit-price",
    ".purchase-summary-price",
    ".settlement-chart-totals",
    ".settlement-detail-amount",
  ])
    expect(declarations(selector), selector).toMatch(/font-variant-numeric:\s*tabular-nums/);
});
