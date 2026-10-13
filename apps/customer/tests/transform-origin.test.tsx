import fs from "node:fs";
import path from "node:path";

/** Every `transformOrigin` the brand art sets, read from source: the Dapur crash came from an unrounded float in one. */
const brand = path.resolve(__dirname, "../../../packages/mobile-ui/src/brand");
const origins = fs
  .readdirSync(brand)
  .filter((file) => file.endsWith(".tsx"))
  .flatMap((file) =>
    fs
      .readFileSync(path.join(brand, file), "utf8")
      .split("\n")
      .filter((line) => line.includes("transformOrigin"))
      .map((line) => ({ file, line: line.trim() })),
  );

it("every transformOrigin in packages/mobile-ui/src/brand has at most two numeric parts", () => {
  expect(origins.length).toBeGreaterThan(0);
  for (const { file, line } of origins) {
    // A value built into a template string carries whatever digits the float has; numbers or a rounded helper only.
    expect({ file, template: /transformOrigin:\s*`/.test(line) }).toEqual({ file, template: false });
    const literal = /transformOrigin:\s*"([^"]*)"/.exec(line);
    if (literal) expect(literal[1].trim().split(/\s+/).length).toBeLessThanOrEqual(2);
  }
});
