import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { earliestImportStart, errorLabel, jakartaDay, shortDate } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { plural, useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  FONT,
  FormError,
  ListCard,
  MascotReading,
  Screen,
  SuccessBeat,
  Text,
  TwoLineRow,
  useColors,
  useListMotion,
  useToast,
  useUnsavedGuard,
  warmSuccessRig,
} from "@catera/mobile-ui";
import { Attachments } from "./Attachments";
import { commitImport } from "./commits";
import { recheck, settle, toImportRow, type AssistantRow } from "./rows";
import { rowHref } from "./RowEditor";
import { useImportStore, type Attachment } from "./store";
import { goToTab } from "../nav";
import { fitsUpload, MAX_IMAGES, shrinkPhoto } from "./images";

/** Refusals that belong to one row (pilot_import_row); anything else is about the request itself. */
const ROW_CODES = new Set(["CAPACITY", "CONFLICT", "CUTOFF", "DUPLICATE_CUSTOMER", "DUPLICATE_IMPORT", "FORBIDDEN", "INVALID_DATE", "INVALID_INPUT", "NOT_AVAILABLE", "OVERLAP", "PRICE_CHANGED"]);

const fail = (e: unknown) => (e as { code?: string }).code || (e as Error).message;

/** How long after an edit the draft is saved: typing a name is one save, not one per letter. */
const DRAFT_SAVE_MS = 600;

/**
 * Impor pelanggan: paste or attach anything, check what the assistant read, save the complete rows. A row is completed
 * in its own form sheet (`/impor-baris`); both read the import in progress from `useImportStore`. The rows are kept on
 * the server as the kitchen's draft, so whoever needs more details from a customer can come back to them later.
 */
export function ImportAssistant() {
  const { runtime, actor, t, locale, command } = useMobile();
  const c = useColors();
  const catererId = actor?.catererId ?? "";
  const options = useData(`impor:${catererId}`, () => runtime.api.sellerImportOptions(catererId));
  const packages = options.data?.packages ?? [];
  const { text, files, rows, setText, setFiles, setRows, setPackages, number: numbered, lastRemoved, reset } = useImportStore();
  // A save ends on the success beat: its mascot layers are fetched now, so they are in when it plays.
  useEffect(() => warmSuccessRig(), []);
  const toast = useToast();
  const [busy, setBusy] = useState("");
  // The message and a number that rises with every failure, so an identical failure is announced again.
  const [errorState, setErrorState] = useState({ message: "", key: 0 });
  const error = errorState.message;
  const setError = (message: string) => setErrorState((s) => ({ message, key: message ? s.key + 1 : s.key }));
  const savingRef = useRef(false);
  const [saved, setSaved] = useState(0);
  // Each save plays the beat again: it is keyed by the number of saves made on this screen.
  const [saves, setSaves] = useState(0);
  const [off, setOff] = useState(false);
  // The kitchen's draft as the first read found it, until the caterer continues it or adds to it. Null once it is in the
  // list; `loaded` says the read has answered, so a save never overwrites a draft nobody has seen.
  const [waiting, setWaiting] = useState<{ rows: AssistantRow[]; updatedAt: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const earliest = earliestImportStart(new Date());
  // Only the very first answer counts: later reads (a save moves the revision) must not bring a draft back.
  useEffect(() => {
    if (!options.data || loaded) return;
    setLoaded(true);
    const found = (options.data.draft?.rows ?? []) as AssistantRow[];
    savedDraft.current = JSON.stringify(found);
    if (!found.length) return;
    const settled = found.map((r) => settle(r, options.data!.packages, earliest, t, locale));
    // A list read before this answered joins the draft; otherwise the draft waits for "Lanjutkan".
    if (rows) setRows((current) => [...numbered(settled), ...(current ?? [])]);
    else setWaiting({ rows: settled, updatedAt: options.data.draft!.updatedAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the first answer only
  }, [options.data, loaded]);
  // What the server should hold: the list, nothing once it is cleared, or (null) the waiting draft left alone.
  const wanted = rows ?? (waiting ? null : []);
  const wantedJson = useRef<string | null>(null);
  wantedJson.current = loaded && wanted ? JSON.stringify(wanted) : null;
  // Saves run one at a time and always send the latest list, so an old one can never land after a new one.
  const savedDraft = useRef<string | null>(null);
  const saving = useRef(Promise.resolve());
  // The session as of the latest render: the one function below outlives the render it was made in.
  const session = useRef({ command, catererId });
  session.current = { command, catererId };
  const saveDraft = useRef(() => {
    saving.current = saving.current.then(async () => {
      const json = wantedJson.current;
      if (json === null || json === savedDraft.current) return;
      try {
        await session.current.command("import.draftSave", { catererId: session.current.catererId, rows: JSON.parse(json) }, { refresh: false });
        savedDraft.current = json;
        setDraftFailed(false);
      } catch {
        setDraftFailed(true);
      }
    });
    return saving.current;
  }).current;
  const wantedKey = wantedJson.current;
  useEffect(() => {
    if (wantedKey === null || wantedKey === savedDraft.current) return;
    const timer = setTimeout(() => void saveDraft(), DRAFT_SAVE_MS);
    return () => clearTimeout(timer);
  }, [wantedKey, saveDraft]);
  // Pasted text and attachments are lost when Impor closes. The list is kept as a draft, so it only asks while that has
  // failed or the kitchen's draft could not be read.
  useUnsavedGuard(rows ? rows.length > 0 && (draftFailed || !loaded) : text.trim() !== "" || files.length > 0, t("daftar", "list"), { t, nounEn: "list", voice: "kamu" });
  // The row sheet checks a row against the same packages this screen read.
  useEffect(() => {
    if (options.data) setPackages(options.data.packages);
  }, [options.data, setPackages]);
  // Closing Impor sends the last edits and forgets the import on this screen; the draft holds the rows.
  useEffect(
    () => () => {
      void saveDraft();
      reset();
    },
    [reset, saveDraft],
  );
  /** Opens one row's form sheet over this screen. */
  const edit = (n: number) => router.push(rowHref(n) as never);
  const message = (code: string) =>
    ({
      IMPORT_UNREADABLE: t("Catatan ini belum bisa dibaca. Coba ketik ulang atau kirim foto yang lebih jelas.", "We couldn't read this. Retype it, or send a clearer photo."),
      IMPORT_TOO_LONG: t("Daftarnya terlalu panjang. Kirim sebagian dulu, maksimal 100 pelanggan.", "The list is too long. Send part of it first, up to 100 customers."),
      INVALID_SIZE: t("Lampiran terlalu besar. Maksimal 4 MB.", "Attachments are too large. 4 MB at most."),
      QUOTA: t("Jatah baca hari ini sudah habis. Coba lagi besok.", "You've used today's reading limit. Try again tomorrow."),
      IMPORT_ASSISTANT_DISABLED: t("Asisten impor belum aktif. Kamu tetap bisa memasukkan pelanggan satu per satu.", "The import assistant isn't switched on yet. You can still add customers one by one."),
      IMPORT_UNAVAILABLE: t("Asisten impor sedang tidak tersedia. Coba lagi nanti.", "The import assistant is unavailable. Try again later."),
    })[code] ?? (errorLabel(code, locale) || t("Catatan belum bisa diproses. Coba lagi.", "Couldn't process the notes. Try again."));

  /** One empty row for typing a customer in by hand; it goes through the same review and save as the assistant's rows. */
  function addRow() {
    const [row] = numbered([
      recheck(
        { name: "", phone: "", addressLine: "", area: "", city: "", notes: "", packageId: packages.length === 1 ? packages[0].id : null, startDate: null, remainingDays: null, portions: 1, needsReview: true, reason: "" },
        packages,
        earliestImportStart(new Date()),
        t,
        locale,
      ),
    ]);
    setRows((all) => [...(all ?? []), row]);
    edit(row.n);
  }

  /** Brings the waiting draft into the list, ahead of anything just read. */
  function continueDraft(read: AssistantRow[] = []) {
    const draft = waiting?.rows ?? [];
    setWaiting(null);
    setRows(numbered([...draft, ...read]));
  }

  // One pick at a time, from the tap until its photos land: a second tap before the gallery opens is ignored.
  const picking = useRef(false);
  async function addPhoto() {
    if (picking.current) return;
    const room = MAX_IMAGES - files.filter((f) => f.kind === "image").length;
    if (room <= 0) return setError(t(`Maksimal ${MAX_IMAGES} foto sekali kirim.`, `At most ${MAX_IMAGES} photos per send.`));
    picking.current = true;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room });
      if (picked.canceled) return;
      // The add tile waits, and takes no press, until the photos land.
      setBusy("photo");
      const images: Attachment[] = [];
      for (const [i, a] of picked.assets.slice(0, room).entries())
        images.push({ kind: "image", name: a.fileName || `Foto ${files.length + i + 1}`, ...(await shrinkPhoto(a)) });
      // Never past six, whatever else landed in the meantime.
      setFiles((f) => [...f, ...images.slice(0, Math.max(0, MAX_IMAGES - f.filter((g) => g.kind === "image").length))]);
    } catch {
      setError(t("Foto belum bisa dibuka. Coba lagi.", "Couldn't open the photo. Try again."));
    } finally {
      picking.current = false;
      setBusy((b) => (b === "photo" ? "" : b));
    }
  }

  async function addFile() {
    try {
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
    } catch {
      setError(t("File belum bisa dibaca. Coba lagi.", "Couldn't read the file. Try again."));
    }
  }

  /** Back to the paste step; Urungkan puts the rows (and the text and attachments) back as they were. */
  function startOver() {
    const before = { text, files, rows };
    setRows(null);
    toast.show({
      message: t("Daftar dikosongkan", "List cleared"),
      action: {
        label: t("Urungkan", "Undo"),
        onPress: () => {
          setText(before.text);
          setFiles(before.files);
          setRows(before.rows);
        },
      },
    });
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
        // Bearer only, like every Catera API call from the phone: no cookie is sent or kept.
        credentials: "omit",
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
      continueDraft(body.data.rows);
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
    if (!rows || savingRef.current) return;
    savingRef.current = true;
    const today = jakartaDay(new Date());
    const clean = rows.filter((r) => !r.needsReview);
    setBusy("save");
    setError("");
    try {
      // A preview only checks rows (the web client skips its refresh too); the commit below is what reloads the app.
      const preview = await command<{ id: string }>(
        "import.preview",
        { catererId, rows: clean.map((r) => toImportRow(r, today, r.n)) },
        { refresh: false },
      );
      await commitImport(command, catererId, preview.id);
      setSaved((s) => s + clean.length);
      setSaves((n) => n + 1);
      // From the current list, not the one this save began with: a row deleted meanwhile stays deleted.
      const savedNs = new Set(clean.map((r) => r.n));
      setRows((current) => current?.filter((r) => !savedNs.has(r.n)) ?? null);
      // A row deleted during this save went with it, so its Urungkan would bring back a customer already saved. A row
      // deleted before the save was never sent, and its Urungkan stays.
      const removed = lastRemoved();
      if (removed !== null && savedNs.has(removed)) toast.hide();
    } catch (e) {
      if (!ROW_CODES.has(fail(e))) {
        setError(message(fail(e)));
        return;
      }
      // One bad row stops the whole batch: find which rows the server refuses and flag them.
      const flagged = new Map<number, string>();
      for (const r of clean) {
        try {
          await command("import.preview", { catererId, rows: [toImportRow(r, today, r.n)] }, { refresh: false });
        } catch (rowError) {
          flagged.set(r.n, message(fail(rowError)));
        }
      }
      setRows((current) => current?.map((r) => (flagged.has(r.n) ? { ...r, needsReview: true, reason: flagged.get(r.n)! } : r)) ?? null);
      setError(flagged.size ? t(`${flagged.size} baris perlu dicek sebelum disimpan.`, `${plural(flagged.size, "row")} ${flagged.size === 1 ? "needs" : "need"} checking before saving.`) : message(fail(e)));
    } finally {
      savingRef.current = false;
      setBusy("");
    }
  }

  const clean = rows?.filter((r) => !r.needsReview).length ?? 0;
  const todo = rows?.filter((r) => r.needsReview) ?? [];
  const ready = rows?.filter((r) => !r.needsReview) ?? [];
  const firstName = todo[0]?.name || t("baris pertama", "the first row");
  const reading = busy === "read";
  // What the assistant is reading, named only as far as it holds: "2 foto dan 1 file", "1 foto", or nothing for text.
  const photoCount = files.filter((f) => f.kind === "image").length;
  const fileCount = files.length - photoCount;
  const readingWhat = t(
    [photoCount ? `${photoCount} foto` : "", fileCount ? `${fileCount} file` : ""].filter(Boolean).join(" dan "),
    [photoCount ? plural(photoCount, "photo") : "", fileCount ? plural(fileCount, "file") : ""].filter(Boolean).join(" and "),
  );
  const readingSaid = t("Membaca daftar pelanggan…", "Reading the customer list…");
  // The reading block replaces the button the caterer just pressed, so its focus is gone; the wait is spoken once as
  // it starts, on both platforms, as SuccessBeat and Toast speak theirs. Re-renders and the read ending say nothing.
  const wasReading = useRef(false);
  const said = useRef("");
  useLayoutEffect(() => {
    said.current = readingWhat ? `${readingSaid}, ${readingWhat}` : readingSaid;
  });
  useEffect(() => {
    if (reading && !wasReading.current) AccessibilityInfo.announceForAccessibility(said.current);
    wasReading.current = reading;
  }, [reading]);
  // Saved rows leave and a row typed in by hand enters; the list the assistant read arrives as one block.
  const rowMotion = useListMotion(rows ? rows.map((r) => String(r.n)) : null);

  return (
    <Screen
      footer={
        rows ? (
          rows.length ? (
            <>
              {error ? <FormError message={error} failureKey={errorState.key} /> : null}
              {draftFailed ? (
                <View testID="import-draft-failed">
                  <FormError
                    message={t("Draf belum tersimpan. Cek koneksimu, jangan tutup halaman ini dulu.", "The draft isn't saved yet. Check your connection and keep this page open.")}
                    failureKey={1}
                    retry={() => void saveDraft()}
                  />
                </View>
              ) : clean && todo.length ? (
                <Text variant="meta" style={{ textAlign: "center" }}>
                  {t("Yang belum lengkap tersimpan sebagai draf. Lanjutkan kapan saja.", "Incomplete customers stay in your draft. Continue any time.")}
                </Text>
              ) : null}
              {clean ? (
                <Button label={t(`Simpan ${clean} pelanggan`, `Save ${plural(clean, "customer")}`)} busy={busy === "save"} disabled={!!busy && busy !== "save"} onPress={() => void save()} />
              ) : (
                <Button label={t(`Lengkapi ${firstName}`, `Complete ${firstName}`)} onPress={() => edit(todo[0].n)} />
              )}
            </>
          ) : undefined
        ) : reading ? (
          // In place of the button while the assistant reads: the reading mascot names the wait and what is read.
          <View style={{ alignItems: "center", gap: nativeLayout.space.xs }}>
            <MascotReading size={120} />
            <Text variant="bodyStrong" style={{ textAlign: "center" }}>
              {readingSaid}
            </Text>
            {readingWhat ? (
              <Text variant="meta" style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>
                {readingWhat}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            {error ? <FormError message={error} failureKey={errorState.key} /> : null}
            <Button label={t("Susun daftar", "Build the list")} disabled={(!text.trim() && !files.length) || !!busy} onPress={() => void read()} />
          </>
        )
      }
    >
      {saved ? (
        <SuccessBeat key={saves} title={t(`${saved} pelanggan tersimpan`, `${plural(saved, "customer")} saved`)} play>
          <Button variant="secondary" label={t("Lihat pelanggan", "View customers")} onPress={() => goToTab("pelanggan")} />
        </SuccessBeat>
      ) : null}
      {rows === null ? (
        <>
          {waiting ? (
            <Card testID="import-draft">
              <Text variant="heading">{t(`Draf: ${waiting.rows.length} pelanggan`, `Draft: ${plural(waiting.rows.length, "customer")}`)}</Text>
              <Text variant="meta" numberOfLines={2}>
                {waiting.rows.map((r) => r.name || t("Tanpa nama", "No name")).join(", ")} · {t(`diubah ${shortDate(jakartaDay(new Date(waiting.updatedAt)), locale)}`, `changed ${shortDate(jakartaDay(new Date(waiting.updatedAt)), locale)}`)}
              </Text>
              <Button label={t("Lanjutkan", "Continue")} disabled={reading} onPress={() => continueDraft()} />
            </Card>
          ) : null}
          {waiting ? <Text variant="meta">{t("Daftar baru masuk ke draf yang sama.", "A new list joins this draft.")}</Text> : null}
          <Text variant="bodyL">
            {t(
              "Tempel catatan atau chat WhatsApp, atau lampirkan foto buku, PDF dan Excel. Asisten menyusunnya jadi daftar, lalu kamu cek.",
              "Paste notes or WhatsApp chats, or attach notebook photos, PDFs and Excel files. The assistant turns them into a list for you to check.",
            )}
          </Text>
          <Text variant="meta">
            {t(
              "AI membaca data ini untuk menyusun daftar. Belum ada yang tersimpan sampai kamu tekan Simpan.",
              "This data is read by AI to build the list. Nothing is saved until you press Save.",
            )}
          </Text>
          <TextInput
            accessibilityLabel={t("Tempel atau ketik daftar pelanggan", "Paste or type your customer list")}
            value={text}
            onChangeText={setText}
            multiline
            placeholder={"Bu Ani, 0812…, Jl. Melati 5 Tebet, Rumahan, sisa 8 hari"}
            placeholderTextColor={c.muted}
            // The platform default ink is near black, which vanishes on the dark surface.
            style={{
              minHeight: 160,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: nativeLayout.radius.control,
              borderCurve: "continuous",
              padding: nativeLayout.cardPadding,
              fontFamily: FONT,
              fontSize: 15,
              lineHeight: 22,
              color: c.charcoal,
              backgroundColor: c.surface,
            }}
          />
          <Attachments
            files={files}
            max={MAX_IMAGES}
            locked={reading}
            adding={busy === "photo"}
            onAddPhoto={() => void addPhoto()}
            onRemove={(index) => setFiles((all) => all.filter((_, j) => j !== index))}
          />
          {/* While the assistant reads it stays in place, dimmed, as the add tile does, and says why it waits. */}
          <Button
            variant="secondary"
            label={t("+ PDF / Excel", "+ PDF / Excel")}
            disabled={reading}
            accessibilityHint={reading ? t("Bisa lagi setelah selesai membaca.", "Available again once reading is done.") : undefined}
            onPress={() => void addFile()}
          />
          {off ? (
            <Card tone="attention">
              <Text>{message("IMPORT_ASSISTANT_DISABLED")}</Text>
              <Button label={t("Isi manual", "Fill in by hand")} onPress={addRow} />
            </Card>
          ) : null}
        </>
      ) : (
        <>
          {/* The summary and how far along the list is; what still needs something comes first. */}
          <View style={{ gap: nativeLayout.groupGap }}>
            <Text variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>
              {t(`${clean} dari ${rows.length} pelanggan siap disimpan`, `${clean} of ${plural(rows.length, "customer")} ready to save`)}
            </Text>
            {rows.length ? (
              <View testID="import-progress" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: "hidden" }}>
                <View style={{ height: 6, width: `${(clean / rows.length) * 100}%`, backgroundColor: c.forest }} />
              </View>
            ) : null}
          </View>
          {(
            [
              [t("Perlu dilengkapi", "To complete"), todo],
              [t("Siap disimpan", "Ready to save"), ready],
            ] as const
          ).map(([title, group]) =>
            group.length ? (
              <View key={title} style={{ gap: nativeLayout.groupGap }}>
                <Text variant="heading" accessibilityRole="header" style={{ fontVariant: ["tabular-nums"] }}>
                  {title} · {group.length}
                </Text>
                <ListCard inset={0}>
                  {group.map((r) => (
                    <Animated.View key={r.n} testID="import-row" {...rowMotion(String(r.n))}>
                      <TwoLineRow
                        testID={`import-row-${r.n}`}
                        // The reason is the point of a row that needs something, so it wraps instead of being cut.
                        wrap={r.needsReview ? "meta" : false}
                        title={r.name || t("Tanpa nama", "No name")}
                        // A row that still needs something says what in its one line; a clean row gives its phone and area.
                        meta={
                          r.needsReview
                            ? r.reason || t("Asisten menebak sebagian data ini", "The assistant guessed part of this")
                            : // Portions are saved with the row and shown nowhere else before the save, so a count other than 1 rides on the line, before the area, which is the part a narrow line may cut.
                              [r.phone, r.portions !== 1 ? t(`${r.portions} porsi`, plural(r.portions, "portion")) : "", r.area].filter(Boolean).join(" · ")
                        }
                        // The label names the row, and what a row still needs, so a screen reader hears it.
                        accessibilityLabel={r.needsReview ? `${t("Lengkapi", "Complete")} ${r.name || t(`baris ${r.n}`, `row ${r.n}`)}: ${r.reason}` : `${t("Ubah", "Edit")} ${r.name || t(`baris ${r.n}`, `row ${r.n}`)}`}
                        onPress={() => edit(r.n)}
                        trailing={
                          // forest: action
                          <Text variant="bodyStrong" style={{ color: c.forest, paddingLeft: nativeLayout.space.md }}>
                            {r.needsReview ? t("Lengkapi", "Complete") : t("Ubah", "Edit")}
                          </Text>
                        }
                      />
                    </Animated.View>
                  ))}
                </ListCard>
              </View>
            ) : null,
          )}
          <Button variant="secondary" label={t("Tambah pelanggan", "Add a customer")} onPress={addRow} />
          <Button variant="text" label={t("Mulai lagi", "Start over")} onPress={startOver} />
        </>
      )}
    </Screen>
  );
}
