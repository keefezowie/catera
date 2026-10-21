import { createContext, startTransition, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { nativeMood, type Mood, type MoodPalette, type ThemeName } from "@catera/design-tokens";
import { useThemePreference } from "./theme";

/** The two toggle labels. This package has no i18n, so the app hands over its translator through `MoodLabelsProvider`. */
export type MoodLabels = Record<Mood, string>;

const DEFAULT_LABELS: MoodLabels = { siang: "Siang", malam: "Malam" };

// Jakarta has no daylight saving and sits at UTC+7 all year.
const JAKARTA_OFFSET_HOURS = 7;
const MALAM_FROM_HOUR = 15;

/**
 * The mood the app opens in: Siang before 15:00 in Jakarta, Malam from 15:00 to the end of the day, whatever the
 * device timezone is. The clock only picks this default; nothing switches the mood while the app is open.
 */
export function defaultMood(now: Date): Mood {
  let hour = Number.NaN;
  try {
    hour =
      Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" }).format(now),
      ) % 24;
  } catch {
    // A JS engine without Intl timezone data falls through to the fixed offset below.
  }
  if (!Number.isFinite(hour)) hour = (now.getUTCHours() + JAKARTA_OFFSET_HOURS) % 24;
  return hour < MALAM_FROM_HOUR ? "siang" : "malam";
}

type MoodValue = { mood: Mood; intent: Mood; setMood: (mood: Mood) => void };

// Without a provider (isolated component tests, early boot) the app reads Siang and cannot change it.
const MoodContext = createContext<MoodValue>({ mood: "siang", intent: "siang", setMood: () => {} });

/**
 * One per app. The mood lives in memory only; every launch starts from the clock.
 * A switch lands in two steps. `intent` changes at once, in the press's own render, so the arc disc and the tab state
 * answer within a frame; `mood` (what the pages and fills read) changes in a transition, so the heavy re-render of the
 * page never holds the press back and a page that suspends keeps the old mood on screen instead of blanking.
 */
export function MoodProvider({
  children,
  now,
}: {
  children: ReactNode;
  /** The clock, for tests. */
  now?: () => Date;
}) {
  const [initial] = useState<Mood>(() => defaultMood((now ?? (() => new Date()))()));
  const [intent, setIntent] = useState<Mood>(initial);
  const [mood, setCommitted] = useState<Mood>(initial);
  const setMood = useCallback((next: Mood) => {
    setIntent(next);
    startTransition(() => setCommitted(next));
  }, []);
  const value = useMemo<MoodValue>(() => ({ mood, intent, setMood }), [mood, intent, setMood]);
  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

const MoodLabelsContext = createContext<MoodLabels>(DEFAULT_LABELS);

/**
 * Hands the toggle its labels in the app's language: `t(id, en)` is the app's translator, and the provider asks it for
 * "Siang" / "Lunch" and "Malam" / "Dinner" itself, so an app only passes its `t`. It sits apart from `MoodProvider`
 * because the translator only exists below the app's own providers, while the mood itself lives above them.
 */
export function MoodLabelsProvider({ t, children }: { t: (id: string, en: string) => string; children: ReactNode }) {
  const siang = t("Siang", "Lunch");
  const malam = t("Malam", "Dinner");
  const value = useMemo<MoodLabels>(() => ({ siang, malam }), [siang, malam]);
  return <MoodLabelsContext.Provider value={value}>{children}</MoodLabelsContext.Provider>;
}

export function useMood(): { mood: Mood; setMood: (mood: Mood) => void } {
  const { mood, setMood } = use(MoodContext);
  return { mood, setMood };
}

/**
 * The mood the person last asked for. It leads `useMood().mood` by a transition: the arc, the toggle and their
 * animations follow this, so a press is answered before the page behind it has re-rendered.
 */
export function useMoodIntent(): Mood {
  return use(MoodContext).intent;
}

/** The toggle labels `MoodLabelsProvider` was given; "Siang" and "Malam" without one. */
export function useMoodLabels(): MoodLabels {
  return use(MoodLabelsContext);
}

/**
 * The mood palette for the active theme. Mood surfaces only: headers, the toggle, the arc, the Malam pattern and the
 * hero card. Tab bars, screen bodies, cards, rows and sheets read the theme palette instead.
 * `mood` reads a specific mood (a cross-fade needs both fills); omitted, it follows the current one.
 */
export function useMoodColors(mood?: Mood): MoodPalette {
  const { scheme } = useThemePreference();
  const current = use(MoodContext).mood;
  return nativeMood[scheme][mood ?? current];
}

/**
 * A theme's Siang header fill whatever theme is active, for a small drawing of the app in that theme (the Tampilan
 * thumbnails in Pengaturan). Screens read `useMoodColors` instead.
 */
export function siangHeaderFill(scheme: ThemeName): string {
  return nativeMood[scheme].siang.header;
}

/**
 * The status-bar icon style: light icons on a dark surface, which is the dark theme only. Direction K makes every
 * header a light neutral in the light theme (Malam is a pale sage, not a dark green), so a Malam header and the demo
 * strip no longer change the glyphs; `mood` and `demo` stay in the signature so callers do not change.
 */
export function statusBarStyle({
  scheme,
}: {
  scheme: ThemeName;
  mood?: Mood | null;
  demo?: boolean;
}): "light" | "dark" {
  return scheme === "dark" ? "light" : "dark";
}
