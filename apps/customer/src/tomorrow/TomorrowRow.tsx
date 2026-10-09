import { View } from "react-native";
import { router } from "expo-router";
import { shortDate, tomorrowStory, type CustomerState, type TomorrowStory } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { PhotoRing, Text } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { partId, useViewedParts } from "./viewed";

/**
 * Tomorrow's menu as a story row: one ring per delivery and meal, lunch in sunrise ink and dinner in forest, then
 * whether the day can still be changed. Before the change cutoff the rings show the dishes. After it each ring is a
 * closed lunchbox until its part has been opened once, so opening the story is the unveil. A ring is covered while the
 * seen marks are still being read, never the other way round.
 */
export function TomorrowRow({ story }: { story: TomorrowStory }) {
  const { runtime, t, locale } = useMobile();
  const { viewed } = useViewedParts(story.parts);
  const open = story.parts.find((p) => p.changeable);
  const meta = open
    ? open.until
      ? t(`Bisa diubah sampai ${open.until}`, `Can be changed until ${open.until}`)
      : t("Masih bisa diubah", "Can still be changed")
    : t("Sudah lewat batas ubah", "Change window closed");
  return (
    <View testID="tomorrow-row" style={{ gap: 8 }}>
      <View>
        <Text variant="label">{t("Menu besok", "Tomorrow's menu")}</Text>
        {/* The title already says tomorrow, so the date is the plain "Sabtu 10 Okt" (as in the story header). */}
        <Text variant="caption">{shortDate(story.date, locale)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {story.parts.map((part, i) => {
          const dinner = part.meal === "dinner";
          const meal = dinner ? t("makan malam", "dinner") : t("makan siang", "lunch");
          const dish = part.menuSet && part.title ? part.title : t("Menu belum diisi", "Menu not set");
          return (
            <PhotoRing
              key={partId(part)}
              uri={photoUri(part.image, runtime.apiBase)}
              size={60}
              ring={dinner ? "forest" : "sunrise"}
              covered={!part.changeable && !viewed.has(partId(part))}
              accessibilityLabel={`${t("Menu besok", "Tomorrow's menu")}, ${meal}, ${dish}`}
              onPress={() => router.push(`/tomorrow?part=${i}` as never)}
            />
          );
        })}
      </View>
      <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
        {meta}
      </Text>
    </View>
  );
}

/** The row for a customer state, or nothing when no delivery comes tomorrow. */
export function TomorrowEntry({ state, now }: { state: CustomerState; now: Date }) {
  const { locale } = useMobile();
  const story = tomorrowStory(state, now, locale);
  return story ? <TomorrowRow story={story} /> : null;
}
