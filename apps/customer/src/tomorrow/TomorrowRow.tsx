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
 * closed lunchbox until its part has been opened once, so opening the story is the unveil. "After it" means the
 * cutoff has passed (`closed`), not that the plan lets days move. A ring is covered while the seen marks are still being
 * read, never the other way round.
 */
export function TomorrowRow({ story }: { story: TomorrowStory }) {
  const { runtime, t, locale } = useMobile();
  const { viewed } = useViewedParts(story.parts);
  // A plan whose days cannot move says nothing about a deadline until the day closes.
  const open = story.parts.find((p) => p.changeable);
  const meta = open
    ? open.until
      ? t(`Bisa diubah sampai ${open.until}`, `Can be changed until ${open.until}`)
      : t("Masih bisa diubah", "Can still be changed")
    : story.parts.every((p) => p.closed)
      ? t("Sudah lewat batas ubah", "Change window closed")
      : null;
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
          const covered = part.closed && !viewed.has(partId(part));
          // A covered ring keeps the dish a surprise for a screen reader too.
          const what = covered
            ? t("tertutup, buka untuk melihat", "covered, open to see")
            : part.menuSet && part.title
              ? part.title
              : t("Menu belum diisi", "Menu not set");
          return (
            <PhotoRing
              key={partId(part)}
              uri={photoUri(part.image, runtime.apiBase)}
              size={60}
              ring={dinner ? "forest" : "sunrise"}
              covered={covered}
              accessibilityLabel={`${t("Menu besok", "Tomorrow's menu")}, ${meal}, ${what}`}
              onPress={() => router.push(`/tomorrow?part=${i}` as never)}
            />
          );
        })}
      </View>
      {meta ? (
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

/** The row for a customer state, or nothing when no delivery comes tomorrow. */
export function TomorrowEntry({ state, now }: { state: CustomerState; now: Date }) {
  const { locale } = useMobile();
  const story = tomorrowStory(state, now, locale);
  return story ? <TomorrowRow story={story} /> : null;
}
