import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { nativeMood, type Mood, type MoodPalette, type ThemeName } from "@catera/design-tokens";
import { useThemePreference } from "./theme";

/** The two toggle labels. This package has no i18n, so the app hands over translated ones through `MoodLabelsProvider`. */
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

type MoodValue = { mood: Mood; setMood: (mood: Mood) => void };

// Without a provider (isolated component tests, early boot) the app reads Siang and cannot change it.
const MoodContext = createContext<MoodValue>({ mood: "siang", setMood: () => {} });

/** One per app. The mood lives in memory only; every launch starts from the clock. */
export function MoodProvider({
  children,
  now,
}: {
  children: ReactNode;
  /** The clock, for tests. */
  now?: () => Date;
}) {
  const [mood, setMood] = useState<Mood>(() => defaultMood((now ?? (() => new Date()))()));
  const value = useMemo<MoodValue>(() => ({ mood, setMood }), [mood]);
  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

const MoodLabelsContext = createContext<MoodLabels>(DEFAULT_LABELS);

/**
 * Hands the toggle its translated labels. It sits apart from `MoodProvider` because the translator only exists below
 * the app's own providers, while the mood itself lives above them.
 */
export function MoodLabelsProvider({ labels, children }: { labels: MoodLabels; children: ReactNode }) {
  const { siang, malam } = labels;
  const value = useMemo<MoodLabels>(() => ({ siang, malam }), [siang, malam]);
  return <MoodLabelsContext.Provider value={value}>{children}</MoodLabelsContext.Provider>;
}

export function useMood(): { mood: Mood; setMood: (mood: Mood) => void } {
  const { mood, setMood } = use(MoodContext);
  return { mood, setMood };
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
 * The status-bar icon style: light icons on a dark surface. That is the dark theme, or a Malam header; the demo strip
 * sits above the header in the theme's own sage fill, so with it shown the header does not decide.
 */
export function statusBarStyle({ scheme, mood, demo }: { scheme: ThemeName; mood: Mood; demo: boolean }): "light" | "dark" {
  return scheme === "dark" || (mood === "malam" && !demo) ? "light" : "dark";
}
