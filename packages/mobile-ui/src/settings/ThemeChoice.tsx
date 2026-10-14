import { Text as RNText, View } from "react-native";
import { nativeThemes, type ThemeName } from "@catera/design-tokens";
import { siangHeaderFill } from "../mood";
import { PressableScale } from "../motion";
import { useColors, type ThemePreference } from "../theme";
import { fonts } from "../type";

/**
 * The words for the three theme choices. The system choice is "Sistem" on iOS and "Ikuti sistem" on Android, each
 * platform's own wording for following the phone. `t` is the app's translator; `os` defaults to the running platform.
 */
export function themeChoiceLabels(
  t: (id: string, en: string) => string,
  os: string | undefined = process.env.EXPO_OS,
): Record<ThemePreference, string> {
  return {
    system: os === "ios" ? t("Sistem", "System") : t("Ikuti sistem", "Follow system"),
    light: t("Terang", "Light"),
    dark: t("Gelap", "Dark"),
  };
}

/** A small screen in one theme: the canvas, a Siang header strip and the cards on it, from the real tokens. */
function Miniature({ scheme, cards }: { scheme: ThemeName; cards: 1 | 2 }) {
  const theme = nativeThemes[scheme];
  const card = { height: 26, borderRadius: 6, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line };
  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas, paddingHorizontal: 7, paddingVertical: 9, gap: 5 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: siangHeaderFill(scheme) }} />
      <View style={card} />
      {cards === 2 ? <View style={card} /> : null}
    </View>
  );
}

const ORDER: ThemePreference[] = ["system", "light", "dark"];

/**
 * The Tampilan choice (canvas `SettingsSheet`): three thumbnails, Sistem split light and dark, Terang and Gelap, each a
 * `radio` in a `radiogroup` named `label`. The chosen one wears a 2dp `forest` ring and a forest label; the others a
 * 1dp `fieldBorder` edge. The thumbnails draw the real palettes, so they read the same in either theme. A press gives
 * the selection haptic and calls `onChange`, also for the one already chosen.
 */
export function ThemeChoice({
  value,
  onChange,
  labels,
  label,
}: {
  value: ThemePreference;
  onChange: (next: ThemePreference) => void;
  labels: Record<ThemePreference, string>;
  /** The group's spoken name ("Tampilan"). */
  label?: string;
}) {
  const palette = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", gap: 12 }}>
      {ORDER.map((option) => {
        const chosen = option === value;
        return (
          <PressableScale
            key={option}
            testID={`theme-choice-${option}`}
            accessibilityRole="radio"
            accessibilityLabel={labels[option]}
            accessibilityState={{ checked: chosen }}
            haptic="select"
            onPress={() => onChange(option)}
            style={{ flex: 1, alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: "100%",
                aspectRatio: 0.78,
                borderRadius: 16,
                borderCurve: "continuous",
                overflow: "hidden",
                flexDirection: "row",
                // The ring is drawn inside the frame; the padding keeps the miniature still when it changes width.
                borderWidth: chosen ? 2 : 1,
                padding: chosen ? 0 : 1,
                borderColor: chosen ? palette.forest : palette.fieldBorder,
              }}
            >
              {option === "system" ? (
                <>
                  <Miniature scheme="light" cards={1} />
                  <Miniature scheme="dark" cards={1} />
                </>
              ) : (
                <Miniature scheme={option} cards={2} />
              )}
            </View>
            <RNText
              style={{
                fontFamily: chosen ? fonts.semibold : fonts.medium,
                fontSize: 14,
                lineHeight: 20,
                color: chosen ? palette.forest : palette.muted, // forest: selection (the chosen theme)
                textAlign: "center",
              }}
            >
              {labels[option]}
            </RNText>
          </PressableScale>
        );
      })}
    </View>
  );
}
