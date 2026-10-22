import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { addDays, planLabel, type Subscription } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PressableRow, Text, themedStyles, useScreenMargin } from "@catera/mobile-ui";
import { planHref } from "../hrefs";
import { ListCard, MediaRow, SectionHeader } from "../layout";
import { photoUri } from "./photoUri";
import { SECTION_LEAD } from "./sectionGap";

/** A rail card's width: two and a bit fit a phone, so the next one peeks and says there are more. */
export const PLAN_CARD_WIDTH = 168;

type Translate = (id: string, en: string) => string;

/** "selesai besok", "selesai hari ini", else "sisa 6 hari": when a running plan ends. */
function endLine(s: Subscription, today: string, t: Translate): string {
  if (s.ends_on === today) return t("selesai hari ini", "ends today");
  if (s.ends_on === addDays(today, 1)) return t("selesai besok", "ends tomorrow");
  return t(`sisa ${s.remaining} hari`, `${s.remaining} ${s.remaining === 1 ? "day" : "days"} left`);
}

/**
 * "Paket kamu" (spec 3.1 item 6), the last block of Beranda: every running plan, the one ending first leading.
 * One or two plans are one card of 72 rows (the plan's photo, its name, "caterer · sisa n hari", a chevron). Three or
 * more are "n paket aktif" with "Lihat semua" (Paket saya) over a rail of 168 wide cards, so a customer with eight plans
 * still scrolls past a screen, not eight rows. A row or card opens its plan. Hidden with no running plan.
 */
export function PlansRow({
  subscriptions,
  today,
  apiBase,
}: {
  /** The customer's plans; the running ones are listed. */
  subscriptions: Subscription[];
  today: string;
  apiBase: string;
}) {
  const { t, locale } = useMobile();
  const styles = useStyles();
  const margin = useScreenMargin();
  const active = subscriptions
    .filter((s) => s.status === "active")
    .sort(
      (a, b) =>
        a.ends_on.localeCompare(b.ends_on) ||
        (a.snapshot?.offer?.name ?? "").localeCompare(b.snapshot?.offer?.name ?? "", locale),
    );
  if (!active.length) return null;
  const open = (s: Subscription) => router.push(planHref(s.id, s.snapshot.offer.name) as never);
  const label = (s: Subscription) => planLabel(s, subscriptions, locale);
  const line = (s: Subscription) => `${s.snapshot.offer.caterer} · ${endLine(s, today, t)}`;

  if (active.length < 3)
    return (
      <View testID="plans" style={styles.section}>
        <SectionHeader title={t("Paket kamu", "Your plans")} />
        <ListCard>
          {active.map((s) => (
            <MediaRow
              key={s.id}
              testID={`plan-row-${s.id}`}
              image={s.snapshot.offer.image ? photoUri(s.snapshot.offer.image, apiBase) : null}
              title={label(s)}
              meta={line(s)}
              trailing="chevron"
              wrap
              onPress={() => open(s)}
            />
          ))}
        </ListCard>
      </View>
    );

  const count = active.length;
  return (
    <View testID="plans" style={styles.section}>
      <SectionHeader
        title={t(`${count} paket aktif`, `${count} active plans`)}
        action={{ label: t("Lihat semua", "See all"), onPress: () => router.push("/paket-saya" as never) }}
      />
      {/* The rail runs to the screen's edges and starts at its margin. */}
      <ScrollView
        testID="plans-rail"
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -margin }}
        contentContainerStyle={{ paddingHorizontal: margin, gap: nativeLayout.groupGap }}
      >
        {active.map((s) => {
          const id = `plan-card-${s.id}`;
          const image = s.snapshot.offer.image;
          return (
            <PressableRow
              key={s.id}
              testID={id}
              accessibilityRole="button"
              accessibilityLabel={`${label(s)}, ${line(s)}`}
              onPress={() => open(s)}
              style={styles.card}
            >
              <View testID={`${id}-photo`} style={styles.photo}>
                {image ? (
                  <Image source={{ uri: photoUri(image, apiBase) }} contentFit="cover" style={styles.fill} accessible={false} />
                ) : null}
              </View>
              <View style={styles.text}>
                <Text variant="bodyStrong">{label(s)}</Text>
                <Text variant="meta" numberOfLines={2}>
                  {line(s)}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  section: { marginTop: SECTION_LEAD },
  card: { width: PLAN_CARD_WIDTH, gap: nativeLayout.space.sm },
  photo: {
    aspectRatio: nativeLayout.ratio.card,
    borderRadius: nativeLayout.radius.control,
    overflow: "hidden",
    backgroundColor: c.sage,
  },
  fill: { width: "100%", height: "100%" },
  text: { minWidth: 0 },
}));
