"use client";
import { useState } from "react";
import { menuSummary, type Delivery, type Offer } from "@catera/domain";
import { Printer, Download } from "lucide-react";
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
  const { t } = useApp();
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
        .map(menuSummary)
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
}: {
  deliveries: Delivery[];
  meal: string;
  date: string;
  loading?: boolean;
}) {
  const { actor, perform, t } = useApp();
  const [revision, setRevision] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>
            {t("Daftar produksi", "Production list")} · {date}
          </h2>
          <p>
            {t(
              "Seluruh paket, siang dan malam, pada tanggal ini. Filter dashboard tidak membatasi produksi atau CSV. Termasuk trial.",
              "All packages, lunch and dinner, on this date. Dashboard filters do not limit production or CSV. Includes trials.",
            )}
          </p>
        </div>
        <Button
          className="button secondary small"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          {t("Cetak", "Print")}
        </Button>
      </div>
      <ProductionRows deliveries={deliveries} meal={meal} />
      <ActionForm
        disabled={loading}
        submit={t(
          "Simpan revisi & buat manifest",
          "Save revision & create manifest",
        )}
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
            "Setiap revisi menyimpan seluruh pesanan pada tanggal ini. Buat revisi baru jika jadwal berubah.",
            "Each revision snapshots every order on this date. Create a new revision when the schedule changes.",
          )}
        </p>
      </ActionForm>
      {revision && (
        <a className="button spaced" href={"/api/manifests/" + revision.id}>
          <Download size={18} />
          {t("Unduh CSV · revisi", "Download CSV · revision")}{" "}
          {revision.revision}
        </a>
      )}
    </section>
  );
}
