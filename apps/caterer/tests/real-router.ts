/**
 * Workarounds for Jest tests that mount the real router (`renderRouter` over `app/`). Import this module before the app
 * renders. Pinned to expo-router 57.0.20: both reach into the library's test setup or private state, so recheck them
 * when expo-router changes.
 */
import fs from "node:fs";
import path from "node:path";
import "expo-router/testing-library";

// The testing library swaps in Reanimated's stock mock (over tests/setup.cjs), which has no useReducedMotion; the
// app reads it. This runs after that swap because the import above runs first.
const Reanimated = require("react-native-reanimated");
Reanimated.useReducedMotion ??= () => false;

/** The router's module-level store. It is private (`build/global-state/store`), so only this file reaches for it. */
function routerStore() {
  return require("expo-router/build/global-state/store") as {
    store: { navigationRef: { current: any } };
    storeRef: { current?: { routeInfo?: unknown } };
  };
}

/**
 * The router keeps the last test's place in its store and resolves a shared path ("/" is in every tab's group) toward
 * that place. A real cold start has no last place, so call this in `beforeEach`.
 */
export function resetRouterStore() {
  const { storeRef } = routerStore();
  if (storeRef.current) storeRef.current.routeInfo = undefined;
}

const appDir = path.join(__dirname, "..", "app");

/** Every file under app/, as the router names it (`(tabs)/(index,pelanggan,menu,usaha)/laporan/[id]`, `+native-intent`). */
function appFiles(dir = appDir, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return appFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    return [`${prefix}${entry.name.replace(/\.tsx?$/, "")}`];
  });
}

/**
 * The app for `renderRouter`: the real layouts and `+native-intent`, and a stand-in for each screen. It is built in
 * memory rather than with `{ appDir, overrides }`, because that form drops file extensions and the router then reads
 * `+native-intent` as an invalid route instead of applying it.
 */
export function appRoutes(screen: (file: string) => () => unknown) {
  return Object.fromEntries(
    appFiles().map((file) => {
      const special = file.endsWith("_layout") || file.split("/").pop()!.startsWith("+");
      return [file, special ? require(path.join(appDir, file)) : screen(file)];
    }),
  );
}

/** The mounted navigation container, for dispatching what the native tab bar would (a tab tap is a `JUMP_TO`). */
export function navigationContainer() {
  return routerStore().store.navigationRef.current;
}
