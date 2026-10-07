import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useNavigation, usePreventRemove } from "expo-router/react-navigation";
import {
  componentLabel,
  customerMenuPresentation,
  jakartaDay,
  mealLabel,
  menuSummary,
  type CustomerMenuMonth,
  type MealMenu,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Segmented, Text } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { failureText } from "../account/failure";
import { FilterChip } from "../discover/FilterChip";
import { jakartaClock, photoUri } from "../today/Plate";
import { longDay, monthTitle, shiftMonth } from "./dates";

type MenuDay = CustomerMenuMonth["dates"][number];
type Meal = "lunch" | "dinner";
type Choice = { slotId: string; optionId: string; optionVersion: number };
type Draft = { days: MenuDay[]; choices: Choice[]; template: MealMenu; dirty: boolean };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Pilih menu: the customer picks the dishes for a delivery (customer-choice packages only). */
export function ChooseMenu() {
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const { actor, ready, t } = useMobile();
  const id = String(params.id ?? "");
  const routeDate = isDate(params.date) ? params.date : "";
  const routeMeal: Meal = params.meal === "dinner" ? "dinner" : "lunch";
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) {
    const query = new URLSearchParams({ ...(routeDate ? { date: routeDate } : {}), meal: routeMeal }).toString();
    return <SignInFirst title={t("Pilih menu", "Choose menus")} next={`/pilih-menu/${encodeURIComponent(id)}?${query}`} />;
  }
  return <Menu key={`${actor.id}:${id}`} id={id} routeDate={routeDate} routeMeal={routeMeal} />;
}

function Menu({ id, routeDate, routeMeal }: { id: string; routeDate: string; routeMeal: Meal }) {
  const { runtime, command, t, locale } = useMobile();
  const customer = useData("pilih-menu:customer", () => runtime.api.customer());
  const subscription = customer.data?.subscriptions.find((s) => s.id === id);
  const offer = subscription?.snapshot.offer;
  const [month, setMonth] = useState((routeDate || jakartaDay(new Date())).slice(0, 7));
  const [chosenMeal, setMeal] = useState<Meal>(routeMeal);
  // A single-meal package always uses its own meal.
  const meal: Meal = offer?.meal === "dinner" ? "dinner" : offer?.meal === "lunch" ? "lunch" : chosenMeal;
  const [date, setDate] = useState(routeDate);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [moreDates, setMoreDates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const navigation = useNavigation();
  const menus = useData(`pilih-menu:${id}:${month}:${meal}:${offer ? "ready" : "wait"}`, () =>
    offer ? runtime.api.customerMenuMonth(id, `${month}-01`, meal) : Promise.resolve(null),
  );

  const discard = (then: () => void) =>
    Alert.alert(
      t("Tinggalkan perubahan?", "Discard changes?"),
      t("Menu yang belum disimpan akan dihapus.", "Unsaved menu changes will be discarded."),
      [
        { text: t("Lanjut mengedit", "Keep editing"), style: "cancel" },
        { text: t("Tinggalkan", "Discard"), style: "destructive", onPress: then },
      ],
    );
  usePreventRemove(!!draft?.dirty, ({ data }) => discard(() => navigation.dispatch(data.action)));

  // The cutoff passes while the screen is open; coming back from another app re-reads the month.
  const reload = menus.reload;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    const foreground = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      setNow(Date.now());
      void reload();
    });
    return () => {
      clearInterval(timer);
      foreground.remove();
    };
  }, [reload]);

  if (!customer.data || (offer && offer.menuSelectionMode === "customer" && !menus.data && !menus.error))
    return customer.error ? (
      <Screen>
        <Text style={{ color: colors.danger }}>{customer.error}</Text>
        <Button label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
      </Screen>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );

  if (!subscription || !offer)
    return (
      <Screen>
        <Text variant="heading">{t("Paket tidak ditemukan.", "Package not found.")}</Text>
        <Button label={t("Ke Jadwal", "Go to Schedule")} onPress={() => router.replace("/jadwal" as never)} />
      </Screen>
    );

  const options = (menus.data?.options ?? []).filter((o) => !o.archived);
  const dates = menus.data?.dates ?? [];
  const today = jakartaDay(new Date(now));
  const selected = dates.find((d) => d.date === date) ?? dates.find((d) => d.date >= today) ?? dates[0];
  const editable = (d: MenuDay) => d.editable && Date.parse(d.cutoffAt) > now;
  const stateLabel = (d: MenuDay) => {
    const state = customerMenuPresentation({
      surface: "delivery",
      hasSavedMenu: !!d.details,
      editable: editable(d),
      selectionStatus: d.selectionStatus,
      activeOptionCount: options.length,
    }).state;
    return state === "saved"
      ? t("Menu tersimpan", "Menu saved")
      : state === "selection_due"
        ? t("Pilih menu", "Choose a menu")
        : state === "caterer_choice"
          ? t("Katering memilih", "Caterer chooses")
          : t("Menu belum diumumkan", "Menu not announced yet");
  };
  const cutoff = (d: MenuDay) => `${longDay(jakartaDay(new Date(d.cutoffAt)), locale)} ${jakartaClock(d.cutoffAt)}`;

  function edit(day: MenuDay) {
    const template = day.details || offer!.menus.find((m) => m.meal === meal);
    if (!template) return;
    setError("");
    setMoreDates(false);
    setReviewing(false);
    setDraft({
      days: [{ ...day }],
      template,
      choices: (day.details?.items ?? [])
        .filter((i) => i.optionId && i.optionVersion)
        .map((i) => ({ slotId: i.id, optionId: i.optionId!, optionVersion: i.optionVersion! })),
      dirty: false,
    });
  }

  const slots =
    draft?.template.composition?.flatMap((g) =>
      Array.from({ length: g.slots }, (_, n) => ({
        id: `${g.id}:${n}`,
        category: g.categoryId,
        label: componentLabel(g, locale) + (g.slots > 1 ? ` ${n + 1}` : ""),
      })),
    ) ?? [];
  const valid =
    !!draft &&
    slots.length > 0 &&
    slots.every((s) =>
      draft.choices.some(
        (c) =>
          c.slotId === s.id &&
          options.some((o) => o.id === c.optionId && o.version === c.optionVersion && o.categoryId === s.category),
      ),
    ) &&
    new Set(draft.choices.map((c) => c.optionId)).size === slots.length;
  const writeable = !!menus.data && !menus.error && !!draft?.days.every(editable);
  const daysPayload = () =>
    draft!.days.map((d) => ({ id: d.dayId, date: d.date, deliveryVersion: d.deliveryVersion, version: d.version }));

  async function send(action: "customerMenu.saveBatch" | "customerMenu.resetBatch") {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await command(action, {
        subscriptionId: id,
        meal,
        days: daysPayload(),
        ...(action === "customerMenu.saveBatch" ? { choices: draft.choices } : {}),
      });
      setDraft(null);
      setReviewing(false);
    } catch (e) {
      setError(failureText(e, locale, t));
    } finally {
      setBusy(false);
    }
  }

  function pick(slotId: string, optionId: string) {
    const option = options.find((o) => o.id === optionId);
    if (!draft || !option) return;
    setDraft({
      ...draft,
      dirty: true,
      choices: [
        ...draft.choices.filter((c) => c.slotId !== slotId),
        { slotId, optionId: option.id, optionVersion: option.version },
      ],
    });
  }

  function toggleDay(day: MenuDay) {
    if (!draft) return;
    const included = draft.days.some((d) => d.dayId === day.dayId);
    setDraft({
      ...draft,
      dirty: true,
      days: included ? draft.days.filter((d) => d.dayId !== day.dayId) : [...draft.days, { ...day }],
    });
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="title">{offer.name}</Text>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {t(
            `Satu pilihan untuk semua ${subscription.portions} porsi. Tanpa biaya tambahan.`,
            `One choice for all ${subscription.portions} portions. No extra charge.`,
          )}
        </Text>
      </View>

      {offer.menuSelectionMode !== "customer" ? (
        <Text>{t("Menu paket ini ditentukan oleh katering.", "The caterer chooses this package's menus.")}</Text>
      ) : !draft ? (
        <>
          <View style={styles.monthRow}>
            <Button
              variant="text"
              label="‹"
              accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
              onPress={() => {
                setMonth(shiftMonth(month, -1));
                setDate("");
              }}
            />
            <Text variant="heading" style={{ flex: 1, textAlign: "center" }}>
              {monthTitle(month, locale)}
            </Text>
            <Button
              variant="text"
              label="›"
              accessibilityLabel={t("Bulan berikutnya", "Next month")}
              onPress={() => {
                setMonth(shiftMonth(month, 1));
                setDate("");
              }}
            />
          </View>
          {offer.meal === "both" ? (
            <Segmented<Meal>
              options={(["lunch", "dinner"] as const).map((value) => ({ value, label: mealLabel(value, locale) }))}
              value={meal}
              onChange={setMeal}
            />
          ) : null}
          {menus.error ? <Text style={{ color: colors.danger }}>{menus.error}</Text> : null}
          {menus.data && !dates.length ? (
            <Text style={{ color: colors.muted }}>
              {t("Tidak ada pengantaran bulan ini.", "No deliveries this month.")}
            </Text>
          ) : null}
          <View>
            {dates.map((d, i) => (
              <Pressable
                key={d.dayId}
                accessibilityRole="button"
                accessibilityState={{ selected: d.dayId === selected?.dayId }}
                onPress={() => setDate(d.date)}
                style={[styles.dateRow, i > 0 && styles.divider, d.dayId === selected?.dayId && styles.dateOn]}
              >
                <Text style={{ flex: 1, fontWeight: "700" }}>{longDay(d.date, locale)}</Text>
                <Text variant="caption">{stateLabel(d)}</Text>
              </Pressable>
            ))}
          </View>
          {selected ? (
            <Card>
              <Text variant="heading">{longDay(selected.date, locale)}</Text>
              <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                {stateLabel(selected)} · {t("batas pilihan", "choose by")} {cutoff(selected)}
              </Text>
              {selected.details ? <Text>{menuSummary(selected.details, locale)}</Text> : null}
              {editable(selected) && options.length ? (
                <Button
                  label={selected.details ? t("Ubah menu", "Change menu") : t("Pilih hidangan", "Choose dishes")}
                  onPress={() => edit(selected)}
                />
              ) : (
                <Text>
                  {t(
                    "Jika pilihan belum tersimpan sebelum batas waktu, katering yang memilih menu Anda.",
                    "If no choice is saved before the cutoff, the caterer chooses your menu.",
                  )}
                </Text>
              )}
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <Text variant="heading">
            {reviewing ? t("Periksa pilihan menu", "Check your choice") : t("Lengkapi pilihan", "Complete your choice")}
          </Text>
          <Text>
            {draft.days.map((d) => longDay(d.date, locale)).join(" · ")} · {mealLabel(meal, locale)}
          </Text>
          {!draft.days.every(editable) ? (
            <Text style={{ color: colors.danger }}>
              {t(
                "Batas pilihan sudah lewat. Pilihan ini tidak bisa disimpan; katering yang memilih.",
                "The cutoff has passed. This choice can't be saved; the caterer chooses.",
              )}
            </Text>
          ) : null}
          {slots.map((slot) => {
            const choice = draft.choices.find((c) => c.slotId === slot.id);
            const dish = options.find((o) => o.id === choice?.optionId);
            return (
              <View key={slot.id} style={{ gap: 8 }}>
                {reviewing ? (
                  <Text style={{ fontWeight: "700" }}>{`${slot.label} · ${dish?.name ?? ""}`}</Text>
                ) : (
                  <>
                    <Text variant="label">{slot.label}</Text>
                    <View style={styles.chips}>
                      {options
                        .filter(
                          (o) =>
                            o.categoryId === slot.category &&
                            !draft.choices.some((c) => c.slotId !== slot.id && c.optionId === o.id),
                        )
                        .map((o) => (
                          <FilterChip
                            key={o.id}
                            label={o.name + (o.serving ? ` · ${o.serving}` : "")}
                            selected={choice?.optionId === o.id}
                            onPress={() => pick(slot.id, o.id)}
                          />
                        ))}
                    </View>
                  </>
                )}
                {dish?.image ? (
                  <Image
                    source={{ uri: photoUri(dish.image, runtime.apiBase) }}
                    style={styles.photo}
                    accessibilityLabel={dish.name}
                  />
                ) : null}
                {dish?.description ? <Text variant="caption">{dish.description}</Text> : null}
              </View>
            );
          })}
          {!reviewing ? (
            <>
              <Button
                variant="secondary"
                label={t("Terapkan juga ke tanggal lain", "Use it on other dates too")}
                onPress={() => setMoreDates((v) => !v)}
              />
              {moreDates ? (
                <View style={styles.chips}>
                  {dates
                    .filter((d) => d.dayId !== draft.days[0]?.dayId && editable(d))
                    .map((d) => (
                      <FilterChip
                        key={d.dayId}
                        label={longDay(d.date, locale)}
                        selected={draft.days.some((x) => x.dayId === d.dayId)}
                        onPress={() => toggleDay(d)}
                      />
                    ))}
                </View>
              ) : null}
              <Button
                label={t("Tinjau pilihan", "Review choice")}
                disabled={!valid || !writeable}
                onPress={() => setReviewing(true)}
              />
            </>
          ) : (
            <>
              <Text variant="caption">
                {t(
                  "Pilihan yang sudah tersimpan pada tanggal di atas akan diganti. Semua porsi mendapat menu yang sama.",
                  "Choices already saved on these dates will be replaced. All portions get the same menu.",
                )}
              </Text>
              {error ? (
                <Text style={{ color: colors.danger }} testID="menu-error">
                  {error}
                </Text>
              ) : null}
              <Button
                label={t("Simpan menu", "Save menu")}
                disabled={busy || !valid || !writeable}
                onPress={() => void send("customerMenu.saveBatch")}
              />
              <Button variant="secondary" label={t("Lanjut mengedit", "Keep editing")} onPress={() => setReviewing(false)} />
            </>
          )}
          {!reviewing && error ? (
            <Text style={{ color: colors.danger }} testID="menu-error">
              {error}
            </Text>
          ) : null}
          {draft.days.some((d) => d.version > 0) ? (
            <Button
              variant="text"
              label={t("Hapus pilihan, biar katering memilih", "Clear my choice, let the caterer choose")}
              disabled={busy || !writeable}
              onPress={() =>
                Alert.alert(
                  t("Hapus pilihan menu?", "Clear menu choice?"),
                  t(
                    "Pilihan pada tanggal di atas dihapus. Katering memilih jika Anda tidak memilih lagi sebelum batas waktu.",
                    "Choices on these dates are removed. The caterer chooses if you don't choose again before the cutoff.",
                  ),
                  [
                    { text: t("Batal", "Cancel"), style: "cancel" },
                    {
                      text: t("Hapus pilihan", "Clear choice"),
                      style: "destructive",
                      onPress: () => void send("customerMenu.resetBatch"),
                    },
                  ],
                )
              }
            />
          ) : null}
          <Button
            variant="text"
            label={t("Tutup", "Close")}
            onPress={() => {
              const close = () => {
                setDraft(null);
                setReviewing(false);
                setError("");
              };
              if (draft.dirty) discard(close);
              else close();
            }}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  dateOn: { backgroundColor: colors.sage, borderRadius: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { height: 120, borderRadius: 12, backgroundColor: colors.sage },
});
