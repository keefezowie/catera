import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { planLabel } from "@catera/domain";
import { requestAccountDeletion, useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  FormError,
  ReadError,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useToast,
} from "@catera/mobile-ui";
import { accountMessage } from "./accountMessages";
import { useAction } from "./useAction";

function Frame({ swapKey, children, footer }: { swapKey: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={t("Hapus akun", "Delete account")} closeLabel={t("Tutup", "Close")} />
      <SheetBody footer={footer}>
        <FadeSwap swapKey={swapKey} style={{ gap: 14 }}>
          {children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

/**
 * `/hapus-akun`: the request to delete the account, as a form sheet over Data akun. It sends a request to the Catera team
 * (`accountRequest.create`, kind deletion) and does not delete anything by itself. A person with plans still running can
 * send it too: one callout counts those plans and lists what the request means, without promising a time. The send
 * button is the danger variant.
 */
export function HapusAkunRoute() {
  const { actor, ready, t } = useMobile();
  if (!ready || !actor)
    return (
      <Frame swapKey={ready ? "signin" : "loading"}>
        {ready ? (
          <SignInPrompt />
        ) : (
          <SkeletonGroup label={t("Memuat", "Loading")}>
            <View style={{ gap: 12 }}>
              <Skeleton height={18} />
              <Skeleton width="70%" height={18} />
              <Skeleton height={48} radius={10} />
            </View>
          </SkeletonGroup>
        )}
      </Frame>
    );
  return <HapusAkun key={actor.id} />;
}

function SignInPrompt() {
  const { t } = useMobile();
  return (
    <Button
      label={t("Masuk", "Sign in")}
      onPress={() => router.push({ pathname: "/login", params: { next: "/data-akun" } } as never)}
    />
  );
}

function HapusAkun() {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const customer = useData("hapus-akun:customer", () => runtime.api.customer());
  const action = useAction(accountMessage);
  const toast = useToast();
  const [result, setResult] = useState<{ existing: boolean } | null>(null);

  const all = customer.data?.subscriptions ?? [];
  const running = all.filter((s) => s.status === "active").map((s) => planLabel(s, all, locale));

  if (!customer.data)
    return (
      <Frame swapKey={customer.error ? "error" : "loading"}>
        {customer.error ? (
          <ReadError message={customer.error} onRetry={() => void customer.reload()} />
        ) : (
          <SkeletonGroup label={t("Memuat paketmu", "Loading your plans")}>
            <View style={{ gap: 12 }}>
              <Skeleton height={18} />
              <Skeleton width="70%" height={18} />
              <Skeleton height={48} radius={10} />
            </View>
          </SkeletonGroup>
        )}
      </Frame>
    );

  const send = () =>
    action.run(async () => {
      const body = `Permintaan hapus akun dari aplikasi pelanggan.${running.length ? ` Paket berjalan: ${running.join(", ")}.` : ""}`;
      const made = await requestAccountDeletion(command, body);
      setResult({ existing: !!made.existing });
    });

  // One callout for any number of running plans: the count, then what the request means for them. The plan names go
  // to the team in the request, not onto the sheet.
  const plans = running.length ? (
    <View testID="hapus-akun-plans" style={{ backgroundColor: c.fill, borderRadius: 16, borderCurve: "continuous", padding: 16, gap: 8 }}>
      <Text variant="bodyStrong">{t(`${running.length} paket masih berjalan`, `${running.length} plans still running`)}</Text>
      {[
        t("Pengantaran yang belum lewat dibatalkan.", "Deliveries that have not passed yet are cancelled."),
        t("Riwayat dan alamat dihapus.", "Your history and addresses are deleted."),
        t(
          "Paket yang masih berjalan diselesaikan dulu oleh tim Catera. Kami hubungi kamu soal sisa harinya sebelum akun dihapus.",
          "The Catera team settles plans that are still running first. We will contact you about the days left before the account is deleted.",
        ),
      ].map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: 8 }}>
          <Text aria-hidden>{"•"}</Text>
          <Text testID="hapus-akun-consequence" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

  const privacy = (
    <Button
      variant="text"
      label={t("Baca kebijakan privasi", "Read the privacy policy")}
      onPress={() =>
        void WebBrowser.openBrowserAsync(`${runtime.apiBase}/syarat-dan-privasi#privasi`).catch(() =>
          toast.show({ message: t("Halaman belum bisa dibuka. Coba lagi.", "Couldn't open the page. Try again."), tone: "error" }),
        )
      }
    />
  );

  if (result)
    return (
      <Frame swapKey="sent" footer={<Button label={t("Selesai", "Done")} onPress={() => router.back()} />}>
        <Text variant="heading" testID="hapus-akun-sent">
          {result.existing
            ? t("Permintaanmu sudah kami terima", "We already have your request")
            : t("Permintaan hapus akun terkirim", "Delete request sent")}
        </Text>
        <Text>
          {t(
            "Akunmu belum dihapus. Tim Catera memeriksa permintaan ini lebih dulu.",
            "Your account is not deleted yet. The Catera team reviews this request first.",
          )}
        </Text>
        {plans}
        {privacy}
      </Frame>
    );

  return (
    <Frame
      swapKey="ready"
      footer={
        <>
          {action.error ? <FormError message={action.error} failureKey={action.failures} testID="hapus-akun-error" /> : null}
          <Button variant="danger" label={t("Kirim permintaan hapus akun", "Send delete request")} busy={action.busy} onPress={() => void send()} />
          <Button variant="text" label={t("Batal", "Cancel")} onPress={() => router.back()} />
        </>
      }
    >
      <Text>
        {t(
          "Permintaan ini dikirim ke tim Catera. Akunmu belum dihapus sampai tim memeriksanya.",
          "This request goes to the Catera team. Your account is not deleted until the team has reviewed it.",
        )}
      </Text>
      {plans}
      {privacy}
    </Frame>
  );
}
