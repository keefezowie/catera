import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const root = join(__dirname, "..");

// The apps follow the phone's light or dark setting; "light" would pin the system chrome and keep the
// stored Tampilan choice from matching what the operating system draws.
test.each(["apps/customer/app.config.ts", "apps/caterer/app.config.ts"])('%s follows the system appearance', (file) => {
  const source = readFileSync(join(root, file), "utf8");
  expect(source).toMatch(/userInterfaceStyle:\s*"automatic"/);
  expect(source).not.toMatch(/userInterfaceStyle:\s*"light"/);
});
