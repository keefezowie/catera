import { useState } from "react";
import { View, Switch } from "react-native";
import { router } from "expo-router";
import {
  addDays,
  localDay,
  mealLabel,
  customerActionPresentation,
  type Delivery,
} from "@catera/domain";
import { nativeApi, nativeLink, useData, useNative } from "./context";
import {
  Btn,
  C,
  DayPicker,
  Empty,
  Gate,
  Panel,
  Photo,
  ResourceNotice,
  Screen,
  Status,
  Txt,
  styles,
} from "./ui";

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
        onPress={() => router.push(("/delivery/" + d.id) as never)}
      />
    </Panel>
  );
}
function dateLabel(date: string, locale: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString(
    locale === "id" ? "id-ID" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  );
}
export function Home() {
  const { actor, t, locale } = useNative();
  const state = useData("home", () =>
    actor ? nativeApi.customer() : Promise.resolve(null),
  );
  const actions = useData("home-actions", () =>
    actor ? nativeApi.customerActions(50) : Promise.resolve(null),
  );
  const [expanded, setExpanded] = useState(false);
  const upcoming = (state.data?.deliveries || [])
    .filter(
      (d) =>
        d.service_date >= localDay() &&
        d.meals.some((m) => !["delivered", "cancelled"].includes(m.status)),
    )
    .sort((a, b) => a.service_date.localeCompare(b.service_date));
  const nextDate = upcoming[0]?.service_date;
  const subscriptions =
    state.data?.subscriptions.filter((s) => s.status === "active") || [];
  return (
    <Gate next="/">
      <Screen
        title={t("Halo, ", "Hello, ") + (actor?.name.split(" ")[0] || "")}
        refresh={async () => {
          await Promise.all([state.reload(), actions.reload()]);
        }}
      >
        <ResourceNotice resource={state} />
        <ResourceNotice resource={actions} />
        {!!actions.data?.items.length && (
          <>
            <Txt kind="heading">
              {t("Perlu perhatian", "Needs your attention")}
            </Txt>
            {(expanded
              ? actions.data.items
              : actions.data.items.slice(0, 3)
            ).map((item) => {
              const p = customerActionPresentation(item, locale);
              return (
                <Panel key={item.id}>
                  <Txt kind="heading">{p.title}</Txt>
                  <Txt kind="small">
                    {[
                      item.packageName,
                      item.catererName,
                      item.serviceDate,
                      item.meal && mealLabel(item.meal, locale),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Txt>
                  {item.dueAt && (
                    <Txt kind="small">
                      {t("Batas waktu", "Due by")}:{" "}
                      {new Date(item.dueAt).toLocaleString(
                        locale === "id" ? "id-ID" : "en-GB",
                      )}
                    </Txt>
                  )}
                  <Btn
                    label={p.action}
                    onPress={() => router.push(nativeLink(item.href) as never)}
                  />
                </Panel>
              );
            })}
            {actions.data.items.length > 3 && (
              <Btn
                secondary
                label={
                  expanded
                    ? t("Tampilkan lebih sedikit", "Show fewer")
                    : `${t("Lihat semua", "View all")} (${actions.data.total})`
                }
                onPress={() => setExpanded(!expanded)}
              />
            )}
          </>
        )}
        <Txt kind="heading">
          {nextDate
            ? dateLabel(nextDate, locale)
            : t("Makanan berikutnya", "Next meals")}
        </Txt>
        {nextDate &&
          ["lunch", "dinner"].flatMap((meal) =>
            upcoming
              .filter(
                (d) =>
                  d.service_date === nextDate &&
                  d.meals.some((m) => m.meal === meal),
              )
              .map((d, i) => (
                <DeliveryCard
                  key={d.id + meal}
                  delivery={d}
                  meal={meal}
                  photo={meal === upcoming[0].meals[0].meal && i === 0}
                />
              )),
          )}
        {state.data && !nextDate && (
          <Empty
            title={t("Belum ada makanan berikutnya", "No upcoming meals")}
            body={
              subscriptions.length
                ? t(
                    "Paket aktif Anda tersedia di bawah. Buka jadwal untuk melihat tanggal lain.",
                    "Your active packages are below. Open the calendar to view other dates.",
                  )
                : t(
                    "Pilih paket untuk mulai merencanakan makanan Anda.",
                    "Choose a package to start planning your meals.",
                  )
            }
          />
        )}
        <Btn
          secondary
          label={t("Buka semua jadwal", "Open full calendar")}
          onPress={() => router.push("/calendar")}
        />
        {!!subscriptions.length && (
          <Txt kind="heading">{t("Paket aktif", "Active packages")}</Txt>
        )}
        {subscriptions.map((s) => (
          <Panel key={s.id}>
            <Txt kind="heading">{s.snapshot.offer.name}</Txt>
            <Txt>
              {s.remaining} {t("hari tersisa", "days remaining")} · {s.portions}{" "}
              {t("porsi tetap", "fixed portions")}
            </Txt>
            <Btn
              secondary
              label={t("Kelola / perpanjang", "Manage / renew")}
              onPress={() => router.push(("/subscriptions/" + s.id) as never)}
            />
          </Panel>
        ))}
        <Btn
          label={t("Jelajah paket", "Explore packages")}
          onPress={() => router.push("/discover")}
        />
      </Screen>
    </Gate>
  );
}
export function Calendar() {
  const { actor, t, locale } = useNative();
  const [date, setDate] = useState(localDay()),
    [all, setAll] = useState(false);
  const state = useData("calendar:" + date + ":" + all, () =>
    actor
      ? nativeApi.customer(`?from=${date}&to=${all ? addDays(date, 60) : date}`)
      : Promise.resolve(null),
  );
  const rows = (state.data?.deliveries || []).filter(
    (d) => all || d.service_date === date,
  );
  const days = [...new Set(rows.map((d) => d.service_date))].sort();
  return (
    <Gate next="/calendar">
      <Screen title={t("Jadwal makan", "Meal calendar")} refresh={state.reload}>
        <DayPicker
          label={t("Mulai dari tanggal", "Starting date")}
          value={date}
          onChange={setDate}
        />
        <View style={styles.row}>
          <Switch
            value={all}
            onValueChange={setAll}
            accessibilityLabel={t(
              "Lihat 60 hari berikutnya",
              "Show the next 60 days",
            )}
            trackColor={{ true: C.forest }}
          />
          <Txt style={{ flex: 1 }}>
            {t("Lihat 60 hari berikutnya", "Show the next 60 days")}
          </Txt>
        </View>
        <ResourceNotice resource={state} />
        {days.map((day) => (
          <View key={day} style={styles.stack}>
            <Txt kind="heading">{dateLabel(day, locale)}</Txt>
            {["lunch", "dinner"].flatMap((meal) =>
              rows
                .filter(
                  (d) =>
                    d.service_date === day &&
                    d.meals.some((m) => m.meal === meal),
                )
                .map((d) => (
                  <DeliveryCard key={d.id + meal} delivery={d} meal={meal} />
                )),
            )}
          </View>
        ))}
        {state.data && !rows.length && (
          <Empty
            title={t(
              "Tidak ada pengantaran di rentang ini",
              "No deliveries in this period",
            )}
            body={t(
              "Pilih tanggal lain atau lihat paket Anda di Akun.",
              "Choose another date or view your packages in Account.",
            )}
          />
        )}
        {all && (
          <Btn
            secondary
            label={t("60 hari berikutnya", "Next 60 days")}
            onPress={() => setDate(addDays(date, 61))}
          />
        )}
      </Screen>
    </Gate>
  );
}
