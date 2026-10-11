import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, FadeSwap, Screen, Text, useBlockEnter, useColors, useListMotion } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { PackageCard } from "./PackageCard";
import { useSaved } from "./saved";
import { packageHref } from "../hrefs";
import { goToTab } from "../nav";
import { SavedSkeleton } from "../skeletons";

/** Disimpan: the packages the customer hearted, on the same card as Jelajah. */
export function SavedList() {
  const { actor, ready, t } = useMobile();
  // The scrolling Screen, as when loaded: iOS insets its scroll view below the large title, so the skeleton is never
  // drawn under the bar.
  if (!ready)
    return (
      <Screen>
        <SavedSkeleton />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Disimpan", "Saved")} next="/disimpan" />;
  return <Saved key={actor.id} />;
}

function Saved() {
  const { t } = useMobile();
  const c = useColors();
  const saved = useSaved("/disimpan");
  // A removal leaves and the rest close up; Urungkan brings the row back as one the customer inserted. The list's
  // first load enters as one block (Decision A), and so does each page "Lihat lebih banyak" loads: its rows are
  // taken without an entrance of their own, and the page fades in as one block below the rows already shown.
  const pagesDrawn = useRef(saved.pages.length);
  const pageArrived = saved.pages.length > pagesDrawn.current;
  useEffect(() => {
    pagesDrawn.current = saved.pages.length;
  });
  const rowMotion = useListMotion(saved.loading ? null : saved.items.map((i) => i.packageId), pageArrived);
  const pageEnter = useBlockEnter();
  const row = (item: (typeof saved.items)[number]) => (
    <Animated.View key={item.packageId} testID="saved-row" {...rowMotion(item.packageId)}>
      {item.offer ? (
        <PackageCard
          offer={item.offer}
          saved
          canSave={saved.signedIn}
          onOpen={() => router.push(packageHref(item.packageId, item.offer?.name ?? "") as never)}
          onToggleSaved={() => void saved.toggle(item.packageId)}
        />
      ) : (
        <Card tone="sage">
          <Text variant="heading">{item.summary.name}</Text>
          <Text variant="caption">{t("Paket ini tidak tersedia lagi.", "This package is no longer available.")}</Text>
          <Button
            variant="text"
            label={t("Hapus dari simpanan", "Remove from saved")}
            accessibilityLabel={t(`Hapus ${item.summary.name} dari simpanan`, `Remove ${item.summary.name} from saved`)}
            onPress={() => void saved.toggle(item.packageId)}
          />
        </Card>
      )}
    </Animated.View>
  );
  return (
    <Screen>
      {saved.error ? (
        <Text selectable style={{ color: c.danger }}>
          {saved.error}
        </Text>
      ) : null}
      {/* The list enters from its skeleton as one block. */}
      <FadeSwap swapKey={saved.loading ? "loading" : "ready"} style={{ gap: 16 }}>
        {saved.loading ? (
          <SavedSkeleton />
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
          saved.pages.map((page, n) =>
            page.length ? (
              <Animated.View key={n} testID="saved-page" entering={n ? pageEnter : undefined} style={{ gap: 16 }}>
                {page.map(row)}
              </Animated.View>
            ) : null,
          )
        )}
      </FadeSwap>
      {saved.hasMore ? (
        <Button variant="secondary" label={t("Lihat lebih banyak", "Show more")} onPress={() => void saved.loadMore()} />
      ) : null}
    </Screen>
  );
}
