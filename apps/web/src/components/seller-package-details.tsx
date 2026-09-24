"use client";
import {
  currency,
  mealLabel,
  packageSubtotal,
  type Offer,
} from "@catera/domain";
import { useApp } from "./context";
import { PackageContents } from "./package-contents";
import { Status } from "./ui";

export function SellerPackageDetails({ offer: o }: { offer: Offer }) {
  const { t, locale } = useApp();
  const weekdays =
    locale === "id"
      ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
      : [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
  return (
    <div className="package-terms">
      <Status status={o.status} />
      <p>{o.description}</p>
      <dl className="facts">
        <div>
          <dt>
            {t("Harga dasar / hari / porsi", "Base price / day / portion")}
          </dt>
          <dd>{currency(o.price, locale)}</dd>
        </div>
        <div>
          <dt>{t("Satu periode", "One cycle")}</dt>
          <dd>
            {o.days} {t("hari pengantaran", "delivery days")} ·{" "}
            {currency(packageSubtotal(o), locale)}
          </dd>
        </div>
        <div>
          <dt>{t("Waktu makan", "Meals")}</dt>
          <dd>{mealLabel(o.meal, locale)}</dd>
        </div>
        <div>
          <dt>{t("Pilihan menu", "Menu selection")}</dt>
          <dd>
            {o.menuSelectionMode === "customer"
              ? t("Pelanggan memilih", "Customer chooses")
              : t("Katerer memilih", "Caterer chooses")}
          </dd>
        </div>
        <div>
          <dt>
            {t("Hari operasional & kapasitas", "Operating days & capacity")}
          </dt>
          <dd>
            {o.weekdays
              .map(
                (day) =>
                  `${weekdays[day]}: ${o.capacity[String(day)] ?? "—"} ${t("porsi", "portions")}`,
              )
              .join(" · ")}
          </dd>
        </div>
        {(o.meal === "both" ? (["lunch", "dinner"] as const) : [o.meal]).map(
          (meal) => (
            <div key={meal}>
              <dt>{mealLabel(meal, locale)}</dt>
              <dd>
                {o.windows[meal]} · {o.timezone}
              </dd>
            </div>
          ),
        )}
        <div>
          <dt>
            {t(
              "Batas perubahan hari sebelumnya",
              "Previous-day change deadline",
            )}
          </dt>
          <dd>
            {o.cutoff} · {o.timezone}
          </dd>
        </div>
      </dl>
      <p className="notice">
        {t(
          "Kapasitas menghitung porsi lengkap. Paket siang + malam memesan kapasitas sekali per hari; pengantaran setiap waktu makan tetap terpisah.",
          "Capacity counts complete portions. Lunch + dinner reserves capacity once per day; fulfilment remains separate for each meal.",
        )}
      </p>
      <p>
        {t(
          "Setelah tayang, harga dasar, isi, dan mode pilihan menu tetap. Durasi dan diskon dapat diperbarui untuk pembelian baru saja. Menu bertanggal dapat disiapkan setelah publikasi.",
          "After publication, base price, contents, and menu selection mode are fixed. Duration options and discounts can change for new purchases only. Dated menus can be prepared after publication.",
        )}
      </p>
      <PackageContents offer={o} />
    </div>
  );
}
