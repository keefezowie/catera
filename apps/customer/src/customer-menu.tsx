import { useEffect, useState } from "react";
import { Alert, AppState, Switch, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useNavigation, usePreventRemove } from "expo-router/react-navigation";
import {
  componentLabel,
  customerMenuPresentation,
  localDay,
  mealLabel,
  menuSummary,
  type CustomerMenuMonth,
  type MealMenu,
} from "@catera/domain";
import { nativeApi, useData, useNative } from "./context";
import {
  Btn,
  Empty,
  Gate,
  Panel,
  Photo,
  ResourceNotice,
  Run,
  Screen,
  Select,
  Txt,
  styles,
} from "./ui";

type MenuDay = CustomerMenuMonth["dates"][number];
type Choice = { slotId: string; optionId: string; optionVersion: number };
type Draft = {
  days: MenuDay[];
  choices: Choice[];
  template: MealMenu;
  dirty: boolean;
};
function monthAfter(month: string, delta: number) {
  const d = new Date(month + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function CustomerMenuScreen() {
  const {
    id,
    date: routeDate,
    meal: routeMeal,
  } = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const { actor } = useNative();
  return (
    <CustomerMenu
      key={`${actor?.id}:${id}`}
      id={id}
      routeDate={routeDate}
      routeMeal={routeMeal}
    />
  );
}
function CustomerMenu({
  id,
  routeDate,
  routeMeal,
}: {
  id: string;
  routeDate?: string;
  routeMeal?: string;
}) {
  const { actor, command, t, locale } = useNative();
  const state = useData("menu-subscription:" + id, () =>
    actor ? nativeApi.customer() : Promise.resolve(null),
  );
  const subscription = state.data?.subscriptions.find((s) => s.id === id);
  const offer = subscription?.snapshot.offer;
  const [month, setMonth] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(routeDate || "")
      ? routeDate!.slice(0, 7)
      : localDay().slice(0, 7),
  );
  const [meal, setMeal] = useState(routeMeal === "dinner" ? "dinner" : "lunch");
  const [date, setDate] = useState(routeDate || "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [moreDates, setMoreDates] = useState(false);
  const [now, setNow] = useState(Date.now());
  const navigation = useNavigation();
  usePreventRemove(!!draft?.dirty, ({ data }) => {
    Alert.alert(
      t("Tinggalkan perubahan?", "Discard changes?"),
      t(
        "Menu yang belum disimpan akan dihapus.",
        "Unsaved menu changes will be discarded.",
      ),
      [
        { text: t("Lanjut mengedit", "Keep editing"), style: "cancel" },
        {
          text: t("Tinggalkan", "Discard"),
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  const menus = useData("customer-menu:" + id + ":" + month + ":" + meal, () =>
    actor && offer
      ? nativeApi.customerMenuMonth(id, month + "-01", meal)
      : Promise.resolve(null),
  );
  // The subscription may resolve after the menu read's first render.
  useEffect(() => {
    if (offer) {
      if (offer.meal === "dinner") setMeal("dinner");
      void menus.reload();
    }
  }, [offer?.id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const foreground = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        setNow(Date.now());
        void menus.reload();
      }
    });
    return () => {
      clearInterval(timer);
      foreground.remove();
    };
  }, [menus.reload]);
  const day = menus.data?.dates.find((d) => d.date === date);
  const active = menus.data?.options.filter((o) => !o.archived) || [];
  const editable = (d: MenuDay) =>
    d.editable && new Date(d.cutoffAt).getTime() > now;
  const label = (d: MenuDay) => {
    const state = customerMenuPresentation({
      surface: "delivery",
      hasSavedMenu: !!d.details,
      editable: editable(d),
      selectionStatus: d.selectionStatus,
      activeOptionCount: active.length,
    }).state;
    return state === "saved"
      ? t("Menu tersimpan", "Saved menu")
      : state === "selection_due"
        ? t("Pilih menu", "Choose menu")
        : state === "caterer_choice"
          ? t("Katerer memilih", "Caterer chooses")
          : t("Menu belum diumumkan", "Menu not announced");
  };
  const cutoff = (d: MenuDay) =>
    new Date(d.cutoffAt).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
      timeZone: offer?.timezone || "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
    });
  function change(action: () => void) {
    if (draft?.dirty)
      Alert.alert(
        t("Tinggalkan perubahan?", "Discard changes?"),
        t(
          "Menu yang belum disimpan akan dihapus.",
          "Unsaved menu changes will be discarded.",
        ),
        [
          { text: t("Lanjut mengedit", "Keep editing"), style: "cancel" },
          {
            text: t("Tinggalkan", "Discard"),
            style: "destructive",
            onPress: () => {
              setDraft(null);
              setReviewing(false);
              action();
            },
          },
        ],
      );
    else {
      setDraft(null);
      setReviewing(false);
      action();
    }
  }
  function edit(selected: MenuDay) {
    const template =
      selected.details || offer?.menus.find((m) => m.meal === meal);
    if (!template) return;
    setDraft({
      days: [{ ...selected }],
      template,
      choices: (selected.details?.items || [])
        .filter((i) => i.optionId && i.optionVersion)
        .map((i) => ({
          slotId: i.id,
          optionId: i.optionId!,
          optionVersion: i.optionVersion!,
        })),
      dirty: false,
    });
    setReviewing(false);
  }
  const slots =
    draft?.template.composition?.flatMap((g) =>
      Array.from({ length: g.slots }, (_, n) => ({
        id: g.id + ":" + n,
        category: g.categoryId,
        label: componentLabel(g, locale) + (g.slots > 1 ? " " + (n + 1) : ""),
      })),
    ) || [];
  const valid =
    !!draft &&
    slots.length > 0 &&
    slots.every((s) =>
      draft.choices.some(
        (c) =>
          c.slotId === s.id &&
          active.some(
            (o) =>
              o.id === c.optionId &&
              o.version === c.optionVersion &&
              o.categoryId === s.category,
          ),
      ),
    ) &&
    new Set(draft.choices.map((c) => c.optionId)).size === slots.length;
  const writeable =
    menus.canWrite && state.canWrite && !!draft?.days.every(editable);
  const payload = () => ({
    subscriptionId: id,
    meal,
    days: draft!.days.map((d) => ({
      id: d.dayId,
      date: d.date,
      deliveryVersion: d.deliveryVersion,
      version: d.version,
    })),
  });
  return (
    <Gate
      next={`/subscriptions/${id}/menu?month=${month}&date=${date}&meal=${meal}`}
    >
      <Screen
        title={t("Pilih menu", "Choose menus")}
        refresh={async () => {
          await Promise.all([state.reload(), menus.reload()]);
        }}
      >
        <ResourceNotice resource={state} />
        <ResourceNotice resource={menus} />
        {state.data && !subscription && (
          <Empty
            title={t("Langganan tidak ditemukan", "Subscription not found")}
          />
        )}
        {offer && (
          <>
            <Txt kind="heading">{offer.name}</Txt>
            <Txt kind="small">
              {t(
                "Satu pilihan menu berlaku untuk semua",
                "One menu selection applies to all",
              )}{" "}
              {subscription!.portions}{" "}
              {t("porsi. Tanpa biaya tambahan.", "portions. No extra charge.")}
            </Txt>
            {offer.menuSelectionMode !== "customer" ? (
              <Txt>
                {t(
                  "Menu paket ini ditentukan oleh katerer.",
                  "The caterer chooses this package’s menus.",
                )}
              </Txt>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Btn
                      secondary
                      label={t("Bulan sebelumnya", "Previous month")}
                      onPress={() =>
                        change(() => {
                          setMonth(monthAfter(month, -1));
                          setDate("");
                        })
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Btn
                      secondary
                      label={t("Bulan berikutnya", "Next month")}
                      onPress={() =>
                        change(() => {
                          setMonth(monthAfter(month, 1));
                          setDate("");
                        })
                      }
                    />
                  </View>
                </View>
                <Txt kind="heading">
                  {new Date(month + "-01T12:00:00Z").toLocaleDateString(
                    locale === "id" ? "id-ID" : "en-GB",
                    { month: "long", year: "numeric", timeZone: "UTC" },
                  )}
                </Txt>
                {offer.meal === "both" && (
                  <Select
                    label={t("Waktu makan", "Meal")}
                    value={meal}
                    onChange={(v) => change(() => setMeal(v))}
                    options={["lunch", "dinner"].map((value) => ({
                      value,
                      label: mealLabel(value, locale),
                    }))}
                  />
                )}
                <Select
                  label={t("Tanggal pengantaran", "Delivery date")}
                  value={date}
                  onChange={(v) => change(() => setDate(v))}
                  options={(menus.data?.dates || []).map((d) => ({
                    value: d.date,
                    label: `${d.date} · ${label(d)}`,
                  }))}
                />
                {menus.data && !menus.data.dates.length && (
                  <Empty
                    title={t(
                      "Tidak ada pengantaran bulan ini",
                      "No deliveries this month",
                    )}
                    body={t(
                      "Pindah bulan untuk melihat jadwal langganan.",
                      "Change month to see your subscription schedule.",
                    )}
                  />
                )}
                {!date && !!menus.data?.dates.length && (
                  <Btn
                    label={t("Buka tanggal terdekat", "Open next delivery")}
                    onPress={() =>
                      setDate(
                        menus.data!.dates.find((d) => d.date >= localDay())
                          ?.date || menus.data!.dates[0].date,
                      )
                    }
                  />
                )}
                {day && !draft && (
                  <Panel>
                    <Txt kind="heading">{label(day)}</Txt>
                    <Txt kind="small">
                      {t("Batas pilihan", "Selection cutoff")}: {cutoff(day)} ·{" "}
                      {offer.timezone}
                    </Txt>
                    {day.details && (
                      <Txt>{menuSummary(day.details, locale)}</Txt>
                    )}
                    {editable(day) && active.length > 0 ? (
                      <Btn
                        label={
                          day.details
                            ? t("Ubah menu", "Edit menu")
                            : t("Pilih hidangan", "Choose dishes")
                        }
                        disabled={!menus.canWrite}
                        onPress={() => edit(day)}
                      />
                    ) : (
                      <Txt>
                        {t(
                          "Jika pilihan belum tersimpan sebelum batas waktu, katerer akan memilih menu Anda.",
                          "If no menu is saved before the cutoff, the caterer will choose for you.",
                        )}
                      </Txt>
                    )}
                  </Panel>
                )}
                {draft && (
                  <Panel>
                    <Txt kind="heading">
                      {reviewing
                        ? t("Periksa pilihan menu", "Review menu selection")
                        : t("Lengkapi pilihan", "Complete your selection")}
                    </Txt>
                    <Txt>
                      {draft.days.map((d) => d.date).join(" · ")} ·{" "}
                      {mealLabel(meal, locale)}
                    </Txt>
                    {!draft.days.every(editable) && (
                      <Txt>
                        {t(
                          "Batas pilihan sudah lewat. Pilihan ini tidak dapat disimpan. Katerer memilih tanggal yang belum memiliki menu.",
                          "The cutoff has passed. This selection cannot be saved. The caterer chooses for dates without a saved menu.",
                        )}
                      </Txt>
                    )}
                    {slots.map((slot) => {
                      const choice = draft.choices.find(
                        (c) => c.slotId === slot.id,
                      );
                      const dish = active.find(
                        (o) => o.id === choice?.optionId,
                      );
                      return (
                        <View key={slot.id} style={styles.stack}>
                          {reviewing ? (
                            <Txt kind="label">
                              {slot.label} · {dish?.name}
                            </Txt>
                          ) : (
                            <Select
                              label={slot.label}
                              value={choice?.optionId || ""}
                              options={active
                                .filter(
                                  (o) =>
                                    o.categoryId === slot.category &&
                                    !draft.choices.some(
                                      (c) =>
                                        c.slotId !== slot.id &&
                                        c.optionId === o.id,
                                    ),
                                )
                                .map((o) => ({
                                  value: o.id,
                                  label:
                                    o.name +
                                    (o.serving ? " · " + o.serving : ""),
                                }))}
                              onChange={(value) => {
                                const option = active.find(
                                  (o) => o.id === value,
                                )!;
                                setDraft({
                                  ...draft,
                                  dirty: true,
                                  choices: [
                                    ...draft.choices.filter(
                                      (c) => c.slotId !== slot.id,
                                    ),
                                    {
                                      slotId: slot.id,
                                      optionId: option.id,
                                      optionVersion: option.version,
                                    },
                                  ],
                                });
                              }}
                            />
                          )}
                          {dish?.image && (
                            <Photo src={dish.image} height={120} />
                          )}
                          {dish?.description && (
                            <Txt kind="small">{dish.description}</Txt>
                          )}
                        </View>
                      );
                    })}
                    {!reviewing && (
                      <>
                        <Btn
                          secondary
                          label={t(
                            "Terapkan juga ke tanggal lain",
                            "Apply to more dates",
                          )}
                          onPress={() => setMoreDates(!moreDates)}
                        />
                        {moreDates &&
                          menus.data?.dates
                            .filter((d) => d.date !== date && editable(d))
                            .map((d) => (
                              <View key={d.dayId} style={styles.row}>
                                <Switch
                                  accessibilityLabel={
                                    t("Terapkan ke ", "Apply to ") + d.date
                                  }
                                  value={draft.days.some(
                                    (x) => x.dayId === d.dayId,
                                  )}
                                  onValueChange={(value) =>
                                    setDraft({
                                      ...draft,
                                      dirty: true,
                                      days: value
                                        ? [...draft.days, { ...d }]
                                        : draft.days.filter(
                                            (x) => x.dayId !== d.dayId,
                                          ),
                                    })
                                  }
                                />
                                <Txt style={{ flex: 1 }}>
                                  {d.date} · {label(d)}
                                </Txt>
                              </View>
                            ))}
                        <Btn
                          label={t("Tinjau pilihan", "Review selection")}
                          disabled={!valid || !writeable}
                          onPress={() => setReviewing(true)}
                        />
                      </>
                    )}
                    {reviewing && (
                      <>
                        <Txt kind="small">
                          {t(
                            "Pilihan tersimpan pada semua tanggal di atas akan diganti. Semua porsi mendapat menu yang sama.",
                            "Saved choices on these dates will be replaced. All portions receive the same menu.",
                          )}
                        </Txt>
                        <Run
                          label={t("Simpan menu", "Save menus")}
                          disabled={!valid || !writeable}
                          successMessage=""
                          action={async () => {
                            await command("customerMenu.saveBatch", {
                              ...payload(),
                              choices: draft.choices,
                            });
                            setDraft(null);
                            setReviewing(false);
                            await menus.reload();
                          }}
                        />
                        <Btn
                          secondary
                          label={t("Lanjut mengedit", "Keep editing")}
                          onPress={() => setReviewing(false)}
                        />
                      </>
                    )}
                    <Txt kind="small">
                      {t(
                        "Jika menu atau hidangan berubah, draf tetap ada. Muat ulang lalu buka ulang tanggal untuk memakai versi terbaru.",
                        "If menus or dishes change, your draft stays here. Refresh, then reopen the date to use the latest version.",
                      )}
                    </Txt>
                    <Btn
                      secondary
                      label={t("Tutup editor", "Close editor")}
                      onPress={() => change(() => {})}
                    />
                    {draft.days.some((d) => d.version > 0) && (
                      <Run
                        secondary
                        label={t(
                          "Hapus pilihan; biarkan katerer memilih",
                          "Clear choices; let the caterer choose",
                        )}
                        disabled={!writeable}
                        successMessage=""
                        action={() =>
                          new Promise<void>((resolve, reject) =>
                            Alert.alert(
                              t("Hapus pilihan menu?", "Clear menu choices?"),
                              t(
                                "Pilihan pada tanggal di atas akan dihapus. Katerer memilih jika Anda tidak memilih lagi sebelum cutoff.",
                                "Choices on these dates will be removed. The caterer chooses if you do not select again before cutoff.",
                              ),
                              [
                                {
                                  text: t("Batal", "Cancel"),
                                  style: "cancel",
                                  onPress: () => resolve(),
                                },
                                {
                                  text: t("Hapus pilihan", "Clear choices"),
                                  style: "destructive",
                                  onPress: () => {
                                    void command(
                                      "customerMenu.resetBatch",
                                      payload(),
                                    )
                                      .then(async () => {
                                        setDraft(null);
                                        await menus.reload();
                                        resolve();
                                      })
                                      .catch(reject);
                                  },
                                },
                              ],
                            ),
                          )
                        }
                      />
                    )}
                  </Panel>
                )}
              </>
            )}
          </>
        )}
      </Screen>
    </Gate>
  );
}
