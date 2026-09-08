import { it, expect } from "vitest";
import { csvText, escapeHtml } from "../src/lib/exports";

it("quotes CSV fields and neutralizes spreadsheet formulas", () => {
  const output = csvText([
    ["name", "note"],
    ["=SUM(1,1)", 'A "quoted", name'],
    ["+cmd", "line\nbreak"],
  ]);
  expect(output).toContain('"\'=SUM(1,1)"');
  expect(output).toContain('"A ""quoted"", name"');
  expect(output).toContain('"\'+cmd"');
});
it("escapes customer text used in printable manifests", () => {
  expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
});
