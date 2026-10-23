import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { areaOptions, type Address } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  Field,
  FormError,
  ReadError,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useBusy,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";
import { FilterChip } from "../discover/FilterChip";
import { addressFormHref } from "./Addresses";
import { useAddressRemoval } from "./addressRemoval";
import { failureText } from "./failure";

/** `other`: the label is the customer's own words (Lainnya), typed in the label field, not one of the preset chips. */
type Draft = { label: string; other: boolean; line: string; area: string; city: string; instructions: string };

/** The label chips before Lainnya, as [Indonesian, English]; a label in either language picks its chip. */
const PRESET_LABELS: [string, string][] = [
  ["Rumah", "Home"],
  ["Kantor", "Office"],
];
const isPreset = (label: string) => PRESET_LABELS.some((p) => p.includes(label.trim()));

/**
 * Only typed text asks: a field that differs from what the form opened with. Choosing an area or a label chip alone
 * does not; the label counts once it is the customer's own words under Lainnya.
 */
const typedChange = (d: Draft, start: Draft) =>
  (["line", "city", "instructions"] as const).some((k) => d[k].trim() !== start[k].trim()) ||
  (d.other && d.label.trim() !== start.label.trim());

/**
 * Addresses typed and not saved, per person and address ("baru" for a new one), in memory only. Android's bottom sheet
 * closes on a swipe before anything can ask (`useUnsavedGuard`), so the typing waits here and comes back when the form
 * opens again for that address. Saving or "Buang" drops it; closing the app forgets it.
 */
const drafts = new Map<string, Draft>();

const blank = (t: (id: string, en: string) => string, a?: Address | null): Draft => ({
  label: a?.label ?? t("Rumah", "Home"),
  other: !!a && !isPreset(a.label),
  line: a?.line ?? "",
  area: a?.area ?? "Jakarta Selatan",
  city: a?.city ?? "Jakarta",
  instructions: a?.instructions ?? "",
});

/** The sheet's frame: the title row over the scrolling form, in one FadeSwap so the form fades in as one block. */
function Frame({ title, swapKey, children, footer }: { title: string; swapKey: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} closeLabel={t("Tutup", "Close")} />
      <SheetBody footer={footer}>
        <FadeSwap swapKey={swapKey} style={{ gap: 12 }}>
          {children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

function FormSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat alamat", "Loading the address")}>
      <View style={{ gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ gap: 6 }}>
            <Skeleton width="35%" height={12} />
            <Skeleton height={48} radius={9} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/**
 * `/alamat-form` (new) and `/alamat-form?id={id}` (edit): an address as a native form sheet over Alamat
 * (`sheetOptions({ detents: "form" })`); from Beli or Bayar the same form opens as `/pembelian/alamat-form` over the
 * purchase. Saving closes the sheet with the toast "Alamat disimpan". Typed changes ask before the sheet closes.
 */
export function AddressForm({ flow = false }: { flow?: boolean } = {}) {
  const params = useLocalSearchParams<{ id?: string }>();
  const { actor, ready, t } = useMobile();
  const id = typeof params.id === "string" && params.id ? params.id : "";
  const title = id ? t("Ubah alamat", "Edit address") : t("Alamat baru", "New address");
  if (!ready || !actor)
    return (
      <Frame title={title} swapKey={ready ? "signin" : "loading"}>
        {ready ? (
          <Button
            label={t("Masuk", "Sign in")}
            onPress={() => router.push({ pathname: "/login", params: { next: "/alamat" } } as never)}
          />
        ) : (
          <FormSkeleton />
        )}
      </Frame>
    );
  return <Book key={`${actor.id}:${id}`} actorId={actor.id} id={id} title={title} flow={flow} />;
}

function Book({ actorId, id, title, flow }: { actorId: string; id: string; title: string; flow: boolean }) {
  const { runtime, t } = useMobile();
  const c = useColors();
  // A new address needs nothing read first; an edit reads the book for its version.
  const customer = useData(`alamat-form:${id}`, () => (id ? runtime.api.customer() : Promise.resolve(null)));
  // Once shown, the form keeps its address: a read after Hapus no longer lists it while the sheet is closing.
  const shown = useRef<Address | null>(null);
  const found = customer.data?.addresses.find((a) => a.id === id);
  if (found) shown.current = found;
  if (!id) return <Form actorId={actorId} address={null} title={title} flow={flow} />;
  const address = found ?? shown.current;
  if (!address)
    return (
      <Frame title={title} swapKey={customer.loading ? "loading" : "missing"}>
        {customer.loading ? (
          <FormSkeleton />
        ) : (
          customer.error ? (
            <ReadError message={customer.error} onRetry={() => void customer.reload()} />
          ) : (
            <Text style={{ color: c.muted }}>{t("Alamat tidak ditemukan.", "Address not found.")}</Text>
          )
        )}
      </Frame>
    );
  return <Form actorId={actorId} address={address} title={title} flow={flow} addresses={customer.data?.addresses ?? [address]} />;
}

function Form({
  actorId,
  address,
  title,
  flow,
  addresses = [],
}: {
  actorId: string;
  address: Address | null;
  title: string;
  flow: boolean;
  /** The whole book, for moving this address's deliveries to another one when Hapus finds it in use. */
  addresses?: Address[];
}) {
  const { command, t, locale } = useMobile();
  const c = useColors();
  const toast = useToast();
  const draftKey = `${actorId}:${address?.id ?? "baru"}`;
  const [start] = useState(() => blank(t, address));
  const [draft, setDraft] = useState<Draft>(() => drafts.get(draftKey) ?? start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [saved, setSaved] = useState(false);
  const [removed, setRemoved] = useState(false);
  const closed = useRef(false);
  const typed = typedChange(draft, start);
  const removal = useAddressRemoval(addressFormHref(flow));
  // Hapus stays busy from the press until the whole removal settles, so a second press sends nothing.
  const [removing, remove] = useBusy(async (retry: () => void) => {
    if (!address) return;
    if (!(await removal(address, addresses, retry))) return;
    drafts.delete(draftKey);
    setRemoved(true);
  });
  const pressRemove = () => void remove(pressRemove);

  useUnsavedGuard(!saved && !removed && typed, t("alamat", "address"), {
    t,
    nounEn: "address",
    onDiscard: () => drafts.delete(draftKey),
  });

  // After the guard has seen `saved`, so closing never asks.
  useEffect(() => {
    if (!saved || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({ message: t("Alamat disimpan", "Address saved"), tone: "success" });
  }, [saved, toast, t]);

  // Deleted: the removal already said so; the form closes once the guard has seen `removed`.
  useEffect(() => {
    if (!removed || closed.current) return;
    closed.current = true;
    router.back();
  }, [removed]);

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (typedChange(next, start)) drafts.set(draftKey, next);
      else drafts.delete(draftKey);
      return next;
    });
  const areas = !areaOptions.includes(draft.area) ? [draft.area, ...areaOptions] : areaOptions;

  // What still keeps the button off, in the order of the form: [Indonesian, English].
  const missing: [string, string][] = [];
  if (!draft.label.trim()) missing.push(["label", "label"]);
  if (draft.line.trim().length < 5) missing.push(["jalan", "street"]);
  if (!draft.city.trim()) missing.push(["kota", "city"]);

  const missingText = t(
    `Isi dulu: ${missing.map((m) => m[0]).join(", ")}.`,
    `Fill in first: ${missing.map((m) => m[1]).join(", ")}.`,
  );

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await command("address.save", {
        ...(address ? { id: address.id, version: address.version } : {}),
        label: draft.label,
        line: draft.line,
        area: draft.area,
        city: draft.city,
        instructions: draft.instructions,
      });
      drafts.delete(draftKey);
      setSaved(true);
    } catch (e) {
      setError(failureText(e, locale, t));
      setFailures((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title={title}
      swapKey="ready"
      footer={
        <>
          {error ? <FormError message={error} failureKey={failures} testID="address-error" /> : null}
          {missing.length ? (
            <Text variant="caption" style={{ color: c.muted }}>
              {missingText}
            </Text>
          ) : null}
          <Button
            label={t("Simpan alamat", "Save address")}
            accessibilityHint={missing.length ? missingText : undefined}
            busy={busy}
            disabled={missing.length > 0}
            onPress={() => void save()}
          />
        </>
      }
    >
      <Text variant="label">{t("Label", "Label")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PRESET_LABELS.map(([id, en]) => {
          const label = t(id, en);
          return (
            <FilterChip
              key={id}
              label={label}
              selected={!draft.other && (draft.label.trim() === id || draft.label.trim() === en)}
              onPress={() => set({ label, other: false })}
            />
          );
        })}
        <FilterChip
          label={t("Lainnya", "Other")}
          selected={draft.other}
          // The customer's own label comes back when it was theirs to start with; a preset gives way to an empty field.
          onPress={() => {
            if (!draft.other) set({ other: true, label: start.other ? start.label : "" });
          }}
        />
      </View>
      {draft.other ? (
        <Field label={t("Label alamat", "Address label")} value={draft.label} onChangeText={(label) => set({ label })} maxLength={60} />
      ) : null}
      <Field
        label={t("Jalan, nomor, detail", "Street, number, details")}
        hint={
          draft.line.trim().length > 0 && draft.line.trim().length < 5
            ? t("Tulis jalan dan nomornya, minimal 5 karakter.", "Write the street and number, at least 5 characters.")
            : undefined
        }
        value={draft.line}
        onChangeText={(line) => set({ line })}
        multiline
        maxLength={300}
      />
      <Text variant="label">{t("Area", "Area")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {areas.map((area) => (
          <FilterChip key={area} label={area} selected={draft.area === area} onPress={() => set({ area })} />
        ))}
      </View>
      <Field label={t("Kota", "City")} value={draft.city} onChangeText={(city) => set({ city })} maxLength={80} />
      <Field
        label={t("Petunjuk pengantaran", "Delivery instructions")}
        hint={t("Contoh: pagar hitam, titip satpam", "For example: black gate, leave it with security")}
        value={draft.instructions}
        onChangeText={(instructions) => set({ instructions })}
        multiline
        maxLength={300}
      />
      <Text variant="caption">
        {t(
          "Mengubah alamat ini tidak mengubah pengantaran yang sudah terjadwal. Untuk itu, pakai Ubah hari di Jadwal.",
          "A delivery already scheduled changes its address only through Change day in Schedule.",
        )}
      </Text>
      {address ? (
        <View style={{ alignItems: "flex-start", paddingTop: 8 }}>
          <Button variant="text" label={t("Hapus alamat", "Delete address")} ink={c.danger} busy={removing} onPress={pressRemove} />
        </View>
      ) : null}
    </Frame>
  );
}
