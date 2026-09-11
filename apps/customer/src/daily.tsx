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
        {new Date(d.service_date + "T12:00:00").toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}{" "}
        · {d.portions} porsi
      </Txt>
      <Txt kind="small">
        {mealLabel(current.meal)} ·{" "}
        {current.meal === "dinner"
          ? d.offer.windows.dinner
          : d.offer.windows.lunch}
      </Txt>
      <Txt kind="small">
        {d.address.label} · {d.address.area}
      </Txt>
      <Btn
        label="Lihat pengantaran"
        secondary
        onPress={() => router.push(("/delivery/" + d.id) as never)}
      />
    </Panel>
  );
}
export function Home() {
  const { actor, t } = useNative();
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
        <Txt>Lebih sedikit memikirkan makan. Lebih banyak menikmati hari.</Txt>
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
        <Txt kind="heading">Makanan berikutnya</Txt>
        {next ? (
          <Meal delivery={next} />
        ) : (
          <Empty title="Belum ada makanan berikutnya." />
        )}
        {pending && (
          <Btn
            secondary
            label="Lanjutkan pembelian terakhir"
            onPress={() => router.push(("/payment/" + pending) as never)}
          />
        )}
        <Txt kind="heading">Agenda makan</Txt>
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
                  {mealLabel(m.meal)} ·{" "}
                  {d.offer.windows[m.meal as "lunch" | "dinner"]}
                </Txt>
                <Txt kind="heading">{d.offer.name}</Txt>
                <Txt kind="small">
                  {d.offer.caterer} · {d.portions} porsi
                </Txt>
                <Status status={m.status} />
              </Panel>
            )),
          )}
        <Txt kind="heading">Paket aktif</Txt>
        {s.data?.subscriptions
          .filter((s) => s.status === "active")
          .map((s) => (
            <Panel key={s.id}>
              <Txt kind="small">{s.snapshot.offer.caterer}</Txt>
              <Txt kind="heading">{s.snapshot.offer.name}</Txt>
              <Txt>
                {s.remaining} hari tersisa · {s.portions} porsi tetap
              </Txt>
              <Btn
                secondary
                label="Kelola langganan"
                onPress={() => router.push(("/subscriptions/" + s.id) as never)}
              />
            </Panel>
          ))}
        <Btn
          label="Temukan favorit baru"
          onPress={() => router.push("/discover")}
        />
      </Screen>
    </Gate>
  );
}
export function Calendar() {
  const [date, setDate] = useState(localDay()),
    [all, setAll] = useState(false);
  const { actor } = useNative();
  const s = useData<CustomerState>("calendar:" + date + actor?.id, () =>
    nativeApi.customer("?from=" + date + "&to=" + addDays(date, 60)),
  );
  const rows =
    s.data?.deliveries.filter((d) => all || d.service_date === date) || [];
  return (
    <Gate>
      <Screen title="Hari-hari yang sudah terencana." refresh={s.reload}>
        <Txt>Semua paket dan katerer, dalam satu jadwal.</Txt>
        <DayPicker label="Jadwal makanan" value={date} onChange={setDate} />
        <View style={styles.row}>
          <Switch
            value={all}
            onValueChange={setAll}
            accessibilityLabel="Semua pengantaran mendatang"
            trackColor={{ true: C.forest }}
          />
          <Txt>Semua mendatang</Txt>
        </View>
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
        {["lunch", "dinner"].map((meal) => (
          <View key={meal} style={{ gap: 18 }}>
            <Txt kind="heading">{mealLabel(meal)}</Txt>
            {rows
              .filter((d) => d.meals.some((m) => m.meal === meal))
              .map((d) => (
                <Meal key={d.id} delivery={d} meal={meal} />
              ))}
            {!rows.some((d) => d.meals.some((m) => m.meal === meal)) && (
              <Txt>Belum ada makanan di jadwal ini.</Txt>
            )}
          </View>
        ))}
      </Screen>
    </Gate>
  );
}
export function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { command } = useNative();
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
      <Screen title="Makanan untuk harimu." refresh={state.reload}>
        {state.error && <Txt style={styles.error}>{state.error}</Txt>}
        {d ? (
          <>
            <Photo src={d.offer.image} height={230} />
            <PackageContents offer={d.offer} />
            <Txt kind="heading">{d.offer.name}</Txt>
            <Status status={d.status} />
            <Facts
              rows={[
                ["Katerer", d.offer.caterer],
                ["Tanggal", d.service_date],
                ["Makanan", mealLabel(d.offer.meal)],
                ["Porsi tetap", d.portions],
                ["Alamat", d.address.line + ", " + d.address.area],
                ["Catatan", d.address.instructions || "—"],
                ["Cutoff", new Date(d.cutoff_at).toLocaleString("id-ID")],
              ]}
            />
            {d.canChange && (
              <>
                <Btn
                  label="Ganti tanggal"
                  onPress={() => {
                    setAction("reschedule");
                    setReview(false);
                  }}
                />
                <Btn
                  secondary
                  label="Lewati & pilih pengganti"
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
                label="Ubah alamat"
                onPress={() => setAction("address")}
              />
            )}
            <Btn
              secondary
              label="Hubungi katerer"
              onPress={() =>
                router.push({
                  pathname: "/messages",
                  params: { caterer: d.offer.catererId },
                })
              }
            />
            <Btn
              secondary
              label="Laporkan masalah / ajukan pembatalan"
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
                    ? "Alamat pengantaran baru"
                    : "Pilih tanggal pengganti"}
                </Txt>
                {d.offer.meal === "both" && (
                  <Txt>
                    Siang dan malam berpindah bersama, dengan alamat yang sama.
                  </Txt>
                )}
                {action === "address" ? (
                  <>
                    <Select
                      label="Alamat tersimpan"
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
                      label="Konfirmasi alamat"
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
                      label="Tanggal baru"
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
                          ["Dari", d.service_date],
                          ["Menjadi", target],
                          ["Porsi", d.portions],
                        ]}
                      />
                    )}
                    <Txt kind="small">
                      Jika tanggal baru penuh, tanggal lama tetap aman. Tidak
                      ada hak makanan yang hilang.
                    </Txt>
                    <Run
                      label={
                        review
                          ? "Konfirmasi tanggal pengganti"
                          : "Tinjau perubahan"
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
                <Btn secondary label="Batal" onPress={() => setAction("")} />
              </Panel>
            )}
            {!d.canChange && (
              <Txt kind="small">
                {d.offer.flexible
                  ? "Batas perubahan sudah lewat atau pengantaran sedang diproses."
                  : "Paket ini memiliki jadwal tetap."}{" "}
                Hubungi katerer jika membutuhkan bantuan.
              </Txt>
            )}
          </>
        ) : (
          <Empty
            title="Memuat pengantaran…"
            body="Tarik halaman untuk memuat ulang."
          />
        )}
      </Screen>
    </Gate>
  );
}
export function SubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { command, offers } = useNative();
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
      <Screen title="Paket yang menemani harimu." refresh={state.reload}>
        {s && (
          <>
            <Photo src={s.snapshot.offer.image} height={220} />
            <PackageContents offer={s.snapshot.offer} />
            <Txt kind="heading">{s.snapshot.offer.name}</Txt>
            <Txt>{s.snapshot.offer.caterer}</Txt>
            <Status status={s.status} />
            <Facts
              rows={[
                ["Sisa pengantaran", s.remaining + " hari"],
                ["Porsi tetap", s.portions],
                ["Mulai / selesai", s.starts_on + " — " + s.ends_on],
                ["Pembelian", currency(s.snapshot.total)],
                ["Aturan", s.snapshot.offer.flexible ? "Fleksibel" : "Tetap"],
              ]}
            />
            {current ? (
              <Panel>
                <Txt kind="heading">Lanjutkan hari-hari baik.</Txt>
                <Facts
                  rows={[
                    [
                      "Harga dahulu / porsi / hari",
                      currency(s.snapshot.offer.price),
                    ],
                    ["Harga sekarang", currency(current.price)],
                    ["Durasi sekarang", current.days + " hari"],
                    [
                      "Aturan sekarang",
                      current.flexible ? "Fleksibel" : "Tetap",
                    ],
                  ]}
                />
                <Txt kind="small">
                  Perpanjangan adalah pembelian baru dengan ketentuan terkini.
                </Txt>
                <Btn
                  label="Beli paket berikutnya"
                  onPress={() =>
                    router.push({
                      pathname: "/checkout/[id]",
                      params: { id: s.package_id, portions: s.portions },
                    })
                  }
                />
              </Panel>
            ) : (
              <Txt>Paket ini sedang tidak tersedia untuk pembelian baru.</Txt>
            )}
            <Btn
              secondary
              label="Ajukan bantuan / pembatalan"
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
                label="Tulis ulasan"
                onPress={() => setReview(!review)}
              />
            )}
            <View style={{ gap: 16 }}>
              {review && (
                <Panel>
                  <Select
                    label="Penilaian"
                    value={rating}
                    onChange={setRating}
                    options={[1, 2, 3, 4, 5].map((n) => ({
                      label: n + " / 5",
                      value: String(n),
                    }))}
                  />
                  <Field
                    label="Pengalamanmu"
                    multiline
                    value={body}
                    onChangeText={setBody}
                  />
                  <Run
                    label="Kirim ulasan"
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
  const { actor, offers, command } = useNative();
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
      <Screen title="Obrolan yang bikin jelas." refresh={state.reload}>
        {state.error && <Txt style={styles.error}>{state.error}</Txt>}
        <Select
          label="Percakapan"
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
              Lakukan pembayaran melalui Catera agar transaksi dan bantuan
              tercatat.
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
                  {new Date(m.created_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Txt>
              </View>
            ))}
            <Field
              label="Pesan"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
            />
            <Run
              label="Kirim pesan"
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
              title="Belum ada percakapan."
              body="Buka detail paket untuk bertanya kepada katerer."
            />
            <Btn
              label="Jelajah katering"
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
  const { command } = useNative();
  const s = useData<CustomerState>("addresses", () => nativeApi.customer());
  const [editing, setEditing] = useState<Address | null | undefined>(),
    [label, setLabel] = useState("Rumah"),
    [line, setLine] = useState(""),
    [area, setArea] = useState("Jakarta Selatan"),
    [city, setCity] = useState("Jakarta"),
    [instructions, setInstructions] = useState("");
  function edit(a: Address | null) {
    setEditing(a);
    setLabel(a?.label || "Rumah");
    setLine(a?.line || "");
    setArea(a?.area || "Jakarta Selatan");
    setCity(a?.city || "Jakarta");
    setInstructions(a?.instructions || "");
  }
  return (
    <Gate>
      <Screen title="Makanan diantar ke mana?" refresh={s.reload}>
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
        {s.data?.addresses.map((a) => (
          <Panel key={a.id}>
            <Txt kind="heading">{a.label}</Txt>
            <Txt>{a.line}</Txt>
            <Txt kind="small">
              {a.area}, {a.city}
            </Txt>
            <Btn secondary label="Ubah alamat" onPress={() => edit(a)} />
          </Panel>
        ))}
        <Btn label="Tambah alamat" onPress={() => edit(null)} />
        {editing !== undefined && (
          <Panel>
            <Field label="Label alamat" value={label} onChangeText={setLabel} />
            <Field
              label="Jalan, nomor, detail"
              value={line}
              onChangeText={setLine}
              multiline
            />
            <Select
              label="Area"
              value={area}
              onChange={setArea}
              options={areaOptions.map((v) => ({ value: v, label: v }))}
            />
            <Field label="Kota" value={city} onChangeText={setCity} />
            <Field
              label="Petunjuk pengantaran"
              value={instructions}
              onChangeText={setInstructions}
              multiline
            />
            <Txt kind="small">
              Alamat pengantaran yang sudah dijadwalkan hanya berubah melalui
              detail pengantaran.
            </Txt>
            <Run
              label="Simpan alamat"
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
              label="Batal"
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
  const { command } = useNative();
  const s = useData<CustomerState>("support", () => nativeApi.customer());
  const [open, setOpen] = useState(!!params.subscription || !!params.delivery),
    [subscription, setSubscription] = useState(params.subscription || ""),
    [subject, setSubject] = useState("Makanan belum diterima"),
    [description, setDescription] = useState("");
  return (
    <Gate>
      <Screen title="Kami bantu sampai selesai." refresh={s.reload}>
        <Txt>
          Ceritakan kendalamu. Katerer merespons lebih dulu, dan Catera siap
          membantu jika perlu.
        </Txt>
        <Txt kind="small">
          Jadwal tetap berjalan sampai keputusan pembatalan dikonfirmasi. Refund
          selalu ditinjau.
        </Txt>
        <Btn label="Ajukan bantuan" onPress={() => setOpen(!open)} />
        {open && (
          <Panel>
            <Select
              label="Paket terkait"
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
              label="Jenis permintaan"
              value={subject}
              onChange={setSubject}
              options={[
                "Makanan belum diterima",
                "Pengantaran terlambat",
                "Menu tidak sesuai",
                "Kemasan rusak",
                "Kualitas makanan",
                "Ajukan pembatalan",
                "Lainnya",
              ].map((v) => ({ value: v, label: v }))}
            />
            <Field
              label="Ceritakan kendalanya"
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
            />
            <Run
              label="Kirim permintaan bantuan"
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
            {!!c.amount && <Txt>Refund disetujui: {currency(c.amount)}</Txt>}
            {c.status === "responded" && (
              <Run
                label="Minta Catera meninjau"
                action={() => command("support.escalate", { id: c.id })}
              />
            )}
          </Panel>
        ))}
        {!s.data?.cases.length && !open && (
          <Empty
            title="Semoga setiap makanan menyenangkan."
            body="Semua permintaan bantuan akan tampil di sini."
          />
        )}
        {s.error && <Txt style={styles.error}>{s.error}</Txt>}
      </Screen>
    </Gate>
  );
}
export function NotificationsScreen() {
  const { command } = useNative();
  const s = useData<CustomerState>("notifications", () => nativeApi.customer());
  return (
    <Gate>
      <Screen title="Kabar untukmu." refresh={s.reload}>
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
              {new Date(n.created_at).toLocaleString("id-ID")}
            </Txt>
          </Pressable>
        ))}
        {!s.data?.notifications.length && (
          <Empty
            title="Belum ada kabar baru."
            body="Kabar makanan dan bantuan akan hadir di sini."
          />
        )}
      </Screen>
    </Gate>
  );
}
