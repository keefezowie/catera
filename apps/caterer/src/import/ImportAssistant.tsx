import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { earliestImportStart, errorLabel, jakartaDay } from "@catera/domain";
import { plural, useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  FONT,
  fontFor,
  PressableRow,
  Screen,
  SuccessBeat,
  Text,
  useColors,
  useListMotion,
} from "@catera/mobile-ui";
import { commitImport } from "./commits";
import { recheck, toImportRow, type AssistantRow } from "./rows";
import { rowHref } from "./RowEditor";
import { useImportStore, type Attachment } from "./store";
import { goToTab } from "../nav";
import { fitsUpload, MAX_IMAGES, shrinkPhoto } from "./images";

/** Refusals that belong to one row (pilot_import_row); anything else is about the request itself. */
const ROW_CODES = new Set(["CAPACITY", "CONFLICT", "CUTOFF", "DUPLICATE_CUSTOMER", "DUPLICATE_IMPORT", "FORBIDDEN", "INVALID_DATE", "INVALID_INPUT", "NOT_AVAILABLE", "OVERLAP", "PRICE_CHANGED"]);

const fail = (e: unknown) => (e as { code?: string }).code || (e as Error).message;

/**
 * Impor pelanggan: paste or attach anything, check what the assistant read, save the clean rows. A row is corrected in
 * its own form sheet (`/impor-baris`); both read the import in progress from `useImportStore`, which empties when
 * Impor closes.
 */
export function ImportAssistant() {
  const { runtime, actor, t, locale, command } = useMobile();
  const c = useColors();
  const catererId = actor?.catererId ?? "";
  const options = useData(`impor:${catererId}`, () => runtime.api.sellerImportOptions(catererId));
  const packages = options.data?.packages ?? [];
  const { text, files, rows, setText, setFiles, setRows, setPackages, number: numbered, reset } = useImportStore();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(0);
  // Each save plays the beat again: it is keyed by the number of saves made on this screen.
  const [saves, setSaves] = useState(0);
  const [off, setOff] = useState(false);
  // The row sheet checks a row against the same packages this screen read.
  useEffect(() => {
    if (options.data) setPackages(options.data.packages);
  }, [options.data, setPackages]);
  // Closing Impor forgets the import, as it always has.
  useEffect(() => reset, [reset]);
  /** Opens one row's form sheet over this screen. */
  const edit = (n: number) => router.push(rowHref(n) as never);
  const message = (code: string) =>
    ({
      IMPORT_UNREADABLE: t("Catatan ini belum bisa dibaca. Coba ketik ulang atau kirim foto yang lebih jelas.", "We couldn't read this. Try retyping it or a clearer photo."),
      IMPORT_TOO_LONG: t("Daftarnya terlalu panjang. Kirim sebagian dulu, maksimal 100 pelanggan.", "The list is too long. Send part of it first, up to 100 customers."),
      INVALID_SIZE: t("Lampiran terlalu besar. Maksimal 4 MB.", "Attachments are too large. 4 MB at most."),
      QUOTA: t("Batas baca hari ini sudah tercapai. Coba lagi besok.", "Today's reading limit is reached. Try again tomorrow."),
      IMPORT_ASSISTANT_DISABLED: t("Asisten impor belum aktif. Anda tetap bisa memasukkan pelanggan satu per satu.", "The import assistant isn't switched on yet. You can still add customers one by one."),
      IMPORT_UNAVAILABLE: t("Asisten impor sedang tidak tersedia. Coba lagi nanti.", "The import assistant is unavailable. Try again later."),
    })[code] ?? (errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));

  /** One empty row for typing a customer in by hand; it goes through the same review and save as the assistant's rows. */
  function addRow() {
    const [row] = numbered([
      recheck(
        { name: "", phone: "", addressLine: "", area: "", city: "", notes: "", packageId: packages.length === 1 ? packages[0].id : null, startDate: null, remainingDays: null, portions: 1, needsReview: true, reason: "" },
        packages,
        earliestImportStart(new Date()),
      ),
    ]);
    setRows((all) => [...(all ?? []), row]);
    edit(row.n);
  }

  async function addPhoto() {
    const room = MAX_IMAGES - files.filter((f) => f.kind === "image").length;
    if (room <= 0) return setError(t(`Maksimal ${MAX_IMAGES} foto sekali kirim.`, `At most ${MAX_IMAGES} photos per send.`));
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room });
    if (picked.canceled) return;
    setBusy("photo");
    try {
      const images: Attachment[] = [];
      for (const [i, a] of picked.assets.slice(0, room).entries())
        images.push({ kind: "image", name: a.fileName || `Foto ${files.length + i + 1}`, ...(await shrinkPhoto(a)) });
      setFiles((f) => [...f, ...images]);
    } finally {
      setBusy("");
    }
  }

  async function addFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const a = picked.assets[0];
    const name = a.name.toLowerCase();
    const kind = name.endsWith(".pdf") ? "pdf" : name.endsWith(".xlsx") ? "xlsx" : name.endsWith(".csv") ? "csv" : null;
    if (!kind) return setError(t("Pilih PDF, CSV atau Excel (.xlsx).", "Choose a PDF, CSV or Excel (.xlsx) file."));
    const data = await new File(a.uri).base64();
    setFiles((f) => [...f, { kind, name: a.name, data } as Attachment]);
  }

  async function read() {
    if (!fitsUpload([text, ...files.map((f) => f.data)]))
      return setError(t("Lampiran terlalu besar. Kirim sebagian dulu.", "Attachments are too large. Send some of them first."));
    setBusy("read");
    setError("");
    try {
      const token = await runtime.token();
      const response = await fetch(`${runtime.apiBase}/api/import-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          text: text.trim() || undefined,
          images: files.flatMap((f) => (f.kind === "image" ? [{ mediaType: f.mediaType, data: f.data }] : [])),
          pdfs: files.flatMap((f) => (f.kind === "pdf" ? [{ data: f.data }] : [])),
          sheets: files.flatMap((f) => (f.kind === "csv" || f.kind === "xlsx" ? [{ kind: f.kind, data: f.data }] : [])),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { data?: { rows: AssistantRow[] }; error?: { code?: string } };
      if (!response.ok || !body.data) throw Object.assign(new Error(body.error?.code || "IMPORT_UNAVAILABLE"), { code: body.error?.code });
      setOff(false);
      setRows(numbered(body.data.rows));
    } catch (e) {
      if (fail(e) === "IMPORT_ASSISTANT_DISABLED") {
        setOff(true);
        return;
      }
      setError(message(fail(e)));
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!rows) return;
    const today = jakartaDay(new Date());
    const clean = rows.filter((r) => !r.needsReview);
    setBusy("save");
    setError("");
    try {
      const preview = await command<{ id: string }>("import.preview", { catererId, rows: clean.map((r) => toImportRow(r, today, r.n)) });
      await commitImport(command, catererId, preview.id);
      setSaved((s) => s + clean.length);
      setSaves((n) => n + 1);
      setRows(rows.filter((r) => r.needsReview));
    } catch (e) {
      if (!ROW_CODES.has(fail(e))) {
        setError(message(fail(e)));
        return;
      }
      // One bad row stops the whole batch: find which rows the server refuses and flag them.
      const flagged = new Map<number, string>();
      for (const r of clean) {
        try {
          await command("import.preview", { catererId, rows: [toImportRow(r, today, r.n)] });
        } catch (rowError) {
          flagged.set(r.n, message(fail(rowError)));
        }
      }
      setRows(rows.map((r) => (flagged.has(r.n) ? { ...r, needsReview: true, reason: flagged.get(r.n)! } : r)));
      setError(flagged.size ? t(`${flagged.size} baris perlu dicek sebelum disimpan.`, `${flagged.size} rows need checking before saving.`) : message(fail(e)));
    } finally {
      setBusy("");
    }
  }

  const clean = rows?.filter((r) => !r.needsReview).length ?? 0;
  // Saved rows leave and a row typed in by hand enters; the list the assistant read arrives as one block.
  const rowMotion = useListMotion(rows ? rows.map((r) => String(r.n)) : null);

  return (
    <Screen
      footer={
        rows ? (
          <Button label={t(`Simpan ${clean} pelanggan`, `Save ${plural(clean, "customer")}`)} disabled={!clean || !!busy} onPress={() => void save()} />
        ) : (
          <Button label={t("Susun daftar", "Build the list")} disabled={(!text.trim() && !files.length) || !!busy} onPress={() => void read()} />
        )
      }
    >
      {saved ? (
        <SuccessBeat key={saves} title={t(`${saved} pelanggan tersimpan`, `${plural(saved, "customer")} saved`)} play>
          <Button variant="secondary" label={t("Lihat Pelanggan", "View customers")} onPress={() => goToTab("pelanggan")} />
        </SuccessBeat>
      ) : null}
      {rows === null ? (
        <>
          <Text>
            {t(
              "Tempel catatan, chat WhatsApp, atau lampirkan foto buku, PDF dan Excel. Asisten akan menyusunnya menjadi daftar untuk Anda periksa.",
              "Paste notes or WhatsApp chats, or attach notebook photos, PDFs and Excel files. The assistant turns them into a list for you to check.",
            )}
          </Text>
          <Text variant="caption">
            {t(
              "Data ini dibaca oleh AI untuk menyusun daftar. Tidak ada yang tersimpan sebelum Anda menekan Simpan.",
              "This data is read by AI to build the list. Nothing is saved until you press Save.",
            )}
          </Text>
          <TextInput
            accessibilityLabel={t("Tempel atau ketik daftar pelanggan", "Paste or type your customer list")}
            value={text}
            onChangeText={setText}
            multiline
            placeholder={"Bu Ani – 0812… – Jl. Melati 5 Tebet – Rumahan, sisa 8 hari"}
            placeholderTextColor={c.muted}
            // The platform default ink is near black, which vanishes on the dark surface.
            style={{ minHeight: 160, textAlignVertical: "top", borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 14, fontFamily: FONT, fontSize: 15, color: c.charcoal, backgroundColor: c.surface }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button style={{ flex: 1 }} variant="secondary" label={t("+ Foto", "+ Photo")} onPress={() => void addPhoto()} />
            <Button style={{ flex: 1 }} variant="secondary" label={t("+ PDF / Excel", "+ PDF / Excel")} onPress={() => void addFile()} />
          </View>
          {files.map((f, i) => (
            <View key={`${f.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1 }}>{f.name}</Text>
              <Button variant="text" label={t("Hapus", "Remove")} onPress={() => setFiles((all) => all.filter((_, j) => j !== i))} />
            </View>
          ))}
          {off ? (
            <Card tone="attention">
              <Text>{message("IMPORT_ASSISTANT_DISABLED")}</Text>
              <Button label={t("Isi manual", "Fill in by hand")} onPress={addRow} />
            </Card>
          ) : null}
          {busy === "read" ? <Text variant="caption">{t("Sedang membaca… biasanya kurang dari satu menit.", "Reading… usually under a minute.")}</Text> : null}
        </>
      ) : (
        <>
          <Text>
            {rows.length - clean
              ? t(`${clean} siap disimpan · ${rows.length - clean} perlu dicek`, `${clean} ready · ${rows.length - clean} to check`)
              : t(`${clean} siap disimpan`, `${clean} ready to save`)}
          </Text>
          {rows.map((r) => (
            <Animated.View key={r.n} testID="import-row" {...rowMotion(String(r.n))}>
              <Card tone={r.needsReview ? "attention" : "surface"}>
                <PressableRow accessibilityRole="button" accessibilityLabel={`${t("Ubah", "Edit")} ${r.name}`} onPress={() => edit(r.n)} style={{ gap: 4 }}>
                  <Text variant="heading">{r.name || t("Tanpa nama", "No name")}</Text>
                  <Text variant="caption">{[r.phone, [r.addressLine, r.area].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</Text>
                  <Text variant="caption">
                    {`${packages.find((p) => p.id === r.packageId)?.name ?? t("Paket belum dipilih", "Package not chosen")} · ${r.remainingDays != null ? t(`${r.remainingDays} hari lagi`, r.remainingDays === 1 ? "1 day left" : `${r.remainingDays} days left`) : t("sisa hari belum diisi", "days left not set")} · ${t(`${r.portions} porsi`, plural(r.portions, "portion"))}`}
                  </Text>
                  {r.needsReview ? <Text style={{ color: c.sunriseInk, fontFamily: fontFor("700") }}>{r.reason}</Text> : null}
                </PressableRow>
              </Card>
            </Animated.View>
          ))}
          <Button variant="secondary" label={t("Tambah baris", "Add a row")} onPress={addRow} />
          <Button variant="text" label={t("Mulai lagi", "Start over")} onPress={() => setRows(null)} />
        </>
      )}
      {error ? <Text selectable style={{ color: c.danger }}>{error}</Text> : null}
    </Screen>
  );
}
