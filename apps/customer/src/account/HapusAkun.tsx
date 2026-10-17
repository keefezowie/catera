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
  useToast,
} from "@catera/mobile-ui";
import { accountMessage } from "./accountMessages";
import { useAction } from "./useAction";

function Frame({ swapKey, children }: { swapKey: string; children: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={t("Hapus akun", "Delete account")} closeLabel={t("Tutup", "Close")} />
      <SheetBody>
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
 * send it too: the sheet names those plans and says the team settles them first, without promising a time.
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

  const plans = running.length ? (
    <View style={{ gap: 6 }} testID="hapus-akun-plans">
      <Text>
        {running.length === 1
          ? t(`Kamu masih punya paket yang berjalan: ${running[0]}.`, `You still have a plan running: ${running[0]}.`)
          : t(`Kamu masih punya ${running.length} paket yang berjalan:`, `You still have ${running.length} plans running:`)}
      </Text>
      {running.length > 1 ? running.map((name) => <Text key={name}>{name}</Text>) : null}
      <Text>
        {t(
          "Paket yang masih berjalan diselesaikan dulu oleh tim Catera. Kami hubungi kamu soal sisa harinya sebelum akun dihapus.",
          "The Catera team settles plans that are still running first. We will contact you about the days left before the account is deleted.",
        )}
      </Text>
    </View>
  ) : null;

  const privacy = (
    <Button
      variant="text"
      label={t("Baca kebijakan privasi", "Read the privacy policy")}
      onPress={() =>
        void WebBrowser.openBrowserAsync(`${runtime.apiBase}/syarat-dan-privasi#privasi`).catch(() =>
          toast.show({ message: t("Belum berhasil. Coba lagi.", "That didn't work. Try again."), tone: "error" }),
        )
      }
    />
  );

  if (result)
    return (
      <Frame swapKey="sent">
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
        <Button label={t("Selesai", "Done")} onPress={() => router.back()} />
      </Frame>
    );

  return (
    <Frame swapKey="ready">
      <Text>
        {t(
          "Permintaan ini dikirim ke tim Catera. Akunmu belum dihapus sampai tim memeriksanya.",
          "This request goes to the Catera team. Your account is not deleted until the team has reviewed it.",
        )}
      </Text>
      {plans}
      {privacy}
      {action.error ? <FormError message={action.error} failureKey={action.failures} testID="hapus-akun-error" /> : null}
      <Button label={t("Kirim permintaan hapus akun", "Send delete request")} busy={action.busy} onPress={() => void send()} />
      <Button variant="text" label={t("Batal", "Cancel")} onPress={() => router.back()} />
    </Frame>
  );
}
