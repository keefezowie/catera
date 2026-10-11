import { View } from "react-native";
import { shortDate, type Delivery } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { HeaderIconButton } from "@catera/mobile-ui";
import { dayHasActions, useDayActions } from "./dayActions";

type Meal = "lunch" | "dinner";

/**
 * The "…" of one delivery day (iOS's horizontal ellipsis, Material's vertical overflow), 44pt or 48dp, opening the day's
 * action sheet (`useDayActions`). It is drawn only when the day offers something now: never for a day with nothing
 * allowed, never without a fresh read (`delivery` undefined: signed out, or a copy kept offline). `tint` is the ink of
 * the ground it sits on; `ground` puts it on a round scrim of its own (over a photo).
 */
export function DayMore({
  delivery,
  meal,
  tint,
  ground,
}: {
  delivery: Delivery | null | undefined;
  meal?: Meal;
  tint?: string;
  ground?: string;
}) {
  const { t, locale } = useMobile();
  const open = useDayActions(delivery, meal);
  if (!delivery || !dayHasActions(delivery, new Date(), meal)) return null;
  const day = shortDate(delivery.service_date, locale);
  const mealName = meal ? (meal === "dinner" ? t("makan malam", "dinner") : t("makan siang", "lunch")) : "";
  const label = mealName
    ? t(`Pilihan untuk ${mealName} ${day}`, `Options for ${mealName} on ${day}`)
    : t(`Pilihan untuk ${day}`, `Options for ${day}`);
  const button = <HeaderIconButton icon="more" label={label} tint={tint} onPress={() => void open()} />;
  if (!ground) return button;
  return (
    <View testID="day-more-ground" style={{ borderRadius: 24, backgroundColor: ground }}>
      {button}
    </View>
  );
}
