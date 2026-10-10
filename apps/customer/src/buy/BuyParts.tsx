import type { ReactNode } from "react";
import { Linking, Text as RNText, View } from "react-native";
import { router } from "expo-router";
import type { DirectPaymentMethod, Offer, PaymentAvailability } from "@catera/domain";
import { Button, Card, FONT, fontFor, PressableScale, Sheet, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { goToTab, leaveFor } from "../nav";

type T = (id: string, en: string) => string;

export function Retry({ message, label, onRetry, t }: { message: string; label?: string; onRetry: () => void; t: T }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: c.danger }}>
        {message}
      </Text>
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
          onPress={() => leaveFor(`/paket/${encodeURIComponent(o.id)}`)}
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
  const c = useColors();
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
        <Text selectable style={{ color: c.danger }}>
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
  const styles = useStyles();
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
  const c = useColors();
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      {items.map((item) => (
        <PressableScale
          key={item.id}
          haptic="select"
          accessibilityRole="radio"
          accessibilityState={{ checked: item.id === selected }}
          onPress={() => {
            onPick(item.id);
            onClose();
          }}
          style={[styles.row, item.id === selected && { borderColor: c.forest }]}
        >
          <Text variant="label">{item.label}</Text>
          {item.detail ? <Text variant="caption">{item.detail}</Text> : null}
        </PressableScale>
      ))}
      {children}
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  strong: { fontFamily: fontFor("800"), color: c.forest },
  method: { borderColor: c.forest, borderWidth: 1.5, gap: 4 },
  terms: { fontFamily: FONT, fontSize: 12, color: c.muted, lineHeight: 17 },
  link: { color: c.forest, fontFamily: fontFor("700"), textDecorationLine: "underline" },
  row: {
    minHeight: 48,
    padding: 12,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    gap: 2,
  },
}));
