import { View } from "react-native";
import { type KitchenSession } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { CheckRow, Text } from "@catera/mobile-ui";
import { dishKey, type Ticks } from "./ticks";

/**
 * "Daftar masak": one checkable row per dish of the session's recap, with its photo (or the meal's icon) and how many
 * portions of it to cook. The ticks are the kitchen's own note, kept on this phone; they gate nothing, so a ticked
 * row only turns muted and struck through, with its photo dimmed. A session with no dishes yet shows the heading alone and the caller's lines about
 * the menus nobody has filled in follow it.
 */
export function CookingList({ session, ticks }: { session: KitchenSession; ticks: Ticks }) {
  const { t } = useMobile();
  const { ticked, toggle } = ticks;
  const dishes = session.recap.byDish;
  return (
    <View testID="cooking-list">
      <Text variant="label">{t("Daftar masak", "Cooking list")}</Text>
      {dishes.map((dish, i) => {
        const key = dishKey(dish);
        return (
          <CheckRow
            key={key}
            testID={`check-row-${i}`}
            quantity={dish.count}
            name={dish.name}
            image={dish.image || undefined}
            icon={session.meal === "lunch" ? "sunny-outline" : "moon-outline"}
            checked={ticked.has(key)}
            onToggle={() => toggle(key)}
          />
        );
      })}
      {dishes.length ? (
        <Text variant="caption">
          {t("Centang ini cuma catatan dapur. Pelanggan tidak melihatnya.", "Ticks are just for the kitchen. Customers don't see them.")}
        </Text>
      ) : null}
    </View>
  );
}
