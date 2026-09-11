"use client";
import { useEffect, useState } from "react";
import { Plus, GripVertical, ImageIcon } from "lucide-react";
import type { DishCategory, LibraryDish } from "@catera/domain";
import { useApp } from "./context";
import { Button, TextInput, Checkbox } from "./form-controls";
import { Field, ErrorNotice } from "./ui";
import { LibraryForm } from "./dish-library";
import { CategoryCreate } from "./composition-editor";

export function MenuLibrary({
  dishes,
  categories,
  categoryId,
  onPick,
  disabled = false,
  onDragChange,
}: {
  dishes: LibraryDish[];
  categories: DishCategory[];
  categoryId?: string;
  onPick?: (dish: LibraryDish) => void;
  disabled?: boolean;
  onDragChange?: (dish: LibraryDish | null) => void;
}) {
  const { actor, perform, t, locale } = useApp();
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState<LibraryDish | "new" | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setSearch("");
    setForm(null);
  }, [categoryId]);
  const picking = !!onPick;
  const visible = dishes.filter(
    (d) =>
      (picking
        ? !d.archived && d.categoryId === categoryId
        : archived || !d.archived) &&
      d.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <section
      className="menu-library"
      aria-label={t("Pustaka hidangan", "Dish library")}
    >
      <div className="section-heading">
        <h2>{t("Pustaka hidangan", "Dish library")}</h2>
        <Button
          type="button"
          className="text-button"
          onClick={() => setForm("new")}
        >
          <Plus size={18} />
          {t("Tambah", "Add")}
        </Button>
      </div>
      {form !== null ? (
        <LibraryForm
          key={typeof form === "string" ? "new" : form.id}
          initial={form === "new" ? null : form}
          categories={categories}
          done={() => setForm(null)}
        />
      ) : (
        <>
          <Field label={t("Cari hidangan", "Search dishes")}>
            <TextInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          {categoryId && (
            <p className="menu-library-hint">
              {t("Kategori slot: ", "Slot category: ")}
              {categories
                .filter((c) => c.id === categoryId)
                .map((c) => (locale === "en" ? c.nameEn || c.name : c.name))
                .join("")}
              .
            </p>
          )}
          {[
            ...categories,
            { id: "", name: t("Belum dikategorikan", "Uncategorized") },
          ].map((c) => {
            if (picking && c.id !== categoryId) return null;
            const rows = visible.filter((d) => (d.categoryId || "") === c.id);
            if (search && !rows.length) return null;
            return (
              <details
                className="library-category"
                key={c.id}
                open={
                  !!search ||
                  c.id === categoryId ||
                  (c.id === "" && !!rows.length)
                }
              >
                <summary>
                  {locale === "en" && "nameEn" in c
                    ? c.nameEn || c.name
                    : c.name}
                  <span>{rows.length}</span>
                </summary>
                {!rows.length && (
                  <p>{t("Belum ada hidangan.", "No dishes yet.")}</p>
                )}
                {rows.map((d) => (
                  <div
                    className="menu-library-row"
                    key={d.id}
                    draggable={
                      !disabled && !!d.categoryId && !d.archived && picking
                    }
                    onDragStart={(e) => {
                      if (disabled || !picking) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData("application/x-catera-dish", d.id);
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setDragImage(e.currentTarget, 40, 35);
                      onDragChange?.(d);
                    }}
                    onDragEnd={() => onDragChange?.(null)}
                  >
                    <span
                      className="menu-drag-handle"
                      draggable={
                        !disabled && !!d.categoryId && !d.archived && picking
                      }
                      title={t("Seret hidangan", "Drag dish")}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </span>
                    {d.image ? (
                      <img
                        src={d.image}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                    ) : (
                      <span className="menu-library-photo">
                        <ImageIcon size={22} aria-hidden="true" />
                      </span>
                    )}
                    <div>
                      <strong>{d.name}</strong>
                      <small>
                        {d.serving}
                        {d.archived ? t(" · Arsip", " · Archived") : ""}
                      </small>
                      <div className="menu-library-actions">
                        {onPick && (
                          <Button
                            type="button"
                            className="text-button"
                            disabled={
                              disabled ||
                              !categoryId ||
                              d.categoryId !== categoryId ||
                              d.archived
                            }
                            onClick={() => onPick(d)}
                          >
                            {t("Pilih", "Choose")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          className="text-button"
                          onClick={() => setForm(d)}
                        >
                          {t("Edit", "Edit")}
                        </Button>
                        <Button
                          type="button"
                          className="text-button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await perform("dish.archive", {
                                catererId: actor!.catererId,
                                id: d.id,
                                version: d.version,
                                archived: !d.archived,
                              });
                              setError("");
                            } catch {
                              setError(
                                t(
                                  "Daftar berubah. Muat ulang lalu coba lagi.",
                                  "The library changed. Reload and retry.",
                                ),
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {d.archived
                            ? t("Pulihkan", "Restore")
                            : t("Arsipkan", "Archive")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </details>
            );
          })}
          {search && !visible.length && (
            <p role="status">
              {t("Hidangan tidak ditemukan.", "No matching dishes.")}
            </p>
          )}
          {!picking && (
            <label className="check-field">
              <Checkbox
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              {t("Tampilkan arsip", "Show archived")}
            </label>
          )}
          <CategoryCreate />
          {error && <ErrorNotice message={error} />}
        </>
      )}
    </section>
  );
}
