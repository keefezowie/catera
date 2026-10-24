import { Fragment, useState } from "react";
import { Linking, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { errorLabel, jakartaDay, shortDate, whatsappUrl, type CustomerSubscription } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  DecorativeIcon,
  FadeSwap,
  FormError,
  KeyValueRow,
  ListCard,
  PressableRow,
  Screen,
  SectionHeader,
  Text,
  useBusy,
  useColors,
} from "@catera/mobile-ui";
import { useActionPairStacked } from "../layout/useActionPairStacked";
import { activeSubscriptions, customerStatus, renewalAction } from "./rules";
import { usePaymentsActive } from "./usePayments";
import { loadCustomer } from "./load";
import { ReadError } from "../ReadError";
import { DetailSkeleton } from "../skeletons";

/** A schedule shows this many deliveries before "Lihat semua". */
const SCHEDULE_CAP = 5;
/** The screen body spaces its blocks 16 apart; the address and the schedules sit the Dapur section gap (24) apart. */
const SECTION_LIFT = nativeLayout.dense.sectionGap - 16;
/** In a row each action takes its own width and shares what is left, so one alone fills the row. */
const GROW = { flexGrow: 1, flexShrink: 0 } as const;

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
  // Which packages' schedules were opened past the first five.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  // Below 400 effective dp the two action buttons stack (the shared pair rule); from 400 up the row wraps if they do not fit.
  const stacked = useActionPairStacked();
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
            <DetailSkeleton shape="customer" label={t("Memuat pelanggan", "Loading the customer")} />
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
  const status = {
    active: t("Aktif", "Active"),
    ending: t("Segera berakhir", "Ending soon"),
    ended: t("Selesai", "Ended"),
  }[customerStatus(c)];
  const origin =
    c.origin === "marketplace"
      ? t("Dari marketplace · dibayar lewat Catera", "From the marketplace · paid through Catera")
      : t("Pelangganmu · dibayar di luar Catera", "Your customer · paid outside Catera");
  const deliveryStatus = (d: CustomerSubscription["deliveries"][number]) =>
    d.status === "delivered" ? t("Sampai", "Arrived") : d.status === "issue" ? t("Gagal diantar", "Not delivered") : t("Terjadwal", "Scheduled");

  return (
    <Screen nativeTitle={c.name}>
      <FadeSwap swapKey="loaded" style={{ gap: 16 }}>
        <Text variant="meta">{`${status} · ${origin}`}</Text>
        {shown.map((s, index) => {
          // Moved deliveries can keep a package running past its booked last day; a past "Selesai" would read as ended.
          const pastEnd = s.status === "active" && s.ends_on < today;
          const chat = index === 0 && !!c.phone;
          const renewable = action !== "none";
          return (
            <Fragment key={s.id}>
              <ListCard inset={0}>
                <KeyValueRow label={t("Paket", "Package")} value={s.package_name} valueWraps />
                <KeyValueRow label={t("Mulai", "Starts")} value={shortDate(s.starts_on, locale)} />
                {pastEnd ? null : <KeyValueRow label={t("Selesai", "Ends")} value={shortDate(s.ends_on, locale)} />}
                {s.remaining > 0 ? (
                  <KeyValueRow label={t("Sisa", "Left")} value={t(`${s.remaining} hari`, s.remaining === 1 ? "1 day" : `${s.remaining} days`)} />
                ) : null}
                <KeyValueRow label={t("Porsi", "Portions")} value={t(`${s.portions} per hari`, `${s.portions} per day`)} valueWraps />
              </ListCard>
              {chat || renewable ? (
                <View style={{ gap: 8 }}>
                  <View testID="customer-actions" style={{ flexDirection: stacked ? "column" : "row", flexWrap: stacked ? "nowrap" : "wrap", gap: 8 }}>
                    {chat ? (
                      <Button
                        variant="secondary"
                        label={t("Chat WhatsApp", "WhatsApp chat")}
                        onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))}
                        style={stacked ? undefined : GROW}
                      />
                    ) : null}
                    {renewable ? (
                      <Button
                        label={t("Kirim tautan perpanjang", "Send renewal link")}
                        busy={busy && which === s.id}
                        disabled={busy && which !== s.id}
                        onPress={() => void renew(s)}
                        style={stacked ? undefined : GROW}
                      />
                    ) : null}
                  </View>
                  {renewable && action === "invite" ? (
                    <Text variant="caption">
                      {t(
                        "Pelanggan ini belum punya akun Catera. Tautan di pesan mengajaknya buat akun, lalu bayar perpanjangan.",
                        "This customer has no Catera account yet. The link in the message takes them to create one, then pay for the renewal.",
                      )}
                    </Text>
                  ) : null}
                  {renewable && failure?.subscription === s.id ? (
                    <FormError message={failure.message} failureKey={failure.key} retry={() => void renew(s)} />
                  ) : null}
                </View>
              ) : null}
            </Fragment>
          );
        })}
        {c.address.line || c.address.area ? (
          <View testID="customer-address" style={{ marginTop: SECTION_LIFT, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 16, borderRadius: nativeLayout.radius.control, backgroundColor: palette.well }}>
            <DecorativeIcon name="location-outline" size={20} color={palette.charcoal} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="meta">
                {c.address.label ? `${t("Alamat antar", "Delivery address")} · ${c.address.label}` : t("Alamat antar", "Delivery address")}
              </Text>
              <Text variant="bodyL">{[c.address.line, c.address.area].filter(Boolean).join(", ")}</Text>
              {c.address.instructions ? <Text variant="meta">{c.address.instructions}</Text> : null}
            </View>
          </View>
        ) : null}
        {shown
          .filter((s) => s.deliveries.length)
          .map((s) => {
            const open = opened[s.id] || s.deliveries.length <= SCHEDULE_CAP;
            const rows = open ? s.deliveries : s.deliveries.slice(0, SCHEDULE_CAP);
            const more = t(`Lihat semua ${s.deliveries.length}`, `See all ${s.deliveries.length}`);
            return (
              <View key={`schedule-${s.id}`} style={{ marginTop: SECTION_LIFT }}>
                <SectionHeader title={s.package_name} count={t("Jadwal", "Schedule")} />
                <ListCard inset={0}>
                  {rows.map((d) => (
                    <View
                      key={d.id}
                      testID="schedule-row"
                      accessible
                      accessibilityLabel={`${shortDate(d.service_date, locale)}, ${deliveryStatus(d)}`}
                      style={{ minHeight: nativeLayout.row.info, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                    >
                      <Text variant="bodyL">{shortDate(d.service_date, locale)}</Text>
                      <Text variant="meta">{deliveryStatus(d)}</Text>
                    </View>
                  ))}
                  {open ? null : (
                    <PressableRow
                      accessibilityRole="button"
                      accessibilityLabel={more}
                      onPress={() => setOpened((o) => ({ ...o, [s.id]: true }))}
                      style={{ minHeight: nativeLayout.row.info, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}
                    >
                      {/* forest: action */}
                      <Text variant="bodyStrong" style={{ color: palette.forest }}>
                        {more}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={palette.forest} />
                    </PressableRow>
                  )}
                </ListCard>
              </View>
            );
          })}
      </FadeSwap>
    </Screen>
  );
}
