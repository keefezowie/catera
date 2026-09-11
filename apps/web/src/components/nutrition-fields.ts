import { Flame, Dumbbell, Wheat, Droplet } from "lucide-react";
export const nutritionFields = [
  {
    key: "caloriesKcal",
    Icon: Flame,
    label: "Kalori",
    labelEn: "Calories",
    unit: "kkal",
  },
  {
    key: "proteinG",
    Icon: Dumbbell,
    label: "Protein",
    labelEn: "Protein",
    unit: "g",
  },
  {
    key: "carbsG",
    Icon: Wheat,
    label: "Karbohidrat",
    labelEn: "Carbs",
    unit: "g",
  },
  { key: "fatG", Icon: Droplet, label: "Lemak", labelEn: "Fat", unit: "g" },
] as const;
