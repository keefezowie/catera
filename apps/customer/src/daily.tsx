import { PackageContents } from "./package-contents";
import { useEffect, useState } from "react";
import { View, Pressable, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  currency,
  localDay,
  addDays,
  mealLabel,
  areaOptions,
  type Delivery,
  type CustomerState,
  type Conversation,
  type Address,
} from "@catera/domain";
import { nativeApi, useNative, useData, nativeLink, apiBase } from "./context";
import {
  Screen,
  Txt,
  Btn,
  Run,
  Field,
  Panel,
  Photo,
  Select,
  LanguageSelect,
  Facts,
  Empty,
  Gate,
  DayPicker,
  Status,
  C,
  styles,
} from "./ui";
function Meal({ delivery: d, meal }: { delivery: Delivery; meal?: string }) {
  const { t, locale } = useNative();
  const current =
    d.meals.find((m) => m.meal === meal) ||
    d.meals.find((m) => !["delivered", "cancelled"].includes(m.status)) ||
    d.meals[0];
  return (
    <Panel>
      <Photo src={d.offer.image} height={190} />
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Txt kind="small">{d.offer.caterer}</Txt>
        <Status status={current.status} />
      </View>
      <Txt kind="heading">{d.offer.name}</Txt>
      <Txt kind="small">
        {new Date(d.service_date + "T12:00:00").toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}{" "}
        · {d.portions} {t("porsi", "portions")}
      </Txt>
      <Txt kind="small">
        {mealLabel(current.meal, locale)} ·{" "}
        {current.meal === "dinner"
          ? d.offer.windows.dinner
          : d.offer.windows.lunch}
      </Txt>
      <Txt kind="small">
        {d.address.label} · {d.address.area}
      </Txt>
      <Btn
        label={t("Lihat pengantaran", "View delivery")}
        secondary
        onPress={() => router.push(("/delivery/" + d.id) as never)}
      />
    </Panel>
  );
}
export function Home() {
  const { actor, t, locale } = useNative();
  const s = useData<CustomerState>("home:" + actor?.id, () =>
    nativeApi.customer(),
  );
  const [pending, setPending] = useState("");
  useEffect(() => {
    SecureStore.getItemAsync("catera.pendingPayment").then((v) =>
      setPending(v || ""),
    );
  }, []);
  const next = s.data?.deliveries.find(
    (d) =>
      d.service_date >= localDay() &&
      !["delivered", "cancelled"].includes(d.status),
  );
  return (
    <Gate>
      <Screen
        title={t(
          "Halo, " + actor?.name.split(" ")[0] + ". Mau makan enak?",
          "Hello, " + actor?.name.split(" ")[0] + ". Ready for a good meal?",
        )}
        refresh={s.reload}
      >
        <Txt>
          {t(
            "Lebih sedikit memikirkan makan. Lebih banyak menikmati hari.",
            "Less meal planning. More enjoying your day.",
          )}
        </Txt>
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
        <Txt kind="heading">{t("Makanan berikutnya", "Next meal")}</Txt>
        {next ? (
          <Meal delivery={next} />
        ) : (
          <Empty title={t("Belum ada makanan berikutnya.", "No upcoming meals yet.")} />
        )}
        {pending && (
          <Btn
            secondary
            label={t("Lanjutkan pembelian terakhir", "Continue your last purchase")}
            onPress={() => router.push(("/payment/" + pending) as never)}
          />
        )}
        <Txt kind="heading">{t("Agenda makan", "Meal agenda")}</Txt>
        {s.data?.deliveries
          .filter(
            (d) =>
              d.service_date === (next?.service_date || localDay()) &&
              d.status !== "cancelled",
          )
          .flatMap((d) =>
            d.meals.map((m) => (
              <Panel key={d.id + m.meal}>
                <Txt kind="small">
                  {mealLabel(m.meal, locale)} ·{" "}
                  {d.offer.windows[m.meal as "lunch" | "dinner"]}
                </Txt>
                <Txt kind="heading">{d.offer.name}</Txt>
                <Txt kind="small">
                  {d.offer.caterer} · {d.portions} {t("porsi", "portions")}
                </Txt>
                <Status status={m.status} />
              </Panel>
            )),
          )}
        <Txt kind="heading">{t("Paket aktif", "Active packages")}</Txt>
        {s.data?.subscriptions
          .filter((s) => s.status === "active")
          .map((s) => (
            <Panel key={s.id}>
              <Txt kind="small">{s.snapshot.offer.caterer}</Txt>
              <Txt kind="heading">{s.snapshot.offer.name}</Txt>
              <Txt>
                {s.remaining} {t("hari tersisa", "days remaining")} · {s.portions}{" "}
                {t("porsi tetap", "fixed portions")}
              </Txt>
              <Btn
                secondary
                label={t("Kelola langganan", "Manage subscription")}
                onPress={() => router.push(("/subscriptions/" + s.id) as never)}
              />
            </Panel>
          ))}
        <Btn
          label={t("Temukan favorit baru", "Find a new favorite")}
          onPress={() => router.push("/discover")}
        />
      </Screen>
    </Gate>
  );
}
export function Calendar() {
  const [date, setDate] = useState(localDay()),
    [all, setAll] = useState(false);
  const { actor, t, locale } = useNative();
  const s = useData<CustomerState>("calendar:" + date + actor?.id, () =>
    nativeApi.customer("?from=" + date + "&to=" + addDays(date, 60)),
  );
  const rows =
    s.data?.deliveries.filter((d) => all || d.service_date === date) || [];
  return (
    <Gate>
      <Screen
        title={t("Hari-hari yang sudah terencana.", "Your meals, all in one place.")}
        refresh={s.reload}
      >
        <Txt>{t("Semua paket dan katerer, dalam satu jadwal.", "Every package and caterer, in one calendar.")}</Txt>
        <DayPicker label={t("Jadwal makanan", "Meal schedule")} value={date} onChange={setDate} />
        <View style={styles.row}>
          <Switch
            value={all}
            onValueChange={setAll}
            accessibilityLabel={t("Semua pengantaran mendatang", "All upcoming deliveries")}
            trackColor={{ true: C.forest }}
          />
          <Txt>{t("Semua mendatang", "All upcoming")}</Txt>
        </View>
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
        {["lunch", "dinner"].map((meal) => (
          <View key={meal} style={{ gap: 18 }}>
            <Txt kind="heading">{mealLabel(meal, locale)}</Txt>
            {rows
              .filter((d) => d.meals.some((m) => m.meal === meal))
              .map((d) => (
                <Meal key={d.id} delivery={d} meal={meal} />
              ))}
            {!rows.some((d) => d.meals.some((m) => m.meal === meal)) && (
              <Txt>{t("Belum ada makanan di jadwal ini.", "No meals on this schedule.")}</Txt>
            )}
          </View>
        ))}
      </Screen>
    </Gate>
  );
}
export function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { command, t, locale } = useNative();
  const state = useData<CustomerState>("delivery:" + id, () =>
    nativeApi.customer("?deliveryId=" + id),
  );
  const [action, setAction] = useState(""),
    [target, setTarget] = useState(addDays(localDay(), 10)),
    [review, setReview] = useState(false),
    [address, setAddress] = useState("");
  const d = state.data?.deliveries.find((d) => d.id === id);
  return (
    <Gate>
      <Screen title={t("Makanan untuk harimu.", "Meals for your day.")} refresh={state.reload}>
        {state.error && <Txt style={styles.error}>{state.error}</Txt>}
        {d ? (
          <>
            <Photo src={d.offer.image} height={230} />
            <PackageContents offer={d.offer} />
            <Txt kind="heading">{d.offer.name}</Txt>
            <Status status={d.status} />
            <Facts
              rows={[
                [t("Katerer", "Caterer"), d.offer.caterer],
                [t("Tanggal", "Date"), d.service_date],
                [t("Makanan", "Meal"), mealLabel(d.offer.meal, locale)],
                [t("Porsi tetap", "Fixed portions"), d.portions],
                [t("Alamat", "Address"), d.address.line + ", " + d.address.area],
                [t("Catatan", "Note"), d.address.instructions || "—"],
                [t("Batas perubahan", "Change cutoff"), new Date(d.cutoff_at).toLocaleString(locale === "id" ? "id-ID" : "en-GB")],
              ]}
            />
            {d.canChange && (
              <>
                <Btn
                  label={t("Ganti tanggal", "Change date")}
                  onPress={() => {
                    setAction("reschedule");
                    setReview(false);
                  }}
                />
                <Btn
                  secondary
                  label={t("Lewati & pilih pengganti", "Skip & choose a replacement")}
                  onPress={() => {
                    setAction("skip");
                    setReview(false);
                  }}
                />
              </>
            )}
            {d.status === "scheduled" && new Date(d.cutoff_at) > new Date() && (
              <Btn
                secondary
                label={t("Ubah alamat", "Change address")}
                onPress={() => setAction("address")}
              />
            )}
            <Btn
              secondary
              label={t("Hubungi katerer", "Contact caterer")}
              onPress={() =>
                router.push({
                  pathname: "/messages",
                  params: { caterer: d.offer.catererId },
                })
              }
            />
            <Btn
              secondary
              label={t("Laporkan masalah / ajukan pembatalan", "Report an issue / request cancellation")}
              onPress={() =>
                router.push({
                  pathname: "/support",
                  params: { delivery: id, subscription: d.subscription_id },
                })
              }
            />
            {action && (
              <Panel>
                <Txt kind="heading">
                  {action === "address"
                    ? t("Alamat pengantaran baru", "New delivery address")
                    : t("Pilih tanggal pengganti", "Choose a replacement date")}
                </Txt>
                {d.offer.meal === "both" && (
                  <Txt>
                    {t(
                      "Siang dan malam berpindah bersama, dengan alamat yang sama.",
                      "Lunch and dinner move together using the same address.",
                    )}
                  </Txt>
                )}
                {action === "address" ? (
                  <>
                    <Select
                      label={t("Alamat tersimpan", "Saved address")}
                      value={address}
                      onChange={setAddress}
                      options={
                        state.data?.addresses.map((a) => ({
                          value: a.id,
                          label: a.label + " · " + a.area,
                        })) || []
                      }
                    />
                    <Run
                      label={t("Konfirmasi alamat", "Confirm address")}
                      action={async () => {
                        await command("delivery.address", {
                          id,
                          version: d.version,
                          addressId: address,
                        });
                        setAction("");
                      }}
                    />
                  </>
                ) : (
                  <>
                    <DayPicker
                      label={t("Tanggal baru", "New date")}
                      value={target}
                      min={localDay()}
                      onChange={(v) => {
                        setTarget(v);
                        setReview(false);
                      }}
                    />
                    {review && (
                      <Facts
                        rows={[
                          [t("Dari", "From"), d.service_date],
                          [t("Menjadi", "To"), target],
                          [t("Porsi", "Portions"), d.portions],
                        ]}
                      />
                    )}
                    <Txt kind="small">
                      {t(
                        "Jika tanggal baru penuh, tanggal lama tetap aman. Tidak ada hak makanan yang hilang.",
                        "If the new date is full, your original date remains safe. No meal entitlement is lost.",
                      )}
                    </Txt>
                    <Run
                      label={
                        review
                          ? t("Konfirmasi tanggal pengganti", "Confirm replacement date")
                          : t("Tinjau perubahan", "Review change")
                      }
                      action={async () => {
                        if (!review) {
                          const dates = await nativeApi.request<
                            { available: boolean; reason: string }[]
                          >(
                            "availability/" +
                              id +
                              "?from=" +
                              target +
                              "&to=" +
                              target,
                          );
                          if (!dates[0]?.available)
                            throw new Error(dates[0]?.reason || "INVALID_DATE");
                          setReview(true);
                          return;
                        }
                        await command("delivery.reschedule", {
                          id,
                          version: d.version,
                          date: target,
                          kind: action,
                        });
                        setAction("");
                      }}
                    />
                  </>
                )}
                <Btn
                  secondary
                  label={t("Batal", "Cancel")}
                  onPress={() => setAction("")}
                />
              </Panel>
            )}
            {!d.canChange && (
              <Txt kind="small">
                {d.offer.flexible
                  ? t(
                      "Batas perubahan sudah lewat atau pengantaran sedang diproses.",
                      "The change cutoff has passed or delivery is being processed.",
                    )
                  : t("Paket ini memiliki jadwal tetap.", "This package uses fixed dates.")}{" "}
                {t("Hubungi katerer jika membutuhkan bantuan.", "Contact the caterer if you need help.")}
              </Txt>
            )}
          </>
        ) : (
          <Empty
            title={t("Memuat pengantaran…", "Loading delivery…")}
            body={t("Tarik halaman untuk memuat ulang.", "Pull to refresh.")}
          />
        )}
      </Screen>
    </Gate>
  );
}
export function SubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { command, offers, t, locale } = useNative();
  const state = useData<CustomerState>("subscription:" + id, () =>
    nativeApi.customer("?from=2020-01-01&to=2040-01-01"),
  );
  const [review, setReview] = useState(false),
    [rating, setRating] = useState("5"),
    [body, setBody] = useState("");
  const s = state.data?.subscriptions.find((s) => s.id === id);
  const current = offers.find((o) => o.id === s?.package_id);
  return (
    <Gate>
      <Screen title={t("Paket yang menemani harimu.", "The packages that keep you going.")} refresh={state.reload}>
        {s && (
          <>
            <Photo src={s.snapshot.offer.image} height={220} />
            <PackageContents offer={s.snapshot.offer} />
            <Txt kind="heading">{s.snapshot.offer.name}</Txt>
            <Txt>{s.snapshot.offer.caterer}</Txt>
            <Status status={s.status} />
            <Facts
              rows={[
                [t("Sisa pengantaran", "Remaining deliveries"), s.remaining + " " + t("hari", "days")],
                [t("Porsi tetap", "Fixed portions"), s.portions],
                [t("Mulai / selesai", "Start / end"), s.starts_on + " — " + s.ends_on],
                [t("Pembelian", "Purchase"), currency(s.snapshot.total, locale)],
                [
                  t("Aturan", "Terms"),
                  s.snapshot.offer.flexible ? t("Fleksibel", "Flexible") : t("Tetap", "Fixed"),
                ],
              ]}
            />
            {current ? (
              <Panel>
                <Txt kind="heading">{t("Lanjutkan hari-hari baik.", "Keep the good days going.")}</Txt>
                <Facts
                  rows={[
                    [
                      t("Harga dahulu / porsi / hari", "Previous price / portion / day"),
                      currency(s.snapshot.offer.price, locale),
                    ],
                    [t("Harga sekarang", "Current price"), currency(current.price, locale)],
                    [t("Durasi sekarang", "Current duration"), current.days + " " + t("hari", "days")],
                    [
                      t("Aturan sekarang", "Current terms"),
                      current.flexible ? t("Fleksibel", "Flexible") : t("Tetap", "Fixed"),
                    ],
                  ]}
                />
                <Txt kind="small">
                  {t(
                    "Perpanjangan adalah pembelian baru dengan ketentuan terkini.",
                    "A renewal is a new purchase under the current terms.",
                  )}
                </Txt>
                <Btn
                  label={t("Beli paket berikutnya", "Buy the next package")}
                  onPress={() =>
                    router.push({
                      pathname: "/checkout/[id]",
                      params: { id: s.package_id, portions: s.portions },
                    })
                  }
                />
              </Panel>
            ) : (
                <Txt>
                  {t(
                    "Paket ini sedang tidak tersedia untuk pembelian baru.",
                    "This package is not currently available for new purchases.",
                  )}
                </Txt>
            )}
            <Btn
              secondary
              label={t("Ajukan bantuan / pembatalan", "Request help / cancellation")}
              onPress={() =>
                router.push({
                  pathname: "/support",
                  params: { subscription: id },
                })
              }
            />
            {state.data?.deliveries.some(
              (d) => d.subscription_id === id && d.status === "delivered",
            ) && (
              <Btn
                secondary
                label={t("Tulis ulasan", "Write a review")}
                onPress={() => setReview(!review)}
              />
            )}
            <View style={{ gap: 16 }}>
              {review && (
                <Panel>
                  <Select
                    label={t("Penilaian", "Rating")}
                    value={rating}
                    onChange={setRating}
                    options={[1, 2, 3, 4, 5].map((n) => ({
                      label: n + " / 5",
                      value: String(n),
                    }))}
                  />
                  <Field
                    label={t("Pengalamanmu", "Your experience")}
                    multiline
                    value={body}
                    onChangeText={setBody}
                  />
                  <Run
                    label={t("Kirim ulasan", "Send review")}
                    action={async () => {
                      await command("review.save", {
                        subscriptionId: id,
                        rating: Number(rating),
                        food: Number(rating),
                        delivery: Number(rating),
                        value: Number(rating),
                        body,
                      });
                      setReview(false);
                    }}
                  />
                </Panel>
              )}
              {state.data?.deliveries
                .filter((d) => d.subscription_id === id)
                .map((d) => (
                  <Meal key={d.id} delivery={d} />
                ))}
            </View>
          </>
        )}
        {state.error && <Txt style={styles.error}>{state.error}</Txt>}
      </Screen>
    </Gate>
  );
}
export function MessagesScreen() {
  const { actor, offers, command, t, locale } = useNative();
  const params = useLocalSearchParams<{ caterer?: string }>();
  const state = useData<Conversation[]>("messages:" + actor?.id, () =>
    nativeApi.conversations(),
  );
  const [selected, setSelected] = useState(""),
    [body, setBody] = useState("");
  const conversation =
    state.data?.find((c) => c.id === selected) ||
    state.data?.find((c) => c.caterer_id === params.caterer) ||
    (!params.caterer ? state.data?.[0] : undefined);
  const caterer = conversation?.caterer_id || params.caterer;
  return (
    <Gate>
      <Screen title={t("Obrolan yang bikin jelas.", "Conversations that make things clear.")} refresh={state.reload}>
        {state.error && <Txt style={styles.error}>{state.error}</Txt>}
        <Select
          label={t("Percakapan", "Conversation")}
          value={conversation?.id || ""}
          onChange={setSelected}
          options={
            state.data?.map((c) => ({ label: c.caterer, value: c.id })) || []
          }
        />
        {caterer ? (
          <>
            <Txt kind="heading">
              {conversation?.caterer ||
                offers.find((o) => o.catererId === caterer)?.caterer}
            </Txt>
            <Txt kind="small">
              {t(
                "Lakukan pembayaran melalui Catera agar transaksi dan bantuan tercatat.",
                "Pay through Catera so your transaction and support history are recorded.",
              )}
            </Txt>
            {conversation?.messages.map((m) => (
              <View
                key={m.id}
                style={{
                  backgroundColor:
                    m.sender_id === actor?.id ? C.forest : C.soft,
                  padding: 16,
                  borderRadius: 12,
                  alignSelf:
                    m.sender_id === actor?.id ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                }}
              >
                <Txt
                  style={{ color: m.sender_id === actor?.id ? C.cream : C.ink }}
                >
                  {m.body}
                </Txt>
                <Txt
                  kind="small"
                  style={{
                    color: m.sender_id === actor?.id ? "#CFDEC7" : C.muted,
                    marginTop: 6,
                  }}
                >
                  {new Date(m.created_at).toLocaleTimeString(locale === "id" ? "id-ID" : "en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Txt>
              </View>
            ))}
            <Field
              label={t("Pesan", "Message")}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
            />
            <Run
              label={t("Kirim pesan", "Send message")}
              action={async () => {
                const result = await command<{ id: string }>("message.send", {
                  conversationId: conversation?.id,
                  catererId: caterer,
                  body,
                });
                setSelected(result.id);
                setBody("");
              }}
            />
          </>
        ) : (
          <>
            <Empty
              title={t("Belum ada percakapan.", "No conversations yet.")}
              body={t(
                "Buka detail paket untuk bertanya kepada katerer.",
                "Open a package detail page to ask the caterer a question.",
              )}
            />
            <Btn
              label={t("Jelajah katering", "Explore caterers")}
              onPress={() => router.push("/discover")}
            />
          </>
        )}
      </Screen>
    </Gate>
  );
}
export function AccountScreen() {
  const { actor, enablePush, logout, t } = useNative();
  const s = useData<CustomerState>("account:" + actor?.id, () =>
    nativeApi.customer(),
  );
  return (
    <Gate>
      <Screen
        title={t("Akunmu, keseharianmu.", "Your account, your everyday.")}
      >
        <Panel>
          <Txt kind="heading">{actor?.name}</Txt>
          <Txt>
            {t(
              "Makanan baik untuk hari-hari yang lebih baik.",
              "Good meals for better everyday living.",
            )}
          </Txt>
        </Panel>
        {actor && actor.role !== "customer" && (
          <View style={styles.stack}>
            <Txt>
              {t(
                "Kelola katering dan administrasi melalui ruang kerja web. Masuk kembali di browser dengan akun yang sama.",
                "Manage catering and administration in your web workspace. Sign in again in the browser with the same account.",
              )}
            </Txt>
            <Run
              secondary
              label={
                actor.role === "platform_admin"
                  ? t("Buka Catera Admin", "Open Catera Admin")
                  : t("Buka ruang kerja katerer", "Open caterer workspace")
              }
              successMessage=""
              action={() =>
                WebBrowser.openBrowserAsync(
                  apiBase +
                    (actor.role === "platform_admin" ? "/admin" : "/seller"),
                )
              }
            />
          </View>
        )}
        <Btn
          secondary
          label={t("Alamat pengantaran", "Delivery addresses")}
          icon="location-outline"
          onPress={() => router.push("/addresses")}
        />
        <Btn
          secondary
          label={t("Notifikasi", "Notifications")}
          icon="notifications-outline"
          onPress={() => router.push("/notifications")}
        />
        <Btn
          secondary
          label={t("Bantuan & pembatalan", "Support & cancellation")}
          icon="help-circle-outline"
          onPress={() => router.push("/support")}
        />
        <LanguageSelect />
        <Run
          label={t(
            "Aktifkan notifikasi pengantaran",
            "Enable delivery notifications",
          )}
          secondary
          action={enablePush}
        />
        <Txt kind="heading">{t("Paket saya", "My packages")}</Txt>
        {s.data?.subscriptions.map((s) => (
          <Btn
            key={s.id}
            secondary
            label={
              s.snapshot.offer.name + " · " + s.remaining + t(" hari", " days")
            }
            onPress={() => router.push(("/subscriptions/" + s.id) as never)}
          />
        ))}
        <Run
          secondary
          label={t("Keluar", "Sign out")}
          action={logout}
          successMessage=""
        />
      </Screen>
    </Gate>
  );
}
export function Addresses() {
  const { command, t } = useNative();
  const s = useData<CustomerState>("addresses", () => nativeApi.customer());
  const [editing, setEditing] = useState<Address | null | undefined>(),
    [label, setLabel] = useState(t("Rumah", "Home")),
    [line, setLine] = useState(""),
    [area, setArea] = useState("Jakarta Selatan"),
    [city, setCity] = useState("Jakarta"),
    [instructions, setInstructions] = useState("");
  function edit(a: Address | null) {
    setEditing(a);
    setLabel(a?.label || t("Rumah", "Home"));
    setLine(a?.line || "");
    setArea(a?.area || "Jakarta Selatan");
    setCity(a?.city || "Jakarta");
    setInstructions(a?.instructions || "");
  }
  return (
    <Gate>
      <Screen title={t("Makanan diantar ke mana?", "Where should meals be delivered?")} refresh={s.reload}>
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
        {s.data?.addresses.map((a) => (
          <Panel key={a.id}>
            <Txt kind="heading">{a.label}</Txt>
            <Txt>{a.line}</Txt>
            <Txt kind="small">
              {a.area}, {a.city}
            </Txt>
            <Btn
              secondary
              label={t("Ubah alamat", "Edit address")}
              onPress={() => edit(a)}
            />
          </Panel>
        ))}
        <Btn label={t("Tambah alamat", "Add address")} onPress={() => edit(null)} />
        {editing !== undefined && (
          <Panel>
            <Field label={t("Label alamat", "Address label")} value={label} onChangeText={setLabel} />
            <Field
              label={t("Jalan, nomor, detail", "Street, number, details")}
              value={line}
              onChangeText={setLine}
              multiline
            />
            <Select
              label={t("Area", "Area")}
              value={area}
              onChange={setArea}
              options={areaOptions.map((v) => ({ value: v, label: v }))}
            />
            <Field label={t("Kota", "City")} value={city} onChangeText={setCity} />
            <Field
              label={t("Petunjuk pengantaran", "Delivery instructions")}
              value={instructions}
              onChangeText={setInstructions}
              multiline
            />
            <Txt kind="small">
              {t(
                "Alamat pengantaran yang sudah dijadwalkan hanya berubah melalui detail pengantaran.",
                "A scheduled delivery address can only be changed from the delivery details.",
              )}
            </Txt>
            <Run
              label={t("Simpan alamat", "Save address")}
              action={async () => {
                await command("address.save", {
                  id: editing?.id,
                  version: editing?.version,
                  label,
                  line,
                  area,
                  city,
                  instructions,
                });
                setEditing(undefined);
              }}
            />
            <Btn
              secondary
              label={t("Batal", "Cancel")}
              onPress={() => setEditing(undefined)}
            />
          </Panel>
        )}
      </Screen>
    </Gate>
  );
}
export function SupportScreen() {
  const params = useLocalSearchParams<{
    subscription?: string;
    delivery?: string;
  }>();
  const { command, t, locale } = useNative();
  const s = useData<CustomerState>("support", () => nativeApi.customer());
  const [open, setOpen] = useState(!!params.subscription || !!params.delivery),
    [subscription, setSubscription] = useState(params.subscription || ""),
    [subject, setSubject] = useState("Makanan belum diterima"),
    [description, setDescription] = useState("");
  return (
    <Gate>
      <Screen title={t("Kami bantu sampai selesai.", "We’ll help see it through.")} refresh={s.reload}>
        <Txt>
          {t(
            "Ceritakan kendalamu. Katerer merespons lebih dulu, dan Catera siap membantu jika perlu.",
            "Tell us what happened. The caterer responds first, and Catera can step in if needed.",
          )}
        </Txt>
        <Txt kind="small">
          {t(
            "Jadwal tetap berjalan sampai keputusan pembatalan dikonfirmasi. Refund selalu ditinjau.",
            "Your schedule continues until a cancellation decision is confirmed. Refunds are always reviewed.",
          )}
        </Txt>
        <Btn label={t("Ajukan bantuan", "Request support")} onPress={() => setOpen(!open)} />
        {open && (
          <Panel>
            <Select
              label={t("Paket terkait", "Related package")}
              value={subscription}
              onChange={setSubscription}
              options={
                s.data?.subscriptions.map((s) => ({
                  value: s.id,
                  label: s.snapshot.offer.name,
                })) || []
              }
            />
            <Select
              label={t("Jenis permintaan", "Request type")}
              value={subject}
              onChange={setSubject}
              options={[
                ["Makanan belum diterima", "Meal not received"],
                ["Pengantaran terlambat", "Delivery is late"],
                ["Menu tidak sesuai", "Menu is incorrect"],
                ["Kemasan rusak", "Packaging is damaged"],
                ["Kualitas makanan", "Food quality"],
                ["Ajukan pembatalan", "Request cancellation"],
                ["Lainnya", "Other"],
              ].map(([id, en]) => ({ value: id, label: t(id, en) }))}
            />
            <Field
              label={t("Ceritakan kendalanya", "Tell us what happened")}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
            />
            <Run
              label={t("Kirim permintaan bantuan", "Send support request")}
              action={async () => {
                await command("support.create", {
                  subscriptionId: subscription,
                  deliveryId: params.delivery,
                  subject,
                  description,
                });
                setOpen(false);
                setDescription("");
              }}
            />
          </Panel>
        )}
        {s.data?.cases.map((c) => (
          <Panel key={c.id}>
            <Txt kind="heading">{c.subject}</Txt>
            <Status status={c.status} />
            <Txt>{c.description}</Txt>
            {c.resolution && <Txt>{c.resolution}</Txt>}
            {!!c.amount && (
              <Txt>
                {t("Refund disetujui", "Refund approved")}: {currency(c.amount, locale)}
              </Txt>
            )}
            {c.status === "responded" && (
              <Run
                label={t("Minta Catera meninjau", "Ask Catera to review")}
                action={() => command("support.escalate", { id: c.id })}
              />
            )}
          </Panel>
        ))}
        {!s.data?.cases.length && !open && (
          <Empty
            title={t("Semoga setiap makanan menyenangkan.", "Here’s to enjoyable meals.")}
            body={t(
              "Semua permintaan bantuan akan tampil di sini.",
              "All support requests will appear here.",
            )}
          />
        )}
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
      </Screen>
    </Gate>
  );
}
export function NotificationsScreen() {
  const { command, t, locale } = useNative();
  const s = useData<CustomerState>("notifications", () => nativeApi.customer());
  return (
    <Gate>
      <Screen title={t("Kabar untukmu.", "Updates for you.")} refresh={s.reload}>
        {s.data?.notifications.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            onPress={() => {
              command("notification.read", { id: n.id }).catch(() => {});
              router.push(nativeLink(n.href) as never);
            }}
            style={[styles.panel, !n.read_at && { backgroundColor: C.soft }]}
          >
            <Txt>{n.body}</Txt>
            <Txt kind="small">
              {new Date(n.created_at).toLocaleString(locale === "id" ? "id-ID" : "en-GB")}
            </Txt>
          </Pressable>
        ))}
        {!s.data?.notifications.length && (
          <Empty
            title={t("Belum ada kabar baru.", "No new updates yet.")}
            body={t(
              "Kabar makanan dan bantuan akan hadir di sini.",
              "Meal and support updates will appear here.",
            )}
          />
        )}
      </Screen>
    </Gate>
  );
}
