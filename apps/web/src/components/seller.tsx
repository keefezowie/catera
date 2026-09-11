"use client";
import { SellerOperations } from "./seller-operations";
import { PackageContents } from "./package-contents";
import {
  type MealMenu,
  type PackageType,
} from "@catera/domain";
import { Select, SelectOption } from "./select";
import { PhotoUpload } from "./photo-upload";
import { CompositionEditor, compositionDraft } from "./composition-editor";
import { MenuCalendar } from "./menu-calendar";
import { PackageCard, PackagePage } from "./marketplace";
import {
  offerEditorIssues,
  offerSteps,
  sharedCapacityValue,
  withSharedCapacity,
  type OfferStep,
  type EditorIssue,
  type Caterer,
} from "@catera/domain";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  Package,
  Users,
} from "lucide-react";
import {
  currency,
  localDay,
  mealLabel,
  areaOptions,
  type SellerState,
  type Offer,
  type SupportCase,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button, Checkbox, TextArea, TextInput } from "./form-controls";
import {
  Heading,
  Status,
  Loading,
  ErrorNotice,
  Empty,
  ActionForm,
  Field,
  Dialog,
} from "./ui";
import { Messages } from "./customer";
import { NumericInput } from "./numeric-input";
import { TimeInput } from "./time-input";

export function Seller({ view }: { view: string }) {
  const { actor } = useApp();
  if (!actor?.catererId) return <Onboarding />;
  if (["today", "schedule", "production", "delivery"].includes(view)) return <SellerOperations view={view} />;
  return <SellerWorkspace view={view} />;
}
function SellerWorkspace({ view }: { view: string }) {
  const { actor, t } = useApp();
  const query = useSearchParams();
  const router = useRouter();
  const date = query.get("date") || localDay();
  useEffect(() => { if (view === "dishes") router.replace("/seller/menus?library=1"); }, [view, router]);
  const state = useResource<SellerState>(
    "seller:" + actor?.catererId + ":" + date,
    () => api.seller(actor!.catererId!, date),
  );
  if (!actor?.catererId) return <Onboarding />;
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const s = state.data;
  return (
    <>
      <Heading
        title={{
          packages: "Paket dari dapurmu.", menus: "Menu yang dinanti.", dishes: "Daftar hidangan", customers: "Pelanggan", support: "Pesan & bantuan", transactions: "Transaksi & pencairan", settings: "Pengaturan katerer",
        }[view] || view}
        description={s.caterer.name}
      />
      {s.caterer.status !== "approved" && (
        <p className="notice">
          Status verifikasi: <Status status={s.caterer.status} /> · Penjualan
          baru tersedia setelah disetujui. Pengantaran yang sudah dibeli tetap
          menjadi tanggung jawab katerer.
        </p>
      )}
      {view === "packages" ? (
        <Packages state={s} />
      ) : view === "dishes" || view === "menus" ? (
        <MenuCalendar state={s} date={date} />
      ) : view === "customers" ? (
        <Customers state={s} />
      ) : view === "support" ? (
        <>
          <SupportQueue cases={s.cases} />
          <Messages />
        </>
      ) : view === "transactions" ? (
        <>
          <section className="panel">
            <h2>Riwayat pembelian</h2>
            <TransactionRows rows={s.transactions} />
          </section>
          <section className="panel spaced">
            <h2>Pencairan</h2>
            <p>
              Pencairan ditinjau dan disetujui Catera. Dana dalam sengketa
              ditahan.
            </p>
            {s.payouts.map((p) => (
              <div className="queue-row" key={p.id}>
                <strong>{currency(p.amount)}</strong>
                <Status status={p.status} />
              </div>
            ))}
            {!s.payouts.length && (
              <p className="quiet-empty">Belum ada pencairan.</p>
            )}
          </section>
        </>
      ) : (
        <SellerSettings state={s} />
      )}
    </>
  );
}

function Packages({ state: s }: { state: SellerState }) {
  const { actor } = useApp();
  const [editing, setEditing] = useState<Offer | null | undefined>();
  return (
    <>
      <div className="section-heading">
        <p>Harga dan aturan baru berlaku untuk pembelian berikutnya.</p>
        {actor?.role === "owner" && (
          <Button className="button" onClick={() => setEditing(null)}>
            <Plus size={17} />
            Buat paket
          </Button>
        )}
      </div>
      <div className="seller-packages">
        {s.offers.map((o) => (
          <article className="panel" key={o.id}>
            {o.image ? (
              <img src={o.image} alt={o.name} />
            ) : (
              <div className="package-image-placeholder">
                Foto belum ditambahkan
              </div>
            )}
            <div>
              <Status status={o.status} />
              <h2>{o.name || "Draf tanpa nama"}</h2>
              <p>
                {o.days} hari · {mealLabel(o.meal)} ·{" "}
                {o.flexible ? "Fleksibel" : "Tetap"}
              </p>
              <strong>
                {currency(o.price)} <small>/ porsi / hari</small>
              </strong>
            </div>
            {actor?.role === "owner" && (
              <Button
                className="button secondary small"
                onClick={() => setEditing(o)}
              >
                Kelola paket <ArrowRight size={16} />
              </Button>
            )}
          </article>
        ))}
      </div>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => {
          if (!o) setEditing(undefined);
        }}
        title={editing ? "Kelola paket" : "Paket baru"}
      >
        <OfferEditor
          key={editing?.id || "new"}
          offer={editing}
          caterer={s.caterer}
          catererId={s.caterer.id}
          done={() => setEditing(undefined)}
        />
      </Dialog>
    </>
  );
}
const blankOffer = {
  name: "",
  description: "",
  price: 35000,
  days: 5,
  meal: "lunch" as const,
  weekdays: [1, 2, 3, 4, 5],
  flexible: true,
  trialPrice: 35000,
  trialMax: 2,
  capacity: { "1": 100, "2": 100, "3": 100, "4": 100, "5": 100 } as Record<
    string,
    number
  >,
  tiers: [],
  windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
  tags: [],
  image: "",
  packageType: null as PackageType | null,
  menus: [] as MealMenu[],
  status: "draft",
};
function OfferEditor({
  offer,
  catererId,
  caterer,
  done,
}: {
  offer: Offer | null | undefined;
  catererId: string;
  caterer: Caterer;
  done: () => void;
}) {
  const { perform, demo, t } = useApp();
  const [step, setStep] = useState<OfferStep>("offer");
  const [pending, setPending] = useState(0),
    [savingDraft, setSavingDraft] = useState(false);
  const [issues, setIssues] = useState<EditorIssue[]>([]),
    [saveError, setSaveError] = useState("");
  const [preview, setPreview] = useState("card");
  const editor = useRef<HTMLDivElement>(null);
  const onBusyChange = (busy: boolean) =>
    setPending((n) => Math.max(0, n + (busy ? 1 : -1)));
  const [value, setValue] = useState(() => ({ ...blankOffer, ...offer, menus: (offer?.menus || []).map(compositionDraft) }));

  const set = (key: string, v: unknown) =>
    setValue((x) => ({ ...x, [key]: v }));
  const labels: Record<OfferStep, string> = {
    offer: t("Penawaran", "Offer"),
    contents: t("Isi paket & foto", "Contents & photos"),
    pricing: t("Harga", "Pricing"),
    schedule: t("Hari & waktu", "Schedule"),
    flexibility: t("Fleksibilitas", "Flexibility"),
    review: t("Tinjau", "Review"),
  };
  const activeValue = {
    ...value,
    capacity: withSharedCapacity(
      value.capacity,
      value.weekdays,
      sharedCapacityValue(value.capacity, value.weekdays),
    ),
    menus: value.menus.filter(
      (m) => value.meal === "both" || m.meal === value.meal,
    ),
  };
  const fieldError = (key: string) =>
    issues.find((i) => i.path === key || i.path.startsWith(key + "."))?.message;
  const showIssues = (found: EditorIssue[]) => {
    setIssues(found);
    if (found[0]) setStep(found[0].step);
  };
  useEffect(() => {
    if (!issues.length) return;
    const container = editor.current;
    let target: HTMLElement | null | undefined;
    for (const issue of issues) {
      for (const key of [issue.path, issue.path.split(".")[0]]) {
        const field = container?.querySelector<HTMLElement>(
          '[data-editor-field="' + CSS.escape(key) + '"]',
        );
        target = field?.querySelector<HTMLElement>(
          'input, textarea, [role="combobox"]',
        );
        if (target) break;
      }
      if (target) break;
    }
    target ||=
      container?.querySelector<HTMLElement>('[data-dish-name][value=""]') ||
      container?.querySelector<HTMLElement>("[data-editor-errors]");
    const disclosure = target?.closest("details");
    if (disclosure) disclosure.open = true;
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  }, [issues, step]);
  const navigate = (next: OfferStep) => {
    if (pending || savingDraft) return false;
    if (offerSteps.indexOf(next) > offerSteps.indexOf(step)) {
      const found = offerEditorIssues(activeValue).filter(
        (i) => offerSteps.indexOf(i.step) < offerSteps.indexOf(next),
      );
      if (found.length) {
        showIssues(found);
        return false;
      }
    }
    setIssues([]);
    setStep(next);
    return true;
  };
  const save = async (draft: boolean) => {
    if (pending) return;
    const found = offerEditorIssues(activeValue, draft);
    if (found.length) {
      showIssues(found);
      return;
    }
    await perform("package.save", {
      catererId,
      id: offer?.id,
      version: offer?.version,
      slug:
        offer?.slug ||
        (value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "draf") +
          "-" +
          crypto.randomUUID().slice(0, 6),
      offer: { ...activeValue, status: draft ? "draft" : value.status },
    });
    done();
  };
  const previewOffer: Offer = {
    id: "preview",
    slug: "preview",
    catererId,
    caterer: caterer.name,
    catererSlug: caterer.slug,
    areas: caterer.area,
    cutoff: caterer.cutoff,
    timezone: caterer.timezone,
    rating: null,
    reviewCount: 0,
    sellerStatus: caterer.status,
    version: 0,
    ...offer,
    ...activeValue,
  };
  return (
    <div ref={editor} className="offer-editor">
      <div
        className="editor-progress"
        aria-label={t("Langkah paket", "Package steps")}
      >
        {offerSteps.map((i, order) => (
          <Button
            type="button"
            key={i}
            className={i === step ? "selected" : ""}
            disabled={pending > 0 || savingDraft}
            aria-current={i === step ? "step" : undefined}
            onClick={() => navigate(i)}
          >
            {order + 1}. {labels[i]}
          </Button>
        ))}
      </div>
      <ActionForm
        noValidate
        disabled={pending > 0 || savingDraft}
        submit={
          step !== "review"
            ? t("Lanjutkan", "Continue")
            : t("Simpan paket", "Save package")
        }
        onSubmit={async () => {
          if (step !== "review") {
            navigate(offerSteps[offerSteps.indexOf(step) + 1]);
            return;
          }
          await save(value.status === "draft");
        }}
      >
        {!!issues.length && (
          <div
            className="error-notice"
            role="alert"
            tabIndex={-1}
            data-editor-errors
          >
            <strong>
              {t(
                "Lengkapi isian sebelum melanjutkan",
                "Complete the fields before continuing",
              )}
            </strong>
            <ul>
              {issues
                .filter((i) => i.step === step)
                .map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
            </ul>
          </div>
        )}
        {step === "offer" ? (
          <>
            <Field
              fieldKey="packageType"
              error={fieldError("packageType")}
              label={t("Jenis paket", "Package type")}
            >
              <Select
                value={value.packageType || ""}
                onValueChange={(selected) => set("packageType", selected)}
              >
                <SelectOption value="" disabled>
                  {t("Pilih jenis paket", "Choose package type")}
                </SelectOption>
                <SelectOption value="ala_carte">À la carte</SelectOption>
                <SelectOption value="nasi_box">Nasi box</SelectOption>
              </Select>
            </Field>
            <Field
              fieldKey="name"
              error={fieldError("name")}
              label="Nama paket"
            >
              <TextInput
                required
                minLength={3}
                maxLength={100}
                value={value.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field
              fieldKey="description"
              error={fieldError("description")}
              label="Cerita paket"
            >
              <TextArea
                required
                minLength={10}
                maxLength={1500}
                value={value.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field
              fieldKey="meal"
              error={fieldError("meal")}
              label="Waktu makan"
            >
              <Select
                value={value.meal}
                onValueChange={(value) => set("meal", value)}
              >
                <SelectOption value="lunch">Makan siang</SelectOption>
                <SelectOption value="dinner">Makan malam</SelectOption>
                <SelectOption value="both">Makan siang + malam</SelectOption>
              </Select>
            </Field>
            <Field
              fieldKey="days"
              error={fieldError("days")}
              label="Durasi pengantaran (hari)"
            >
              <NumericInput
                min={1}
                max={60}
                required
                value={value.days}
                onValueChange={(next) => set("days", next)}
              />
            </Field>
          </>
        ) : step === "pricing" ? (
          <>
            <Field
              fieldKey="price"
              error={fieldError("price")}
              label="Harga per porsi / hari (pengantaran termasuk)"
            >
              <NumericInput
                min={1000}
                required
                value={value.price}
                onValueChange={(next) => set("price", next)}
              />
            </Field>
            <p>
              Untuk siang + malam, harga ini sudah mencakup kedua makanan per
              porsi per hari.
            </p>
            <Field
              fieldKey="tiers"
              error={fieldError("tiers")}
              label="Diskon kuantitas"
            >
              <Select
                value={value.tiers.length ? "yes" : "no"}
                onValueChange={(value) =>
                  set("tiers", value === "yes" ? [{ min: 3, percent: 5 }] : [])
                }
              >
                <SelectOption value="no">Tanpa diskon</SelectOption>
                <SelectOption value="yes">
                  Gunakan tingkatan diskon
                </SelectOption>
              </Select>
            </Field>
            {value.tiers.map((tier, i) => (
              <div className="form-row" key={i}>
                <Field
                  fieldKey="tiers"
                  error={fieldError("tiers")}
                  label="Mulai porsi"
                >
                  <NumericInput
                    min={1}
                    value={tier.min}
                    onValueChange={(next) =>
                      set(
                        "tiers",
                        value.tiers.map((t, n) =>
                          n === i ? { ...t, min: next } : t,
                        ),
                      )
                    }
                  />
                </Field>
                <Field
                  fieldKey="tiers"
                  error={fieldError("tiers")}
                  label="Diskon (%)"
                >
                  <NumericInput
                    min={0}
                    max={90}
                    value={tier.percent}
                    onValueChange={(next) =>
                      set(
                        "tiers",
                        value.tiers.map((t, n) =>
                          n === i ? { ...t, percent: next } : t,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
            {value.tiers.length > 0 && (
              <Button
                type="button"
                className="text-button"
                onClick={() =>
                  set("tiers", [...value.tiers, { min: 5, percent: 10 }])
                }
              >
                Tambah tingkatan
              </Button>
            )}
          </>
        ) : step === "schedule" ? (
          <>
            <fieldset data-editor-field="weekdays">
              <legend>Hari operasional</legend>
              <div className="weekday-checks">
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(
                  (d, i) => (
                    <label key={d}>
                      <Checkbox
                        checked={value.weekdays.includes(i)}
                        onChange={(e) =>
                          setValue((current) => {
                            const weekdays = e.target.checked
                              ? [...current.weekdays, i].sort((a, b) => a - b)
                              : current.weekdays.filter((x) => x !== i);
                            return {
                              ...current,
                              weekdays,
                              capacity: withSharedCapacity(
                                current.capacity,
                                weekdays,
                                sharedCapacityValue(
                                  current.capacity,
                                  current.weekdays,
                                ),
                              ),
                            };
                          })
                        }
                      />
                      {d}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <div className="form-row">
              {["lunch", "dinner"].map((m) => (
                <Field
                  fieldKey={"windows." + m}
                  error={fieldError("windows." + m)}
                  key={m}
                  label={mealLabel(m)}
                >
                  <TextInput
                    required
                    value={value.windows[m as "lunch" | "dinner"]}
                    onChange={(e) =>
                      set("windows", { ...value.windows, [m]: e.target.value })
                    }
                  />
                </Field>
                ))}
            </div>
            <Field
              fieldKey="capacity"
              error={fieldError("capacity")}
              label={t("Kapasitas porsi per hari", "Portions per operating day")}
            >
              <NumericInput
                min={0}
                required
                value={sharedCapacityValue(value.capacity, value.weekdays)}
                onValueChange={(next) =>
                  set(
                    "capacity",
                    withSharedCapacity(value.capacity, value.weekdays, next),
                  )
                }
              />
            </Field>
            <p className="notice">
              {t(
                "Kapasitas ini berlaku sama untuk setiap hari operasional yang dipilih.",
                "This capacity applies equally to every selected operating day.",
              )}
            </p>
          </>
        ) : step === "flexibility" ? (
          <>
            <Field
              fieldKey="flexible"
              error={fieldError("flexible")}
              label="Perubahan jadwal"
            >
              <Select
                value={String(value.flexible)}
                onValueChange={(value) => set("flexible", value === "true")}
              >
                <SelectOption value="true">
                  Paket fleksibel · boleh ganti tanggal sebelum cutoff
                </SelectOption>
                <SelectOption value="false">
                  Paket tetap · tanggal tidak dapat dipindah
                </SelectOption>
              </Select>
            </Field>
            <Field
              fieldKey="trialPrice"
              error={fieldError("trialPrice")}
              label="Trial satu hari"
            >
              <Select
                value={value.trialPrice === null ? "no" : "yes"}
                onValueChange={(selected) =>
                  set("trialPrice", selected === "yes" ? value.price : null)
                }
              >
                <SelectOption value="yes">Tersedia</SelectOption>
                <SelectOption value="no">Tidak tersedia</SelectOption>
              </Select>
            </Field>
            {value.trialPrice !== null && (
              <div className="form-row">
                <Field
                  fieldKey="trialPrice"
                  error={fieldError("trialPrice")}
                  label="Harga trial per porsi"
                >
                  <NumericInput
                    min={1000}
                    required
                    value={value.trialPrice}
                    onValueChange={(next) => set("trialPrice", next)}
                  />
                </Field>
                <Field
                  fieldKey="trialMax"
                  error={fieldError("trialMax")}
                  label="Maksimum porsi trial"
                >
                  <NumericInput
                    min={1}
                    value={value.trialMax || 1}
                    onValueChange={(next) => set("trialMax", next)}
                  />
                </Field>
              </div>
            )}
            <p className="notice">
              Satu trial berhasil dibeli per pelanggan per katerer. Semua
              pembatalan masuk peninjauan bantuan.
            </p>
          </>
        ) : step === "contents" ? (
          <>
            <div data-editor-field="image">
              <PhotoUpload
                label={t("Foto paket", "Package photo")}
                value={value.image}
                onChange={(image) => set("image", image)}
                onBusyChange={onBusyChange}
              />
              {fieldError("image") && (
                <p className="field-error">{fieldError("image")}</p>
              )}
            </div>
            {demo && (
              <Button
                type="button"
                className="text-button"
                onClick={() => set("image", "/assets/food/ayam-panggang.png")}
              >
                Gunakan foto sintetis demo
              </Button>
            )}
            <Field
              fieldKey="tags"
              error={fieldError("tags")}
              label="Kategori (pisahkan koma)"
            >
              <TextInput
                value={value.tags.join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value.split(",").map((x) => x.trim()),
                  )
                }
              />
            </Field>
            {offer && offer.menus.some(m => m.contentModel !== "slots") && <p role="note">{t("Versi baru: tinjau kategori dan jumlah slot. Menu dan pembelian versi lama tetap tersimpan.", "New revision: review categories and slot counts. Previous menus and purchases stay intact.")}</p>}
            {!value.packageType ? (
              <p>
                {t(
                  "Pilih jenis paket pada langkah Penawaran.",
                  "Choose a package type in Offer.",
                )}
              </p>
            ) : (
              (value.meal === "both" ? ["lunch", "dinner"] : [value.meal]).map(
                (meal) => (
                  <CompositionEditor
                    key={meal}
                    menu={
                      value.menus.find((m) => m.meal === meal) || {
                        meal,
                        name: "",
                        description: "",
                        image: "",
                        items: [],
                        composition: [],
                      }
                    }
                    onChange={(menu) =>
                      set("menus", [
                        ...value.menus.filter((m) => m.meal !== meal),
                        menu,
                      ])
                    }
                  />
                ),
              )
            )}
            <h3>{t("Akan dilihat pelanggan", "Customer preview")}</h3>
            <PackageContents
              offer={{
                ...value,
                menus: value.menus.filter(
                  (m) => value.meal === "both" || m.meal === value.meal,
                ),
              }}
            />
          </>
        ) : (
          <>
            <h3>{t("Pratinjau pelanggan", "Customer preview")}</h3>
            <p>
              {t(
                "Tampilan menggunakan isian Anda saat ini. Tindakan pembelian dinonaktifkan dalam pratinjau.",
                "This preview uses your current entries. Purchase actions are disabled here.",
              )}
            </p>
            <div className="preview-tabs">
              <Button
                type="button"
                className={"button " + (preview === "card" ? "" : "secondary")}
                onClick={() => setPreview("card")}
              >
                {t("Kartu penelusuran", "Discovery card")}
              </Button>
              <Button
                type="button"
                className={
                  "button " + (preview === "detail" ? "" : "secondary")
                }
                onClick={() => setPreview("detail")}
              >
                {t("Detail paket", "Package details")}
              </Button>
            </div>
            <div className={"listing-preview " + preview}>
              {preview === "card" ? (
                <PackageCard offer={previewOffer} preview />
              ) : (
                <PackagePage
                  slug={previewOffer.slug}
                  offer={previewOffer}
                  preview
                />
              )}
            </div>
            <Field label="Status penawaran">
              <Select
                value={value.status}
                onValueChange={(value) => set("status", value)}
              >
                <SelectOption value="draft">Simpan draf</SelectOption>
                <SelectOption value="published">
                  Tayangkan setelah verifikasi katerer
                </SelectOption>
                <SelectOption value="paused">Jeda penjualan baru</SelectOption>
                <SelectOption value="retired">Arsipkan</SelectOption>
              </Select>
            </Field>
          </>
        )}
        {step !== "offer" && (
          <Button
            className="text-button"
            type="button"
            onClick={() => navigate(offerSteps[offerSteps.indexOf(step) - 1])}
          >
            Kembali
          </Button>
        )}
      </ActionForm>
      {saveError && <ErrorNotice message={saveError} />}
      <Button
        type="button"
        className="text-button"
        disabled={pending > 0 || savingDraft}
        onClick={async () => {
          setSavingDraft(true);
          setSaveError("");
          try {
            await save(true);
          } catch {
            setSaveError(
              t(
                "Draf belum tersimpan. Muat ulang jika data telah berubah, lalu coba lagi.",
                "Draft could not be saved. Reload if data changed, then retry.",
              ),
            );
          } finally {
            setSavingDraft(false);
          }
        }}
      >
        {savingDraft
          ? t("Menyimpan…", "Saving…")
          : t("Simpan draf", "Save draft")}
      </Button>
    </div>
  );
}
function Customers({ state: s }: { state: SellerState }) {
  const [showImport, setShowImport] = useState(false);
  const { actor } = useApp();
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>Hubungan pelanggan</h2>
          {actor?.role === "owner" && (
            <Button
              className="button secondary small"
              onClick={() => setShowImport(true)}
            >
              Impor langganan prabayar
            </Button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Akuisisi awal</th>
                <th>Identitas akun</th>
              </tr>
            </thead>
            <tbody>
              {s.customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.source}</td>
                  <td>
                    <code>{c.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialog
        open={showImport}
        onOpenChange={setShowImport}
        title="Impor langganan prabayar"
      >
        <ImportForm
          catererId={s.caterer.id}
          done={() => setShowImport(false)}
        />
      </Dialog>
    </>
  );
}
function ImportForm({
  catererId,
  done,
}: {
  catererId: string;
  done: () => void;
}) {
  const { perform } = useApp();
  const [preview, setPreview] = useState<{
    id: string;
    rows: unknown[];
  } | null>(null);
  return (
    <ActionForm
      submit={preview ? "Konfirmasi impor" : "Periksa & buat pratinjau"}
      onSubmit={async (f) => {
        if (preview) {
          await perform("import.commit", { catererId, id: preview.id });
          done();
        } else {
          const rows = JSON.parse(String(f.get("rows")));
          setPreview(await perform("import.preview", { catererId, rows }));
        }
      }}
    >
      {!preview ? (
        <>
          <p>
            Hanya langganan yang sudah dibayar di luar Catera. Pelanggan harus
            memiliki akun dan alamat. Impor tidak menagih pembayaran baru.
          </p>
          <Field label="Data JSON (maksimal 100 baris)">
            <TextArea
              className="code-input"
              name="rows"
              required
              placeholder={
                '[{"customerId":"…","packageId":"…","addressId":"…","portions":1,"startDate":"2026-10-01","remainingDays":3,"externalReference":"receipt-verified"}]'
              }
            />
          </Field>
        </>
      ) : (
        <>
          <p>
            {preview.rows.length} langganan akan dibuat. Semua tanggal dan
            kapasitas diperiksa kembali saat konfirmasi.
          </p>
          <pre>{JSON.stringify(preview.rows, null, 2)}</pre>
          <label className="checkbox">
            <Checkbox required />
            Saya telah memverifikasi pembayaran dan hak pengantaran ini.
          </label>
          <Button
            type="button"
            className="text-button"
            onClick={() => setPreview(null)}
          >
            Perbaiki data
          </Button>
        </>
      )}
    </ActionForm>
  );
}
export function SupportQueue({
  cases,
  admin = false,
}: {
  cases: SupportCase[];
  admin?: boolean;
}) {
  const { perform } = useApp();
  const [selected, setSelected] = useState("");
  const c = cases.find((c) => c.id === selected);
  return (
    <section className="panel">
      <h2>{admin ? "Permintaan & keputusan" : "Permintaan bantuan"}</h2>
      <div className="master-detail">
        <div>
          {cases.map((x) => (
            <Button
              key={x.id}
              className={"queue-row " + (selected === x.id ? "selected" : "")}
              onClick={() => setSelected(x.id)}
            >
              <span>
                <strong>{x.subject}</strong>
                <small>
                  {new Date(x.created_at).toLocaleDateString("id-ID")}
                </small>
              </span>
              <Status status={x.status} />
            </Button>
          ))}
          {!cases.length && (
            <p className="quiet-empty">Belum ada permintaan bantuan.</p>
          )}
        </div>
        {c && (
          <div className="support-decision">
            <h3>{c.subject}</h3>
            <p>{c.description}</p>
            <p className="muted">Kasus {c.id}</p>
            {c.resolution && (
              <div className="support-response">
                {c.resolution}
                {!!c.amount && <strong>{currency(c.amount)}</strong>}
              </div>
            )}
            {c.status !== "resolved" &&
              (admin ? (
                <ActionForm
                  submit="Simpan keputusan keuangan"
                  onSubmit={async (f) => {
                    await perform("support.resolve", {
                      id: c.id,
                      reason: f.get("reason"),
                      amount: Number(f.get("amount")),
                      cancelRemaining: f.get("cancelRemaining") === "on",
                    });
                    setSelected("");
                  }}
                >
                  <Field label="Alasan keputusan">
                    <TextArea name="reason" minLength={5} required />
                  </Field>
                  <Field label="Jumlah refund (Rp)">
                    <NumericInput
                      name="amount"
                      min={0}
                      required
                      defaultValue={0}
                    />
                  </Field>
                  <label className="checkbox">
                    <Checkbox name="cancelRemaining" />
                    Batalkan sisa pengantaran dan lepaskan pemesanan
                  </label>
                  <p className="notice">
                    Refund diproses terpisah dari keputusan. Biaya split
                    memerlukan rekonsiliasi eksplisit.
                  </p>
                </ActionForm>
              ) : (
                <>
                  <ActionForm
                    submit="Kirim tanggapan"
                    onSubmit={async (f) => {
                      await perform("support.respond", {
                        id: c.id,
                        response: f.get("response"),
                      });
                    }}
                  >
                    <Field label="Tanggapan katerer">
                      <TextArea name="response" required minLength={5} />
                    </Field>
                  </ActionForm>
                  <ActionForm
                    submit="Eskalasi ke Catera"
                    onSubmit={async () => {
                      await perform("support.escalate", { id: c.id });
                    }}
                  >
                    <p>
                      Keputusan refund dan pembatalan keuangan dilakukan oleh
                      Catera.
                    </p>
                  </ActionForm>
                </>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
export function TransactionRows({
  rows,
}: {
  rows: SellerState["transactions"];
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pembelian</th>
            <th>Porsi × hari</th>
            <th>Total pelanggan</th>
            <th>Status</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.quote.offer.name}</strong>
                <small>
                  {c.quote.trial ? "Trial · " : ""}
                  {c.id.slice(0, 8)}
                </small>
              </td>
              <td>
                {c.quote.portions} × {c.quote.dates.length}
              </td>
              <td>
                {currency(c.quote.total)}
                <small>Biaya layanan {currency(c.quote.serviceFee)}</small>
              </td>
              <td>
                <Status status={c.state} />
              </td>
              <td>{new Date(c.created_at).toLocaleDateString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="quiet-empty">Belum ada pembelian.</p>
  );
}
function SellerSettings({ state: s }: { state: SellerState }) {
  const { perform } = useApp();
  const [invite, setInvite] = useState("");
  return (
    <div className="ops-two-col">
      <section className="panel">
        <h2>Profil & pengantaran</h2>
        <ActionForm
          onSubmit={async (f) => {
            await perform("seller.save", {
              catererId: s.caterer.id,
              version: s.caterer.version,
              name: f.get("name"),
              description: f.get("description"),
              areas: f.getAll("areas"),
              cutoff: f.get("cutoff"),
            });
          }}
        >
          <Field label="Nama katerer">
            <TextInput name="name" required defaultValue={s.caterer.name} />
          </Field>
          <Field label="Tentang katerer">
            <TextArea
              name="description"
              required
              defaultValue={s.caterer.description}
            />
          </Field>
          <fieldset>
            <legend>Area pengantaran</legend>
            {areaOptions.map((a) => (
              <label className="checkbox" key={a}>
                <Checkbox
                  name="areas"
                  value={a}
                  defaultChecked={s.caterer.area.includes(a)}
                />
                {a}
              </label>
            ))}
          </fieldset>
          <Field label="Cutoff sehari sebelumnya">
            <TimeInput
              name="cutoff"
              required
              defaultValue={s.caterer.cutoff.slice(0, 5)}
            />
          </Field>
          <p>{s.caterer.timezone}</p>
        </ActionForm>
      </section>
      <section className="panel">
        <h2>Verifikasi</h2>
        <Status status={s.caterer.status} />
        {s.caterer.review_note && (
          <p className="notice">{s.caterer.review_note}</p>
        )}
        <p>
          Lengkapi profil dan setidaknya satu draf paket sebelum mengajukan
          peninjauan.
        </p>
        {["draft", "corrections"].includes(s.caterer.status) && (
          <ActionForm
            submit="Ajukan verifikasi"
            onSubmit={async () => {
              await perform("seller.submit", { catererId: s.caterer.id });
            }}
          >
            <span />
          </ActionForm>
        )}
        <h2 className="spaced">Tim katerer</h2>
        {s.staff.map((st) => (
          <div className="queue-row" key={st.user_id}>
            <span>{st.name}</span>
            <small>{st.role}</small>
          </div>
        ))}
        <ActionForm
          submit="Buat undangan staf"
          onSubmit={async () => {
            const r = await perform<{ code: string }>("staff.invite", {
              catererId: s.caterer.id,
            });
            setInvite(r.code);
          }}
        >
          <p>
            Staf menangani operasi. Akses keuangan dan pengaturan dibatasi untuk
            pemilik.
          </p>
        </ActionForm>
        {invite && (
          <div className="notice">
            Bagikan kode kepada staf yang dimaksud: <code>{invite}</code>
          </div>
        )}
      </section>
    </div>
  );
}
export function Onboarding() {
  const { actor, perform } = useApp();
  return (
    <div className="content narrow-wide">
      <Heading
        title="Makanan dari dapurmu. Hari baik untuk banyak orang."
        description="Bangun langganan yang berulang dengan ritme dapur yang kamu tentukan."
      />
      {!actor ? (
        <>
          <img
            className="onboarding-art"
            src="/assets/welcome.png"
            alt="Ilustrasi kotak makanan Catera"
          />
          <Link className="button" href="/login?next=/seller/onboarding">
            Masuk untuk menjadi mitra <ArrowRight size={18} />
          </Link>
        </>
      ) : actor.catererId ? (
        <div className="panel">
          <h2>Ruang katerermu siap dilengkapi.</h2>
          <Link className="button" href="/seller/packages">
            Siapkan paket pertama <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <section className="panel">
          <ActionForm
            submit="Buat profil katerer"
            onSubmit={async (f) => {
              await perform("seller.create", {
                name: f.get("name"),
                slug: String(f.get("slug")).toLowerCase(),
                description: f.get("description"),
                areas: f.getAll("areas"),
              });
              location.assign("/seller/packages");
            }}
          >
            <Field label="Nama katerer">
              <TextInput name="name" required minLength={3} />
            </Field>
            <Field label="Alamat halaman katerer">
              <TextInput
                name="slug"
                required
                pattern="[a-z0-9-]+"
                placeholder="dapur-kamu"
              />
            </Field>
            <Field label="Tentang makananmu">
              <TextArea name="description" required minLength={10} />
            </Field>
            <fieldset>
              <legend>Area pengantaran</legend>
              {areaOptions.map((a) => (
                <label className="checkbox" key={a}>
                  <Checkbox name="areas" value={a} />
                  {a}
                </label>
              ))}
            </fieldset>
            <p className="notice">
              Profil dimulai sebagai draf. Catera meninjau profil dan paket
              sebelum penjualan dibuka.
            </p>
          </ActionForm>
          <details className="spaced">
            <summary>Saya diundang sebagai staf</summary>
            <ActionForm
              submit="Terima undangan"
              onSubmit={async (f) => {
                await perform("invite.accept", { code: f.get("code") });
                location.assign("/seller");
              }}
            >
              <Field label="Kode undangan">
                <TextInput required name="code" />
              </Field>
            </ActionForm>
          </details>
        </section>
      )}
    </div>
  );
}
