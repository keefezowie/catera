"use client";
import { Select, SelectOption } from "./select";
import Link from "next/link";
import { useState } from "react";
import {
  Asterisk,
  Search,
  MapPin,
  SlidersHorizontal,
  ArrowRight,
  ArrowUpRight,
  Sun,
  Moon,
  SunMoon,
  Leaf,
  Check,
  Star,
  Plus,
  Clock,
  Truck,
  CalendarDays,
  Heart,
  Minus,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import { currency, mealLabel, areaOptions, type Offer } from "@catera/domain";
import { useApp, api, useResource } from "./context";
import { Heading, Empty, Facts } from "./ui";
export function PackageCard({ offer }: { offer: Offer }) {
  const { area, compare, toggleCompare, locale, t } = useApp();
  const covered = !area || offer.areas.includes(area);
  return (
    <article className={"package-card " + (!covered ? "outside" : "")}>
      <div className="package-image">
        <Link href={"/packages/" + offer.slug}>
          <img
            src={offer.image}
            alt={offer.name}
            width="724"
            height="543"
            loading="lazy"
          />
        </Link>
        {offer.trialPrice && (
          <span className="image-label">
            {t("Bisa coba dulu", "Trial available")}
          </span>
        )}
        <button
          className={
            "compare-add " + (compare.includes(offer.id) ? "active" : "")
          }
          onClick={() => toggleCompare(offer.id)}
          aria-label={
            (compare.includes(offer.id)
              ? "Hapus dari perbandingan: "
              : "Bandingkan: ") + offer.name
          }
        >
          {compare.includes(offer.id) ? (
            <Check size={18} />
          ) : (
            <Plus size={18} />
          )}
        </button>
      </div>
      <div className="package-body">
        <div className="caterer-line">
          <span>{offer.caterer}</span>
          <span>
            <Star size={13} fill={offer.rating ? "currentColor" : "none"} />
            {offer.rating || t("Baru", "New")}
            {offer.reviewCount > 0 && <small>({offer.reviewCount})</small>}
          </span>
        </div>
        <Link href={"/packages/" + offer.slug}>
          <h3>{offer.name}</h3>
        </Link>
        <p className="package-meta">
          {mealLabel(offer.meal, locale)}
          <span>·</span>
          {offer.days} {t("hari", "days")}
        </p>
        <div className="package-chips">
          <span className={offer.flexible ? "flexible" : ""}>
            {offer.flexible ? <CalendarDays size={13} /> : <Clock size={13} />}{" "}
            {offer.flexible
              ? t("Jadwal fleksibel", "Flexible schedule")
              : t("Jadwal tetap", "Fixed schedule")}
          </span>
          <span>{offer.tags[0]}</span>
        </div>
        <div className="card-price">
          <div>
            <strong>{currency(offer.price, locale)}</strong>
            <small>
              / {t("porsi / hari", "portion / day")}
              {offer.meal === "both" ? " · 2×" : ""}
            </small>
          </div>
          <Link
            href={"/packages/" + offer.slug}
            className="circle-link"
            aria-label={"Lihat " + offer.name}
          >
            <ArrowUpRight size={20} />
          </Link>
        </div>
        <p className={"delivery-included " + (!covered ? "unavailable" : "")}>
          <Truck size={14} />
          {covered
            ? t("Pengantaran termasuk", "Delivery included")
            : t("Di luar area pengantaran", "Outside delivery area")}
        </p>
      </div>
    </article>
  );
}
export function Catalog({ caterer }: { caterer?: string }) {
  const { offers, area, setArea, t, locale } = useApp();
  const [search, setSearch] = useState(""),
    [meal, setMeal] = useState("all"),
    [flex, setFlex] = useState(false),
    [trial, setTrial] = useState(false),
    [diet, setDiet] = useState(false),
    [max, setMax] = useState(""),
    [sort, setSort] = useState("recommended"),
    [filters, setFilters] = useState(false);
  const filtered = offers
    .filter(
      (p) =>
        (meal === "all" || p.meal === meal) &&
        (!flex || p.flexible) &&
        (!trial || p.trialPrice) &&
        (!diet || p.tags.includes("Plant-based")) &&
        (!max || p.price <= Number(max)) &&
        (!search ||
          [p.name, p.caterer, ...p.tags]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) => {
      const coverage =
        Number(!b.areas.includes(area)) - Number(!a.areas.includes(area));
      if (area && a.areas.includes(area) !== b.areas.includes(area))
        return -coverage;
      return sort === "price"
        ? a.price - b.price
        : sort === "rating"
          ? (b.rating || 0) - (a.rating || 0)
          : 0;
    });
  return (
    <>
      <section className="market-hero">
        <div className="hero-copy">
          <h1>
            {t("Makan enak.", "Eat well.")}
            <br />
            {t("Setiap hari.", "Every day.")}
            <Asterisk className="hero-dot" aria-hidden="true" />
          </h1>
          <p>
            {t(
              "Katering yang pas untuk keseharian Anda. Pilih makanannya, atur jadwalnya, nikmati harinya.",
              "Catering that fits your everyday. Choose your meals, set your schedule, enjoy your day.",
            )}
          </p>
          <a className="button cream" href="#packages">
            {t("Temukan paketmu", "Find your meals")}
            <ArrowUpRight size={19} />
          </a>
          <div className="hero-benefits">
            <span>
              <Check size={15} />
              {t("Pengantaran termasuk", "Delivery included")}
            </span>
            <span>
              <Check size={15} />
              {t("Bisa coba dulu", "Try before subscribing")}
            </span>
          </div>
        </div>
        <div className="hero-food">
          <img
            src="/assets/food/ayam-panggang.png"
            alt="Ayam panggang, nasi hangat, dan sayuran segar"
            fetchPriority="high"
            width="724"
            height="543"
          />
          <div className="hero-food-caption">
            <span>
              <Sun size={18} />
              {t("Satu urusan berkurang.", "One less thing to plan.")}
            </span>
            <strong>
              {t(
                "Satu hari lebih menyenangkan.",
                "A little more joy every day.",
              )}
            </strong>
          </div>
        </div>
      </section>
      <section className="catalog-section" id="packages">
        <div className="market-toolbar">
          <div className="delivery-selector">
            <MapPin size={20} />
            <label>
              <span>{t("Area pengantaran", "Delivery area")}</span>
              <Select
                value={area}
                onValueChange={(value) => setArea(value)}
                aria-label="Area pengantaran"
              >
                <SelectOption value="">
                  {t("Pilih area Anda", "Choose your area")}
                </SelectOption>
                {areaOptions.map((a) => (
                  <SelectOption key={a}>{a}</SelectOption>
                ))}
              </Select>
            </label>
          </div>
          <label className="search-field">
            <Search size={19} />
            <input
              placeholder={t(
                "Cari paket, menu, atau katerer favorit…",
                "Find a package, meal, or favorite caterer…",
              )}
              aria-label="Cari katering"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="section-heading">
          <div>
            <h2>{t("Mau makan apa hari ini?", "What sounds good today?")}</h2>
            <p>
              {t(
                "Temukan rutinitas makan yang paling cocok untukmu.",
                "Find the meal routine that feels right for you.",
              )}
            </p>
          </div>
          <button
            className={"button secondary small " + (filters ? "active" : "")}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} /> Filter
          </button>
        </div>
        <div className="meal-filter-row">
          {[
            ["all", "Semua paket", "All packages", PackageIcon],
            ["lunch", "Makan siang", "Lunch", Sun],
            ["dinner", "Makan malam", "Dinner", Moon],
            ["both", "Siang + malam", "Lunch + dinner", SunMoon],
          ].map(([key, id, en, Icon]) => {
            const C = Icon as typeof Sun;
            return (
              <button
                key={key as string}
                className={meal === key ? "selected" : ""}
                onClick={() => setMeal(key as string)}
              >
                <C size={19} />
                {t(id as string, en as string)}
              </button>
            );
          })}
          <span className="filter-divider" />
          <button
            className={diet ? "selected" : ""}
            onClick={() => setDiet(!diet)}
          >
            <Leaf size={18} /> Plant-based
          </button>
          <button
            className={trial ? "selected" : ""}
            onClick={() => setTrial(!trial)}
          >
            <Heart size={18} />
            {t("Coba dulu", "Try first")}
          </button>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              <input
                type="checkbox"
                checked={flex}
                onChange={(e) => setFlex(e.target.checked)}
              />
              {t("Jadwal fleksibel saja", "Flexible packages only")}
            </label>
            <label>
              {t(
                "Harga maksimum / porsi / hari",
                "Maximum price / portion / day",
              )}
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Rp 100.000"
                min="1000"
              />
            </label>
            <button
              className="text-button"
              onClick={() => {
                setFlex(false);
                setTrial(false);
                setDiet(false);
                setMax("");
                setSearch("");
                setMeal("all");
              }}
            >
              {t("Hapus filter", "Reset filters")}
            </button>
          </div>
        )}
        <div className="results-bar">
          <p>
            <strong>{filtered.length}</strong>{" "}
            {t(
              "paket untuk hari-hari yang lebih baik",
              "packages for better everyday meals",
            )}
            {area && (
              <>
                {" "}
                · <span>{area}</span>
              </>
            )}
          </p>
          <label>
            {t("Urutkan:", "Sort:")}{" "}
            <Select value={sort} onValueChange={(value) => setSort(value)}>
              <SelectOption value="recommended">
                {t("Rekomendasi", "Recommended")}
              </SelectOption>
              <SelectOption value="price">
                {t("Harga terendah", "Lowest price")}
              </SelectOption>
              <SelectOption value="rating">
                {t("Rating tertinggi", "Highest rated")}
              </SelectOption>
            </Select>
          </label>
        </div>
        <div className="package-grid">
          {filtered.map((p) => (
            <PackageCard key={p.id} offer={p} />
          ))}
        </div>
        {!filtered.length && (
          <Empty
            title={t("Belum ada yang cocok", "No matching packages")}
            description={t(
              "Coba kata pencarian atau filter yang berbeda.",
              "Try another search or adjust your filters.",
            )}
          />
        )}
      </section>
      <section className="how-it-works" id="how-it-works">
        <div>
          <h2>
            {t("Makanan sudah dipikirkan.", "Meals, already taken care of.")}
            <br />
            {t("Harimu tinggal dinikmati.", "Your day is yours to enjoy.")}
          </h2>
          <p>
            {t(
              "Mulai dari satu kali coba, sampai jadi bagian favorit dari keseharian.",
              "From a first taste to your favorite everyday ritual.",
            )}
          </p>
        </div>
        <ol>
          <li>
            <strong>{t("Pilih yang kamu suka", "Find your favorite")}</strong>
            <p>
              {t(
                "Bandingkan menu, porsi, dan jadwal dari katerer pilihanmu.",
                "Compare meals, portions, and schedules from different caterers.",
              )}
            </p>
          </li>
          <li>
            <strong>{t("Buat jadwalmu", "Make it your routine")}</strong>
            <p>
              {t(
                "Tentukan jumlah porsi dan tanggal mulai. Kami susun jadwalnya.",
                "Choose portions and a start date. We arrange the calendar.",
              )}
            </p>
          </li>
          <li>
            <strong>{t("Nikmati, lalu ulangi", "Enjoy, then repeat")}</strong>
            <p>
              {t(
                "Makanan diantar oleh katerer. Perpanjang hanya ketika kamu mau.",
                "Your caterer delivers. Renew only when you want to.",
              )}
            </p>
          </li>
        </ol>
      </section>
    </>
  );
}
function PackageIcon({ size = 18 }: { size?: number }) {
  return <CalendarDays size={size} />;
}
export function PackagePage({ slug }: { slug: string }) {
  const { offers, t, locale, area, compare, toggleCompare } = useApp();
  const p = offers.find((x) => x.slug === slug || x.id === slug);
  const [portions, setPortions] = useState(1);
  const reviews = useResource<
    {
      id: string;
      customer: string;
      rating: number;
      body: string;
      reply: string;
    }[]
  >("reviews:" + p?.id, () =>
    p ? api.request("reviews/" + p.id) : Promise.resolve([]),
  );
  if (!p)
    return (
      <Empty title="Paket tidak ditemukan" href="/" label="Jelajah paket" />
    );
  const eligible = !area || p.areas.includes(area);
  const tier = Math.max(
    0,
    ...p.tiers.filter((x) => portions >= x.min).map((x) => x.percent),
  );
  const total = Math.round(p.price * p.days * portions * (1 - tier / 100));
  return (
    <div className="content package-detail">
      <div className="breadcrumbs">
        <Link href="/#packages">{t("Jelajah", "Discover")}</Link>
        <span>/</span>
        <Link href={"/caterers/" + p.catererSlug}>{p.caterer}</Link>
        <span>/</span>
        {p.name}
      </div>
      <div className="detail-layout">
        <div>
          <img className="detail-hero" src={p.image} alt={p.name} />
          <div className="detail-heading">
            <Link className="seller-link" href={"/caterers/" + p.catererSlug}>
              <span className="mini-avatar">{p.caterer[0]}</span>
              {p.caterer}
              <ArrowUpRight size={16} />
            </Link>
            <h1>{p.name}</h1>
            <p>{p.description}</p>
          </div>
          <div className="detail-badges">
            <span>
              <Truck size={17} />
              {t("Pengantaran termasuk", "Delivery included")}
            </span>
            <span>
              <CalendarDays size={17} />
              {p.flexible
                ? t("Jadwal fleksibel", "Flexible schedule")
                : t("Jadwal tetap", "Fixed schedule")}
            </span>
            <span>
              <Sun size={17} />
              {mealLabel(p.meal, locale)}
            </span>
          </div>
          <section className="detail-section">
            <h2>{t("Menu yang menantimu", "Meals to look forward to")}</h2>
            <p>
              {t(
                "Menu disediakan katerer. Semua porsi menerima menu yang sama.",
                "Menus are supplied by the caterer. All portions receive the same menu.",
              )}
            </p>
            <div className="menu-list">
              {p.menus.map((m, i) => (
                <div key={i}>
                  <img src={m.image} alt={m.name} />
                  <div>
                    <small>{mealLabel(m.meal, locale)}</small>
                    <h3>{m.name}</h3>
                    <p>{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>{t("Jelas dari awal", "Know before you subscribe")}</h2>
            <Facts
              rows={[
                [
                  t("Hari pengantaran", "Operating days"),
                  p.weekdays
                    .map(
                      (d) =>
                        (locale === "id"
                          ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
                          : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[
                          d
                        ],
                    )
                    .join(", "),
                ],
                [
                  t("Waktu pengantaran", "Delivery window"),
                  p.meal === "both"
                    ? p.windows.lunch + " & " + p.windows.dinner
                    : p.windows[p.meal],
                ],
                [
                  t("Batas perubahan", "Change cutoff"),
                  p.cutoff.slice(0, 5) +
                    " · " +
                    t("sehari sebelum pengantaran", "the day before delivery"),
                ],
                [
                  t("Aturan jadwal", "Schedule rules"),
                  p.flexible
                    ? t(
                        "Ganti tanggal sebelum batas waktu. Porsi tidak hangus.",
                        "Move eligible days before cutoff. No meal entitlement is lost.",
                      )
                    : t(
                        "Tanggal tetap, tidak dapat dilewati atau diganti.",
                        "Fixed dates cannot be skipped or rescheduled.",
                      ),
                ],
                [
                  t("Pembatalan & refund", "Cancellation & refunds"),
                  t(
                    "Semua permintaan ditinjau melalui bantuan Catera.",
                    "All requests are reviewed through Catera support.",
                  ),
                ],
              ]}
            />
            {p.meal === "both" && (
              <p className="notice">
                {t(
                  "Siang dan malam menggunakan satu alamat dan selalu berpindah bersama.",
                  "Lunch and dinner share an address and are rescheduled together.",
                )}
              </p>
            )}
          </section>
          <section className="detail-section">
            <h2>{t("Cerita dari pelanggan", "Customer experiences")}</h2>
            {reviews.data?.length ? (
              reviews.data.map((r) => (
                <div className="review" key={r.id}>
                  <strong>{r.customer}</strong>
                  <span>
                    <Star size={14} />
                    {r.rating}/5
                  </span>
                  <p>{r.body}</p>
                  {r.reply && (
                    <blockquote>
                      {p.caterer}: {r.reply}
                    </blockquote>
                  )}
                </div>
              ))
            ) : (
              <p>
                {t(
                  "Belum ada ulasan. Ulasan hanya dari pelanggan yang sudah menerima makanan.",
                  "No reviews yet. Only customers who have received a meal can review.",
                )}
              </p>
            )}
          </section>
        </div>
        <aside className="purchase-card">
          <span>
            {p.days} {t("hari makanan baik", "days of good meals")}
          </span>
          <h2>
            {currency(p.price, locale)}
            <small> / {t("porsi / hari", "portion / day")}</small>
          </h2>
          <p>
            {mealLabel(p.meal, locale)}
            {p.meal === "both" ? " · 2 " + t("kali makan", "meals") : ""}
          </p>
          <div className="portion-control">
            <label>{t("Jumlah porsi", "Portions")}</label>
            <div>
              <button
                className="icon-button"
                aria-label="Kurangi porsi"
                disabled={portions === 1}
                onClick={() => setPortions(portions - 1)}
              >
                <Minus size={16} />
              </button>
              <strong>{portions}</strong>
              <button
                className="icon-button"
                aria-label="Tambah porsi"
                disabled={portions === 100}
                onClick={() => setPortions(portions + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <p className="small muted">
            {t(
              "1 porsi = 1 orang setiap kali makan.",
              "1 portion = 1 person per meal.",
            )}
          </p>
          {tier > 0 && (
            <p className="notice">
              {t("Hemat", "Save")} {tier}% ·{" "}
              {t("diskon jumlah porsi", "quantity discount")}
            </p>
          )}
          <Facts
            rows={[
              [t("Harga paket", "Package price"), currency(total, locale)],
              [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
            ]}
          />
          <Link
            href={
              eligible ? "/checkout/" + p.id + "?portions=" + portions : "#"
            }
            aria-disabled={!eligible}
            className={"button full " + (!eligible ? "disabled" : "")}
          >
            {eligible
              ? t("Pilih paket ini", "Choose this package")
              : t("Di luar area pengantaran", "Outside delivery area")}
            <ArrowRight size={17} />
          </Link>
          {p.trialPrice && eligible && (
            <Link
              className="button secondary full"
              href={"/checkout/" + p.id + "?trial=1&portions=" + portions}
            >
              {t("Coba 1 hari", "Try 1 day")} ·{" "}
              {currency(p.trialPrice * portions, locale)}
            </Link>
          )}
          <button
            className="text-button centered"
            onClick={() => toggleCompare(p.id)}
          >
            {compare.includes(p.id)
              ? t("Hapus perbandingan", "Remove comparison")
              : t("Bandingkan paket", "Compare package")}
          </button>
          <p className="purchase-footnote">
            {t(
              "Biaya layanan ditampilkan saat checkout. Tidak ada perpanjangan otomatis.",
              "Service fee appears at checkout. No automatic renewal.",
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}
export function Compare() {
  const { offers, compare, toggleCompare, t, locale } = useApp();
  const [portions, setPortions] = useState(1);
  const selected = offers.filter((p) => compare.includes(p.id));
  return (
    <div className="content">
      <Heading
        title={t("Pilih yang paling pas.", "Find your best fit.")}
        description={t(
          "Bandingkan hingga 3 paket dengan jumlah porsi yang sama.",
          "Compare up to 3 packages using the same portion quantity.",
        )}
      />
      {selected.length ? (
        <>
          <label className="inline-field">
            {t("Porsi setiap hari", "Portions per day")}
            <input
              aria-label="Porsi perbandingan"
              type="number"
              min="1"
              max="100"
              value={portions}
              onChange={(e) =>
                setPortions(Math.max(1, Math.min(100, Number(e.target.value))))
              }
            />
          </label>
          <div className="comparison-scroll">
            <table className="comparison">
              <thead>
                <tr>
                  <th>{t("Yang penting untukmu", "What matters to you")}</th>
                  {selected.map((p) => (
                    <th key={p.id}>
                      <img src={p.image} alt={p.name} />
                      <h3>{p.name}</h3>
                      <p>{p.caterer}</p>
                      <button
                        className="text-button"
                        onClick={() => toggleCompare(p.id)}
                      >
                        {t("Hapus", "Remove")}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Harga paket",
                    ...selected.map((p) =>
                      currency(
                        Math.round(
                          p.price *
                            p.days *
                            portions *
                            (1 -
                              Math.max(
                                0,
                                ...p.tiers
                                  .filter((x) => portions >= x.min)
                                  .map((x) => x.percent),
                              ) /
                                100),
                        ),
                        locale,
                      ),
                    ),
                  ],
                  [
                    "Per porsi / hari",
                    ...selected.map((p) =>
                      currency(
                        Math.round(
                          p.price *
                            (1 -
                              Math.max(
                                0,
                                ...p.tiers
                                  .filter((x) => portions >= x.min)
                                  .map((x) => x.percent),
                              ) /
                                100),
                        ),
                        locale,
                      ),
                    ),
                  ],
                  ["Durasi", ...selected.map((p) => p.days + " hari")],
                  [
                    "Waktu makan",
                    ...selected.map((p) => mealLabel(p.meal, locale)),
                  ],
                  [
                    "Jadwal",
                    ...selected.map((p) =>
                      p.flexible ? "Fleksibel" : "Tetap",
                    ),
                  ],
                  [
                    "Trial 1 hari",
                    ...selected.map((p) =>
                      p.trialPrice
                        ? currency(p.trialPrice * portions, locale)
                        : "Tidak tersedia",
                    ),
                  ],
                  [
                    "Pengantaran",
                    ...selected.map(
                      (p) =>
                        "Termasuk · " +
                        (p.meal === "dinner"
                          ? p.windows.dinner
                          : p.windows.lunch),
                    ),
                  ],
                  [
                    "Menu",
                    ...selected.map((p) =>
                      p.menus.map((m) => m.name).join(", "),
                    ),
                  ],
                ].map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) =>
                      j === 0 ? <th key={j}>{v}</th> : <td key={j}>{v}</td>,
                    )}
                  </tr>
                ))}
                <tr>
                  <th />
                  {selected.map((p) => (
                    <td key={p.id}>
                      <Link
                        className="button full"
                        href={"/packages/" + p.slug}
                      >
                        Lihat paket
                        <ArrowRight size={15} />
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty
          title="Belum ada paket untuk dibandingkan"
          description="Pilih tanda + pada kartu paket yang menarik untukmu."
          href="/#packages"
          label="Jelajah paket"
        />
      )}
    </div>
  );
}
export function CatererPage({ slug }: { slug: string }) {
  const { offers, t, perform, actor } = useApp();
  const list = offers.filter((p) => p.catererSlug === slug);
  const p = list[0];
  if (!p) return <Empty title="Katerer tidak ditemukan" />;
  return (
    <div className="content">
      <section className="caterer-cover">
        <div className="seller-avatar">{p.caterer[0]}</div>
        <div>
          <h1>{p.caterer}</h1>
          <p>
            <MapPin size={16} />
            {p.areas.join(" · ")}
          </p>
          <span className="badge">
            <Check size={14} />
            {t(
              "Informasi usaha ditinjau Catera",
              "Business information reviewed by Catera",
            )}
          </span>
        </div>
        <Link
          href={
            actor
              ? "/messages?caterer=" + p.catererId
              : "/login?next=" +
                encodeURIComponent("/messages?caterer=" + p.catererId)
          }
          className="button secondary"
        >
          <MessageCircle size={17} />
          {t("Tanya katerer", "Ask the caterer")}
        </Link>
      </section>
      <Heading
        title={t("Dari dapur, untuk harimu.", "From our kitchen to your day.")}
        description={t(
          "Pilih paket dan rutinitas makan yang cocok untukmu.",
          "Choose a package that suits your routine.",
        )}
      />
      <div className="package-grid">
        {list.map((p) => (
          <PackageCard key={p.id} offer={p} />
        ))}
      </div>
    </div>
  );
}
