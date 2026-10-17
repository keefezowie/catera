import { Linking, Text as RNText, View } from "react-native";
import { router } from "expo-router";
import type { DirectPaymentMethod, Offer, PaymentAvailability } from "@catera/domain";
import { Button, Card, FONT, fontFor, FormError, ReadError, Text, themedStyles } from "@catera/mobile-ui";
import { packageHref } from "../hrefs";
import { goToTab, leaveFor } from "../nav";

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
    <Card tone="attention">
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
}: {
  availability: PaymentAvailability | null;
  chosen: DirectPaymentMethod | null;
  onChoose: (m: DirectPaymentMethod) => void;
  t: T;
}) {
  const styles = useStyles();
  const other = chosen === "QRIS" ? "VIRTUAL_ACCOUNT_BRI" : "QRIS";
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{t("Bayar dengan", "Pay with")}</Text>
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
              style={{ alignSelf: "flex-start" }}
              label={other === "QRIS" ? t("Pakai QRIS", "Use QRIS") : t("Pakai transfer bank (VA)", "Use bank transfer (VA)")}
              onPress={() => onChoose(other)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

/** Paying is the agreement; the link opens the terms on the web origin. */
export function Terms({ apiBase, t }: { apiBase: string; t: T }) {
  const styles = useStyles();
  return (
    <RNText style={styles.terms}>
      {t("Dengan membayar, Anda setuju dengan ", "By paying, you agree to the ")}
      <RNText accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(`${apiBase}/syarat-dan-privasi#syarat`)}>
        {t("Ketentuan Catera", "Catera Terms")}
      </RNText>
      .
    </RNText>
  );
}

const useStyles = themedStyles((c) => ({
  strong: { fontFamily: fontFor("800"), color: c.charcoal },
  method: { borderColor: c.forest, borderWidth: 1.5, gap: 4 },
  terms: { fontFamily: FONT, fontSize: 12, color: c.muted, lineHeight: 17 },
  link: { color: c.forest, fontFamily: fontFor("700"), textDecorationLine: "underline" }, // forest: action
}));
