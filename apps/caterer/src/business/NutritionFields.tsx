import { Switch, useWindowDimensions, View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Field, PressableRow, Text, useColors } from "@catera/mobile-ui";
import { carriedText, editGram, type NutritionField, type NutritionForm } from "./package";

/**
 * "Gizi per porsi (opsional)": the caterer's own estimates per portion, never required and never calculated by Catera.
 * Calories are one number or, with "Pakai rentang", a from and a to; protein, carbohydrate and fat are one number each.
 * A field left empty is not shown to customers; a typed zero is. A gram range copied from another package shows as
 * "29–30" until the caterer types over it.
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
  const toggle = () => set("range", !value.range);
  // Fields in a row keep their labels on one line: each has a basis that grows with the text size, and the row wraps
  // rather than squeezing a label onto two lines. With every label one line tall, the rows align at the top and an
  // error line under one field never lifts it above its neighbour.
  const row = { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-start" } as const;
  // Bases in dp at text size 1: about the width of "Kalori dari (kkal)" (140) and "Protein (g)" (92) at 13/700.
  const cell = (basis: number) => ({ flexGrow: 1, flexBasis: basis * fontScale, minWidth: 0 });
  return (
    <View style={{ gap: 12 }}>
      <Text variant="label" accessibilityRole="header" style={{ fontSize: 15, lineHeight: 22 }}>
        {t("Gizi per porsi", "Nutrition per portion")}
        <Text variant="caption" style={{ fontSize: 15, lineHeight: 22 }}>{` ${t("(opsional)", "(optional)")}`}</Text>
      </Text>
      {/* The whole 48dp row is the switch: its label toggles it too, and it is read once as a switch. */}
      <PressableRow
        accessibilityRole="switch"
        accessibilityLabel={t("Pakai rentang", "Use a range")}
        accessibilityState={{ checked: value.range }}
        onPress={toggle}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48 }}
      >
        <Text style={{ flex: 1, fontSize: 15 }}>{t("Pakai rentang", "Use a range")}</Text>
        <Switch
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          value={value.range}
          onValueChange={(range) => set("range", range)}
          trackColor={{ false: c.controlRing, true: c.forest }}
          thumbColor={c.surface}
          ios_backgroundColor={c.controlRing}
        />
      </PressableRow>
      {value.range ? (
        <View testID="gizi-kalori" style={row}>
          <View style={cell(140)}>
            <Field
              label={t("Kalori dari (kkal)", "Calories from (kcal)")}
              value={value.caloriesKcal[0]}
              onChangeText={(v) => set("caloriesKcal", [v, value.caloriesKcal[1]])}
              error={errors.caloriesKcal}
              keyboardType="number-pad"
            />
          </View>
          <View style={cell(140)}>
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
      <View testID="gizi-gram" style={row}>
        {(
          [
            ["proteinG", t("Protein (g)", "Protein (g)")],
            ["carbsG", t("Karbo (g)", "Carbs (g)")],
            ["fatG", t("Lemak (g)", "Fat (g)")],
          ] as const
        ).map(([key, label]) => {
          const carried = value.carried?.[key];
          return (
            <View key={key} style={cell(92)}>
              <Field
                label={label}
                value={carried ? carriedText(carried) : value[key]}
                onChangeText={(v) => onChange(editGram(value, key, v))}
                // A carried "29–30" is replaced whole by the first keystroke, not edited as text.
                selectTextOnFocus={!!carried}
                error={errors[key]}
                keyboardType="number-pad"
              />
            </View>
          );
        })}
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
