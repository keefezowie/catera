import { use, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, TextInput, View, type ScrollViewInstance, type ViewInstance } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeLayout } from "@catera/design-tokens";
import { addDays, earliestImportStart, longDay, monthOf, normalizeCustomerPhone, shortDate } from "@catera/domain";
import { plural, useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  CalendarPanel,
  Field,
  FieldMessage,
  fontFor,
  PressableRow,
  PressableScale,
  SHEET_CLOSE_MS,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useToast,
  type CalendarDayState,
} from "@catera/mobile-ui";
import { ReadError } from "../ReadError";
import { issuesOf, recheck, type AssistantRow, type RowField } from "./rows";
import { useImportStore, type ImportPackage } from "./store";

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

/** A field's label where the control is not a `Field`: the same 13/700 line. */
function ControlLabel({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ fontFamily: fontFor("700"), fontSize: 13, lineHeight: 18, color: c.charcoal }}>{children}</Text>;
}

/** A named part of the form. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: nativeLayout.headingGap }}>
      <Text variant="meta" accessibilityRole="header" style={{ fontFamily: fontFor("700"), letterSpacing: 0.4, textTransform: "uppercase" }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Looks like a field and opens the calendar: a date is picked, never typed. */
function DateField({ label, value, error, onPress }: { label: string; value: string; error?: string; onPress: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <ControlLabel>{label}</ControlLabel>
      <PressableRow
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value || t("belum dipilih", "not chosen")}`}
        accessibilityHint={error}
        onPress={onPress}
        style={{
          minHeight: nativeLayout.control.field,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: nativeLayout.space.md,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: error ? c.danger : c.fieldBorder,
          borderRadius: 9,
          borderCurve: "continuous",
          backgroundColor: c.inputFill,
        }}
      >
        <Text style={{ flex: 1, color: value ? c.charcoal : c.muted }}>{value || t("Pilih tanggal", "Choose a date")}</Text>
        <Ionicons name="calendar-outline" size={20} color={c.muted} accessible={false} importantForAccessibility="no" />
      </PressableRow>
      {error ? <FieldMessage text={error} /> : null}
    </View>
  );
}

/** The kitchen's packages with their length, which is what Sisa hari is checked against. */
function PackagePicker({ packages, value, error, onPick }: { packages: ImportPackage[]; value: string | null; error?: string; onPick: (id: string) => void }) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: nativeLayout.groupGap }}>
      <ControlLabel>{t("Paket", "Package")}</ControlLabel>
      {packages.map((p) => {
        const on = p.id === value;
        return (
          <PressableRow
            key={p.id}
            accessibilityRole="radio"
            accessibilityLabel={`${p.name}, ${t(`${p.days} hari`, plural(p.days, "day"))}`}
            accessibilityState={{ checked: on }}
            onPress={() => onPick(p.id)}
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: nativeLayout.space.md,
              paddingVertical: nativeLayout.groupGap,
              paddingHorizontal: 14,
              borderWidth: on ? 2 : 1,
              borderColor: on ? c.forest : c.fieldBorder,
              borderRadius: 9,
              borderCurve: "continuous",
            }}
          >
            <Text variant="bodyStrong" style={{ flex: 1, minWidth: 0 }}>
              {p.name}
            </Text>
            <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
              {t(`${p.days} hari`, plural(p.days, "day"))}
            </Text>
            {on ? <Ionicons name="checkmark" size={20} color={c.forest} accessible={false} importantForAccessibility="no" /> : null}
          </PressableRow>
        );
      })}
      {error ? <FieldMessage text={error} /> : null}
    </View>
  );
}

const STEP = 48;

/** The days left: − and + up to the package's length, with the number itself typable for a long package. */
function DaysLeft({ value, max, error, onChange }: { value: number | null; max: number | null; error?: string; onChange: (n: number | null) => void }) {
  const { t } = useMobile();
  const c = useColors();
  const label = t("Sisa hari", "Days left");
  const over = !!max && !!value && value > max;
  const button = (glyph: string, a11y: string, disabled: boolean, next: number) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic="select"
      onPress={() => onChange(next)}
      style={{ width: STEP, height: STEP, borderRadius: STEP / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.sage, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ fontFamily: fontFor("700"), fontSize: 22, lineHeight: 26, color: c.charcoal }}>{glyph}</Text>
    </PressableScale>
  );
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ControlLabel>{label}</ControlLabel>
          <Text variant="caption">{max ? t(`Paket ini ${max} hari`, `This package has ${plural(max, "day")}`) : t("Pilih paket dulu", "Choose a package first")}</Text>
        </View>
        {button("−", t("Kurangi sisa hari", "Fewer days left"), !value || value <= 1, (value ?? 2) - 1)}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          value={value ? String(value) : ""}
          keyboardType="number-pad"
          onChangeText={(v) => onChange(Number(v.replace(/\D/g, "")) || null)}
          style={{
            width: 56,
            minHeight: nativeLayout.control.field,
            borderWidth: 1,
            borderColor: error ? c.danger : c.fieldBorder,
            borderRadius: 9,
            borderCurve: "continuous",
            backgroundColor: c.inputFill,
            textAlign: "center",
            fontFamily: fontFor("700"),
            fontSize: 16,
            fontVariant: ["tabular-nums"],
            color: c.charcoal,
          }}
        />
        {button("+", t("Tambah sisa hari", "More days left"), !max || (value ?? 0) >= max, (value ?? 0) + 1)}
      </View>
      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.space.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <FieldMessage text={error} />
          </View>
          {over ? <Button variant="text" label={t(`Pakai ${max} hari`, `Use ${plural(max, "day")}`)} onPress={() => onChange(max)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One imported customer, completed in a form sheet over Impor. Every change goes straight into the import in progress
 * (`useImportStore`) and is checked again with the server's rules, so the list under the sheet already shows it and
 * closing the sheet in any way loses nothing. What is missing is said under its own field, and the pinned button always
 * says the next step: to what is missing, to the next customer who needs something, or back to the list.
 */
export function ImportRowEditor({ n: opened }: { n: number }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const toast = useToast();
  const { rows, packages, setRow, removeRow, restoreRow } = useImportStore();
  // The sheet moves through the customers without leaving: "Lanjut ke Bu Rina".
  const [n, setN] = useState(opened);
  const [picking, setPicking] = useState(false);
  // While the sheet leaves after "Hapus baris ini" it keeps drawing the row it had, so it never turns into "no longer
  // there" on its way out (or, under TalkBack, while it lingers).
  const [leavingWith, setLeavingWith] = useState<AssistantRow | null>(null);
  const row = leavingWith ?? rows?.find((r) => r.n === n);
  const close = () => router.back();
  const scroller = useRef<ScrollViewInstance>(null);
  const form = useRef<ViewInstance>(null);
  const anchors = useRef<Partial<Record<RowField, ViewInstance | null>>>({});
  const anchor = (field: RowField) => (node: ViewInstance | null) => {
    anchors.current[field] = node;
  };

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

  const earliest = earliestImportStart(new Date());
  const name = row.name || t("Pelanggan", "Customer");
  const update = (patch: Partial<AssistantRow>) => setRow(n, (current) => recheck({ ...current, ...patch }, packages, earliest, t, locale));
  const issues = issuesOf(row, packages, earliest, t, locale);
  const errorOf = (field: RowField) => issues.find((i) => i.field === field)?.message;
  // The assistant's doubt about a value it guessed: nothing is wrong by the rules, but the caterer has not looked yet.
  const doubt = !issues.length && row.needsReview;
  const pkg = packages.find((p) => p.id === row.packageId);
  const date = row.startDate && /^\d{4}-\d{2}-\d{2}$/.test(row.startDate) ? row.startDate : "";
  const waiting = (rows ?? []).filter((r) => r.needsReview && r.n !== n);
  const next = waiting.find((r) => r.n > n) ?? waiting[0];
  const nextName = next ? next.name || t("baris berikutnya", "the next row") : "";

  if (picking) {
    const days: Record<string, CalendarDayState> = {};
    const last = addDays(earliest, 365);
    for (let day = earliest; day <= last; day = addDays(day, 1)) days[day] = { state: "available" };
    return (
      <View testID="import-row-sheet" style={{ flex: 1 }}>
        <SheetHeader
          title={t("Antar berikutnya", "Next delivery")}
          context={t(`${name} · paling cepat ${shortDate(earliest, locale)}`, `${name} · ${shortDate(earliest, locale)} at the earliest`)}
          closeLabel={t("Kembali", "Back")}
          onClose={() => setPicking(false)}
        />
        <SheetBody>
          <CalendarPanel
            month={monthOf(date || earliest)}
            days={days}
            current={date}
            window={{ from: earliest, to: last }}
            onPick={() => undefined}
            idleLabel={t("Pilih tanggal", "Choose a date")}
            promptText={t("Pilih tanggal antar berikutnya.", "Choose the next delivery date.")}
            confirmLabel={(d) => t(`Pilih ${longDay(d, locale)}`, `Choose ${longDay(d, locale)}`)}
            onConfirm={async (d) => {
              update({ startDate: d });
              setPicking(false);
            }}
            staff
            inset
          />
        </SheetBody>
      </View>
    );
  }

  /** Brings the first thing missing into view and says what it is. */
  const showFirst = () => {
    const first = issues[0];
    const target = anchors.current[first.field];
    if (target && form.current)
      target.measureLayout?.(
        form.current,
        (_x, y) => scroller.current?.scrollTo({ y: Math.max(0, y - nativeLayout.headingGap), animated: true }),
        () => undefined,
      );
    AccessibilityInfo.announceForAccessibility(first.message);
  };
  const primary = issues.length
    ? { label: t("Lengkapi yang kurang", "Fill in what's missing"), onPress: showFirst }
    : doubt
      ? { label: t("Sudah benar", "This is correct"), onPress: () => update({}) }
      : next
        ? {
            label: t(`Lanjut ke ${nextName}`, `Go on to ${nextName}`),
            onPress: () => {
              setN(next.n);
              scroller.current?.scrollTo({ y: 0, animated: false });
            },
          }
        : { label: t("Selesai", "Done"), onPress: close };
  const secondary = issues.length || doubt ? t("Nanti saja", "Later") : next ? t("Kembali ke daftar", "Back to the list") : "";

  return (
    <View testID="import-row-sheet" style={{ flex: 1 }}>
      <SheetHeader title={name} closeLabel={t("Tutup", "Close")} />
      {/* The next step is pinned under the form; "Hapus baris ini" is destructive and secondary, so it stays in the scrolling content. */}
      <SheetBody
        scrollRef={scroller}
        footer={
          <View style={{ gap: nativeLayout.space.xs }}>
            <Button label={primary.label} onPress={primary.onPress} />
            {secondary ? <Button variant="text" label={secondary} onPress={close} /> : null}
          </View>
        }
      >
        {/* Keyed by the row, so moving to the next customer starts each field from that customer's value. */}
        <View key={n} ref={form} collapsable={false} style={{ gap: nativeLayout.dense.sectionGap }}>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {!issues.length && !doubt ? <Ionicons name="checkmark-circle" size={18} color={c.forest} accessible={false} importantForAccessibility="no" /> : null}
            <Text testID="import-row-reason" selectable style={{ flex: 1, fontFamily: fontFor("700"), color: c.charcoal }}>
              {issues.length
                ? t(`Kurang ${issues.length} lagi`, `${issues.length} more to fill in`)
                : doubt
                  ? `${t("Perlu dicek", "To check")}: ${row.reason || t("asisten menebak sebagian data ini", "the assistant guessed part of this")}`
                  : t("Lengkap, siap disimpan", "Complete, ready to save")}
            </Text>
          </View>
          <Group title={t("Kontak", "Contact")}>
            <View ref={anchor("name")} collapsable={false}>
              <Field label={t("Nama", "Name")} value={row.name} error={errorOf("name")} onChangeText={(v) => update({ name: v })} />
            </View>
            <View ref={anchor("phone")} collapsable={false}>
              <Field
                label={t("Nomor WhatsApp", "WhatsApp number")}
                defaultValue={row.phone}
                error={errorOf("phone")}
                keyboardType="phone-pad"
                // The row holds what is typed at once, so a button pressed with the keyboard still up loses nothing;
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
            </View>
          </Group>
          <Group title={t("Alamat", "Address")}>
            <View ref={anchor("addressLine")} collapsable={false}>
              <Field label={t("Alamat", "Address")} value={row.addressLine} error={errorOf("addressLine")} onChangeText={(v) => update({ addressLine: v })} />
            </View>
            {/* Top-aligned: labels hold one line, so a line under one field never lifts it above its neighbour. */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: nativeLayout.groupGap }}>
              <View ref={anchor("area")} collapsable={false} style={{ flex: 1 }}>
                <Field label={t("Area", "Area")} value={row.area} placeholder={t("Mis. Tebet", "E.g. Tebet")} error={errorOf("area")} onChangeText={(v) => update({ area: v })} />
              </View>
              <View ref={anchor("city")} collapsable={false} style={{ flex: 1 }}>
                <Field label={t("Kota", "City")} value={row.city} placeholder={t("Mis. Jakarta", "E.g. Jakarta")} error={errorOf("city")} onChangeText={(v) => update({ city: v })} />
              </View>
            </View>
          </Group>
          <Group title={t("Langganan", "Subscription")}>
            <View ref={anchor("packageId")} collapsable={false}>
              <PackagePicker packages={packages} value={row.packageId} error={errorOf("packageId")} onPick={(id) => update({ packageId: id })} />
            </View>
            <View ref={anchor("startDate")} collapsable={false}>
              <DateField label={t("Antar berikutnya", "Next delivery")} value={date ? longDay(date, locale) : ""} error={errorOf("startDate")} onPress={() => setPicking(true)} />
            </View>
            <View ref={anchor("remainingDays")} collapsable={false}>
              <DaysLeft value={row.remainingDays} max={pkg?.days ?? null} error={errorOf("remainingDays")} onChange={(v) => update({ remainingDays: v })} />
            </View>
            {/* Portions come from what the assistant read and are saved with the row; there is no field for them, so the count is told. */}
            {row.portions !== 1 ? (
              <Text testID="import-row-portions" variant="meta">
                {t(`${row.portions} porsi per hari`, `${plural(row.portions, "portion")} per day`)}
              </Text>
            ) : null}
          </Group>
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
        </View>
      </SheetBody>
    </View>
  );
}
