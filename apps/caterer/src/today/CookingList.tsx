import type { ReactNode } from "react";
import { View } from "react-native";
import { type KitchenSession } from "@catera/domain";
import { useMobile, plural } from "@catera/mobile-core";
import { CheckRow, CHECK_ROW_INSET, ListCard, SectionHeader, Text } from "@catera/mobile-ui";
import { dishKey, type Ticks } from "./ticks";
import { HEADING_GAP } from "./rows";

/**
 * "Daftar masak": a section whose heading carries how many dishes ("4 menu") and the caller's actions (Bagikan, Cetak),
 * over one `ListCard` of checkable rows, one per dish of the session's recap, each with its photo (or the meal's icon)
 * and how many portions of it to cook. The ticks are the kitchen's own note, kept on this phone; they gate nothing, so a
 * ticked row only turns muted and struck through, with its photo dimmed, and stays where it is. `after` (the lines about
 * the menus nobody has filled in) sits directly under the list, before the note about the ticks. A session with no dishes
 * yet shows the heading alone and `after` follows it.
 */
export function CookingList({
  session,
  ticks,
  actions,
  after,
}: {
  session: KitchenSession;
  ticks: Ticks;
  /** The trailing slot of the heading: the icon buttons. */
  actions?: ReactNode;
  after?: ReactNode;
}) {
  const { t } = useMobile();
  const { ticked, toggle } = ticks;
  const dishes = session.recap.byDish;
  return (
    <View testID="cooking-list">
      <SectionHeader
        title={t("Daftar masak", "Cooking list")}
        count={dishes.length ? t(`${dishes.length} menu`, plural(dishes.length, "dish", "dishes")) : undefined}
        action={actions}
      />
      {dishes.length ? (
        <ListCard inset={CHECK_ROW_INSET}>
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
        </ListCard>
      ) : null}
      {after ? <View style={{ marginTop: HEADING_GAP }}>{after}</View> : null}
      {dishes.length ? (
        <Text variant="meta" style={{ marginTop: HEADING_GAP }}>
          {t("Centang ini cuma catatan dapur. Pelanggan tidak melihatnya.", "Ticks are just for the kitchen. Customers don't see them.")}
        </Text>
      ) : null}
    </View>
  );
}
