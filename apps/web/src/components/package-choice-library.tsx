"use client";
import { Plus, RefreshCw, Archive, RotateCcw, Utensils } from "lucide-react";
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
  const categories = [...allowed].map((id) => ({
    id,
    name:
      offer.menus
        .flatMap((menu) => menu.composition || [])
        .find((group) => group.categoryId === id)?.name || id,
    required: Math.max(
      ...offer.menus.map((menu) =>
        (menu.composition || [])
          .filter((group) => group.categoryId === id)
          .reduce((count, group) => count + group.slots, 0),
      ),
    ),
  }));
  return (
    <section className="package-choice-library">
      {dishes ? (
        <>
          <div className="choice-library-heading">
            <div>
              <span className="choice-mode">
                <Utensils size={16} />
                {t("Pilih menu sendiri", "Choose your menu")}
              </span>
              <h2>
                {t("Pilihan hidangan pelanggan", "Customer dish options")}
              </h2>
              <p>
                {t(
                  "Kelola hidangan yang bisa dipilih pelanggan untuk paket ini. Pilihan dibuat setelah berlangganan, sebelum batas waktu pengantaran.",
                  "Manage the dishes customers can choose for this package. Customers select after subscribing, before the delivery cutoff.",
                )}
              </p>
            </div>
            <strong className="choice-active-count">
              {resource.loading
                ? t("Memuat pilihan…", "Loading options…")
                : resource.error
                  ? t("Jumlah belum tersedia", "Count unavailable")
                  : `${options.filter((d) => !d.archived).length} ${t("hidangan aktif", "active dishes")}`}
            </strong>
          </div>
          <div className="choice-composition">
            {offer.menus.map((menu) => (
              <div key={menu.meal}>
                <strong>
                  {menu.meal === "lunch"
                    ? t("Siang", "Lunch")
                    : t("Malam", "Dinner")}
                </strong>
                <span>
                  {menu.composition
                    ?.map((group) => `${group.slots} ${group.name}`)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3>
            {offer.name} · {t("Pilih menu sendiri", "Choose your menu")}
          </h3>
          <ChoiceRules />
        </>
      )}
      {resource.error && (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      )}
      {error && <ErrorNotice message={error} retry={resource.reload} />}
      {!resource.data && !resource.error && (
        <p role="status">
          {t("Memuat pilihan hidangan…", "Loading dish options…")}
        </p>
      )}
      {resource.data &&
        (dishes && actor?.role === "owner" ? (
          <>
            <p>
              {t(
                "Pilihan pelanggan yang sudah disimpan tetap harus dipenuhi. Pembaruan hanya berlaku untuk pilihan baru.",
                "Saved customer choices must still be fulfilled. Updates apply to new selections only.",
              )}
            </p>
            {categories.map((category) => (
              <section key={category.id} className="choice-category">
                <h3>{category.name}</h3>
                <p>
                  {category.required}{" "}
                  {t("slot wajib per waktu makan", "required slots per meal")} ·{" "}
                  {resource.loading || resource.error
                    ? "…"
                    : options.filter(
                        (d) => d.categoryId === category.id && !d.archived,
                      ).length}{" "}
                  {t("pilihan aktif tersedia", "active options available")}
                </p>
                <div className="choice-option-grid">
                  {options
                    .filter((d) => d.categoryId === category.id)
                    .map((d) => (
                      <article
                        className={
                          "choice-option-card" +
                          (d.archived ? " is-retired" : "")
                        }
                        key={d.id}
                      >
                        {d.image ? (
                          <img src={d.image} alt="" />
                        ) : (
                          <div className="choice-option-placeholder">
                            <Utensils size={26} />
                          </div>
                        )}
                        <div className="choice-option-info">
                          <strong>{d.name}</strong>
                          <small>
                            {d.serving} ·{" "}
                            {d.archived
                              ? t("Nonaktif", "Inactive")
                              : t("Aktif", "Active")}
                          </small>
                        </div>
                        <div className="choice-option-actions">
                          <Button
                            variant="secondary"
                            disabled={
                              busy || resource.loading || !!resource.error
                            }
                            onClick={() =>
                              save({
                                id: d.id,
                                version: d.version,
                                archived: !d.archived,
                              })
                            }
                          >
                            {d.archived ? (
                              <RotateCcw size={15} />
                            ) : (
                              <Archive size={15} />
                            )}
                            {d.archived
                              ? t("Pulihkan", "Restore")
                              : t("Nonaktifkan", "Retire")}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={
                              busy ||
                              d.archived ||
                              resource.loading ||
                              !!resource.error
                            }
                            onClick={() =>
                              save({
                                id: d.id,
                                version: d.version,
                                refresh: true,
                              })
                            }
                          >
                            <RefreshCw size={15} />
                            {t("Perbarui", "Refresh")}
                          </Button>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            ))}
            <h3>
              {t(
                "Tambahkan pilihan dari pustaka",
                "Add options from your library",
              )}
            </h3>
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
                    disabled={
                      busy ||
                      !resource.data ||
                      resource.loading ||
                      !!resource.error
                    }
                    onClick={() => save({ sourceDishId: d.id })}
                  >
                    <Plus size={16} />
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
        ))}
    </section>
  );
}
