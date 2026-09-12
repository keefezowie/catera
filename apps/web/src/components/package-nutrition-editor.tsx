"use client";

import { useId } from "react";
import {
  nutrientBounds,
  type Nutrition,
  type NutrientValue,
} from "@catera/domain";
import { useApp } from "./context";
import { NumericInput } from "./numeric-input";
import { nutritionFields } from "./nutrition-fields";

export function PackageNutritionEditor({
  value,
  error,
  onChange,
}: {
  value: Nutrition | null | undefined;
  error?: string;
  onChange: (nutrition: Nutrition | null) => void;
}) {
  const { t } = useApp();
  const id = useId();

  const setMetric = (key: keyof Nutrition, next: NutrientValue | undefined) => {
    const nutrition = { ...value };
    if (next === undefined) delete nutrition[key];
    else nutrition[key] = next;
    onChange(Object.keys(nutrition).length ? nutrition : null);
  };

  return (
    <fieldset
      className="package-nutrition"
      data-editor-field="nutrition"
      aria-describedby={
        error ? `${id}-hint ${id}-error` : `${id}-hint`
      }
    >
      <legend>{t("Informasi gizi (opsional)", "Nutrition (optional)")}</legend>
      <p id={`${id}-hint`}>
        {t(
          "Isi satu nilai untuk angka tetap, atau tambahkan nilai maksimum untuk rentang.",
          "Enter one value for a fixed amount, or add a maximum for a range.",
        )}
      </p>
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      <div className="package-nutrition-fields">
        {nutritionFields.map(({ key, Icon, label, labelEn, unit }) => {
          const bounds = nutrientBounds(value?.[key]);
          const unitLabel = unit === "kkal" ? t("kkal", "kcal") : unit;
          return (
            <div className="package-nutrient" key={key}>
              <div className="package-nutrient-heading">
                <Icon size={17} aria-hidden="true" />
                <strong>{t(label, labelEn)}</strong>
                <span>{unitLabel}</span>
              </div>
              <div className="package-nutrient-range">
                <label>
                  <span>{t("Nilai tetap / min.", "Fixed / min.")}</span>
                  <NumericInput
                    min={0}
                    step="any"
                    normalizeOnBlur={false}
                    value={bounds?.min ?? ""}
                    aria-label={`${t(label, labelEn)} · ${t("nilai tetap atau minimum", "fixed or minimum value")} (${unitLabel})`}
                    onDraftChange={(raw) => {
                      if (raw === "") setMetric(key, undefined);
                    }}
                    onValueChange={(minimum) =>
                      setMetric(
                        key,
                        bounds && bounds.max !== bounds.min
                          ? { min: minimum, max: bounds.max }
                          : minimum,
                      )
                    }
                  />
                </label>
                <span aria-hidden="true">–</span>
                <label>
                  <span>{t("Maks. (opsional)", "Max. (optional)")}</span>
                  <NumericInput
                    min={0}
                    step="any"
                    normalizeOnBlur={false}
                    disabled={!bounds}
                    value={
                      bounds && bounds.max !== bounds.min ? bounds.max : ""
                    }
                    aria-label={`${t(label, labelEn)} · ${t("nilai maksimum opsional", "optional maximum value")} (${unitLabel})`}
                    onDraftChange={(raw) => {
                      if (raw === "" && bounds) setMetric(key, bounds.min);
                    }}
                    onValueChange={(maximum) => {
                      if (bounds)
                        setMetric(key, { min: bounds.min, max: maximum });
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <p>
        {t(
          "Estimasi katerer per porsi makan. Catera tidak menghitung atau memverifikasi nilai ini.",
          "Caterer estimate per meal portion. Catera does not calculate or verify these values.",
        )}
      </p>
    </fieldset>
  );
}
