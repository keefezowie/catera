import { Switch, useWindowDimensions, View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Field, Text, useColors } from "@catera/mobile-ui";
import type { NutritionField, NutritionForm } from "./package";

/**
 * "Gizi per porsi (opsional)": the caterer's own estimates per portion, never required and never calculated by Catera.
 * Calories are one number or, with "Pakai rentang", a from and a to; protein, carbohydrate and fat are one number each.
 * A field left empty is not shown to customers; a typed zero is.
 */
export function NutritionFields({
  value,
  onChange,
  errors,
}: {
  value: NutritionForm;
  onChange: (next: NutritionForm) => void;
  errors: Partial<Record<NutritionField, string>>;
}) {
  const { t } = useMobile();
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const set = <K extends keyof NutritionForm>(key: K, v: NutritionForm[K]) => onChange({ ...value, [key]: v });
  // Three grams fields share a row while their labels fit; at large text they wrap rather than squeeze the labels.
  const basis = 92 * fontScale;
  return (
    <View style={{ gap: 12 }}>
      <Text variant="label" accessibilityRole="header" style={{ fontSize: 15, lineHeight: 22 }}>
        {t("Gizi per porsi", "Nutrition per portion")}
        <Text variant="caption" style={{ fontSize: 15, lineHeight: 22 }}>{` ${t("(opsional)", "(optional)")}`}</Text>
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48 }}>
        {/* The switch carries the same name, so the visible label is not read twice. */}
        <Text accessible={false} style={{ flex: 1, fontSize: 15 }}>
          {t("Pakai rentang", "Use a range")}
        </Text>
        <Switch
          accessible
          accessibilityRole="switch"
          accessibilityLabel={t("Pakai rentang", "Use a range")}
          accessibilityState={{ checked: value.range }}
          value={value.range}
          onValueChange={(range) => set("range", range)}
          trackColor={{ false: c.controlRing, true: c.forest }}
          thumbColor={c.surface}
          ios_backgroundColor={c.controlRing}
        />
      </View>
      {value.range ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field
              label={t("Kalori dari (kkal)", "Calories from (kcal)")}
              value={value.caloriesKcal[0]}
              onChangeText={(v) => set("caloriesKcal", [v, value.caloriesKcal[1]])}
              error={errors.caloriesKcal}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field
              label={t("sampai (kkal)", "to (kcal)")}
              accessibilityLabel={t("Kalori sampai (kkal)", "Calories to (kcal)")}
              value={value.caloriesKcal[1]}
              onChangeText={(v) => set("caloriesKcal", [value.caloriesKcal[0], v])}
              error={errors.caloriesMax}
              keyboardType="number-pad"
            />
          </View>
        </View>
      ) : (
        <Field
          label={t("Kalori (kkal)", "Calories (kcal)")}
          value={value.caloriesKcal[0]}
          onChangeText={(v) => set("caloriesKcal", [v, value.caloriesKcal[1]])}
          error={errors.caloriesKcal}
          keyboardType="number-pad"
        />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        {(
          [
            ["proteinG", t("Protein (g)", "Protein (g)")],
            ["carbsG", t("Karbo (g)", "Carbs (g)")],
            ["fatG", t("Lemak (g)", "Fat (g)")],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={{ flexGrow: 1, flexBasis: basis, minWidth: 0 }}>
            <Field label={label} value={value[key]} onChangeText={(v) => set(key, v)} error={errors[key]} keyboardType="number-pad" />
          </View>
        ))}
      </View>
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        {t(
          "Isi kalau kamu tahu. Pelanggan melihatnya sebagai perkiraan per porsi; kolom kosong tidak ditampilkan.",
          "Fill these in if you know them. Customers see them as an estimate per portion; empty fields are not shown.",
        )}
      </Text>
    </View>
  );
}
