import { View } from "react-native";
import { router } from "expo-router";
import { currency, dayLabel, jakartaDay, type Subscription } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, fontFor, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { SunriseButton } from "./Plate";

/** Shown at 3 or fewer days left; renewal stays an explicit purchase. */
export function RenewalCard({ subscription: s }: { subscription: Subscription }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const offer = s.snapshot.offer;
  return (
    <View style={styles.card}>
      <Text variant="caption" style={{ color: c.charcoal, fontFamily: fontFor("700") }}>
        {offer.name} · {offer.caterer}
      </Text>
      <Text variant="title" style={{ color: c.charcoal }}>
        {t(`Sisa ${s.remaining} hari`, s.remaining === 1 ? "1 day left" : `${s.remaining} days left`)}
      </Text>
      <Text style={{ fontVariant: ["tabular-nums"] }}>
        {t(
          `Paket ${offer.days} hari · harga terakhir ${currency(offer.price, locale)} per porsi per hari`,
          `${offer.days}-day package · last price ${currency(offer.price, locale)} per portion per day`,
        )}
      </Text>
      <SunriseButton
        label={t("Perpanjang", "Renew")}
        onPress={() => router.push(`/renew/${encodeURIComponent(s.id)}` as never)}
      />
    </View>
  );
}

/** A trial ending: invites the full package; it promises no price or availability. */
export function TrialCard({ subscription: s }: { subscription: Subscription }) {
  const { t } = useMobile();
  const name = s.snapshot.offer.name;
  const today = jakartaDay(new Date());
  // A trial whose last day has passed has no "last day" to announce; the invitation stands alone.
  const ended = s.ends_on < today;
  return (
    <Card tone="attention" style={{ gap: 10 }}>
      <Text variant="heading">{t(`Suka dengan ${name}?`, `Enjoying ${name}?`)}</Text>
      <Text>
        {ended
          ? t("Lanjutkan dengan paket penuh kapan saja.", "Continue with the full package any time.")
          : t(
              `Hari terakhir: ${dayLabel(s.ends_on, today, "id")}. Lanjutkan dengan paket penuh kapan saja.`,
              `Last day: ${dayLabel(s.ends_on, today, "en")}. Continue with the full package any time.`,
            )}
      </Text>
      <Button
        label={t("Lihat paket penuh", "See the full package")}
        onPress={() => router.push(`/paket/${encodeURIComponent(s.package_id)}` as never)}
      />
    </Card>
  );
}

const useStyles = themedStyles((c) => ({
  card: {
    backgroundColor: c.cream,
    borderWidth: 1.5,
    borderColor: c.sunrise,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
}));
