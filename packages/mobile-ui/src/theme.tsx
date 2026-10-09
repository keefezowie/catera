import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { nativeThemes, type NativePalette, type ThemeName } from "@catera/design-tokens";

export type ThemePreference = "system" | "light" | "dark";

type ThemeValue = {
  palette: NativePalette;
  scheme: ThemeName;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (PREFERENCES as readonly string[]).includes(value);
}

// Without a provider (isolated component tests, early boot) everything reads the light palette.
const ThemeContext = createContext<ThemeValue>({
  palette: nativeThemes.light,
  scheme: "light",
  preference: "system",
  setPreference: () => {},
});

/**
 * Resolves the palette for the whole tree. The stored choice is read once; until it arrives, and whenever it is
 * missing, unreadable or unknown, the app follows the system scheme.
 */
export function ThemeProvider({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const system = useColorScheme();
  // Set once the user has chosen in this session: a slower initial read must not overwrite that choice.
  const chosen = useRef(false);

  useEffect(() => {
    let live = true;
    SecureStore.getItemAsync(storageKey)
      .then((stored) => {
        if (live && !chosen.current && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [storageKey]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      chosen.current = true;
      setPreferenceState(next);
      // A failed write only loses persistence; the choice still applies for this session.
      SecureStore.setItemAsync(storageKey, next).catch(() => {});
    },
    [storageKey],
  );

  // The keyboard, Alert and the window background are drawn by the system from its own scheme, not from this tree.
  // A chosen theme is handed to it here; "system" returns control with "unspecified". Once overridden,
  // useColorScheme reports the override, which is harmless because a chosen preference never reads `system`.
  useEffect(() => {
    Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
  }, [preference]);

  const scheme: ThemeName = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  const value = useMemo<ThemeValue>(
    () => ({ palette: nativeThemes[scheme], scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette. */
export function useColors(): NativePalette {
  return use(ThemeContext).palette;
}

/** The stored choice, the scheme it resolves to, and the setter that stores and applies a new choice. */
export function useThemePreference(): { preference: ThemePreference; scheme: ThemeName; setPreference: (p: ThemePreference) => void } {
  const { preference, scheme, setPreference } = use(ThemeContext);
  return { preference, scheme, setPreference };
}

/**
 * A stylesheet that depends on the palette. The factory runs at most once per theme, so every component instance in
 * the same theme shares one object, as with a module-level StyleSheet.
 *
 * The result is a hook: bind it to a `use*` name at module level (`const useStyles = themedStyles(...)`) and call it
 * only while rendering, never in a callback, a loop or after an early return.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: NativePalette) => T): () => T {
  const cache: { light?: T; dark?: T } = {};
  return () => {
    const { scheme } = use(ThemeContext);
    return (cache[scheme] ??= StyleSheet.create(factory(nativeThemes[scheme])));
  };
}

/**
 * React Navigation's own theme with its colours replaced by the active palette, so scene containers, cards and
 * borders never show the library's light default behind the app's surfaces. The roots pass the library's Default
 * theme in light and its Dark theme in dark, which keeps the `dark` flag and the fonts it expects.
 */
export function navigationTheme<T extends { colors: object }>(base: T, p: NativePalette): T {
  return { ...base, colors: { ...base.colors, primary: p.forest, background: p.canvas, card: p.surface, text: p.forest, border: p.line } };
}
