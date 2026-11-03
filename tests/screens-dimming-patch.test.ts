import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const screens = resolve(root, "node_modules/react-native-screens");
const dimmingView = resolve(
  screens,
  "android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt",
);

describe("react-native-screens dimming view patch", () => {
  const version = JSON.parse(readFileSync(resolve(screens, "package.json"), "utf8")).version as string;

  it("has a patch file for the installed react-native-screens version", () => {
    expect(existsSync(resolve(root, `patches/react-native-screens+${version}.patch`))).toBe(true);
  });

  it("runs patch-package after install", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts.postinstall).toBe("patch-package");
    expect(pkg.devDependencies["patch-package"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("keeps TalkBack off the formSheet backdrop in the installed Kotlin", () => {
    const source = readFileSync(dimmingView, "utf8");
    // npm runs the root postinstall only on a bare `npm install` or `npm ci`; `npm install <pkg>` skips it, so a
    // tree installed before the patch landed stays unpatched until patch-package runs.
    expect(source, "react-native-screens is unpatched: run `npx patch-package` (or `npm ci`) at the repo root").toContain("importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO");
  });
});
