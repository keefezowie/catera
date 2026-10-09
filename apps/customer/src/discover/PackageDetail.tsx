import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  compositionPreview,
  currency,
  mealLabel,
  menuSourceLabel,
  menuSummary,
  perMealPrice,
  priceUnitLabel,
  shortDate,
  startDates,
  type Offer,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, RoundButton, Screen, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { dayRange, ratingText } from "./format";
import { useSaved } from "./saved";

type Review = { id: string; customer: string; rating: number; body: string };

const leave = () => (router.canGoBack() ? router.back() : router.replace("/jelajah" as never));

/** Paket: one package in full, with the way into Pilih jadwal (or a one-day trial). */
export function PackageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const saved = useSaved(`/paket/${id}`);
  const loaded = useData<{ offer: Offer | null }>(`paket:${id}`, () => runtime.api.offer(id));
  const reviews = useData<Review[]>(`reviews:${id}`, () => runtime.api.request<Review[]>(`reviews/${id}`));
  const o = loaded.data?.offer;

  if (!o)
    return (
      <Screen>
        <RoundButton icon="chevron-back" label={t("Kembali", "Back")} onPress={leave} />
        {loaded.loading && !loaded.data ? (
          <ActivityIndicator color={c.forest} />
        ) : (
          <View style={{ gap: 10 }}>
            <Text variant="heading" selectable={!!loaded.error} style={{ color: loaded.error ? c.danger : c.forest }}>
              {loaded.error || t("Paket tidak ditemukan.", "Package not found.")}
            </Text>
            {loaded.error ? (
              <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void loaded.reload()} />
            ) : (
              <Button label={t("Jelajah paket", "Browse packages")} onPress={() => router.replace("/jelajah" as never)} />
            )}
          </View>
        )}
      </Screen>
    );

  const open = `/beli/${encodeURIComponent(o.id)}`;
  const windows = (o.meal === "both" ? [o.windows.lunch, o.windows.dinner] : [o.windows[o.meal]]).join(" · ");
  const isSaved = saved.isSaved(o.id);
  const shown = (reviews.data ?? []).slice(0, 3);
  const { note } = priceUnitLabel(o, locale);
  const earliest = startDates(o, new Date(), 1)[0];
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={{ flexShrink: 1 }}>
            <Text variant="caption">{t("Per sekali makan", "Per meal")}</Text>
            <Text
              variant="title"
              accessibilityRole="text"
              style={{ fontSize: 20, lineHeight: 26, fontVariant: ["tabular-nums"] }}
            >
              {currency(perMealPrice(o), locale)}
            </Text>
            {note ? <Text variant="caption">{note}</Text> : null}
          </View>
          <View style={styles.actions}>
            {o.trialPrice ? (
              <Button
                variant="secondary"
                label={t("Coba 1 hari", "Try 1 day")}
                onPress={() => router.push(`${open}?trial=1` as never)}
                style={styles.action}
              />
            ) : null}
            <Button
              label={t("Pilih jadwal", "Choose schedule")}
              onPress={() => router.push(open as never)}
              style={styles.action}
            />
          </View>
        </View>
      }
    >
      <View style={styles.hero}>
        {o.image ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(o.image, runtime.apiBase) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
        <RoundButton icon="chevron-back" label={t("Kembali", "Back")} onPress={leave} style={styles.back} />
        <RoundButton
          icon={isSaved ? "heart" : "heart-outline"}
          label={isSaved ? t(`Hapus ${o.name} dari simpanan`, `Remove ${o.name} from saved`) : t(`Simpan ${o.name}`, `Save ${o.name}`)}
          selected={isSaved}
          onPress={() => void saved.toggle(o.id)}
          style={styles.heart}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text variant="title" style={{ fontSize: 26, lineHeight: 32 }}>
          {o.name}
        </Text>
        <Text variant="caption" style={{ fontSize: 13, lineHeight: 18 }}>
          {`${[o.caterer, o.areas[0]].filter(Boolean).join(", ")}. ${ratingText(o, locale, t)}`}
        </Text>
        {saved.error ? (
          <Text selectable style={{ color: c.danger }}>
            {saved.error}
          </Text>
        ) : null}
      </View>
      {o.description ? <Text>{o.description}</Text> : null}

      <View style={{ gap: 10 }}>
        <Text variant="heading">{t("Isi paket", "What is included")}</Text>
        {o.menus.map((m) => (
          <View key={m.meal} style={styles.meal}>
            <Text variant="label">
              {mealLabel(m.meal, locale)} · {menuSourceLabel(m, locale)}
            </Text>
            {m.composition?.length ? <Text>{compositionPreview(m, o.packageType, locale)}</Text> : null}
            {menuSummary(m, locale) !== menuSourceLabel(m, locale) ? (
              <Text variant="caption" style={{ fontSize: 13, lineHeight: 18 }}>
                {menuSummary(m, locale)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.facts}>
        <Fact label={t("Diantar", "Delivered")} value={`${dayRange(o.weekdays, locale)}, ${windows}`} />
        <Fact
          label={t("Ubah hari", "Change a day")}
          value={t(
            `Sampai ${o.cutoff.slice(0, 5).replace(":", ".")}, sehari sebelumnya`,
            `Until ${o.cutoff.slice(0, 5)} the day before`,
          )}
        />
        <Fact label={t("Ongkir", "Delivery fee")} value={t("Pengantaran termasuk", "Delivery included")} />
        {earliest ? (
          <Fact label={t("Mulai paling cepat", "Earliest start")} value={shortDate(earliest, locale)} />
        ) : null}
      </View>

      {shown.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">{t("Ulasan", "Reviews")}</Text>
          {shown.map((r) => (
            <View key={r.id} style={styles.meal}>
              <Text variant="label">
                {r.customer} · {r.rating}/5
              </Text>
              {r.body ? <Text>{r.body}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <Text variant="label" style={styles.factLabel}>
        {label}
      </Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  hero: {
    height: 250,
    marginHorizontal: -20,
    marginTop: -16,
    backgroundColor: c.sage,
  },
  back: { position: "absolute", top: 12, left: 16 },
  heart: { position: "absolute", top: 12, right: 16 },
  meal: {
    gap: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  facts: { gap: 10, paddingVertical: 4 },
  fact: { flexDirection: "row", gap: 12 },
  factLabel: { width: "32%", minWidth: 100, flexShrink: 0 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  actions: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  action: { paddingHorizontal: 14 },
}));
