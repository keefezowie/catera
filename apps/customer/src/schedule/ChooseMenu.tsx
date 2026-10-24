import { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { useLocalSearchParams } from "expo-router";
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
import { plural, useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  FadeSwap,
  fontFor,
  FormError,
  PressableScale,
  ReadError,
  Screen,
  Segmented,
  Text,
  themedStyles,
  useColors,
  useConfirm,
  useToast,
  Photo,
  StickyAction,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { failureText } from "../account/failure";
import { FilterChip } from "../discover/FilterChip";
import { jakartaClock, photoUri } from "../today/Plate";
import { longDay, monthTitle, shiftMonth, weekdayName } from "./dates";
import { goToTab } from "../nav";
import { ChooseMenuSkeleton } from "../skeletons";
import { DecorativeIcon } from "../layout/DecorativeIcon";
import { DishCard } from "./DishCard";

type MenuDay = CustomerMenuMonth["dates"][number];
type Meal = "lunch" | "dinner";
type Choice = { slotId: string; optionId: string; optionVersion: number };
/** Under a day to the cutoff, the deadline line takes the attention ground. */
const SOON_MS = 24 * 3600_000;
type Draft = { days: MenuDay[]; choices: Choice[]; template: MealMenu; dirty: boolean };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The toast after saving: "Menu Selasa tersimpan", "Menu Selasa dan Rabu tersimpan", "Menu 3 hari tersimpan". */
function savedMessage(days: { date: string }[], t: (id: string, en: string) => string): string {
  const [first, second] = days;
  if (days.length === 1)
    return t(`Menu ${weekdayName(first.date, "id")} tersimpan`, `${weekdayName(first.date, "en")} menu saved`);
  if (days.length === 2)
    return t(
      `Menu ${weekdayName(first.date, "id")} dan ${weekdayName(second.date, "id")} tersimpan`,
      `${weekdayName(first.date, "en")} and ${weekdayName(second.date, "en")} menus saved`,
    );
  return t(`Menu ${days.length} hari tersimpan`, `Menus for ${days.length} days saved`);
}

/** Pilih menu: the customer picks the dishes for a delivery (customer-choice packages only). */
export function ChooseMenu() {
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const { actor, ready, t } = useMobile();
  const id = String(params.id ?? "");
  const routeDate = isDate(params.date) ? params.date : "";
  const routeMeal: Meal = params.meal === "dinner" ? "dinner" : "lunch";
  if (!ready)
    return (
      <Screen>
        <ChooseMenuSkeleton />
      </Screen>
    );
  if (!actor) {
    const query = new URLSearchParams({ ...(routeDate ? { date: routeDate } : {}), meal: routeMeal }).toString();
    return <SignInFirst title={t("Pilih menu", "Choose menus")} next={`/pilih-menu/${encodeURIComponent(id)}?${query}`} />;
  }
  return <Menu key={`${actor.id}:${id}`} id={id} routeDate={routeDate} routeMeal={routeMeal} />;
}

function Menu({ id, routeDate, routeMeal }: { id: string; routeDate: string; routeMeal: Meal }) {
  const { runtime, command, t, locale } = useMobile();
  // The choice callbacks below name their argument `c`, so the palette keeps a longer name here.
  const palette = useColors();
  const styles = useStyles();
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
  // Which command is waiting: Simpan menu and Hapus pilihan share one request at a time, each with its own spinner.
  const [sending, setSending] = useState<"" | "save" | "reset">("");
  const busy = sending !== "";
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [now, setNow] = useState(Date.now());
  const navigation = useNavigation();
  const menus = useData(`pilih-menu:${id}:${month}:${meal}:${offer ? "ready" : "wait"}`, () =>
    offer ? runtime.api.customerMenuMonth(id, `${month}-01`, meal) : Promise.resolve(null),
  );

  // Leaving with unsaved choices asks in the native confirm sheet; one question at a time.
  const confirm = useConfirm();
  const toast = useToast();
  const asking = useRef(false);
  const discard = async (then: () => void) => {
    if (asking.current) return;
    asking.current = true;
    try {
      const leave = await confirm({
        title: t("Buang pilihan menu?", "Discard menu choices?"),
        message: t("Pilihan yang belum disimpan akan hilang.", "Choices you haven't saved will be lost."),
        confirmLabel: t("Buang", "Discard"),
        cancelLabel: t("Lanjut memilih", "Keep choosing"),
        tone: "danger",
        icon: "trash",
      });
      if (leave) then();
    } finally {
      asking.current = false;
    }
  };
  usePreventRemove(!!draft?.dirty, ({ data }) => void discard(() => navigation.dispatch(data.action)));

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
    // The menus fade in from their skeleton as one block: every state of this screen keeps one FadeSwap in one place.
    return (
      <Screen>
        <FadeSwap swapKey={customer.error ? "error" : "loading"} style={{ gap: 16 }}>
          {customer.error ? (
            <ReadError art message={customer.error} onRetry={() => void customer.reload()} />
          ) : (
            <ChooseMenuSkeleton />
          )}
        </FadeSwap>
      </Screen>
    );

  if (!subscription || !offer)
    return (
      <Screen>
        <FadeSwap swapKey="missing" style={{ gap: 16 }}>
          <Text variant="heading">{t("Paket tidak ditemukan.", "Package not found.")}</Text>
          <Button label={t("Ke Jadwal", "Go to Schedule")} onPress={() => goToTab("jadwal")} />
        </FadeSwap>
      </Screen>
    );

  const options = (menus.data?.options ?? []).filter((o) => !o.archived);
  const dates = menus.data?.dates ?? [];
  const today = jakartaDay(new Date(now));
  const selected = dates.find((d) => d.date === date) ?? dates.find((d) => d.date >= today) ?? dates[0];
  const editable = (d: MenuDay) => d.editable && Date.parse(d.cutoffAt) > now;
  const menuState = (d: MenuDay) =>
    customerMenuPresentation({
      surface: "delivery",
      hasSavedMenu: !!d.details,
      editable: editable(d),
      selectionStatus: d.selectionStatus,
      activeOptionCount: options.length,
    }).state;
  const savedDays = dates.filter((d) => menuState(d) === "saved").length;
  const stateLabel = (d: MenuDay) => {
    const state = menuState(d);
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
    if (!draft || busy) return;
    setSending(action === "customerMenu.saveBatch" ? "save" : "reset");
    setError("");
    try {
      await command(action, {
        subscriptionId: id,
        meal,
        days: daysPayload(),
        ...(action === "customerMenu.saveBatch" ? { choices: draft.choices } : {}),
      });
      if (action === "customerMenu.saveBatch") toast.show({ message: savedMessage(draft.days, t), tone: "success" });
      setDraft(null);
      setReviewing(false);
    } catch (e) {
      setError(failureText(e, locale, t));
      setFailures((n) => n + 1);
    } finally {
      setSending("");
    }
  }

  function pick(slotId: string, optionId: string) {
    const option = options.find((o) => o.id === optionId);
    if (!draft || !option || !draft.days.every(editable)) return;
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

  // The editor's deadline is its earliest open day's cutoff; once any day has passed, FormError says so instead.
  const open = !!draft && draft.days.every(editable);
  const firstCutoff = draft ? [...draft.days].sort((a, b) => Date.parse(a.cutoffAt) - Date.parse(b.cutoffAt))[0] : undefined;
  const soon = !!firstCutoff && Date.parse(firstCutoff.cutoffAt) - now < SOON_MS;
  const deadline =
    open && firstCutoff ? (
      <View style={styles.deadlineRow}>
        <DecorativeIcon name="time-outline" size={18} color={soon ? palette.charcoal : palette.muted} />
        <Text
          variant={soon ? "bodyStrong" : "caption"}
          style={{ flex: 1, fontVariant: ["tabular-nums"] }}
        >
          {t(`Pilih sebelum ${cutoff(firstCutoff)}`, `Choose by ${cutoff(firstCutoff)}`)}
        </Text>
      </View>
    ) : null;

  // While editing, the one action is pinned under the page: Tinjau pilihan, then Simpan menu.
  const footer =
    offer.menuSelectionMode === "customer" && draft ? (
      reviewing ? (
        <StickyAction
          testID="menu-save"
          caption={t(
            "Pilihan yang sudah tersimpan di tanggal-tanggal ini akan diganti. Semua porsi dapat menu yang sama.",
            "Choices already saved on these dates will be replaced. Every portion gets the same menu.",
          )}
          label={t("Simpan menu", "Save menu")}
          busy={sending === "save"}
          disabled={!valid || !writeable || sending === "reset"}
          onPress={() => void send("customerMenu.saveBatch")}
        />
      ) : (
        <StickyAction
          testID="menu-review"
          label={t("Tinjau pilihan", "Review choice")}
          disabled={!valid || !writeable || sending === "reset"}
          onPress={() => setReviewing(true)}
        />
      )
    ) : undefined;

  return (
    <Screen footer={footer}>
      <FadeSwap swapKey="ready" style={{ gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text variant="title">{offer.name}</Text>
          <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
            {t(
              `Satu pilihan untuk semua ${subscription.portions} porsi. Tanpa biaya tambahan.`,
              subscription.portions === 1 ? "Your portion gets this choice. No extra charge." : `One choice for all ${subscription.portions} portions. No extra charge.`,
            )}
          </Text>
        </View>

        {offer.menuSelectionMode !== "customer" ? (
          <Text>{t("Katering yang memilih menu paket ini.", "The caterer picks the menu for this package.")}</Text>
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
            {dates.length ? (
              <Text variant="caption" testID="menu-count" style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>
                {t(
                  `${savedDays} dari ${dates.length} hari sudah dipilih`,
                  `${savedDays} of ${dates.length} ${dates.length === 1 ? "day" : "days"} chosen`,
                )}
              </Text>
            ) : null}
            {offer.meal === "both" ? (
              <Segmented<Meal>
                options={(["lunch", "dinner"] as const).map((value) => ({ value, label: mealLabel(value, locale) }))}
                value={meal}
                onChange={setMeal}
              />
            ) : null}
            {menus.error ? <ReadError message={menus.error} onRetry={() => void menus.reload()} /> : null}
            {menus.data && !dates.length ? (
              <Text style={{ color: palette.muted }}>
                {t("Tidak ada pengantaran bulan ini.", "No deliveries this month.")}
              </Text>
            ) : null}
            <View>
              {dates.map((d, i) => (
                <PressableScale
                  key={d.dayId}
                  haptic="select"
                  accessibilityRole="button"
                  accessibilityState={{ selected: d.dayId === selected?.dayId }}
                  onPress={() => setDate(d.date)}
                  style={[styles.dateRow, i > 0 && styles.divider, d.dayId === selected?.dayId && styles.dateOn]}
                >
                  <Text style={{ flex: 1, fontFamily: fontFor("700") }}>{longDay(d.date, locale)}</Text>
                  <Text variant="caption">{stateLabel(d)}</Text>
                </PressableScale>
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
                      "Kalau kamu belum menyimpan pilihan sebelum batas waktu, katering yang memilihkan menunya.",
                      "If you don't save a choice before the cutoff, the caterer picks for you.",
                    )}
                  </Text>
                )}
              </Card>
            ) : null}
          </>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text variant="heading">
                {reviewing ? t("Periksa pilihan menu", "Check your choice") : t("Lengkapi pilihan", "Complete your choice")}
              </Text>
              <Text>
                {draft.days.map((d) => longDay(d.date, locale)).join(" · ")} · {mealLabel(meal, locale)}
              </Text>
            </View>
            {deadline ? (
              soon ? (
                <View testID="menu-deadline" style={styles.soon}>
                  {deadline}
                </View>
              ) : (
                <View testID="menu-deadline">{deadline}</View>
              )
            ) : null}
            {!open ? (
              <FormError
                message={t(
                  "Batas memilih sudah lewat, jadi pilihan ini tidak bisa disimpan. Katering yang memilihkan.",
                  "The cutoff has passed, so this choice can't be saved. The caterer will pick.",
                )}
              />
            ) : null}
            {slots.map((slot) => {
              const choice = draft.choices.find((c) => c.slotId === slot.id);
              const dish = options.find((o) => o.id === choice?.optionId);
              return (
                <View key={slot.id} style={{ gap: 8 }}>
                  {reviewing ? (
                    <Text style={{ fontFamily: fontFor("700") }}>{`${slot.label} · ${dish?.name ?? ""}`}</Text>
                  ) : (
                    <>
                      <Text variant="label">{slot.label}</Text>
                      <View style={styles.grid}>
                        {options
                          .filter(
                            (o) =>
                              o.categoryId === slot.category &&
                              !draft.choices.some((c) => c.slotId !== slot.id && c.optionId === o.id),
                          )
                          .map((o) => (
                            <DishCard
                              key={o.id}
                              id={o.id}
                              name={o.name}
                              serving={o.serving || undefined}
                              uri={o.image ? photoUri(o.image, runtime.apiBase) : undefined}
                              label={o.name + (o.serving ? ` · ${o.serving}` : "")}
                              selected={choice?.optionId === o.id}
                              disabled={!open}
                              onPress={() => pick(slot.id, o.id)}
                            />
                          ))}
                      </View>
                    </>
                  )}
                  {/* The review shows each chosen dish's photo once more under its line. */}
                  {reviewing && dish?.image ? (
                    <Photo uri={photoUri(dish.image, runtime.apiBase)} style={styles.photo} accessibilityLabel={dish.name} />
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
              </>
            ) : (
              <>
                {error ? <FormError message={error} failureKey={failures} testID="menu-error" /> : null}
                <Button variant="secondary" label={t("Lanjut memilih", "Keep choosing")} onPress={() => setReviewing(false)} />
              </>
            )}
            {!reviewing && error ? <FormError message={error} failureKey={failures} testID="menu-error" /> : null}
            {draft.days.some((d) => d.version > 0) ? (
              <Button
                variant="text"
                label={t("Hapus pilihan, biar katering memilih", "Clear my choice, let the caterer choose")}
                busy={sending === "reset"}
                disabled={!writeable || sending === "save"}
                onPress={() =>
                  void confirm({
                    title: t("Hapus pilihan menu?", "Clear menu choice?"),
                    message: t(
                      "Pilihan di tanggal-tanggal ini akan dihapus. Kalau kamu tidak memilih lagi sebelum batas waktu, katering yang memilihkan.",
                      "Your choices on these dates will be removed. If you don't choose again before the cutoff, the caterer picks.",
                    ),
                    confirmLabel: t("Hapus pilihan", "Clear choice"),
                    cancelLabel: t("Batal", "Cancel"),
                    tone: "danger",
                    icon: "trash",
                  }).then((clear) => {
                    if (clear) void send("customerMenu.resetBatch");
                  })
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
                if (draft.dirty) void discard(close);
                else close();
              }}
            />
          </View>
        )}
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  monthRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  dateOn: { backgroundColor: c.sage, borderRadius: 10 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { height: 120, borderRadius: 12, backgroundColor: c.sage },
  // Dish cards: two columns 12 apart, 16 between rows (the cards carry their own 2dp ring and 4 inset).
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 16 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Under a day: the page's `fill` step with the warm attention edge, never the shared attention card (its `cream`
  // ground is forest in dark). The ink stays charcoal.
  soon: {
    backgroundColor: c.fill,
    borderColor: c.attentionBorder,
    borderWidth: 1,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    padding: nativeLayout.cardPadding - 1,
  },
}));
