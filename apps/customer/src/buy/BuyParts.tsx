import type { ReactNode } from "react";
import { Linking, Text as RNText, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { currency, mealLabel, perMealPrice, priceUnitLabel, type DirectPaymentMethod, type Locale, type Offer, type PaymentAvailability } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { Button, Card, fontFor, FormError, ReadError, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { packageHref } from "../hrefs";
import { DecorativeIcon, GlyphCircle, SectionHeader, Thumb } from "../layout";
import { goToTab, leaveFor } from "../nav";
import { photoUri } from "../today/photoUri";
import { SUMMARY_PAD, THREE_LINE_PAD } from "./metrics";

type T = (id: string, en: string) => string;

/**
 * A failed read and "Coba lagi". A read whose failure stands in for the whole page (`art`: Beli's package, Bayar's
 * checkout) leads with the puzzled mascot, centred above the message (spec 7.2); one inside a loaded page (a price
 * that could not be worked out) stays the compact line.
 */
export function Retry({
  message,
  label,
  onRetry,
  t,
  art = false,
}: {
  message: string;
  label?: string;
  onRetry: () => void;
  t: T;
  art?: boolean;
}) {
  // The usual retry is the shared read error; a price that is worked out again says "Hitung ulang" under its message.
  if (!label) return <ReadError art={art} message={message} onRetry={onRetry} />;
  return (
    <View style={{ gap: 6 }}>
      <FormError message={message} />
      <Button variant="secondary" label={label} onPress={onRetry} />
    </View>
  );
}

/** A renewal checkout that is still payable: continue it rather than buying twice. */
export function PendingPayment({ checkoutId, t }: { checkoutId: string; t: T }) {
  return (
    <Card tone="attention" testID="buy-pending">
      <Text>{t("Perpanjangan ini masih menunggu pembayaran.", "This renewal is still waiting for payment.")}</Text>
      <Button
        label={t("Lanjutkan pembayaran", "Continue payment")}
        onPress={() => router.replace(`/bayar/${encodeURIComponent(checkoutId)}` as never)}
      />
    </Card>
  );
}

/** Renewing a package the caterer no longer sells: their other packages, then Jelajah. */
export function NoLongerSold({ caterer, offers, t }: { caterer: string; offers: Offer[]; t: T }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="heading">
        {t(
          `Paket sebelumnya sudah tidak tersedia. Pilih paket lain dari ${caterer}.`,
          `Your previous package is no longer available. Choose another package from ${caterer}.`,
        )}
      </Text>
      {offers.map((o) => (
        <Button
          key={o.id}
          variant="secondary"
          label={o.name}
          onPress={() => leaveFor(packageHref(o.id, o.name))}
        />
      ))}
      <Button label={t("Lihat paket lain", "See other packages")} onPress={() => goToTab("jelajah")} />
    </View>
  );
}

/** "Bayar dengan": QRIS first when offered, the other method one text button away. */
export function PayWith({
  availability,
  chosen,
  onChoose,
  t,
  section = false,
}: {
  availability: PaymentAvailability | null;
  chosen: DirectPaymentMethod | null;
  onChoose: (m: DirectPaymentMethod) => void;
  t: T;
  /** The heading is a `section` (Beli's layout) instead of the small label Bayar keeps. */
  section?: boolean;
}) {
  const styles = useStyles();
  const other = chosen === "QRIS" ? "VIRTUAL_ACCOUNT_BRI" : "QRIS";
  return (
    <View style={{ gap: section ? 0 : 8 }}>
      {section ? <SectionHeader title={t("Bayar dengan", "Pay with")} /> : <Text variant="label">{t("Bayar dengan", "Pay with")}</Text>}
      {!availability ? null : availability.mode !== "direct" ? (
        <Card style={styles.method}>
          <Text>{t("Pilih cara bayar di halaman berikutnya.", "Choose how to pay on the next page.")}</Text>
        </Card>
      ) : !chosen ? (
        <FormError message={t("Pembayaran belum tersedia. Coba lagi nanti.", "Payment isn't available yet. Try again later.")} />
      ) : (
        <>
          <Card style={styles.method}>
            <Text style={styles.strong}>{chosen === "QRIS" ? "QRIS" : t("Transfer bank BRI (VA)", "BRI bank transfer (VA)")}</Text>
            <Text variant="caption">
              {chosen === "QRIS"
                ? t("Pindai dari aplikasi bank atau e-wallet apa pun.", "Scan from any bank or e-wallet app.")
                : t("Bayar ke nomor virtual account BRI.", "Pay to a BRI virtual account number.")}
            </Text>
          </Card>
          {availability.availableMethods.includes(other) ? (
            <Button
              variant="text"
              style={{ alignSelf: "flex-start", marginTop: section ? nativeLayout.groupGap : 0 }}
              label={other === "QRIS" ? t("Pakai QRIS", "Use QRIS") : t("Pakai transfer bank (VA)", "Use bank transfer (VA)")}
              onPress={() => onChoose(other)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * The package being bought: its 64 photo, the name in `rowTitle`, the kitchen and meal, and the price per meal in `meta`
 * (a trial quotes the trial price). Words wrap rather than truncate, so a long name shows whole at large text.
 */
export function BuySummary({ offer, trial, apiBase, locale }: { offer: Offer; trial: boolean; apiBase: string; locale: Locale }) {
  const styles = useStyles();
  const unit = priceUnitLabel(offer, locale).unit;
  const price = trial && offer.trialPrice ? perMealPrice({ price: offer.trialPrice, meal: offer.meal }) : perMealPrice(offer);
  return (
    <View testID="buy-summary" style={styles.summary}>
      <Thumb uri={offer.image ? photoUri(offer.image, apiBase) : null} size={nativeLayout.thumb.md} testID="buy-summary-thumb" />
      <View style={styles.summaryText}>
        <Text variant="rowTitle">{offer.name}</Text>
        <Text variant="meta">{[offer.caterer, mealLabel(offer.meal, locale).toLowerCase()].join(" · ")}</Text>
        <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
          {`${currency(price, locale)} ${unit}`}
        </Text>
      </View>
    </View>
  );
}

/** The glyph a field row leads with, drawn on its 40 circle. */
export function FieldGlyph({ id, icon }: { id: string; icon: keyof typeof Ionicons.glyphMap }) {
  const c = useColors();
  return (
    <GlyphCircle testID={`buy-row-${id}-glyph`}>
      <DecorativeIcon name={icon} size={20} color={c.charcoal} />
    </GlyphCircle>
  );
}

/**
 * One row of the choices card: a 40 glyph circle, the text column (label in `meta` over the value in `bodyStrong`), and
 * a trailing action. 72 tall for a row of three lines (`THREE_LINE_PAD` keeps three lines inside 72), 56 for two. `below`
 * is a control that needs the card's full width (the length options). The row grows with large text.
 */
export function FieldRow({
  id,
  icon,
  minHeight,
  trailing,
  below,
  children,
}: {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  minHeight: 56 | 72;
  trailing?: ReactNode;
  below?: ReactNode;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View testID={`buy-row-${id}`} style={{ minHeight }}>
      <View style={[styles.field, { minHeight, paddingVertical: minHeight === nativeLayout.row.media ? THREE_LINE_PAD : nativeLayout.space.sm }]}>
        <FieldGlyph id={id} icon={icon} />
        <View style={styles.fieldText}>{children}</View>
        {trailing}
      </View>
      {below ? <View style={styles.below}>{below}</View> : null}
    </View>
  );
}

/** Paying is the agreement; the link opens the terms on the web origin. */
export function Terms({ apiBase, t }: { apiBase: string; t: T }) {
  const styles = useStyles();
  return (
    <Text variant="meta">
      {t("Dengan membayar, kamu setuju dengan ", "By paying, you agree to the ")}
      <RNText accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(`${apiBase}/syarat-dan-privasi#syarat`)}>
        {t("Ketentuan Catera", "Catera Terms")}
      </RNText>
      .
    </Text>
  );
}

const useStyles = themedStyles((c) => ({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    padding: SUMMARY_PAD,
    borderRadius: nativeLayout.radius.card,
    backgroundColor: c.surface,
  },
  summaryText: { flex: 1, minWidth: 0 },
  field: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md },
  fieldText: { flex: 1, minWidth: 0 },
  below: { paddingBottom: nativeLayout.space.md },
  strong: { fontFamily: fontFor("800"), color: c.charcoal },
  method: { borderColor: c.forest, borderWidth: 1.5, gap: 4 },
  link: { color: c.forest, fontFamily: fontFor("700"), textDecorationLine: "underline" }, // forest: action
}));
