import { View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { currency } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import {
  BARE_GLYPH_INSET,
  Button,
  Card,
  DecorativeIcon,
  FadeSwap,
  GlyphRow,
  HeaderIconButton,
  ListCard,
  MediaRow,
  MoodHeader,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useActionSheet,
  useColors,
} from "@catera/mobile-ui";
import { usePaymentsActive } from "../customers/usePayments";
import { packageHref } from "../hrefs";
import { PhotoThumb } from "../layout/PhotoThumb";
import { photoUri } from "../photo";
import { ReadError } from "../ReadError";

/** The board draws the first block 12 under the header row; the screen body starts 16 down, so the blocks lift by 4. */
const BODY_LIFT = -4;
/** A 48 button in a row pulls 12 into the card's side padding, so its glyph ends where the other rows' content does. */
const MORE_PULL = -12;

/** What the package list looks like while it loads: two 72 media rows, a 56 photo, two text lines and the 48 button's place. */
function PackagesSkeleton() {
  return (
    <ListCard>
      {[0, 1].map((i) => (
        <View
          key={i}
          testID={`usaha-skeleton-row-${i}`}
          style={{ height: nativeLayout.row.media, flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}
        >
          <Skeleton width={nativeLayout.thumb.sm} height={nativeLayout.thumb.sm} radius={nativeLayout.radius.thumb} />
          <View style={{ flex: 1 }}>
            {/* rowTitle's 22 line and meta's 18 line, centred as the loaded text is. */}
            <View style={{ height: 22, justifyContent: "center" }}>
              <Skeleton width={i % 2 ? "45%" : "60%"} height={12} radius={6} />
            </View>
            <View style={{ height: 18, justifyContent: "center" }}>
              <Skeleton width={i % 2 ? "60%" : "70%"} height={10} radius={5} />
            </View>
          </View>
          <View style={{ width: 36, alignItems: "center" }}>
            <Skeleton width={20} height={20} radius={10} />
          </View>
        </View>
      ))}
    </ListCard>
  );
}

/** Usaha: packages, money, importing customers, team and payments: the things set up once. Pengaturan comes last. */
export function UsahaScreen() {
  const { runtime, actor, t, locale } = useMobile();
  const c = useColors();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const payments = usePaymentsActive();
  const actions = useActionSheet();
  const offers = (ops.data?.offers ?? []).filter((o) => o.status !== "retired");
  /** "…" on a package: look at it, or copy it into a new package (a live package's terms cannot change). */
  async function packageActions(o: (typeof offers)[number], detail: string, image: string | undefined) {
    const key = await actions({
      title: t("Paket", "Package"),
      context: { image, title: o.name, lines: [detail] },
      items: [
        { key: "lihat", label: t("Lihat paket", "View package"), icon: "eye-outline" },
        { key: "salin", label: t("Salin jadi paket baru", "Copy into a new package"), icon: "copy-outline" },
      ],
      closeLabel: t("Tutup", "Close"),
    });
    if (key === "lihat") router.push(packageHref(o.id, o.name) as never);
    // Paket baru says "Paket disalin" once the copy is actually in its editor.
    else if (key === "salin") router.push(`/paket/baru?from=${o.id}` as never);
  }
  const name = ops.data?.caterer.name;
  const addLabel = t("+ Paket baru", "+ New package");
  const ios = process.env.EXPO_OS === "ios";
  // The gear is 44 on iOS and 48 on Android; pulled out by half the room round its glyph, it ends on the margin.
  const gear = (
    <View style={{ marginRight: ios ? -11 : -12, marginVertical: ios ? 0 : -2 }}>
      <HeaderIconButton
        icon="settings"
        label={t("Pengaturan", "Settings")}
        tint={c.charcoal}
        onPress={() => router.push("/pengaturan" as never)}
      />
    </View>
  );
  const kelola = [
    { icon: "wallet-outline", label: t("Uang", "Money"), href: "/uang" },
    { icon: "people-outline", label: t("Impor pelanggan", "Import customers"), href: "/impor" },
    { icon: "person-add-outline", label: t("Tim", "Team"), href: "/tim" },
    {
      icon: "card-outline",
      label: t("Pembayaran", "Payments"),
      href: "/aktifkan",
      status: payments ? t("Aktif", "On") : t("Belum aktif", "Not on yet"),
    },
    // Last: notifications, language, theme and Keluar live in Pengaturan, the same screen a helper opens.
    { icon: "settings-outline", label: t("Pengaturan", "Settings"), href: "/pengaturan" },
  ] as const;
  return (
    <Screen
      plainHeader
      header={
        // No mood band: the kitchen name and the gear share a 44 row on the canvas (spec 3.4); no line above the name.
        <MoodHeader
          plain
          testID="usaha-header"
          title={null}
          meta={
            <Text variant="heroTitle" accessibilityRole="header">
              {name || t("Usaha", "Business")}
            </Text>
          }
          trailing={gear}
        />
      }
    >
      {/* The payments card (when it applies), Paket and Kelola: three blocks 24 apart. */}
      <View testID="usaha-sections" style={{ gap: nativeLayout.dense.sectionGap, marginTop: BODY_LIFT }}>
        {payments === false ? (
          <View testID="usaha-payments">
            <Card tone="attention">
              <Text variant="section">{t("Terima pembayaran lewat Catera", "Take payments through Catera")}</Text>
              <Text>{t("Supaya pelanggan bisa memperpanjang lewat Catera.", "So customers can renew through Catera.")}</Text>
              <Button label={t("Aktifkan pembayaran", "Turn on payments")} onPress={() => router.push("/aktifkan" as never)} />
            </Card>
          </View>
        ) : null}
        <View testID="usaha-packages">
          <SectionHeader
            title={t("Paket", "Packages")}
            action={
              ops.data ? (
                // A 48 target in the heading's 26 line: it overhangs by 11 above and below, and ends on the margin.
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={addLabel}
                  haptic="none"
                  onPress={() => router.push("/paket/baru" as never)}
                  style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, marginRight: -8 }}
                >
                  <DecorativeIcon name="add" size={20} color={c.forest} />
                  {/* forest: action */}
                  <Text variant="bodyStrong" style={{ color: c.forest }}>
                    {addLabel.replace(/^\+\s*/, "")}
                  </Text>
                </PressableScale>
              ) : undefined
            }
          />
          {!ops.data && ops.error ? <ReadError message={ops.error} onRetry={() => void ops.reload()} /> : null}
          {/* The package rows enter from their skeleton as one block, under their heading. */}
          {ops.data || !ops.error ? (
            <FadeSwap swapKey={ops.data ? "packages" : "loading"}>
              {ops.data ? (
                offers.length ? (
                  // clip={false}: the package photo carries its own radius (`PhotoThumb`); inside a clipping card a late photo can stay blank on Android.
                  <ListCard clip={false}>
                    {offers.map((o) => {
                      // A draft with no price yet shows only its state: no stand-in for a value the read does not hold.
                      const state = o.status === "published" ? t("tayang", "live") : t("draf", "draft");
                      const detail = o.price === null ? state : `${currency(o.price, locale)} · ${state}`;
                      const meta = o.price === null ? state : `${currency(o.price, locale)} / ${t("makan", "meal")} · ${state}`;
                      const image = o.image ? photoUri(o.image, runtime.apiBase) : undefined;
                      return (
                        <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm }}>
                          {/* The row and its "…" are two buttons side by side, so a screen reader finds both. */}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <MediaRow
                              testID={`usaha-package-${o.id}`}
                              leading={<PhotoThumb testID={`usaha-package-${o.id}-thumb`} uri={image} size={nativeLayout.thumb.sm} />}
                              // A package name is identity: it wraps rather than ending in an ellipsis at 360.
                              wrap="title"
                              title={o.name}
                              meta={meta}
                              accessibilityLabel={o.name}
                              onPress={() => router.push(packageHref(o.id, o.name) as never)}
                            />
                          </View>
                          <PressableScale
                            accessibilityRole="button"
                            accessibilityLabel={`${t("Lihat atau salin", "View or copy")}: ${o.name}`}
                            haptic="tap"
                            onPress={() => void packageActions(o, detail, image)}
                            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: MORE_PULL }}
                          >
                            <DecorativeIcon name="ellipsis-horizontal" size={20} color={c.charcoal} />
                          </PressableScale>
                        </View>
                      );
                    })}
                  </ListCard>
                ) : (
                  <Text variant="meta">{t("Belum ada paket.", "No packages yet.")}</Text>
                )
              ) : (
                <SkeletonGroup label={t("Memuat paket", "Loading packages")}>
                  <PackagesSkeleton />
                </SkeletonGroup>
              )}
            </FadeSwap>
          ) : null}
        </View>
        <View>
          <SectionHeader title={t("Kelola", "Manage")} />
          <View testID="usaha-kelola">
            <ListCard inset={BARE_GLYPH_INSET}>
              {kelola.map((row) => (
                <GlyphRow
                  key={row.href}
                  bare
                  minHeight={48}
                  glyph={<Ionicons name={row.icon} size={20} color={c.muted} />}
                  title={row.label}
                  onPress={() => router.push(row.href as never)}
                  trailing={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm }}>
                      {"status" in row ? <Text variant="meta">{row.status}</Text> : null}
                      <DecorativeIcon name="chevron-forward" size={20} color={c.muted} />
                    </View>
                  }
                />
              ))}
            </ListCard>
          </View>
        </View>
      </View>
    </Screen>
  );
}
