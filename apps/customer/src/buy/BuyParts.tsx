import type { ReactNode } from "react";
import { Linking, Pressable, Text as RNText, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { DirectPaymentMethod, Offer, PaymentAvailability } from "@catera/domain";
import { Button, Card, colors, FONT, fontFor, Sheet, Text } from "@catera/mobile-ui";

type T = (id: string, en: string) => string;

export function Retry({ message, label, onRetry, t }: { message: string; label?: string; onRetry: () => void; t: T }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.danger }}>{message}</Text>
      <Button variant="secondary" label={label ?? t("Coba lagi", "Try again")} onPress={onRetry} />
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
          onPress={() => router.push(`/paket/${encodeURIComponent(o.id)}` as never)}
        />
      ))}
      <Button label={t("Lihat paket lain", "See other packages")} onPress={() => router.push("/jelajah" as never)} />
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
  const other = chosen === "QRIS" ? "VIRTUAL_ACCOUNT_BRI" : "QRIS";
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{t("Bayar dengan", "Pay with")}</Text>
      {!availability ? null : availability.mode !== "direct" ? (
        <Card style={styles.method}>
          <Text style={styles.strong}>{t("Halaman pembayaran aman", "Secure payment page")}</Text>
          <Text variant="caption">{t("Pilih cara bayar di halaman berikutnya.", "Choose how to pay on the next page.")}</Text>
        </Card>
      ) : !chosen ? (
        <Text style={{ color: colors.danger }}>
          {t("Pembayaran belum tersedia. Coba lagi nanti.", "Payment isn't available yet. Try again later.")}
        </Text>
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
  return (
    <RNText style={styles.terms}>
      {t("Dengan membayar, Anda setuju dengan ", "By paying, you agree to the ")}
      <RNText accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(`${apiBase}/terms`)}>
        {t("Ketentuan Catera", "Catera Terms")}
      </RNText>
      .
    </RNText>
  );
}

/** A sheet of 48pt radio rows (addresses, start dates). */
export function ChoiceSheet({
  visible,
  title,
  items,
  selected,
  onPick,
  onClose,
  closeLabel,
  children,
}: {
  visible: boolean;
  title: string;
  /** Translated accessibility label for the sheet's scrim ("Tutup" / "Close"). */
  closeLabel: string;
  items: { id: string; label: string; detail?: string }[];
  selected: string | null | undefined;
  onPick: (id: string) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: item.id === selected }}
          onPress={() => {
            onPick(item.id);
            onClose();
          }}
          style={[styles.row, item.id === selected && { borderColor: colors.forest }]}
        >
          <Text variant="label">{item.label}</Text>
          {item.detail ? <Text variant="caption">{item.detail}</Text> : null}
        </Pressable>
      ))}
      {children}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fontFor("800"), color: colors.forest },
  method: { borderColor: colors.forest, borderWidth: 1.5, gap: 4 },
  terms: { fontFamily: FONT, fontSize: 12, color: colors.muted, lineHeight: 17 },
  link: { color: colors.forest, fontFamily: fontFor("700"), textDecorationLine: "underline" },
  row: {
    minHeight: 48,
    padding: 12,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
});
