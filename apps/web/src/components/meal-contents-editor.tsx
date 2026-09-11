"use client";
import { useRef } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  mealLabel,
  menuItems,
  menuSummary,
  type Dish,
  type MealMenu,
  type PackageType,
  type Nutrition,
} from "@catera/domain";
import { useApp } from "./context";
import { Button, TextInput } from "./form-controls";
import { Field, ErrorNotice } from "./ui";
import { Select, SelectOption } from "./select";
import { DishFields, useDishLibrary } from "./dish-library";
import { NumericInput } from "./numeric-input";

export function MealContentsEditor({
  menu,
  type,
  onChange,
  fixedComposition = false,
  onBusyChange,
  fieldPrefix = "menus.0",
  errors = {},
}: {
  menu: MealMenu;
  type: PackageType;
  onChange: (menu: MealMenu) => void;
  fixedComposition?: boolean;
  onBusyChange?: (busy: boolean) => void;
  fieldPrefix?: string;
  errors?: Record<string, string>;
}) {
  const { t, locale } = useApp();
  const library = useDishLibrary();
  const removed = useRef<Record<string, Dish[]>>({});
  const current = useRef(menu);
  current.current = menu;
  const items = menu.items ?? menuItems(menu),
    groups = menu.composition ?? [];
  const change = (patch: Partial<MealMenu>, foodChanged = false) => {
    const previous = current.current;
    const m = {
      ...previous,
      items: previous.items ?? menuItems(previous),
      composition: previous.composition ?? [],
      ...(foodChanged ? { nutrition: null } : {}),
      ...patch,
    };
    current.current = { ...m, name: menuSummary(m) };
    onChange(current.current);
  };
  const blank = (groupId?: string): Dish => ({
    id: crypto.randomUUID(),
    name: "",
    description: "",
    image: "",
    serving: "",
    ...(groupId ? { groupId } : {}),
  });
  const update = (id: string, patch: Partial<Dish>) => {
    const list = current.current.items ?? menuItems(current.current),
      old = list.find((i) => i.id === id);
    const foodChanged =
      !!old &&
      (["name", "description", "serving"] as const).some(
        (k) => patch[k] !== undefined && patch[k] !== old[k],
      );
    change(
      { items: list.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
      foodChanged ||
        (patch.name !== undefined &&
          patch.sourceDishId !== old?.sourceDishId) ||
        (patch.sourceDishVersion !== undefined &&
          patch.sourceDishVersion !== old?.sourceDishVersion &&
          !!old?.sourceDishId),
    );
  };
  const move = (id: string, direction: number) => {
    const next = [...items],
      i = next.findIndex((x) => x.id === id),
      j = i + direction;
    if (j >= 0 && j < next.length && next[i].groupId === next[j].groupId) {
      [next[i], next[j]] = [next[j], next[i]];
      change({ items: next });
    }
  };
  const setSlots = (id: string, slots: number) => {
    if (!Number.isInteger(slots) || slots < 1 || slots > 30) return;
    const own = items.filter((i) => i.groupId === id),
      saved = removed.current[id] ?? [];
    if (items.length - own.length + slots > 60) return;
    const next = own.slice(0, slots);
    if (slots < own.length)
      removed.current[id] = [...own.slice(slots), ...saved];
    else {
      while (next.length < slots) next.push(saved.shift() ?? blank(id));
      removed.current[id] = saved;
    }
    change(
      {
        composition: groups.map((g) => (g.id === id ? { ...g, slots } : g)),
        items: groups.flatMap((g) =>
          g.id === id ? next : items.filter((i) => i.groupId === g.id),
        ),
      },
      slots !== own.length,
    );
  };
  const moveGroup = (index: number, direction: number) => {
    const next = [...groups];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    change({
      composition: next,
      items: next.flatMap((g) => items.filter((i) => i.groupId === g.id)),
    });
  };
  const dishEditor = (i: Dish, n: number) => {
    const position = items.findIndex((x) => x.id === i.id);
    return (
      <fieldset className="dish-editor" key={i.id}>
        <legend>
          {groups.find((g) => g.id === i.groupId)?.name ||
            t("Hidangan", "Dish")}{" "}
          {n + 1}
        </legend>
        <div className="dish-editor-actions">
          <Button
            type="button"
            className="text-button"
            disabled={
              position === 0 || items[position - 1].groupId !== i.groupId
            }
            aria-label={t("Naikkan hidangan ", "Move dish up ") + (n + 1)}
            onClick={() => move(i.id, -1)}
          >
            <ArrowUp size={18} />
          </Button>
          <Button
            type="button"
            className="text-button"
            disabled={
              position === items.length - 1 ||
              items[position + 1].groupId !== i.groupId
            }
            aria-label={t("Turunkan hidangan ", "Move dish down ") + (n + 1)}
            onClick={() => move(i.id, 1)}
          >
            <ArrowDown size={18} />
          </Button>
          {type === "ala_carte" && !fixedComposition && (
            <Button
              type="button"
              className="text-button"
              aria-label={t("Hapus hidangan ", "Remove dish ") + (n + 1)}
              onClick={() =>
                change({ items: items.filter((x) => x.id !== i.id) }, true)
              }
            >
              <Trash2 size={18} />
            </Button>
          )}
        </div>
        <DishFields
          fieldPrefix={fieldPrefix + ".items." + position}
          errors={errors}
          dish={i}
          library={library.data?.dishes || []}
          onChange={(p) => update(i.id, p)}
          onBusyChange={onBusyChange}
        />
      </fieldset>
    );
  };
  return (
    <section
      className="contents-editor"
      aria-label={
        t("Isi paket", "Package contents") +
        " · " +
        mealLabel(menu.meal, locale)
      }
    >
      <h3>{mealLabel(menu.meal, locale)}</h3>
      {library.error && (
        <ErrorNotice
          message={t(
            "Daftar hidangan belum dimuat. Anda tetap dapat menulis hidangan langsung.",
            "Dish library could not load. You can still enter dishes directly.",
          )}
          retry={library.reload}
        />
      )}
      {type === "nasi_box" ? (
        <>
          <p>
            {t(
              "Tambahkan komponen, lalu isi hidangannya. Jumlah hidangan berbeda dari ukuran saji.",
              "Add a component, then enter its dishes. Dish count is separate from serving size.",
            )}
          </p>
          {groups.map((g, index) => (
            <section
              className="component-editor"
              key={g.id}
              aria-label={g.name}
            >
              <div className="component-row">
                <Field
                  fieldKey={fieldPrefix + ".composition." + index + ".name"}
                  error={
                    errors[fieldPrefix + ".composition." + index + ".name"]
                  }
                  label={t("Komponen", "Component")}
                >
                  <TextInput
                    maxLength={60}
                    value={g.name}
                    disabled={fixedComposition}
                    onChange={(e) =>
                      change({
                        composition: groups.map((x) =>
                          x.id === g.id ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  fieldKey={fieldPrefix + ".composition." + index + ".slots"}
                  error={
                    errors[fieldPrefix + ".composition." + index + ".slots"]
                  }
                  label={t("Jumlah hidangan", "Dish slots")}
                >
                  <NumericInput
                    min={1}
                    max={30}
                    value={g.slots}
                    disabled={fixedComposition}
                    onValueChange={(slots) => setSlots(g.id, slots)}
                  />
                </Field>
              </div>
              {items.filter((i) => i.groupId === g.id).map(dishEditor)}
              {!fixedComposition && (
                <div className="component-actions">
                  <Button
                    type="button"
                    className="text-button"
                    disabled={index === 0}
                    aria-label={
                      t("Naikkan komponen ", "Move component up ") + g.name
                    }
                    onClick={() => moveGroup(index, -1)}
                  >
                    <ArrowUp size={18} />
                  </Button>
                  <Button
                    type="button"
                    className="text-button"
                    disabled={index === groups.length - 1}
                    aria-label={
                      t("Turunkan komponen ", "Move component down ") + g.name
                    }
                    onClick={() => moveGroup(index, 1)}
                  >
                    <ArrowDown size={18} />
                  </Button>
                  <Button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      change(
                        {
                          composition: groups.filter((x) => x.id !== g.id),
                          items: items.filter((i) => i.groupId !== g.id),
                        },
                        true,
                      )
                    }
                  >
                    <Trash2 size={18} />
                    {t("Hapus komponen", "Remove component")}
                  </Button>
                </div>
              )}
            </section>
          ))}
          {!fixedComposition && (
            <Field label={t("Tambah komponen", "Add component")}>
              <Select
                value=""
                disabled={groups.length >= 20 || items.length >= 60}
                onValueChange={(value) => {
                  const id = crypto.randomUUID();
                  change(
                    {
                      composition: [
                        ...groups,
                        {
                          id,
                          name:
                            value === "custom"
                              ? t("Komponen lain", "Custom component")
                              : value,
                          slots: 1,
                        },
                      ],
                      items: [...items, blank(id)],
                    },
                    true,
                  );
                }}
              >
                <SelectOption value="" disabled>
                  {t("Pilih komponen", "Choose component")}
                </SelectOption>
                {[
                  "Nasi",
                  "Lauk",
                  "Sayur",
                  "Sup",
                  "Buah",
                  "Minuman",
                  "Sambal / pelengkap",
                ].map((x) => (
                  <SelectOption key={x} value={x}>
                    {x}
                  </SelectOption>
                ))}
                <SelectOption value="custom">
                  {t("Komponen khusus…", "Custom component…")}
                </SelectOption>
              </Select>
            </Field>
          )}
        </>
      ) : (
        <>
          {items.map(dishEditor)}
          {!fixedComposition && (
            <Button
              type="button"
              className="text-button"
              disabled={items.length >= 60}
              onClick={() => change({ items: [...items, blank()] }, true)}
            >
              <Plus size={18} />
              {t("Tambah hidangan", "Add dish")}
            </Button>
          )}
        </>
      )}
      <details className="nutrition-editor">
        <summary>
          {t("Informasi gizi (opsional)", "Nutrition (optional)")}
        </summary>
        <p>
          {t("Per porsi ", "Per portion of ")}
          {mealLabel(menu.meal, locale).toLowerCase()} ·{" "}
          {t(
            "Estimasi dari katerer. Kosongkan nilai yang belum tersedia.",
            "Caterer estimate. Leave unavailable values blank.",
          )}
        </p>
        <p>
          {t(
            "Isi ulang informasi gizi setelah mengubah hidangan atau ukuran saji.",
            "Re-enter nutrition after changing dishes or serving sizes.",
          )}
        </p>
        <div className="form-row">
          {(
            [
              ["caloriesKcal", t("Kalori (kkal)", "Calories (kcal)")],
              ["proteinG", "Protein (g)"],
              ["carbsG", t("Karbohidrat (g)", "Carbs (g)")],
              ["fatG", t("Lemak (g)", "Fat (g)")],
            ] as [keyof Nutrition, string][]
          ).map(([key, label]) => (
            <Field
              key={key}
              fieldKey={fieldPrefix + ".nutrition." + key}
              error={errors[fieldPrefix + ".nutrition." + key]}
              label={label}
            >
              <NumericInput
                min={0}
                step="any"
                value={menu.nutrition?.[key] ?? ""}
                normalizeOnBlur={false}
                onChange={(e) => {
                  const nutrition = { ...menu.nutrition };
                  if (e.target.value === "") delete nutrition[key];
                  else nutrition[key] = Number(e.target.value);
                  change({
                    nutrition: Object.keys(nutrition).length ? nutrition : null,
                  });
                }}
              />
            </Field>
          ))}
        </div>
      </details>
    </section>
  );
}
