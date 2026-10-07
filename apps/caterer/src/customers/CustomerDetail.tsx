import { useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { errorLabel, whatsappUrl } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Text } from "@catera/mobile-ui";
import { currentSubscription, renewalAction } from "./rules";
import { usePaymentsActive } from "./usePayments";

/** One customer: when their package ends, how to reach them, and the renewal link. */
export function CustomerDetail({ id }: { id: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  const catererId = actor?.catererId ?? "";
  const list = useData(`customers:${catererId}`, () => runtime.api.sellerCustomers(catererId));
  const payments = usePaymentsActive();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const c = list.data?.customers.find((x) => x.id === id);
  if (!c) return <Screen>{list.error ? <Text style={{ color: colors.danger }}>{list.error}</Text> : <Text variant="caption">{t("Memuat…", "Loading…")}</Text>}</Screen>;
  const s = currentSubscription(c);
  const action = renewalAction(c);

  async function renew() {
    if (!c || !s) return;
    if (payments !== true) {
      router.push("/aktifkan" as never);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result =
        action === "followup"
          ? await command<{ path: string }>("customer.followup", { catererId, subscriptionId: s.id, kind: "prepared" })
          : await command<{ path: string }>("customer.invite", { catererId, customerRecordId: c.id });
      const message =
        action === "followup"
          ? t("Paket katering Anda hampir selesai. Perpanjang di sini:", "Your catering package is nearly finished. Renew here:")
          : t(
              "Paket katering Anda hampir selesai. Buat akun Catera lalu perpanjang di sini:",
              "Your catering package is nearly finished. Create your Catera account and renew here:",
            );
      await Linking.openURL(whatsappUrl(`${message} ${runtime.apiBase}${result.path}`, c.phone!));
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">{c.name}</Text>
      {s ? (
        <Card tone={s.status === "active" && s.remaining <= 3 ? "attention" : "surface"}>
          <Text variant="label" style={{ color: colors.sunriseInk }}>
            {s.status === "active"
              ? `${t("Berakhir", "Ends")} ${s.ends_on} · ${t("sisa", "left")} ${s.remaining} ${t("hari", "days")}`
              : t("Paket sudah selesai", "Package finished")}
          </Text>
          <Text variant="heading">{`${s.package_name} · ${s.portions} porsi`}</Text>
          <Text variant="caption">
            {c.origin === "marketplace"
              ? t("Dari marketplace · dibayar lewat Catera", "From the marketplace · paid through Catera")
              : t("Pelanggan Anda · dibayar di luar Catera", "Your customer · paid outside Catera")}
          </Text>
          {action !== "none" ? (
            <Button label={t("Kirim tautan perpanjang", "Send renewal link")} disabled={busy} onPress={() => void renew()} />
          ) : null}
          {action === "invite" ? (
            <Text variant="caption">
              {t(
                "Pelanggan ini belum punya akun Catera. Pesannya berisi tautan untuk membuat akun lalu membayar perpanjangan.",
                "This customer has no Catera account yet. The message links to creating one, then paying for the renewal.",
              )}
            </Text>
          ) : null}
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        </Card>
      ) : null}
      {c.phone ? (
        <Button variant="secondary" label={t("Chat WhatsApp", "WhatsApp chat")} onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))} />
      ) : null}
      <Card>
        <Text variant="label">{t("Alamat antar", "Delivery address")}</Text>
        <Text>{[c.address.line, c.address.area].filter(Boolean).join(", ")}</Text>
        {c.address.instructions ? <Text variant="caption">{c.address.instructions}</Text> : null}
      </Card>
      {s?.deliveries.length ? (
        <Card>
          <Text variant="label">{t("Jadwal", "Schedule")}</Text>
          {s.deliveries.map((d) => (
            <View key={d.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text>{d.service_date}</Text>
              <Text variant="caption">{d.status === "delivered" ? t("Terkirim", "Delivered") : d.status === "issue" ? t("Gagal diantar", "Not delivered") : t("Terjadwal", "Scheduled")}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
