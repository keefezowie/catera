import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { currency, errorLabel, nutritionSummary, packageNutrition, WEEK_HEADER, type Locale, type SellerOffer } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { plural, useMobile } from "@catera/mobile-core";
import { Button, FormError, KeyValueRow, ListCard, Screen, Text, useBusy, useConfirm, useToast } from "@catera/mobile-ui";
import { photoUri } from "../photo";
import { PackagePhoto } from "./PackagePhoto";
import { kitchenLive } from "./kitchen";
import { pushScreen } from "../nav";

/** Whole day names, Monday first (the index is `(weekday + 6) % 7`, with Sunday as 0). */
const FULL_DAYS = {
  id: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

/**
 * The delivery days as short as they read: a run of three or more in a row is a range ("Senin–Jumat", "Senin–Minggu"),
 * and days apart stay a short list ("Sen, Rab, Jum"). When the days are one group they use whole names; with several
 * groups they use the short ones, so the value stays short; the row lets a text value wrap (`valueWraps`).
 */
export function weekdayLabel(weekdays: number[], locale: Locale): string {
  const places = [...new Set(weekdays.map((d) => (d + 6) % 7))].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const place of places) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === place - 1) last.push(place);
    else runs.push([place]);
  }
  const names = runs.length === 1 ? FULL_DAYS[locale] : WEEK_HEADER[locale];
  return runs
    .map((run) => (run.length >= 3 ? `${names[run[0]]}–${names[run[run.length - 1]]}` : run.map((place) => names[place]).join(", ")))
    .join(", ");
}

/**
 * A package customers can already buy keeps its commercial terms fixed, so it is shown read-only with lifecycle
 * controls: pause ("Jeda paket"), archive once paused & finished ("Arsipkan paket"), or copy into a new package.
 */
export function PackageDetail({ offer, kitchenStatus }: { offer: SellerOffer; kitchenStatus?: string }) {
  const { runtime, actor, command, t, locale } = useMobile();
  const confirm = useConfirm();
  const toast = useToast();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // A published package in a kitchen Catera has not approved is not on sale yet: say so rather than let it pass as live.
  const hidden = kitchenStatus !== undefined && offer.status === "published" && !kitchenLive(kitchenStatus);
  const suspended = offer.status === "suspended";
  const published = offer.status === "published";
  const groups = offer.menus[0]?.composition ?? [];
  const capacity = offer.weekdays.length ? offer.capacity[String(offer.weekdays[0])] : undefined;
  // The caterer's own estimates as customers see them; nothing when none were entered (a zero is shown).
  const gizi = nutritionSummary(packageNutrition(offer), locale);
  const portion = groups.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ");

  const [busy, runLifecycle] = useBusy(async (action: "package.suspend" | "package.archive") => {
    const isArchive = action === "package.archive";
    const go = await confirm({
      title: isArchive ? t("Arsipkan paket ini?", "Archive this package?") : t("Jeda paket ini?", "Pause this package?"),
      message: isArchive
        ? t(
            "Paket ini akan dipindahkan ke arsip setelah semua pengantaran selesai. Riwayat pesanan tetap tersimpan.",
            "This package will be archived once all deliveries finish. Order history stays saved.",
          )
        : t(
            "Pelanggan baru tidak bisa melihat atau memesan paket ini. Pengantaran yang sudah berjalan tetap lanjut.",
            "New customers won't see or order this package. Existing deliveries keep running.",
          ),
      confirmLabel: isArchive ? t("Arsipkan", "Archive") : t("Jeda paket", "Pause package"),
      cancelLabel: t("Batal", "Cancel"),
      tone: isArchive ? "danger" : undefined,
    });
    if (!go) return;
    setError("");
    try {
      await command(action, { catererId: actor?.catererId ?? "", packageId: offer.id });
      toast.show({
        message: isArchive ? t("Paket diarsipkan", "Package archived") : t("Paket dijeda", "Package paused"),
        tone: "success",
      });
      if (isArchive) router.back();
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setAttempt((n) => n + 1);
      setError(
        errorLabel(code, locale) ||
          (isArchive
            ? t("Paket belum bisa diarsipkan. Pastikan semua pengantaran sudah selesai.", "Couldn't archive yet. Make sure all deliveries are finished.")
            : t("Paket belum bisa dijeda. Coba lagi.", "Couldn't pause the package. Try again.")),
      );
    }
  });

  return (
    <Screen nativeTitle={offer.name}>
      <View testID="paket-detail" style={{ gap: nativeLayout.dense.sectionGap }}>
        <View style={{ gap: nativeLayout.space.lg }}>
          {offer.image ? <PackagePhoto uri={photoUri(offer.image, runtime.apiBase)} /> : null}
          <Text variant="bodyL">{offer.description}</Text>
        </View>
        <View style={{ gap: nativeLayout.groupGap }}>
          <ListCard inset={0}>
            {hidden ? <KeyValueRow testID="paket-fact-status" label={t("Status", "Status")} value={t("Belum tampil", "Not shown yet")} /> : null}
            {suspended ? <KeyValueRow testID="paket-fact-status" label={t("Status", "Status")} value={t("Dijeda", "Paused")} /> : null}
            <KeyValueRow
              testID="paket-fact-harga"
              label={t("Harga", "Price")}
              value={offer.price === null ? t("Belum ada harga", "No price yet") : `${currency(offer.price, locale)} ${t("per porsi", "per portion")}`}
            />
            <KeyValueRow testID="paket-fact-hari" valueWraps label={t("Hari antar", "Delivery days")} value={weekdayLabel(offer.weekdays, locale)} />
            {capacity !== undefined ? (
              <KeyValueRow
                testID="paket-fact-kapasitas"
                valueWraps
                label={t("Kapasitas", "Capacity")}
                value={t(`${capacity} porsi per hari`, `${plural(capacity, "portion")} a day`)}
              />
            ) : null}
          </ListCard>
          {hidden ? (
            <Text variant="meta">
              {t(
                "Paket ini sudah diterbitkan. Pelanggan bisa melihatnya setelah tim Catera menyetujui dapurmu. Langkahnya ada di Usaha.",
                "This package is published. Customers can see it once the Catera team approves your kitchen. The steps are in Business.",
              )}
            </Text>
          ) : null}
          {suspended ? (
            <Text variant="meta">
              {t(
                "Paket ini sedang dijeda. Pembeli baru tidak bisa melihatnya, sementara pengantaran yang sudah berjalan tetap lanjut.",
                "This package is paused. New buyers can't see it while existing deliveries continue.",
              )}
            </Text>
          ) : null}
          {portion ? <Text variant="meta">{portion}</Text> : null}
          {gizi ? (
            <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
              {`${t("Gizi per porsi", "Nutrition per portion")}: ${gizi}`}
            </Text>
          ) : null}
        </View>
        <View style={{ gap: nativeLayout.space.md }}>
          <Text variant="meta">
            {t(
              "Paket yang sudah diterbitkan tidak bisa diubah, supaya pelanggan dapat persis yang mereka beli. Untuk ubah harga, isi, atau kapasitas, salin jadi paket baru.",
              "Published packages are locked so customers get exactly what they bought. To change the price, contents or capacity, copy it into a new package.",
            )}
          </Text>
          {error ? <FormError message={error} failureKey={attempt} testID="paket-lifecycle-error" /> : null}
          <Button variant="secondary" label={t("Salin jadi paket baru", "Copy into a new package")} disabled={busy} onPress={() => pushScreen(`/paket/baru?from=${offer.id}`)} />
          {published ? (
            <View testID="package-suspend">
              <Button variant="text" label={t("Jeda paket", "Pause package")} busy={busy} onPress={() => void runLifecycle("package.suspend")} />
            </View>
          ) : null}
          {suspended ? (
            <View testID="package-archive">
              <Button variant="danger" label={t("Arsipkan paket", "Archive package")} busy={busy} onPress={() => void runLifecycle("package.archive")} />
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
