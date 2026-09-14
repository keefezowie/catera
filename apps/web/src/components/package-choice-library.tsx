"use client";
import { useState } from "react";
import { type Offer, type LibraryDish } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button, Checkbox } from "./form-controls";
import { ErrorNotice } from "./ui";
import { MenuLibrary } from "./menu-library";
import "./package-choice-library.css";
export function ChoiceRules() {
  const { t } = useApp();
  return (
    <p className="notice">
      {t(
        "Pilih menu sendiri setelah pembayaran, sebelum batas waktu pengantaran. Satu menu berlaku untuk semua porsi pada tanggal dan waktu makan yang sama. Semua pilihan termasuk harga paket. Jika belum memilih, katerer menentukan hidangan dan menghubungi Anda.",
        "Choose your menu after payment, before the delivery cutoff. One menu applies to all portions on the same date and meal. All choices are included. If you have not chosen, the caterer decides the dishes and contacts you.",
      )}
    </p>
  );
}
export function ChoiceDishChecklist({
  dishes,
  selected,
  onChange,
}: {
  dishes: LibraryDish[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useApp();
  return (
    <fieldset className="choice-dish-list">
      <legend>
        {t(
          "Hidangan yang boleh dipilih pelanggan",
          "Dishes customers can choose",
        )}
      </legend>
      <p>
        {t(
          "Sediakan hidangan berbeda yang cukup untuk setiap kategori. Kelola hidangan melalui Menu.",
          "Provide enough distinct dishes for each category. Manage dishes in Menu.",
        )}
      </p>
      {dishes
        .filter((d) => !d.archived && d.categoryId)
        .map((d) => (
          <label className="check-field" key={d.id}>
            <Checkbox
              checked={selected.includes(d.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, d.id]
                    : selected.filter((id) => id !== d.id),
                )
              }
            />
            {d.image && <img src={d.image} width={40} height={40} alt="" />}
            <span>
              {d.name} · {d.serving}
            </span>
          </label>
        ))}
      {!dishes.length && (
        <p>
          {t(
            "Tambahkan hidangan di Menu terlebih dahulu.",
            "Add dishes in Menu first.",
          )}
        </p>
      )}
    </fieldset>
  );
}
export function PackageChoiceLibrary({
  offer,
  dishes,
}: {
  offer: Offer;
  dishes?: LibraryDish[];
}) {
  const { t, perform, actor } = useApp();
  const resource = useResource("package-options:" + offer.id, () =>
    api.packageOptions(offer.id),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await perform("packageOption.save", { packageId: offer.id, ...payload });
      resource.reload();
    } catch (e) {
      setError(
        (e as { code?: string }).code === "INSUFFICIENT_OPTIONS"
          ? t(
              "Sisakan cukup hidangan aktif untuk mengisi setiap kategori.",
              "Keep enough active dishes to fill each category.",
            )
          : t(
              "Pilihan berubah atau tidak valid. Muat ulang lalu coba lagi.",
              "Options changed or are invalid. Reload and retry.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  const options = resource.data || [];
  const allowed = new Set(
    offer.menus.flatMap((m) => m.composition?.map((g) => g.categoryId) || []),
  );
  return (
    <section className="package-choice-library">
      <h3>
        {offer.name} · {t("Pilih menu sendiri", "Choose your menu")}
      </h3>
      <ChoiceRules />
      {resource.error && (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      )}
      {error && <ErrorNotice message={error} retry={resource.reload} />}
      {!resource.data && !resource.error && (
        <p role="status">
          {t("Memuat pilihan hidangan…", "Loading dish options…")}
        </p>
      )}
      {dishes && actor?.role === "owner" ? (
        <>
          <p>
            {t(
              "Pilihan pelanggan yang sudah disimpan tetap harus dipenuhi. Pembaruan hanya berlaku untuk pilihan baru.",
              "Saved customer choices must still be fulfilled. Updates apply to new selections only.",
            )}
          </p>
          {options.map((d) => (
            <div className="action-row" key={d.id}>
              <strong>{d.name}</strong>
              <span>{d.serving}</span>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  save({ id: d.id, version: d.version, archived: !d.archived })
                }
              >
                {d.archived
                  ? t("Pulihkan", "Restore")
                  : t("Nonaktifkan", "Retire")}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || d.archived}
                onClick={() =>
                  save({ id: d.id, version: d.version, refresh: true })
                }
              >
                {t("Gunakan versi terbaru", "Use latest version")}
              </Button>
            </div>
          ))}
          {dishes
            .filter(
              (d) =>
                !d.archived &&
                allowed.has(d.categoryId) &&
                !options.some((o) => o.sourceDishId === d.id),
            )
            .map((d) => (
              <div className="action-row" key={d.id}>
                <span>{d.name}</span>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => save({ sourceDishId: d.id })}
                >
                  {t("Tambahkan ke paket", "Add to package")}
                </Button>
              </div>
            ))}
        </>
      ) : (
        <MenuLibrary
          manage={false}
          dishes={options.filter((d) => !d.archived)}
          categories={offer.menus
            .flatMap((m) => m.composition || [])
            .filter(
              (g, i, all) =>
                all.findIndex((x) => x.categoryId === g.categoryId) === i,
            )
            .map((g) => ({ id: g.categoryId!, name: g.name }))}
        />
      )}
    </section>
  );
}
