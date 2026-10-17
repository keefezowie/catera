import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("RUNBOOK records the native toolchain pins and the upgrade checklist", () => {
  const runbook = read("docs/RUNBOOK.md");
  expect(runbook).toContain("Native toolchain pins and the SDK upgrade checklist");
  for (const word of ["overrides", "expo.install.exclude", "~57.0.27", "~57.0.25", "ScreenPresentationContext"])
    expect(runbook).toContain(word);
  // The pinned versions it describes are the ones in package.json.
  const pkg = JSON.parse(read("package.json")) as { overrides: Record<string, string> };
  expect(Object.keys(pkg.overrides)).toEqual(expect.arrayContaining(["react-native-reanimated", "react-native-worklets"]));
});

test("mobile-ui declares every native package it imports as a peer dependency", () => {
  const peers = (JSON.parse(read("packages/mobile-ui/package.json")) as { peerDependencies: Record<string, string> }).peerDependencies;
  for (const name of ["expo-router", "react-native-safe-area-context", "react-native-screens"]) expect(peers[name]).toBe("*");
});

test("the app Metro and Jest configs no longer describe a hoisted-copy workaround", () => {
  for (const app of ["customer", "caterer"])
    for (const file of ["metro.config.js", "jest.config.cjs"])
      expect(read(`apps/${app}/${file}`)).not.toMatch(/hoisted root copy|differs from the\s+\/\/ SDK-pinned/);
});

test("the signed-out sentence is written once and shared", () => {
  const sentence = "Masuk untuk melihat paket dan jadwal antar";
  expect(read("apps/customer/src/account/SignInFirst.tsx")).toContain(sentence);
  expect(read("apps/customer/src/help/ReportProblem.tsx")).not.toContain(sentence);
  expect(read("apps/customer/src/help/ReportProblem.tsx")).toContain("signInSentence(t)");
});
