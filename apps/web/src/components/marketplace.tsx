"use client";
import "./package-presentation.css";
import { FeaturedHero } from "./featured-hero";
import { Select, SelectOption } from "./select";
import { PackagePreview } from "./package-preview";
import { PackageContents } from "./package-contents";
import {
  menuSummary,
  packageTypeLabel,
  nutritionSummary,
} from "@catera/domain";
import Link from "next/link";
import { useState } from "react";
import {
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
import { Button, Checkbox, TextInput } from "./form-controls";
import { Heading, Empty, Facts } from "./ui";
import { NumericInput } from "./numeric-input";
export function PackageCard({
  offer,
  preview = false,
}: {
  offer: Offer;
  preview?: boolean;
}) {
  const { area, compare, toggleCompare, locale, t } = useApp();
  const [meal, setMeal] = useState("lunch");
  const covered = !area || offer.areas.includes(area);
  const compared = compare.includes(offer.id);
  const navigation = {
    "aria-disabled": preview,
    tabIndex: preview ? -1 : undefined,
    onClick: (event: React.MouseEvent) => {
      if (preview) event.preventDefault();
    },
  };
  return (
    <article
      className={"package-card package-card-v2 " + (!covered ? "outside" : "")}
    >
      <div className="package-image">
        <Link href={"/packages/" + offer.slug} {...navigation}>
          <img
            src={offer.image}
            alt={offer.name}
            width="724"
            height="543"
            loading="lazy"
          />
        </Link>
        {!!offer.trialPrice && (
          <span className="image-label">
            {t("Bisa coba dulu", "Trial available")}
          </span>
        )}
      </div>
      <div className="package-body">
        <div className="package-identity">
          <div className="caterer-line">
            <strong>{offer.caterer}</strong>
            <span>
              {!!offer.rating && (
                <Star size={14} fill="currentColor" aria-hidden="true" />
              )}
              {offer.rating || t("Baru", "New")}
              {offer.reviewCount > 0 && <small>({offer.reviewCount})</small>}
            </span>
          </div>
          <Link href={"/packages/" + offer.slug} {...navigation}>
            <h3>{offer.name}</h3>
          </Link>
        </div>
        <div className="package-commitment">
          <strong className="package-duration">
            {offer.days}
            <span>{t("hari", "days")}</span>
          </strong>
          <div>
            <span>
              {offer.meal === "both" ? (
                <SunMoon size={16} aria-hidden="true" />
              ) : offer.meal === "dinner" ? (
                <Moon size={16} aria-hidden="true" />
              ) : (
                <Sun size={16} aria-hidden="true" />
              )}
              {mealLabel(offer.meal, locale)}
            </span>
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              {offer.flexible
                ? t("Jadwal fleksibel", "Flexible schedule")
                : t("Jadwal tetap", "Fixed schedule")}
            </span>
          </div>
        </div>
        <PackagePreview
          offer={offer}
          meal={meal}
          onMealChange={setMeal}
          preview={preview}
        />
        <div className="package-footer">
          <div className="card-price">
            <div>
              <strong>{currency(offer.price, locale)}</strong>
              <small>
                {t("/ porsi / hari", "/ portion / day")}
                {offer.meal === "both"
                  ? t(" · 2 kali makan", " · 2 meals")
                  : ""}
              </small>
            </div>
          </div>
          <p className={"delivery-included " + (!covered ? "unavailable" : "")}>
            <Truck size={15} aria-hidden="true" />
            {covered
              ? t("Pengantaran termasuk", "Delivery included")
              : t("Di luar area pengantaran", "Outside delivery area")}
          </p>
          <div className="package-actions">
            <Button
              type="button"
              disabled={preview}
              aria-pressed={compared}
              aria-label={
                (compared
                  ? t("Hapus dari perbandingan: ", "Remove from comparison: ")
                  : t("Bandingkan: ", "Compare: ")) + offer.name
              }
              onClick={() => toggleCompare(offer.id)}
            >
              {compared && <Check size={15} aria-hidden="true" />}
              {compared
                ? t("Dibandingkan", "Comparing")
                : t("Bandingkan", "Compare")}
            </Button>
            <Link href={"/packages/" + offer.slug} {...navigation}>
              {t("Lihat paket", "View package")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
export function Catalog({ caterer }: { caterer?: string }) {
  const { offers, area, setArea, t, locale } = useApp();
  const [search, setSearch] = useState(""),
    [meal, setMeal] = useState("all"),
    [packageType, setPackageType] = useState("all"),
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
        (packageType === "all" || p.packageType === packageType) &&
        (!flex || p.flexible) &&
        (!trial || p.trialPrice) &&
        (!diet || p.tags.includes("Plant-based")) &&
        (!max || p.price <= Number(max)) &&
        (!search ||
          [p.name, p.caterer, ...p.tags, ...p.menus.map(menuSummary)]
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
      <FeaturedHero />
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
            <TextInput
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
          <Button
            className={"button secondary small " + (filters ? "active" : "")}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} /> Filter
          </Button>
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
              <Button
                key={key as string}
                className={meal === key ? "selected" : ""}
                onClick={() => setMeal(key as string)}
              >
                <C size={19} />
                {t(id as string, en as string)}
              </Button>
            );
          })}
          <span className="filter-divider" />
          <Button
            className={diet ? "selected" : ""}
            onClick={() => setDiet(!diet)}
          >
            <Leaf size={18} /> Plant-based
          </Button>
          <Button
            className={trial ? "selected" : ""}
            onClick={() => setTrial(!trial)}
          >
            <Heart size={18} />
            {t("Coba dulu", "Try first")}
          </Button>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              <Checkbox
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
              <NumericInput
                value={max}
                onDraftChange={setMax}
                placeholder="Rp 100.000"
                min="1000"
                normalizeOnBlur={false}
              />
            </label>
            <Button
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
            </Button>
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
        <label className="field package-type-filter">
          <span>{t("Jenis paket", "Package type")}</span>
          <Select value={packageType} onValueChange={setPackageType}>
            <SelectOption value="all">
              {t("Semua jenis", "All types")}
            </SelectOption>
            <SelectOption value="ala_carte">À la carte</SelectOption>
            <SelectOption value="nasi_box">Nasi box</SelectOption>
          </Select>
        </label>
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
export function PackagePage({
  slug,
  offer,
  preview = false,
}: {
  slug: string;
  offer?: Offer;
  preview?: boolean;
}) {
  const { offers, t, locale, area, compare, toggleCompare } = useApp();
  const p = offer || offers.find((x) => x.slug === slug || x.id === slug);
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
    p && p.id !== "preview"
      ? api.request("reviews/" + p.id)
      : Promise.resolve([]),
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
    <div inert={preview} className="content package-detail">
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
            <h2>{t("Isi paket", "Included dishes")}</h2>
            <p>
              {t(
                "Menu disediakan katerer. Semua porsi menerima menu yang sama.",
                "Menus are supplied by the caterer. All portions receive the same menu.",
              )}
            </p>
            <PackageContents
              offer={p}
              presentation="gallery"
              coverImage={p.image}
              preview={preview}
            />
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
              <Button
                className="icon-button"
                aria-label="Kurangi porsi"
                disabled={portions === 1}
                onClick={() => setPortions(portions - 1)}
              >
                <Minus size={16} />
              </Button>
              <strong>{portions}</strong>
              <Button
                className="icon-button"
                aria-label="Tambah porsi"
                disabled={portions === 100}
                onClick={() => setPortions(portions + 1)}
              >
                <Plus size={16} />
              </Button>
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
          <Button
            className="text-button centered"
            onClick={() => toggleCompare(p.id)}
          >
            {compare.includes(p.id)
              ? t("Hapus perbandingan", "Remove comparison")
              : t("Bandingkan paket", "Compare package")}
          </Button>
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
  const [portionValue, setPortionValue] = useState(1);
  const portions = Math.max(1, Math.min(100, portionValue || 1));
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
            <NumericInput
              aria-label="Porsi perbandingan"
              min={1}
              max={100}
              step={1}
              value={portionValue}
              onValueChange={setPortionValue}
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
                      <Button
                        className="text-button"
                        onClick={() => toggleCompare(p.id)}
                      >
                        {t("Hapus", "Remove")}
                      </Button>
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
                    t("Jenis paket", "Package type"),
                    ...selected.map((p) =>
                      packageTypeLabel(p.packageType, locale),
                    ),
                  ],
                  [
                    t(
                      "Gizi per porsi · estimasi katerer",
                      "Nutrition per portion · caterer estimate",
                    ),
                    ...selected.map((p) =>
                      p.menus
                        .map(
                          (m) =>
                            mealLabel(m.meal, locale) +
                            ": " +
                            (nutritionSummary(m.nutrition, locale) ||
                              t("Belum tersedia", "Unavailable")),
                        )
                        .join("; "),
                    ),
                  ],
                  [
                    "Menu",
                    ...selected.map((p) => p.menus.map(menuSummary).join("; ")),
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
