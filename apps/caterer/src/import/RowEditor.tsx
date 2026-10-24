import { use, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeLayout } from "@catera/design-tokens";
import { earliestImportStart, normalizeCustomerPhone } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Chip,
  Field,
  fontFor,
  SHEET_CLOSE_MS,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useToast,
} from "@catera/mobile-ui";
import { ReadError } from "../ReadError";
import { recheck, type AssistantRow } from "./rows";
import { useImportStore } from "./store";

/** The row sheet for row `n` of the import in progress, a form sheet above Impor in the root stack. */
export const rowHref = (n: number) => `/impor-baris?n=${n}`;

/**
 * A wrapped row of 34 chips: each draws 34 tall and reaches a 48 target through 7 of hit slop above and below, so the
 * rows sit 14 apart (34 + 14 = 48) and no two targets overlap. Side by side they keep the 8 group gap.
 */
const CHIP_ROWS = { flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap, rowGap: 48 - nativeLayout.control.chip } as const;

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
            {/* The field boxes and the chip of the loaded form: 50 and 34 tall, the same corners, the same gaps. */}
            <View testID="import-row-skeleton" style={{ gap: nativeLayout.space.md }}>
              <Skeleton testID="import-row-skeleton-field-1" height={nativeLayout.control.field} radius={nativeLayout.radius.control} />
              <Skeleton testID="import-row-skeleton-field-2" height={nativeLayout.control.field} radius={nativeLayout.radius.control} />
              <Skeleton testID="import-row-skeleton-field-3" height={nativeLayout.control.field} radius={nativeLayout.radius.control} />
              <Skeleton testID="import-row-skeleton-chip" height={nativeLayout.control.chip} width="60%" radius={nativeLayout.control.chip / 2} />
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
  const { t, locale } = useMobile();
  const c = useColors();
  const toast = useToast();
  const { rows, packages, setRow, removeRow, restoreRow } = useImportStore();
  // While the sheet leaves after "Hapus baris ini" it keeps drawing the row it had, so it never turns into "no longer
  // there" on its way out (or, under TalkBack, while it lingers).
  const [leavingWith, setLeavingWith] = useState<AssistantRow | null>(null);
  const row = leavingWith ?? rows?.find((r) => r.n === n);
  const close = () => router.back();

  // The removal waits for the sheet to have gone (G1a): first the sheet closes, then the row leaves the list under it
  // and the toast offers Urungkan. "Gone" is the route's own close transition (`transitionEnd` closing, which UIKit
  // reports for a swipe), or the route leaving the tree: at once on Android, whose bottom sheet lives in the app's
  // window, and after `SHEET_CLOSE_MS` on iOS, where the sheet keeps sliding away after its route has gone. Once only.
  const navigation = use(NavigationContext);
  const afterClose = useRef<(() => void) | null>(null);
  const runAfterClose = useRef(() => {
    const run = afterClose.current;
    afterClose.current = null;
    run?.();
  }).current;
  useEffect(() => {
    if (!navigation) return;
    return navigation.addListener("transitionEnd" as never, (e: { data?: { closing?: boolean } }) => {
      if (e.data?.closing) runAfterClose();
    });
  }, [navigation, runAfterClose]);
  useEffect(
    () => () => {
      if (!afterClose.current) return;
      if (process.env.EXPO_OS === "ios") setTimeout(runAfterClose, SHEET_CLOSE_MS);
      else runAfterClose();
    },
    [runAfterClose],
  );

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
    setRow(n, (current) => recheck({ ...current, ...patch }, packages, earliestImportStart(new Date()), t, locale));

  return (
    <View testID="import-row-sheet" style={{ flex: 1 }}>
      <SheetHeader title={row.name || t("Pelanggan", "Customer")} closeLabel={t("Tutup", "Close")} />
      {/* Selesai is pinned under the form; "Hapus baris ini" is destructive and secondary, so it stays in the scrolling content. */}
      <SheetBody footer={<Button label={t("Selesai", "Done")} onPress={close} />}>
        {/* What still stops this row from being saved, in the words and the bold charcoal the list uses (a to-do, not an error). */}
        {row.needsReview ? (
          <Text testID="import-row-reason" selectable style={{ color: c.charcoal, fontFamily: fontFor("700") }}>
            {row.reason}
          </Text>
        ) : null}
        <Field label={t("Nama", "Name")} value={row.name} onChangeText={(v) => update({ name: v })} />
        <Field
          label={t("Nomor WhatsApp", "WhatsApp number")}
          defaultValue={row.phone}
          keyboardType="phone-pad"
          // The row holds what is typed at once, so Selesai or Simpan pressed with the keyboard still up loses nothing;
          // the tidy +62 form replaces it when the field ends (and again when the row is sent).
          onChangeText={(v) => update({ phone: v })}
          onEndEditing={(e) => {
            let phone = e.nativeEvent.text;
            try {
              phone = normalizeCustomerPhone(phone);
            } catch {}
            update({ phone });
          }}
        />
        <Field label={t("Alamat", "Address")} value={row.addressLine} onChangeText={(v) => update({ addressLine: v })} />
        <View style={{ flexDirection: "row", gap: nativeLayout.groupGap }}>
          <View style={{ flex: 1 }}>
            <Field label={t("Area", "Area")} value={row.area} onChangeText={(v) => update({ area: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t("Kota", "City")} value={row.city} onChangeText={(v) => update({ city: v })} />
          </View>
        </View>
        <View style={CHIP_ROWS}>
          {packages.map((p) => (
            <Chip key={p.id} label={p.name} selected={row.packageId === p.id} onPress={() => update({ packageId: p.id })} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: nativeLayout.groupGap }}>
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
        <Button
          variant="text"
          label={t("Hapus baris ini", "Remove this row")}
          onPress={() => {
            // One removal however many taps land while the sheet leaves.
            if (leavingWith || afterClose.current) return;
            setLeavingWith(row);
            afterClose.current = () => {
              const removed = removeRow(n);
              // The toast outlives this sheet; Urungkan puts the row back with the edits it had, at its place.
              if (removed)
                toast.show({
                  message: t("Baris dihapus", "Row removed"),
                  action: { label: t("Urungkan", "Undo"), onPress: () => restoreRow(removed.row, removed.index) },
                });
            };
            close();
          }}
        />
      </SheetBody>
    </View>
  );
}
