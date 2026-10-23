import type { ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { currency, perMealPrice, priceUnitLabel, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  MoodHeader,
  PressableRow,
  ReadError,
  Screen,
  StateArt,
  Text,
  themedStyles,
  useColors,
  Photo,
} from "@catera/mobile-ui";
import { photoUri } from "./Plate";
import { packageHref } from "../hrefs";
import { goToTab } from "../nav";
import { OffersSkeleton } from "../skeletons";

/** The read of Beranda's suggested packages, as `useData` returns it. */
export type HomeCatalog = {
  data: { items: Offer[] } | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
};

/**
 * Beranda without an active package, on its own: the signed-out Beranda, which reads its packages itself. A signed-in
 * Beranda that turns out to have nothing running shows the same header and body in its own screen, with the packages
 * read alongside its first read (see `SignedInHome`), so it arrives in one fade.
 */
export function EmptyHome({ lead }: { lead?: ReactNode } = {}) {
  const { runtime } = useMobile();
  const catalog = useData("home:catalog", () => runtime.api.catalog("?limit=3"));
  return (
    <Screen header={<EmptyHomeHeader />}>
      <EmptyHomeBody lead={lead} catalog={catalog} />
    </Screen>
  );
}

/** The header of a Beranda with nothing running: the tab's name, no arc, nothing riding over it. */
export function EmptyHomeHeader() {
  const { t } = useMobile();
  return <MoodHeader testID="beranda-header" title={t("Beranda", "Home")} />;
}

/**
 * Beranda without an active package: food first, then how caterer links work. Its blocks are the screen body's
 * children (a fragment), so they keep the body's gap inside a `FadeSwap` that carries the same gap.
 * `lead` sits above the invitation: the "Paket selesai" recap of a plan that just ended.
 */
export function EmptyHomeBody({
  lead,
  leadShown,
  catalog,
}: {
  lead?: ReactNode;
  /** Whether `lead` is on the page (the recap reads its seen marks first): undefined while that is not known. */
  leadShown?: boolean;
  catalog: HomeCatalog;
}) {
  const { actor, t } = useMobile();
  const c = useColors();
  const offers: Offer[] = (catalog.data?.items ?? []).slice(0, 3);
  // The waving mascot says hello above the invitation (spec 7.2), but never under the recap's food photo. While the
  // recap reads its seen marks the art's box is held, so the invitation does not move down when the art lands.
  const held = !!lead && leadShown === undefined;
  const art = !lead || leadShown === false || held;
  const centred = art ? ({ textAlign: "center" } as const) : null;
  return (
    <>
      {lead}
      <View style={{ gap: 6, paddingTop: 8 }}>
        {art ? <StateArt pose="melambai" held={held} style={{ marginBottom: 10 }} /> : null}
        <Text variant="title" style={centred}>
          {t("Mau makan apa minggu ini?", "What would you like to eat this week?")}
        </Text>
        <Text style={[{ color: c.muted }, centred]}>
          {t(
            "Pilih paket katering rumahan, diantar sesuai jadwalmu.",
            "Pick a home-style catering package, delivered on your schedule.",
          )}
        </Text>
      </View>
      {/* The three packages fade in from their skeleton as one block. */}
      <FadeSwap swapKey={catalog.data ? "ready" : catalog.loading ? "loading" : "error"} style={{ gap: 16 }}>
        {catalog.loading && !catalog.data ? <OffersSkeleton /> : null}
        {catalog.error && !catalog.data ? (
          <ReadError message={catalog.error} onRetry={() => void catalog.reload()} />
        ) : null}
        {catalog.data && !offers.length ? (
          <Text style={{ color: c.muted }}>{t("Belum ada paket.", "No packages yet.")}</Text>
        ) : null}
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </FadeSwap>
      <Button label={t("Jelajah paket", "Browse packages")} onPress={() => goToTab("jelajah")} />
      <Text variant="caption">
        {t(
          "Dapat tautan dari katering? Buka tautannya untuk menyambungkan paketmu ke akun ini.",
          "Got a link from your caterer? Open it to connect your package to this account.",
        )}
      </Text>
      {!actor ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Sudah berlangganan?", "Already subscribed?")}</Text>
          <Button variant="secondary" label={t("Masuk", "Sign in")} onPress={() => router.push("/login" as never)} />
        </View>
      ) : null}
    </>
  );
}

const useStyles = themedStyles((c) => ({
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  photo: { height: 150, width: "100%", backgroundColor: c.sage },
}));

function OfferCard({ offer: o }: { offer: Offer }) {
  const { runtime, t, locale } = useMobile();
  const styles = useStyles();
  const { unit, note } = priceUnitLabel(o, locale);
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={`${o.name}, ${o.caterer}`}
      onPress={() => router.push(packageHref(o.id, o.name) as never)}
      style={styles.card}
    >
      {o.image ? (
        <Photo uri={photoUri(o.image, runtime.apiBase)} style={styles.photo} />
      ) : null}
      <View style={{ padding: 14, gap: 2 }}>
        <Text variant="heading">{o.name}</Text>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {o.caterer} · {currency(perMealPrice(o), locale)} {unit}
        </Text>
        {note ? <Text variant="caption">{note}</Text> : null}
      </View>
    </PressableRow>
  );
}
