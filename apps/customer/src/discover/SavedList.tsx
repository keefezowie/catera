import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, Screen, Text, useColors } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { PackageCard } from "./PackageCard";
import { useSaved } from "./saved";
import { packageHref } from "../hrefs";
import { goToTab } from "../nav";

/** Disimpan: the packages the customer hearted, on the same card as Jelajah. */
export function SavedList() {
  const { actor, ready, t } = useMobile();
  const c = useColors();
  // The scrolling Screen, as when loaded: iOS insets its scroll view below the large title, so the spinner is never
  // drawn under the bar.
  if (!ready)
    return (
      <Screen>
        <ActivityIndicator color={c.forest} />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Disimpan", "Saved")} next="/disimpan" />;
  return <Saved key={actor.id} />;
}

function Saved() {
  const { t } = useMobile();
  const c = useColors();
  const saved = useSaved("/disimpan");
  return (
    <Screen>
      {saved.error ? (
        <Text selectable style={{ color: c.danger }}>
          {saved.error}
        </Text>
      ) : null}
      {saved.loading ? (
        <ActivityIndicator color={c.forest} />
      ) : saved.loadError && !saved.items.length ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: c.danger }}>
            {saved.loadError}
          </Text>
          <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void saved.reload()} />
        </View>
      ) : !saved.items.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">{t("Belum ada paket tersimpan.", "No saved packages yet.")}</Text>
          <Text style={{ color: c.muted }}>
            {t("Ketuk hati pada paket yang Anda suka.", "Tap the heart on a package you like.")}
          </Text>
          <Button label={t("Jelajah paket", "Browse packages")} onPress={() => goToTab("jelajah")} />
        </View>
      ) : (
        saved.items.map((item) =>
          item.offer ? (
            <PackageCard
              key={item.packageId}
              offer={item.offer}
              saved
              onOpen={() => router.push(packageHref(item.packageId, item.offer?.name ?? "") as never)}
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
