"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Check, ImageIcon, Plus, X } from "lucide-react";
import type { LibraryDish, MealMenu, Nutrition } from "@catera/domain";
import { defaultDishCategories } from "@catera/domain";
import { useApp } from "./context";
import { Button } from "./form-controls";
import { NumericInput } from "./numeric-input";
import { nutritionFields } from "./nutrition-fields";

/** Keep the library still while the calendar becomes the assembly card. */
export function MenuPanel({
  mode,
  children,
}: {
  mode: string;
  children: ReactNode;
}) {
  const { t } = useApp();
  const panel = useRef<HTMLElement>(null),
    content = useRef<HTMLDivElement>(null);
  const height = useRef(0);
  useLayoutEffect(() => {
    const outer = panel.current!,
      inner = content.current!;
    const next = outer.getBoundingClientRect().height;
    const previous = height.current;
    let expansion: Animation | undefined, entrance: Animation | undefined;
    if (previous && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      expansion = outer.animate(
        [{ height: previous + "px" }, { height: next + "px" }],
        {
          duration: 280,
          easing: "cubic-bezier(.16,1,.3,1)",
        },
      );
      entrance = inner.animate(
        [
          { opacity: 0.25, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(.16,1,.3,1)",
        },
      );
    }
    height.current = next;
    const observer = new ResizeObserver(() => {
      if (expansion?.playState !== "running")
        height.current = outer.getBoundingClientRect().height;
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      expansion?.cancel();
      entrance?.cancel();
    };
  }, [mode]);
  return (
    <section
      ref={panel}
      className="menu-main"
      aria-label={t("Kalender menu", "Menu calendar")}
    >
      <div ref={content} className="menu-panel-content">
        {children}
      </div>
    </section>
  );
}

export function MenuSlots({
  menu,
  activeId,
  dragging,
  busy,
  onSelect,
  onDrop,
  onRemove,
}: {
  menu: MealMenu;
  activeId: string;
  dragging: LibraryDish | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onDrop: (id: string, dishId: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t, locale } = useApp();
  return (
    <div className="menu-assembly-slots">
      {menu.composition?.flatMap((group) =>
        (menu.items || [])
          .filter((i) => i.groupId === group.id)
          .map((item, index) => {
            const groupName =
              locale === "en"
                ? defaultDishCategories.find((c) => c.id === group.categoryId)
                    ?.nameEn || group.name
                : group.name;
            const label = `${groupName} ${index + 1}`;
            const compatible = dragging?.categoryId === group.categoryId;
            return (
              <div
                key={item.id}
                className={
                  "menu-slot" +
                  (activeId === item.id ? " active" : "") +
                  (item.name ? " filled" : "") +
                  (dragging
                    ? compatible
                      ? " drop-compatible"
                      : " drop-incompatible"
                    : "")
                }
                data-slot-id={item.id}
                onDragOver={(e) => {
                  if (!busy) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDragEnter={(e) => {
                  if (!busy) e.currentTarget.classList.add("drag-over");
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    e.currentTarget.classList.remove("drag-over");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("drag-over");
                  if (!busy)
                    onDrop(
                      item.id,
                      e.dataTransfer.getData("application/x-catera-dish"),
                    );
                }}
              >
                <button
                  type="button"
                  className="menu-slot-select"
                  disabled={busy}
                  aria-pressed={activeId === item.id}
                  aria-label={`${label}: ${item.name || t("Belum diisi", "Empty slot")}. ${t("Pilih hidangan", "Choose dish")}`}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="menu-slot-photo">
                    {item.image ? (
                      <img src={item.image} alt="" draggable={false} />
                    ) : item.name ? (
                      <ImageIcon aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                  </span>
                  <span className="menu-slot-copy">
                    <span className="menu-slot-label">{label}</span>
                    <strong>
                      {item.name ||
                        t("Taruh hidangan di sini", "Drop a dish here")}
                    </strong>
                    <span className="menu-slot-help">
                      {item.name ? (
                        item.serving
                      ) : (
                        <>
                          <span className="menu-drag-copy">
                            {t(
                              "Klik untuk memilih kategori, lalu seret dari pustaka",
                              "Click to select category, then drag from the library",
                            )}
                          </span>
                          <span className="menu-tap-copy">
                            {t(
                              "Ketuk untuk memilih hidangan",
                              "Tap to choose a dish",
                            )}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  {item.name && (
                    <Check
                      className="menu-slot-check"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
                {item.name && (
                  <Button
                    type="button"
                    className="text-button menu-slot-remove"
                    disabled={busy}
                    aria-label={
                      t("Kosongkan ", "Clear ") + label + ": " + item.name
                    }
                    onClick={() => onRemove(item.id)}
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>
            );
          }),
      )}
    </div>
  );
}

export function MenuNutrition({
  value,
  disabled,
  onChange,
}: {
  value: Nutrition | null | undefined;
  disabled: boolean;
  onChange: (n: Nutrition | null) => void;
}) {
  const { t } = useApp();
  return (
    <fieldset className="menu-nutrition" disabled={disabled}>
      <legend>{t("Informasi gizi (opsional)", "Nutrition (optional)")}</legend>
      <div className="menu-nutrition-fields">
        {nutritionFields.map(({ key, Icon, label, labelEn, unit }) => (
          <label key={key}>
            <span>
              <Icon size={16} aria-hidden="true" />
              {t(label, labelEn)}
            </span>
            <span className="menu-nutrition-value">
              <NumericInput
                min={0}
                step="any"
                normalizeOnBlur={false}
                aria-label={`${t(label, labelEn)} (${unit === "kkal" ? t("kkal", "kcal") : unit})`}
                value={value?.[key] ?? ""}
                onChange={(e) => {
                  const next = { ...value };
                  if (e.target.value === "") delete next[key];
                  else next[key] = Number(e.target.value);
                  onChange(Object.keys(next).length ? next : null);
                }}
              />
              <span>{unit === "kkal" ? t("kkal", "kcal") : unit}</span>
            </span>
          </label>
        ))}
      </div>
      <p>
        {t(
          "Estimasi katerer · per porsi makan",
          "Caterer estimate · per meal portion",
        )}
      </p>
    </fieldset>
  );
}
