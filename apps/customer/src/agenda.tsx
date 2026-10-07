import { router } from "expo-router";
import { mealLabel, type Delivery } from "@catera/domain";
import { useNative } from "./context";
import { Btn, Panel, Photo, Status, Txt } from "./ui";

export function DeliveryCard({
  delivery: d,
  meal = d.meals[0]?.meal,
  photo = false,
}: {
  delivery: Delivery;
  meal?: string;
  photo?: boolean;
}) {
  const { t, locale } = useNative();
  const current = d.meals.find((m) => m.meal === meal)!;
  return (
    <Panel>
      {photo && <Photo src={d.offer.image} height={170} />}
      <Txt kind="small">
        {mealLabel(meal, locale)} ·{" "}
        {d.offer.windows[meal as "lunch" | "dinner"]}
      </Txt>
      <Txt kind="heading">{d.offer.name}</Txt>
      <Txt kind="small">
        {d.offer.caterer} · {d.portions} {t("porsi", "portions")}
      </Txt>
      <Status status={current.status} />
      <Txt kind="small">
        {d.address.label} · {d.address.area}
      </Txt>
      <Btn
        secondary
        label={t("Lihat pengantaran", "View delivery")}
        onPress={() => router.push(("/hari/" + d.id) as never)}
      />
    </Panel>
  );
}
