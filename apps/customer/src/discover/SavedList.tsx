import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Text } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { PackageCard } from "./PackageCard";
import { useSaved } from "./saved";

/** Disimpan: the packages the customer hearted, on the same card as Jelajah. */
export function SavedList() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={colors.forest} />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Disimpan", "Saved")} next="/disimpan" />;
  return <Saved key={actor.id} />;
}

function Saved() {
  const { t } = useMobile();
  const saved = useSaved("/disimpan");
  return (
    <Screen>
      <Text variant="title">{t("Disimpan", "Saved")}</Text>
      {saved.error ? <Text style={{ color: colors.danger }}>{saved.error}</Text> : null}
      {saved.loading ? (
        <ActivityIndicator color={colors.forest} />
      ) : saved.loadError && !saved.items.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.danger }}>{saved.loadError}</Text>
          <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void saved.reload()} />
        </View>
      ) : !saved.items.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">{t("Belum ada paket tersimpan.", "No saved packages yet.")}</Text>
          <Text style={{ color: colors.muted }}>
            {t("Ketuk hati pada paket yang Anda suka.", "Tap the heart on a package you like.")}
          </Text>
          <Button label={t("Jelajah paket", "Browse packages")} onPress={() => router.push("/jelajah" as never)} />
        </View>
      ) : (
        saved.items.map((item) =>
          item.offer ? (
            <PackageCard
              key={item.packageId}
              offer={item.offer}
              saved
              onOpen={() => router.push(`/paket/${encodeURIComponent(item.packageId)}` as never)}
              onToggleSaved={() => void saved.toggle(item.packageId)}
            />
          ) : (
            <Card key={item.packageId} tone="sage">
              <Text variant="heading">{item.summary.name}</Text>
              <Text variant="caption">{t("Paket ini tidak tersedia lagi.", "This package is no longer available.")}</Text>
              <Button
                variant="text"
                label={t("Hapus dari simpanan", "Remove from saved")}
                accessibilityLabel={t(`Hapus ${item.summary.name} dari simpanan`, `Remove ${item.summary.name} from saved`)}
                onPress={() => void saved.toggle(item.packageId)}
              />
            </Card>
          ),
        )
      )}
      {saved.hasMore ? (
        <Button variant="secondary" label={t("Lihat lebih banyak", "Show more")} onPress={() => void saved.loadMore()} />
      ) : null}
    </Screen>
  );
}
