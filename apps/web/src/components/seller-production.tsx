"use client";
import { useState } from "react";
import {
  menuSummary,
  type Delivery,
  type Offer,
  type SellerOperationsState,
} from "@catera/domain";
import { Printer, Download, Save } from "lucide-react";
import { useApp } from "./context";
import { Button } from "./form-controls";
import { ActionForm, Empty } from "./ui";
function ProductionRows({
  deliveries,
  meal,
}: {
  deliveries: Delivery[];
  meal: string;
}) {
  const { t, locale } = useApp();
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
        .map((menu) => menuSummary(menu, locale))
        .join(", ");
      const key =
        d.offer.id + ":" + (d.offer.contentRevision || 0) + ":" + m.meal + menu;
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
            <th>{t("Paket / menu", "Package / menu")}</th>
            <th>{t("Waktu makan", "Meal period")}</th>
            <th className="number">{t("Porsi", "Portions")}</th>
            <th className="number">{t("Termasuk trial", "Includes trial")}</th>
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
              <td>
                {g.meal === "lunch"
                  ? t("Siang", "Lunch")
                  : t("Malam", "Dinner")}
              </td>
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
      title={t("Belum ada kebutuhan produksi", "No production scheduled")}
      description={t(
        "Pilih tanggal yang memiliki pengantaran untuk melihat kebutuhan produksi.",
        "Choose a date with deliveries to view production needs.",
      )}
    />
  );
}
export function Production({
  deliveries,
  meal,
  date,
  loading = false,
  latest,
}: {
  deliveries: Delivery[];
  meal: string;
  date: string;
  loading?: boolean;
  latest?: SellerOperationsState["latestProduction"];
}) {
  const { actor, perform, t, locale } = useApp();
  const [saved, setRevision] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  const revision =
    latest && (!saved || latest.revision >= saved.revision) ? latest : saved;
  const portions = deliveries
    .filter((d) => d.status !== "cancelled")
    .reduce((sum, d) => sum + d.portions * d.meals.length, 0);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>
            {t("Daftar dapur & pengantaran", "Kitchen & delivery list")} ·{" "}
            {date}
          </h2>
          <strong>
            {t(
              "Ringkasan langsung · sehari penuh",
              "Live overview · whole day",
            )}{" "}
            · {loading ? "…" : portions} {t("porsi makan", "meal portions")}
          </strong>
          <p>
            {t(
              "Sehari penuh: semua paket, termasuk coba paket, makan siang dan malam. Filter di atas tidak mengubah daftar ini.",
              "Whole day: all packages, including trials, lunch and dinner. The filters above do not change this list.",
            )}
          </p>
        </div>
        <Button
          className="button secondary small"
          disabled={loading}
          onClick={() => window.print()}
        >
          <Printer size={16} />
          {t("Cetak", "Print")}
        </Button>
      </div>
      <ProductionRows deliveries={deliveries} meal={meal} />
      <ActionForm
        disabled={loading}
        submitIcon={<Save size={18} aria-hidden="true" />}
        successMessage={t(
          "Daftar tersimpan. Unduh salinan di bawah.",
          "List saved. Download a copy below.",
        )}
        submit={t("Simpan daftar pengantaran", "Save delivery list")}
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
          {t(
            "Simpan seluruh pesanan tanggal ini sebagai salinan kerja. Simpan lagi bila jadwal berubah.",
            "Save every order for this date as a working copy. Save again when the schedule changes.",
          )}
        </p>
      </ActionForm>
      {revision && (
        <div className="ops-saved-copy">
          <strong>
            {t("Salinan tersimpan", "Saved copy")} #{revision.revision}
          </strong>
          {latest?.id === revision.id && (
            <p>
              {new Date(latest.createdAt).toLocaleString(
                locale === "id" ? "id-ID" : "en-GB",
                { timeZone: deliveries[0]?.offer.timezone || "Asia/Jakarta" },
              )}{" "}
              ·{" "}
              {loading
                ? t("Memeriksa perubahan…", "Checking for changes…")
                : latest.changed
                  ? t(
                      "Pesanan telah berubah. Simpan salinan terbaru sebelum digunakan.",
                      "Orders changed. Save the latest copy before using the list.",
                    )
                  : t(
                      "Sesuai dengan pesanan saat terakhir diperiksa.",
                      "Matches orders at the last successful check.",
                    )}
            </p>
          )}
          <p>
            {t(
              "Salinan ini tidak berubah otomatis. Simpan lagi setelah pesanan berubah; ringkasan di atas selalu menampilkan data terbaru.",
              "This copy does not update automatically. Save again after orders change; the overview above always shows current data.",
            )}{" "}
            · {date} · {t("sehari penuh", "whole day")}
          </p>
          <a className="button spaced" href={"/api/manifests/" + revision.id}>
            <Download size={18} />
            {t("Unduh CSV · salinan", "Download CSV · copy")} #
            {revision.revision}
          </a>
        </div>
      )}
    </section>
  );
}
