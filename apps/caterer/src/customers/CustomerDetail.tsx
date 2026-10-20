import { useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { errorLabel, jakartaDay, shortDate, whatsappUrl, type CustomerSubscription } from "@catera/domain";
import { useData, useMobile, plural } from "@catera/mobile-core";
import { Button, Card, FadeSwap, FormError, Screen, Text, useBusy, useColors } from "@catera/mobile-ui";
import { activeEndLabel, activeSubscriptions, renewalAction } from "./rules";
import { usePaymentsActive } from "./usePayments";
import { loadCustomer } from "./load";
import { ReadError } from "../ReadError";
import { DetailSkeleton } from "../skeletons";

/**
 * One customer: when their package ends, how to reach them, and the renewal link. `title` is the name the link that
 * opened it carried (`customerHref`), absent on a cold link.
 */
export function CustomerDetail({ id, title }: { id: string; title?: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  // Named palette because `c` is the customer record below.
  const palette = useColors();
  const catererId = actor?.catererId ?? "";
  const record = useData(`customer:${catererId}:${id}`, () => loadCustomer(runtime, catererId, id));
  const payments = usePaymentsActive();
  const [failure, setFailure] = useState<{ message: string; key: number; subscription: string } | null>(null);
  // Which package's button is waiting; the hook drops a second press while one runs.
  const [which, setWhich] = useState("");
  const c = record.data;
  const [busy, renew] = useBusy(async (s: CustomerSubscription) => {
    if (!c) return;
    if (payments !== true) {
      router.push("/aktifkan" as never);
      return;
    }
    setWhich(s.id);
    setFailure(null);
    try {
      const followup = renewalAction(c) === "followup";
      const result = followup
        ? await command<{ path: string }>("customer.followup", { catererId, subscriptionId: s.id, kind: "prepared" })
        : await command<{ path: string }>("customer.invite", { catererId, customerRecordId: c.id });
      const message = followup
        ? t("Paket kateringmu hampir selesai. Perpanjang di sini:", "Your catering package is nearly finished. Renew here:")
        : t(
            "Paket kateringmu hampir selesai. Buat akun Catera lalu perpanjang di sini:",
            "Your catering package is nearly finished. Create your Catera account and renew here:",
          );
      await Linking.openURL(whatsappUrl(`${message} ${runtime.apiBase}${result.path}`, c.phone!));
    } catch (e) {
      setFailure((f) => ({
        subscription: s.id,
        key: (f?.key ?? 0) + 1,
        message:
          errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Tautan perpanjang belum terkirim. Coba lagi.", "The renewal link was not sent. Try again."),
      }));
    }
  });
  // Until the record arrives the screen keeps the name its link carried, or else is named by what it is; then by the
  // customer. A failed read or a customer the read does not hold goes back to what it is: the carried name was never
  // checked against a record.
  if (!c) {
    const loading = record.loading && !record.error;
    return (
      <Screen nativeTitle={loading ? (title ?? t("Pelanggan", "Customer")) : t("Pelanggan", "Customer")}>
        {/* The same FadeSwap as the loaded page, so the customer enters from the skeleton as one block. */}
        <FadeSwap swapKey={loading ? "loading" : "missing"} style={{ gap: 16 }}>
          {record.error ? (
            <ReadError art message={record.error} onRetry={() => void record.reload()} />
          ) : loading ? (
            <DetailSkeleton label={t("Memuat pelanggan", "Loading the customer")} />
          ) : (
            <Text>{t("Pelanggan ini tidak ditemukan.", "This customer was not found.")}</Text>
          )}
        </FadeSwap>
      </Screen>
    );
  }
  const today = jakartaDay(new Date());
  const active = activeSubscriptions(c);
  // Every active package, soonest ending first; a customer with none shows their latest finished one.
  const shown = active.length ? active : c.subscriptions.slice(0, 1);
  const action = renewalAction(c);

  return (
    <Screen nativeTitle={c.name}>
      <FadeSwap swapKey="loaded" style={{ gap: 16 }}>
        {shown.map((s) => (
          <Card key={s.id} tone={s.status === "active" && s.remaining <= 3 ? "attention" : "surface"}>
            <Text variant="label" style={{ color: palette.charcoal }}>
              {s.status === "active"
                ? activeEndLabel(s, today, t, locale, true)
                : t("Paket sudah selesai", "Package finished")}
            </Text>
            <Text variant="heading">{t(`${s.package_name} · ${s.portions} porsi`, `${s.package_name} · ${plural(s.portions, "portion")}`)}</Text>
            <Text variant="caption">
              {c.origin === "marketplace"
                ? t("Dari marketplace · dibayar lewat Catera", "From the marketplace · paid through Catera")
                : t("Pelangganmu · dibayar di luar Catera", "Your customer · paid outside Catera")}
            </Text>
            {action !== "none" ? (
              <Button label={t("Kirim tautan perpanjang", "Send renewal link")} busy={busy && which === s.id} disabled={busy && which !== s.id} onPress={() => void renew(s)} />
            ) : null}
            {action === "invite" ? (
              <Text variant="caption">
                {t(
                  "Pelanggan ini belum punya akun Catera. Tautan di pesan mengajaknya buat akun, lalu bayar perpanjangan.",
                  "This customer has no Catera account yet. The link in the message takes them to create one, then pay for the renewal.",
                )}
              </Text>
            ) : null}
            {failure?.subscription === s.id ? <FormError message={failure.message} failureKey={failure.key} retry={() => void renew(s)} /> : null}
          </Card>
        ))}
        {c.phone ? (
          <Button variant="secondary" label={t("Chat WhatsApp", "WhatsApp chat")} onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))} />
        ) : null}
        <Card>
          <Text variant="label">{t("Alamat antar", "Delivery address")}</Text>
          <Text>{[c.address.line, c.address.area].filter(Boolean).join(", ")}</Text>
          {c.address.instructions ? <Text variant="caption">{c.address.instructions}</Text> : null}
        </Card>
        {shown
          .filter((s) => s.deliveries.length)
          .map((s) => (
            <Card key={`schedule-${s.id}`}>
              <Text variant="label">{shown.length > 1 ? `${t("Jadwal", "Schedule")} · ${s.package_name}` : t("Jadwal", "Schedule")}</Text>
              {s.deliveries.map((d) => (
                <View key={d.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
                  <Text>{shortDate(d.service_date, locale)}</Text>
                  <Text variant="caption">{d.status === "delivered" ? t("Sampai", "Arrived") : d.status === "issue" ? t("Gagal diantar", "Not delivered") : t("Terjadwal", "Scheduled")}</Text>
                </View>
              ))}
            </Card>
          ))}
      </FadeSwap>
    </Screen>
  );
}
