import { View } from "react-native";
import { router } from "expo-router";
import { earliestImportStart, normalizeCustomerPhone } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Chip, Field, SheetBody, SheetHeader, Text, useColors } from "@catera/mobile-ui";
import { recheck, type AssistantRow } from "./rows";
import { useImportStore } from "./store";

/** The row sheet for row `n` of the import in progress, a form sheet above Impor in the root stack. */
export const rowHref = (n: number) => `/impor-baris?n=${n}`;

/**
 * One imported customer, corrected in a form sheet over Impor. Every change goes straight into the import in progress
 * (`useImportStore`) and is checked again with the server's rules, so the list under the sheet already shows it and
 * closing the sheet in any way loses nothing. "Selesai" returns to the list; "Hapus baris ini" takes the row off it.
 */
export function ImportRowEditor({ n }: { n: number }) {
  const { t } = useMobile();
  const c = useColors();
  const { rows, packages, setRow, removeRow } = useImportStore();
  const row = rows?.find((r) => r.n === n);
  const close = () => router.back();

  // A link to a row that is gone (saved, removed, or Impor closed meanwhile) has nothing to edit.
  if (!row || !packages)
    return (
      <View testID="import-row-sheet" style={{ flex: 1 }}>
        <SheetHeader title={t("Pelanggan", "Customer")} closeLabel={t("Tutup", "Close")} />
        <SheetBody>
          <Text selectable>{t("Baris ini sudah tidak ada.", "This row is no longer there.")}</Text>
          <Button variant="secondary" label={t("Tutup", "Close")} onPress={close} />
        </SheetBody>
      </View>
    );

  const update = (patch: Partial<AssistantRow>) =>
    setRow(n, (current) => recheck({ ...current, ...patch }, packages, earliestImportStart(new Date())));

  return (
    <View testID="import-row-sheet" style={{ flex: 1 }}>
      <SheetHeader title={row.name || t("Pelanggan", "Customer")} closeLabel={t("Tutup", "Close")} />
      <SheetBody>
        {/* What still stops this row from being saved, in the words the list uses. */}
        {row.needsReview ? <Text selectable style={{ color: c.sunriseInk }}>{row.reason}</Text> : null}
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
            removeRow(n);
          }}
        />
      </SheetBody>
    </View>
  );
}
