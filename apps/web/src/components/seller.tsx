"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  Clock,
  Truck,
  Package,
  Download,
  Printer,
  CalendarDays,
  Check,
  ChevronRight,
  Users,
} from "lucide-react";
import {
  currency,
  localDay,
  mealLabel,
  areaOptions,
  type SellerState,
  type Offer,
  type Delivery,
  type SupportCase,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import {
  Heading,
  Status,
  Loading,
  ErrorNotice,
  Empty,
  ActionForm,
  Field,
  Dialog,
  Facts,
} from "./ui";
import { Messages } from "./customer";

export function Seller({ view }: { view: string }) {
  const { actor, t } = useApp();
  const query = useSearchParams();
  const router = useRouter();
  const date = query.get("date") || localDay();
  const meal = query.get("meal") || "all";
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
  const rows = s.deliveries.filter(
    (d) => meal === "all" || d.meals.some((m) => m.meal === meal),
  );
  const context = "?date=" + date + "&meal=" + meal;
  const dateControls = (
    <div className="ops-date">
      <CalendarDays size={18} />
      <input
        type="date"
        aria-label="Tanggal operasional"
        value={date}
        onChange={(e) =>
          router.replace(
            "/seller/" +
              (view === "today" ? "" : view) +
              "?date=" +
              e.target.value +
              "&meal=" +
              meal,
          )
        }
      />
      <select
        aria-label="Waktu makan"
        value={meal}
        onChange={(e) =>
          router.replace(
            "/seller/" +
              (view === "today" ? "" : view) +
              "?date=" +
              date +
              "&meal=" +
              e.target.value,
          )
        }
      >
        <option value="all">Siang & malam</option>
        <option value="lunch">Makan siang</option>
        <option value="dinner">Makan malam</option>
      </select>
    </div>
  );
  const operational = ["today", "schedule", "production", "delivery"].includes(
    view,
  );
  return (
    <>
      <Heading
        title={
          view === "today"
            ? t(
                "Selamat berkarya, " + s.caterer.name + ".",
                "A good day at " + s.caterer.name + ".",
              )
            : {
                schedule: "Jadwal pengantaran",
                production: "Siapkan dengan tepat.",
                delivery: "Sampai dengan baik.",
                packages: "Paket dari dapurmu.",
                menus: "Menu yang dinanti.",
                capacity: "Ruang untuk setiap porsi.",
                customers: "Pelanggan",
                support: "Pesan & bantuan",
                transactions: "Transaksi & pencairan",
                settings: "Pengaturan katerer",
              }[view] || view
        }
        description={
          view === "today"
            ? "Semua yang perlu disiapkan, dalam satu pandangan."
            : s.caterer.name
        }
      >
        {operational && dateControls}
      </Heading>
      {s.caterer.status !== "approved" && (
        <p className="notice">
          Status verifikasi: <Status status={s.caterer.status} /> · Penjualan
          baru tersedia setelah disetujui. Pengantaran yang sudah dibeli tetap
          menjadi tanggung jawab katerer.
        </p>
      )}
      {operational && (
        <>
          <div className="ops-metrics">
            {[
              [
                ChefHat,
                "Porsi hari ini",
                rows
                  .filter((d) => d.status !== "cancelled")
                  .reduce(
                    (n, d) =>
                      n + d.portions * (meal === "all" ? d.meals.length : 1),
                    0,
                  ),
                "Termasuk porsi trial",
              ],
              [Package, "Pengantaran", rows.length, "Jadwal " + date],
              [
                Clock,
                "Batas perubahan",
                s.caterer.cutoff.slice(0, 5),
                s.caterer.timezone,
              ],
              [
                Truck,
                "Perlu perhatian",
                rows.filter((d) => d.status === "issue").length +
                  s.cases.filter((c) => c.status !== "resolved").length,
                "Pengantaran & bantuan",
              ],
            ].map(([Icon, label, value, caption]) => {
              const I = Icon as typeof ChefHat;
              return (
                <div key={label as string}>
                  <I size={21} />
                  <span>{label as string}</span>
                  <strong>{value as string | number}</strong>
                  <small>{caption as string}</small>
                </div>
              );
            })}
          </div>
          <nav className="workflow-tabs">
            {[
              ["schedule", "Jadwal", CalendarDays],
              ["production", "Produksi", ChefHat],
              ["delivery", "Pengiriman", Truck],
            ].map(([key, label, Icon], i) => {
              const I = Icon as typeof ChefHat;
              return (
                <Link
                  className={view === key ? "selected" : ""}
                  href={"/seller/" + key + context}
                  key={key as string}
                >
                  <span>{i + 1}</span>
                  <I size={18} />
                  {label as string}
                  <ChevronRight size={17} />
                </Link>
              );
            })}
          </nav>
        </>
      )}
      {view === "today" ? (
        <>
          <div className="ops-two-col">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Keluar dari dapur hari ini</h2>
                  <p>Porsi yang sudah dibayar dan perlu disiapkan.</p>
                </div>
                <Link
                  className="text-button"
                  href={"/seller/production" + context}
                >
                  Lihat produksi <ArrowUpRight size={17} />
                </Link>
              </div>
              <ProductionRows deliveries={rows} meal={meal} />
            </section>
            <section className="panel">
              <h2>Perlu ditindaklanjuti</h2>
              {s.cases
                .filter((c) => c.status !== "resolved")
                .map((c) => (
                  <Link className="queue-row" key={c.id} href="/seller/support">
                    <span>
                      <strong>{c.subject}</strong>
                      <small>{c.description}</small>
                    </span>
                    <Status status={c.status} />
                  </Link>
                ))}
              {!s.cases.some((c) => c.status !== "resolved") && (
                <div className="quiet-empty">
                  <Check size={25} />
                  <p>Semua permintaan sudah tertangani.</p>
                </div>
              )}
              <div className="soft-callout">
                <img src="/assets/mascot.png" alt="" />
                <p>
                  Persiapan yang tenang.
                  <br />
                  <strong>Makanan yang menyenangkan.</strong>
                </p>
              </div>
            </section>
          </div>
          <section className="panel spaced">
            <h2>Langganan & trial terbaru</h2>
            <TransactionRows rows={s.transactions.slice(0, 5)} />
          </section>
        </>
      ) : view === "schedule" || view === "delivery" ? (
        <Deliveries deliveries={rows} fulfillment={view === "delivery"} />
      ) : view === "production" ? (
        <Production deliveries={rows} meal={meal} date={date} />
      ) : view === "packages" ? (
        <Packages state={s} />
      ) : view === "menus" ? (
        <MenuEditor state={s} date={date} />
      ) : view === "capacity" ? (
        <Capacity state={s} date={date} />
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

function ProductionRows({
  deliveries,
  meal,
}: {
  deliveries: Delivery[];
  meal: string;
}) {
  const groups = new Map<
    string,
    {
      offer: Offer;
      meal: string;
      portions: number;
      trial: number;
      menu: string;
    }
  >();
  for (const d of deliveries.filter((d) => d.status !== "cancelled"))
    for (const m of d.meals.filter((m) => meal === "all" || m.meal === meal)) {
      const menu = d.offer.menus
        .filter((x) => x.meal === m.meal)
        .map((x) => x.name)
        .join(", ");
      const key = d.offer.id + m.meal + menu;
      const g = groups.get(key) || {
        offer: d.offer,
        meal: m.meal,
        portions: 0,
        trial: 0,
        menu,
      };
      g.portions += d.portions;
      if (d.trial) g.trial += d.portions;
      groups.set(key, g);
    }
  return groups.size ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Paket / menu</th>
            <th>Waktu makan</th>
            <th className="number">Porsi</th>
            <th className="number">Termasuk trial</th>
          </tr>
        </thead>
        <tbody>
          {[...groups].map(([key, g]) => (
            <tr key={key}>
              <td>
                <div className="table-product">
                  <img src={g.offer.image} alt="" />
                  <div>
                    <strong>{g.offer.name}</strong>
                    <small>{g.menu}</small>
                  </div>
                </div>
              </td>
              <td>{mealLabel(g.meal)}</td>
              <td className="number">
                <strong>{g.portions}</strong>
              </td>
              <td className="number">{g.trial}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Dapur belum punya jadwal hari ini"
      description="Pilih tanggal yang memiliki pengantaran untuk melihat kebutuhan produksi."
    />
  );
}
function Production({
  deliveries,
  meal,
  date,
}: {
  deliveries: Delivery[];
  meal: string;
  date: string;
}) {
  const { actor, perform } = useApp();
  const [revision, setRevision] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Daftar produksi · {date}</h2>
          <p>
            Jumlah di bawah mencakup trial. Paket siang + malam memiliki dua
            baris produksi.
          </p>
        </div>
        <button
          className="button secondary small"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Cetak
        </button>
      </div>
      <ProductionRows deliveries={deliveries} meal={meal} />
      <ActionForm
        submit="Simpan revisi & buat manifest"
        onSubmit={async () =>
          setRevision(
            await perform("production.freeze", {
              catererId: actor!.catererId,
              date,
            }),
          )
        }
      >
        <p className="notice">
          Setiap revisi menyimpan kondisi pesanan saat ini. Buat revisi baru
          jika jadwal berubah.
        </p>
      </ActionForm>
      {revision && (
        <a className="button spaced" href={"/api/manifests/" + revision.id}>
          <Download size={18} />
          Unduh CSV · revisi {revision.revision}
        </a>
      )}
    </section>
  );
}
function Deliveries({
  deliveries,
  fulfillment,
}: {
  deliveries: Delivery[];
  fulfillment: boolean;
}) {
  const { perform } = useApp();
  const [selected, setSelected] = useState(""),
    [selectedMeal, setSelectedMeal] = useState("lunch");
  const d = deliveries.find((d) => d.id === selected);
  const currentMeal =
    d?.meals.find((m) => m.meal === selectedMeal) || d?.meals[0];
  return (
    <div className={"master-detail " + (d ? "has-detail" : "")}>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Paket</th>
                <th>Tujuan</th>
                <th>Porsi</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((x) => (
                <tr key={x.id} className={d?.id === x.id ? "selected" : ""}>
                  <td>
                    <strong>{x.offer.name}</strong>
                    <small>
                      {mealLabel(x.offer.meal)}
                      {x.trial ? " · Trial" : ""}
                    </small>
                  </td>
                  <td>
                    {x.address.label}
                    <small>{x.address.area}</small>
                  </td>
                  <td>{x.portions}</td>
                  <td>
                    <Status status={x.status} />
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(x.id)}
                      aria-label={"Detail " + x.offer.name}
                    >
                      Detail <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!deliveries.length && (
          <Empty title="Tidak ada pengantaran pada tanggal ini" />
        )}
      </section>
      {d && (
        <aside className="panel detail-panel">
          <button className="text-button" onClick={() => setSelected("")}>
            Tutup detail
          </button>
          <img className="detail-food" src={d.offer.image} alt={d.offer.name} />
          <h2>{d.offer.name}</h2>
          <Facts
            rows={[
              ["Tanggal", d.service_date],
              ["Porsi", d.portions],
              ...d.meals.map(
                (m) =>
                  [
                    mealLabel(m.meal),
                    <Status key={m.meal} status={m.status} />,
                  ] as [string, React.ReactNode],
              ),
              ["Alamat", d.address.line + ", " + d.address.area],
              ["Catatan", d.address.instructions || "—"],
              [
                "Batas perubahan",
                new Date(d.cutoff_at).toLocaleString("id-ID"),
              ],
            ]}
          />
          {fulfillment && d.status !== "cancelled" && (
            <ActionForm
              submit="Perbarui pengantaran"
              disabled={currentMeal?.status === "delivered"}
              onSubmit={async (f) => {
                await perform("delivery.status", {
                  id: d.id,
                  version: d.version,
                  meal: currentMeal?.meal,
                  status: f.get("status"),
                });
              }}
            >
              {d.meals.length > 1 && (
                <Field label="Waktu makan">
                  <select
                    value={selectedMeal}
                    onChange={(e) => setSelectedMeal(e.target.value)}
                  >
                    {d.meals.map((m) => (
                      <option value={m.meal} key={m.meal}>
                        {mealLabel(m.meal)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Status berikutnya">
                <select
                  name="status"
                  key={currentMeal?.meal + ":" + currentMeal?.status}
                >
                  {(currentMeal?.status === "delivered"
                    ? ["delivered"]
                    : currentMeal?.status === "scheduled"
                      ? ["preparing"]
                      : currentMeal?.status === "preparing"
                        ? ["out_for_delivery"]
                        : currentMeal?.status === "out_for_delivery"
                          ? ["delivered", "issue"]
                          : ["out_for_delivery"]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s === "preparing"
                        ? "Mulai menyiapkan"
                        : s === "out_for_delivery"
                          ? "Dalam pengantaran"
                          : s === "delivered"
                            ? "Sudah diterima"
                            : "Ada kendala"}
                    </option>
                  ))}
                </select>
              </Field>
            </ActionForm>
          )}
          <Link className="button secondary spaced" href="/seller/support">
            Pesan & bantuan
          </Link>
        </aside>
      )}
    </div>
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
          <button className="button" onClick={() => setEditing(null)}>
            <Plus size={17} />
            Buat paket
          </button>
        )}
      </div>
      <div className="seller-packages">
        {s.offers.map((o) => (
          <article className="panel" key={o.id}>
            <img src={o.image} alt={o.name} />
            <div>
              <Status status={o.status} />
              <h2>{o.name}</h2>
              <p>
                {o.days} hari · {mealLabel(o.meal)} ·{" "}
                {o.flexible ? "Fleksibel" : "Tetap"}
              </p>
              <strong>
                {currency(o.price)} <small>/ porsi / hari</small>
              </strong>
            </div>
            {actor?.role === "owner" && (
              <button
                className="button secondary small"
                onClick={() => setEditing(o)}
              >
                Kelola paket <ArrowRight size={16} />
              </button>
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
  menus: [],
  status: "draft",
};
function OfferEditor({
  offer,
  catererId,
  done,
}: {
  offer: Offer | null | undefined;
  catererId: string;
  done: () => void;
}) {
  const { perform, demo } = useApp();
  const [step, setStep] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [value, setValue] = useState({ ...blankOffer, ...offer });
  const set = (key: string, v: unknown) =>
    setValue((x) => ({ ...x, [key]: v }));
  const labels = [
    "Penawaran",
    "Harga",
    "Hari & waktu",
    "Fleksibilitas",
    "Menu & foto",
    "Tinjau",
  ];
  return (
    <>
      <div className="editor-progress">
        {labels.map((l, i) => (
          <button
            type="button"
            key={l}
            className={i === step ? "selected" : ""}
            onClick={() => setStep(i)}
          >
            {i + 1}. {l}
          </button>
        ))}
      </div>
      <ActionForm
        submit={step < 5 ? "Lanjutkan" : "Simpan paket"}
        onSubmit={async () => {
          if (step < 5) {
            setStep(step + 1);
            return;
          }
          await perform("package.save", {
            catererId,
            id: offer?.id,
            version: offer?.version,
            slug:
              offer?.slug ||
              value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
                "-" +
                crypto.randomUUID().slice(0, 6),
            offer: value,
          });
          done();
        }}
      >
        {step === 0 ? (
          <>
            <Field label="Nama paket">
              <input
                required
                minLength={3}
                maxLength={100}
                value={value.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Cerita paket">
              <textarea
                required
                minLength={10}
                maxLength={1500}
                value={value.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field label="Waktu makan">
              <select
                value={value.meal}
                onChange={(e) => set("meal", e.target.value)}
              >
                <option value="lunch">Makan siang</option>
                <option value="dinner">Makan malam</option>
                <option value="both">Makan siang + malam</option>
              </select>
            </Field>
            <Field label="Durasi pengantaran (hari)">
              <input
                type="number"
                min={1}
                max={60}
                required
                value={value.days}
                onChange={(e) => set("days", Number(e.target.value))}
              />
            </Field>
          </>
        ) : step === 1 ? (
          <>
            <Field label="Harga per porsi / hari (pengantaran termasuk)">
              <input
                type="number"
                min={1000}
                required
                value={value.price}
                onChange={(e) => set("price", Number(e.target.value))}
              />
            </Field>
            <p>
              Untuk siang + malam, harga ini sudah mencakup kedua makanan per
              porsi per hari.
            </p>
            <Field label="Diskon kuantitas">
              <select
                value={value.tiers.length ? "yes" : "no"}
                onChange={(e) =>
                  set(
                    "tiers",
                    e.target.value === "yes" ? [{ min: 3, percent: 5 }] : [],
                  )
                }
              >
                <option value="no">Tanpa diskon</option>
                <option value="yes">Gunakan tingkatan diskon</option>
              </select>
            </Field>
            {value.tiers.map((tier, i) => (
              <div className="form-row" key={i}>
                <Field label="Mulai porsi">
                  <input
                    type="number"
                    min={1}
                    value={tier.min}
                    onChange={(e) =>
                      set(
                        "tiers",
                        value.tiers.map((t, n) =>
                          n === i ? { ...t, min: Number(e.target.value) } : t,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Diskon (%)">
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={tier.percent}
                    onChange={(e) =>
                      set(
                        "tiers",
                        value.tiers.map((t, n) =>
                          n === i
                            ? { ...t, percent: Number(e.target.value) }
                            : t,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
            {value.tiers.length > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  set("tiers", [...value.tiers, { min: 5, percent: 10 }])
                }
              >
                Tambah tingkatan
              </button>
            )}
          </>
        ) : step === 2 ? (
          <>
            <fieldset>
              <legend>Hari operasional</legend>
              <div className="weekday-checks">
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(
                  (d, i) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={value.weekdays.includes(i)}
                        onChange={(e) =>
                          set(
                            "weekdays",
                            e.target.checked
                              ? [...value.weekdays, i]
                              : value.weekdays.filter((x) => x !== i),
                          )
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
                <Field key={m} label={mealLabel(m)}>
                  <input
                    required
                    value={value.windows[m as "lunch" | "dinner"]}
                    onChange={(e) =>
                      set("windows", { ...value.windows, [m]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
            {value.weekdays.map((d) => (
              <Field
                key={d}
                label={
                  "Kapasitas porsi · " +
                  [
                    "Minggu",
                    "Senin",
                    "Selasa",
                    "Rabu",
                    "Kamis",
                    "Jumat",
                    "Sabtu",
                  ][d]
                }
              >
                <input
                  type="number"
                  min={0}
                  required
                  value={value.capacity[String(d)] || 0}
                  onChange={(e) =>
                    set("capacity", {
                      ...value.capacity,
                      [d]: Number(e.target.value),
                    })
                  }
                />
              </Field>
            ))}
          </>
        ) : step === 3 ? (
          <>
            <Field label="Perubahan jadwal">
              <select
                value={String(value.flexible)}
                onChange={(e) => set("flexible", e.target.value === "true")}
              >
                <option value="true">
                  Paket fleksibel · boleh ganti tanggal sebelum cutoff
                </option>
                <option value="false">
                  Paket tetap · tanggal tidak dapat dipindah
                </option>
              </select>
            </Field>
            <Field label="Trial satu hari">
              <select
                value={value.trialPrice === null ? "no" : "yes"}
                onChange={(e) =>
                  set(
                    "trialPrice",
                    e.target.value === "yes" ? value.price : null,
                  )
                }
              >
                <option value="yes">Tersedia</option>
                <option value="no">Tidak tersedia</option>
              </select>
            </Field>
            {value.trialPrice !== null && (
              <div className="form-row">
                <Field label="Harga trial per porsi">
                  <input
                    type="number"
                    min={1000}
                    required
                    value={value.trialPrice}
                    onChange={(e) => set("trialPrice", Number(e.target.value))}
                  />
                </Field>
                <Field label="Maksimum porsi trial">
                  <input
                    type="number"
                    min={1}
                    value={value.trialMax || 1}
                    onChange={(e) => set("trialMax", Number(e.target.value))}
                  />
                </Field>
              </div>
            )}
            <p className="notice">
              Satu trial berhasil dibeli per pelanggan per katerer. Semua
              pembatalan masuk peninjauan bantuan.
            </p>
          </>
        ) : step === 4 ? (
          <>
            <Field label="Unggah foto makanan">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadError("");
                  try {
                    const form = new FormData();
                    form.set("file", file);
                    const response = await fetch("/api/uploads", {
                      method: "POST",
                      body: form,
                    });
                    if (!response.ok) throw new Error(await response.text());
                    const r = await response.json();
                    set("image", r.data.url);
                  } catch (e) {
                    setUploadError((e as Error).message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </Field>
            {uploading && <p>Foto sedang diunggah…</p>}
            {uploadError && <ErrorNotice message={uploadError} />}
            <Field label="Foto makanan (URL milik katerer)">
              <input
                required
                type={demo ? "text" : "url"}
                value={value.image}
                placeholder={
                  demo ? "/assets/food/ayam-panggang.png" : "https://…"
                }
                onChange={(e) => set("image", e.target.value)}
              />
            </Field>
            {demo && (
              <button
                type="button"
                className="text-button"
                onClick={() => set("image", "/assets/food/ayam-panggang.png")}
              >
                Gunakan foto sintetis demo
              </button>
            )}
            <Field label="Kategori (pisahkan koma)">
              <input
                value={value.tags.join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value.split(",").map((x) => x.trim()),
                  )
                }
              />
            </Field>
            {(value.meal === "both" ? ["lunch", "dinner"] : [value.meal]).map(
              (m) => (
                <Field key={m} label={"Menu awal · " + mealLabel(m)}>
                  <input
                    required
                    value={value.menus.find((x) => x.meal === m)?.name || ""}
                    onChange={(e) =>
                      set("menus", [
                        ...value.menus.filter((x) => x.meal !== m),
                        {
                          name: e.target.value,
                          description: "",
                          meal: m,
                          image: value.image,
                        },
                      ])
                    }
                  />
                </Field>
              ),
            )}
          </>
        ) : (
          <>
            <Facts
              rows={[
                ["Paket", value.name],
                ["Durasi", value.days + " hari"],
                ["Waktu makan", mealLabel(value.meal)],
                ["Harga", currency(value.price) + "/ porsi / hari"],
                ["Pengantaran", "Termasuk"],
                ["Jadwal", value.flexible ? "Fleksibel" : "Tetap"],
                [
                  "Trial",
                  value.trialPrice === null
                    ? "Tidak tersedia"
                    : currency(value.trialPrice),
                ],
              ]}
            />
            <Field label="Status penawaran">
              <select
                value={value.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="draft">Simpan draf</option>
                <option value="published">
                  Tayangkan setelah verifikasi katerer
                </option>
                <option value="paused">Jeda penjualan baru</option>
                <option value="retired">Arsipkan</option>
              </select>
            </Field>
          </>
        )}
        {step > 0 && (
          <button
            className="text-button"
            type="button"
            onClick={() => setStep(step - 1)}
          >
            Kembali
          </button>
        )}
      </ActionForm>
    </>
  );
}
function MenuEditor({ state: s, date }: { state: SellerState; date: string }) {
  const { perform } = useApp();
  return (
    <section className="panel form-panel">
      <h2>Menu untuk tanggal tertentu</h2>
      <p>
        Perubahan menu tersampaikan kepada pelanggan dengan pengantaran pada
        tanggal ini.
      </p>
      <ActionForm
        onSubmit={async (f) => {
          await perform("menu.save", {
            catererId: s.caterer.id,
            packageId: f.get("packageId"),
            date: f.get("date"),
            meal: f.get("meal"),
            details: {
              name: f.get("name"),
              description: f.get("description"),
              image: f.get("image"),
            },
          });
        }}
      >
        <Field label="Paket">
          <select name="packageId">
            {s.offers.map((o) => (
              <option value={o.id} key={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Tanggal">
            <input type="date" name="date" defaultValue={date} required />
          </Field>
          <Field label="Waktu makan">
            <select name="meal">
              <option value="lunch">Makan siang</option>
              <option value="dinner">Makan malam</option>
            </select>
          </Field>
        </div>
        <Field label="Nama menu">
          <input name="name" required />
        </Field>
        <Field label="Isi menu / perubahan">
          <textarea name="description" required />
        </Field>
        <Field label="URL foto">
          <input name="image" />
        </Field>
      </ActionForm>
    </section>
  );
}
function Capacity({ state: s, date }: { state: SellerState; date: string }) {
  const { perform } = useApp();
  return (
    <section className="panel form-panel">
      <h2>Kapasitas & hari tutup</h2>
      <p>
        Satu slot adalah satu porsi. Paket siang + malam memakai kapasitas
        sekali per hari.
      </p>
      <ActionForm
        onSubmit={async (f) => {
          await perform("capacity.save", {
            catererId: s.caterer.id,
            packageId: f.get("packageId"),
            date: f.get("date"),
            slots: Number(f.get("slots")),
            closed: f.get("closed") === "on",
          });
        }}
      >
        <Field label="Paket">
          <select name="packageId">
            {s.offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal">
          <input type="date" name="date" defaultValue={date} required />
        </Field>
        <Field label="Kapasitas porsi">
          <input
            type="number"
            name="slots"
            min={0}
            required
            defaultValue={100}
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" name="closed" />
          Tutup penjualan pada tanggal ini
        </label>
        <p className="notice">
          Kapasitas tidak boleh di bawah pesanan yang sudah dijanjikan. Untuk
          menutup tanggal yang terisi, selesaikan perubahan atau pembatalan
          melalui bantuan lebih dulu.
        </p>
      </ActionForm>
    </section>
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
            <button
              className="button secondary small"
              onClick={() => setShowImport(true)}
            >
              Impor langganan prabayar
            </button>
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
            <textarea
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
            <input required type="checkbox" />
            Saya telah memverifikasi pembayaran dan hak pengantaran ini.
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() => setPreview(null)}
          >
            Perbaiki data
          </button>
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
            <button
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
            </button>
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
                    <textarea name="reason" minLength={5} required />
                  </Field>
                  <Field label="Jumlah refund (Rp)">
                    <input
                      type="number"
                      name="amount"
                      min={0}
                      required
                      defaultValue={0}
                    />
                  </Field>
                  <label className="checkbox">
                    <input name="cancelRemaining" type="checkbox" />
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
                      <textarea name="response" required minLength={5} />
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
            <input name="name" required defaultValue={s.caterer.name} />
          </Field>
          <Field label="Tentang katerer">
            <textarea
              name="description"
              required
              defaultValue={s.caterer.description}
            />
          </Field>
          <fieldset>
            <legend>Area pengantaran</legend>
            {areaOptions.map((a) => (
              <label className="checkbox" key={a}>
                <input
                  type="checkbox"
                  name="areas"
                  value={a}
                  defaultChecked={s.caterer.area.includes(a)}
                />
                {a}
              </label>
            ))}
          </fieldset>
          <Field label="Cutoff sehari sebelumnya">
            <input
              type="time"
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
              <input name="name" required minLength={3} />
            </Field>
            <Field label="Alamat halaman katerer">
              <input
                name="slug"
                required
                pattern="[a-z0-9-]+"
                placeholder="dapur-kamu"
              />
            </Field>
            <Field label="Tentang makananmu">
              <textarea name="description" required minLength={10} />
            </Field>
            <fieldset>
              <legend>Area pengantaran</legend>
              {areaOptions.map((a) => (
                <label className="checkbox" key={a}>
                  <input type="checkbox" name="areas" value={a} />
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
                <input required name="code" />
              </Field>
            </ActionForm>
          </details>
        </section>
      )}
    </div>
  );
}
