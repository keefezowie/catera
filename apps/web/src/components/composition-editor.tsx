"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  defaultDishCategories,
  mealLabel,
  type MealMenu,
  type DishCategory,
} from "@catera/domain";
import { useApp } from "./context";
import { useDishLibrary } from "./dish-library";
import { Button, TextInput } from "./form-controls";
import { NumericInput } from "./numeric-input";
import { Field, ErrorNotice } from "./ui";
import { Select, SelectOption } from "./select";

export function CategoryCreate({
  onCreated,
}: {
  onCreated?: (category: DishCategory) => void;
}) {
  const { actor, perform, t } = useApp();
  const [name, setName] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="category-create">
      <Button
        type="button"
        className="text-button"
        onClick={() => setOpen(!open)}
      >
        <Plus size={16} />
        {t("Kategori baru", "New category")}
      </Button>
      {open && (
        <div>
          <Field label={t("Nama kategori", "Category name")}>
            <TextInput
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            type="button"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const c = await perform<DishCategory>("category.save", {
                  catererId: actor!.catererId,
                  name: name.trim(),
                });
                onCreated?.(c);
                setName("");
                setOpen(false);
              } catch {
                setError(
                  t(
                    "Kategori belum tersimpan. Periksa nama atau muat ulang.",
                    "Category not saved. Check its name or reload.",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Simpan kategori", "Save category")}
          </Button>
          {error && <ErrorNotice message={error} />}
        </div>
      )}
    </div>
  );
}

/** Conversion is a draft until the caterer explicitly saves the package's new revision. */
export function compositionDraft(m: MealMenu): MealMenu {
  if (m.contentModel === "slots") return m;
  return {
    meal: m.meal,
    contentModel: "slots",
    name: "",
    description: "",
    image: "",
    items: [],
    nutrition: null,
    composition: (m.composition || []).map((g) => ({
      ...g,
      categoryId:
        g.categoryId ||
        defaultDishCategories.find(
          (c) => c.name.toLowerCase() === g.name.toLowerCase(),
        )?.id,
    })),
  };
}
export function CompositionEditor({
  menu,
  onChange,
}: {
  menu: MealMenu;
  onChange: (m: MealMenu) => void;
}) {
  const { t, locale } = useApp();
  const library = useDishLibrary();
  const categories = library.data?.categories || defaultDishCategories;
  const groups = menu.composition || [];
  const update = (composition: MealMenu["composition"]) =>
    onChange({ ...compositionDraft(menu), composition });
  return (
    <section className="composition-editor">
      <h3>{mealLabel(menu.meal, locale)}</h3>
      <p>
        {t(
          "Tentukan isi per porsi. Pilih hidangannya nanti di kalender Menu.",
          "Define what each portion includes. Assign dishes later in the menu calendar.",
        )}
      </p>
      {groups.map((g) => (
        <div className="composition-row" key={g.id}>
          <Field label={t("Kategori", "Category")}>
            <Select
              value={g.categoryId || ""}
              onValueChange={(id) => {
                const c = categories.find((c) => c.id === id)!;
                update(
                  groups.map((x) =>
                    x.id === g.id ? { ...g, categoryId: id, name: c.name } : x,
                  ),
                );
              }}
            >
              <SelectOption value="" disabled>
                {g.name || t("Pilih kategori", "Choose category")}
              </SelectOption>
              {categories
                .filter(
                  (c) =>
                    c.id === g.categoryId ||
                    !groups.some((x) => x.categoryId === c.id),
                )
                .map((c) => (
                  <SelectOption key={c.id} value={c.id}>
                    {locale === "en" ? c.nameEn || c.name : c.name}
                  </SelectOption>
                ))}
            </Select>
          </Field>
          <Field label={t("Jumlah ", "Count ") + g.name}>
            <NumericInput
              aria-label={t("Jumlah ", "Count ") + g.name}
              value={g.slots}
              min={1}
              max={30}
              onValueChange={(slots) =>
                update(groups.map((x) => (x.id === g.id ? { ...g, slots } : x)))
              }
            />
          </Field>
          <Button
            type="button"
            className="text-button"
            aria-label={t("Hapus ", "Remove ") + g.name}
            onClick={() => update(groups.filter((x) => x.id !== g.id))}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      ))}
      <Field label={t("Tambah kategori ke paket", "Add package category")}>
        <Select
          value=""
          disabled={groups.length >= 20}
          onValueChange={(id) => {
            const c = categories.find((c) => c.id === id)!;
            update([
              ...groups,
              {
                id: crypto.randomUUID(),
                categoryId: c.id,
                name: c.name,
                slots: 1,
              },
            ]);
          }}
        >
          <SelectOption value="" disabled>
            {t("Pilih kategori", "Choose category")}
          </SelectOption>
          {categories
            .filter((c) => !groups.some((g) => g.categoryId === c.id))
            .map((c) => (
              <SelectOption key={c.id} value={c.id}>
                {locale === "en" ? c.nameEn || c.name : c.name}
              </SelectOption>
            ))}
        </Select>
      </Field>
      <CategoryCreate
        onCreated={(c) =>
          update([
            ...groups,
            {
              id: crypto.randomUUID(),
              categoryId: c.id,
              name: c.name,
              slots: 1,
            },
          ])
        }
      />
    </section>
  );
}
