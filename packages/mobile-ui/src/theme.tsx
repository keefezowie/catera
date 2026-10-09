import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";
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

  useEffect(() => {
    let live = true;
    SecureStore.getItemAsync(storageKey)
      .then((stored) => {
        if (live && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [storageKey]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      // A failed write only loses persistence; the choice still applies for this session.
      SecureStore.setItemAsync(storageKey, next).catch(() => {});
    },
    [storageKey],
  );

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
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: NativePalette) => T): () => T {
  const cache: { light?: T; dark?: T } = {};
  return () => {
    const { scheme } = use(ThemeContext);
    return (cache[scheme] ??= StyleSheet.create(factory(nativeThemes[scheme])));
  };
}
