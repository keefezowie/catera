import { useState } from "react";
import { Linking, View } from "react-native";
import { listAccountRequests, requestAccountDeletion, useData, useMobile } from "@catera/mobile-core";
import { Button, fontFor, FormError, SheetFitBody, SheetHeader, sheetSidePadding, Text, useBusy } from "@catera/mobile-ui";
import { accountMessage } from "./accountMessages";

/**
 * Hapus akun, a sheet: a request to the Catera team, not an instant deletion (`accountRequest.create` kind `deletion`).
 * It says what happens to the customers and deliveries still running and promises no timing. An open request is shown
 * as it stands instead of a second button. The privacy section of the terms page follows.
 */
export function HapusAkun() {
  const { runtime, actor, t, locale, command } = useMobile();
  const inset = sheetSidePadding();
  const requests = useData(`account-requests:${actor?.id ?? ""}`, () => listAccountRequests(runtime.api));
  const open = (requests.data ?? []).find((r) => r.kind === "deletion" && r.status === "open");
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  const [busy, send] = useBusy(async () => {
    setFailure(null);
    try {
      await requestAccountDeletion(command, "Permintaan hapus akun dari aplikasi Catera Dapur.");
      setSent(true);
      await requests.reload();
    } catch (e) {
      setFailure((f) => ({
        message: accountMessage(e, t, locale, t("Permintaan belum terkirim. Coba lagi.", "The request was not sent. Try again.")),
        key: (f?.key ?? 0) + 1,
      }));
    }
  });
  const asked = sent || !!open;
  return (
    <SheetFitBody testID="hapus-akun-sheet" header={<SheetHeader title={t("Hapus akun", "Delete account")} closeLabel={t("Tutup", "Close")} />}>
      <View testID="hapus-akun-content" style={{ paddingHorizontal: inset, gap: 16 }}>
        <Text>
          {t(
            "Tim Catera memproses permintaan ini. Pelanggan dan pengantaran yang masih berjalan diselesaikan dulu bersama tim. Kami hubungi kamu soal sisanya sebelum akun dihapus.",
            "The Catera team handles this request. Customers and deliveries still running are settled with the team first. We contact you about the rest before the account is deleted.",
          )}
        </Text>
        <Button
          variant="text"
          label={t("Baca kebijakan privasi", "Read the privacy policy")}
          onPress={() => void Linking.openURL(`${runtime.apiBase}/syarat-dan-privasi#privasi`)}
        />
        {asked ? (
          <Text testID="deletion-status" selectable style={{ fontFamily: fontFor("700") }}>
            {t("Permintaan hapus akunmu sudah masuk dan menunggu Tim Catera.", "Your request to delete the account was received and is waiting for the Catera team.")}
          </Text>
        ) : (
          <>
            {failure ? <FormError message={failure.message} failureKey={failure.key} retry={() => void send()} /> : null}
            <Button label={t("Kirim permintaan hapus akun", "Send request to delete account")} busy={busy} onPress={() => void send()} />
          </>
        )}
      </View>
    </SheetFitBody>
  );
}
