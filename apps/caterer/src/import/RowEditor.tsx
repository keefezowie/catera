import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { earliestImportStart, normalizeCustomerPhone } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Chip, Field, SheetBody, SheetHeader, Skeleton, SkeletonGroup, Text, useColors, useToast } from "@catera/mobile-ui";
import { ReadError } from "../ReadError";
import { recheck, type AssistantRow } from "./rows";
import { useImportStore } from "./store";

/** The row sheet for row `n` of the import in progress, a form sheet above Impor in the root stack. */
export const rowHref = (n: number) => `/impor-baris?n=${n}`;

/**
 * The row sheet while the kitchen's package choices are not in the import yet: field-shaped skeletons, or the read's
 * error with Coba lagi. It reads the choices itself (Impor's own read may still be on its way, or may have failed) and
 * puts them in the import, which then shows the row's editor.
 */
function PackageChoices({ title }: { title: string }) {
  const { runtime, actor, t } = useMobile();
  const catererId = actor?.catererId ?? "";
  const { setPackages } = useImportStore();
  const options = useData(`impor:${catererId}`, () => runtime.api.sellerImportOptions(catererId));
  useEffect(() => {
    if (options.data) setPackages(options.data.packages);
  }, [options.data, setPackages]);
  return (
    <View testID="import-row-sheet" style={{ flex: 1 }}>
      <SheetHeader title={title} closeLabel={t("Tutup", "Close")} />
      <SheetBody>
        {options.error ? (
          <ReadError message={options.error} onRetry={() => void options.reload()} />
        ) : (
          <SkeletonGroup label={t("Memuat pilihan paket", "Loading the package choices")}>
            <View style={{ gap: 12 }}>
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
              <Skeleton height={40} width="60%" radius={20} />
            </View>
          </SkeletonGroup>
        )}
      </SheetBody>
    </View>
  );
}

/**
 * One imported customer, corrected in a form sheet over Impor. Every change goes straight into the import in progress
 * (`useImportStore`) and is checked again with the server's rules, so the list under the sheet already shows it and
 * closing the sheet in any way loses nothing. "Selesai" returns to the list; "Hapus baris ini" takes the row off it and offers "Urungkan" in a toast.
 */
export function ImportRowEditor({ n }: { n: number }) {
  const { t } = useMobile();
  const c = useColors();
  const toast = useToast();
  const { rows, packages, setRow, removeRow, restoreRow } = useImportStore();
  const row = rows?.find((r) => r.n === n);
  const close = () => router.back();

  // A link to a row that is gone (saved, removed, or Impor closed meanwhile) has nothing to edit. Opened cold, nothing is
  // under the sheet to go back to, so both closes open Impor in its place, as the photo viewer does.
  if (!row) {
    const leave = () => (router.canGoBack() ? router.back() : router.replace("/impor" as never));
    return (
      <View testID="import-row-sheet" style={{ flex: 1 }}>
        <SheetHeader title={t("Pelanggan", "Customer")} closeLabel={t("Tutup", "Close")} onClose={leave} />
        <SheetBody>
          <Text selectable>{t("Baris ini sudah tidak ada.", "This row is no longer there.")}</Text>
          <Button variant="secondary" label={t("Tutup", "Close")} onPress={leave} />
        </SheetBody>
      </View>
    );
  }
  // The row is there, but Impor's read of the package choices has not landed (or failed): the row is checked against
  // them, so the sheet waits for them instead of calling the row gone.
  if (!packages) return <PackageChoices title={row.name || t("Pelanggan", "Customer")} />;

  const update = (patch: Partial<AssistantRow>) =>
    setRow(n, (current) => recheck({ ...current, ...patch }, packages, earliestImportStart(new Date())));

  return (
    <View testID="import-row-sheet" style={{ flex: 1 }}>
      <SheetHeader title={row.name || t("Pelanggan", "Customer")} closeLabel={t("Tutup", "Close")} />
      <SheetBody>
        {/* What still stops this row from being saved, in the words the list uses. */}
        {row.needsReview ? <Text selectable style={{ color: c.danger }}>{row.reason}</Text> : null}
        <Field label={t("Nama", "Name")} value={row.name} onChangeText={(v) => update({ name: v })} />
        <Field
          label={t("Nomor WhatsApp", "WhatsApp number")}
          defaultValue={row.phone}
          keyboardType="phone-pad"
          onEndEditing={(e) => {
            let phone = e.nativeEvent.text;
            try {
              phone = normalizeCustomerPhone(phone);
            } catch {}
            update({ phone });
          }}
        />
        <Field label={t("Alamat", "Address")} value={row.addressLine} onChangeText={(v) => update({ addressLine: v })} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label={t("Area", "Area")} value={row.area} onChangeText={(v) => update({ area: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t("Kota", "City")} value={row.city} onChangeText={(v) => update({ city: v })} />
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {packages.map((p) => (
            <Chip key={p.id} label={p.name} selected={row.packageId === p.id} onPress={() => update({ packageId: p.id })} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field
              label={t("Antar berikutnya (TTTT-BB-HH)", "Next delivery (YYYY-MM-DD)")}
              value={row.startDate ?? ""}
              onChangeText={(v) => update({ startDate: v || null })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t("Sisa hari", "Days left")}
              value={row.remainingDays ? String(row.remainingDays) : ""}
              keyboardType="number-pad"
              onChangeText={(v) => update({ remainingDays: v ? Number(v.replace(/\D/g, "")) : null })}
            />
          </View>
        </View>
        <Button label={t("Selesai", "Done")} onPress={close} />
        <Button
          variant="text"
          label={t("Hapus baris ini", "Remove this row")}
          onPress={() => {
            // The sheet leaves first, so it slides away showing the row rather than "no longer there".
            close();
            const removed = removeRow(n);
            // The toast outlives this sheet; Urungkan puts the row back with the edits it had, at its place.
            if (removed)
              toast.show({
                message: t("Baris dihapus", "Row removed"),
                action: { label: t("Urungkan", "Undo"), onPress: () => restoreRow(removed.row, removed.index) },
              });
          }}
        />
      </SheetBody>
    </View>
  );
}
