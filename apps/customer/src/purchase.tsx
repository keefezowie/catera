import { useEffect, useState } from "react";
import { View, Image, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  addDays,
  localDay,
  currency,
  mealLabel,
  price,
  type CustomerState,
  type Quote,
  type Checkout,
  areaOptions,
} from "@catera/domain";
import { useNative, nativeApi, useData } from "./context";
import {
  Screen,
  Txt,
  Btn,
  Run,
  Field,
  Panel,
  Photo,
  OfferCard,
  Select,
  Qty,
  Facts,
  Empty,
  Gate,
  DayPicker,
  C,
  styles,
} from "./ui";
export function Discover() {
  const { offers, area, setArea, compare, error, refresh, t } = useNative();
  const [search, setSearch] = useState(""),
    [meal, setMeal] = useState("all"),
    [trial, setTrial] = useState(false);
  const filtered = offers
    .filter(
      (o) =>
        (!search ||
          [o.name, o.caterer, ...o.tags]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (meal === "all" || o.meal === meal) &&
        (!trial || o.trialPrice),
    )
    .sort(
      (a, b) => Number(b.areas.includes(area)) - Number(a.areas.includes(area)),
    );
  return (
    <Screen refresh={refresh}>
      <Image
        source={require("../../../packages/brand/assets/wordmark.png")}
        style={{ width: 148, height: 50, alignSelf: "center" }}
        resizeMode="contain"
      />
      <Select
        label={t("Area pengantaran", "Delivery area")}
        value={area}
        onChange={setArea}
        options={[
          { value: "", label: "Pilih area" },
          ...areaOptions.map((v) => ({ value: v, label: v })),
        ]}
      />
      <Field
        label={t("Cari makanan favorit", "Find your favorite meals")}
        value={search}
        onChangeText={setSearch}
        placeholder="Paket, menu, atau katerer"
      />
      <View
        style={{
          backgroundColor: C.forest,
          padding: 25,
          borderRadius: 14,
          gap: 16,
        }}
      >
        <Txt
          kind="title"
          style={{ color: C.cream, fontSize: 35, lineHeight: 43 }}
        >
          Makan enak.{"\n"}Setiap hari.
        </Txt>
        <Txt style={{ color: "#DDE7D5", fontSize: 12 }}>
          Pilih makanannya, atur jadwalnya, nikmati harinya.
        </Txt>
        <Photo src="/assets/food/ayam-panggang.png" height={190} />
      </View>
      <Txt kind="heading">Mau makan apa hari ini?</Txt>
      <Select
        label="Waktu makan"
        value={meal}
        onChange={setMeal}
        options={[
          { label: "Semua paket", value: "all" },
          { label: "Makan siang", value: "lunch" },
          { label: "Makan malam", value: "dinner" },
          { label: "Siang + malam", value: "both" },
        ]}
      />
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Txt>Paket yang bisa dicoba dulu</Txt>
        <Switch
          accessibilityLabel="Trial tersedia"
          value={trial}
          onValueChange={setTrial}
          trackColor={{ true: C.forest }}
        />
      </View>
      {error && <Txt style={styles.error}>{error}</Txt>}
      {compare.length > 0 && (
        <Btn
          label={"Bandingkan " + compare.length + " paket"}
          onPress={() => router.push("/compare")}
        />
      )}
      <Txt kind="small">
        {filtered.length} paket untuk hari-hari yang lebih baik
      </Txt>
      {filtered.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}
      {!filtered.length && (
        <Empty
          title="Belum ada paket yang cocok."
          body="Coba pencarian atau filter lain."
        />
      )}
    </Screen>
  );
}
export function PackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { offers, area, setArea, compare, toggleCompare } = useNative();
  const [qty, setQty] = useState(1);
  const o = offers.find((o) => o.id === id);
  const reviews = useData<
    {
      id: string;
      customer: string;
      rating: number;
      body: string;
      reply: string;
    }[]
  >("reviews:" + id, () => nativeApi.request("reviews/" + id));
  if (!o)
    return (
      <Screen>
        <Empty title="Paket tidak ditemukan." />
      </Screen>
    );
  const total = price(o, qty);
  const inArea = !area || o.areas.includes(area);
  return (
    <Screen>
      <Photo src={o.image} height={275} />
      <Txt kind="small">{o.caterer}</Txt>
      <Txt kind="title">{o.name}</Txt>
      <Txt>{o.description}</Txt>
      <Select
        label="Area pengantaran"
        value={area}
        onChange={setArea}
        options={areaOptions.map((v) => ({ value: v, label: v }))}
      />
      <Panel>
        <Txt kind="heading">{currency(o.price)} / porsi / hari</Txt>
        <Txt kind="small">
          {mealLabel(o.meal)} · {o.days} hari ·{" "}
          {o.flexible ? "Paket fleksibel" : "Paket tetap"}
        </Txt>
        <Qty value={qty} onChange={setQty} />
        <Facts
          rows={[
            ["Harga paket", currency(total.total)],
            ["Diskon kuantitas", total.discountPercent + "%"],
            ["Pengantaran", "Termasuk"],
          ]}
        />
        <Btn
          disabled={!inArea}
          label={inArea ? "Pilih paket ini" : "Di luar area pengantaran"}
          onPress={() =>
            router.push({
              pathname: "/checkout/[id]",
              params: { id, portions: qty },
            })
          }
        />
        {!!o.trialPrice && (
          <Btn
            disabled={!inArea}
            secondary
            label={"Coba 1 hari · " + currency(o.trialPrice * qty)}
            onPress={() =>
              router.push({
                pathname: "/checkout/[id]",
                params: { id, portions: qty, trial: "1" },
              })
            }
          />
        )}
        <Btn
          secondary
          label={
            compare.includes(id) ? "Hapus perbandingan" : "Bandingkan paket"
          }
          onPress={() => toggleCompare(id)}
        />
        <Txt kind="small">
          Biaya layanan ditampilkan saat checkout. Tidak ada perpanjangan
          otomatis.
        </Txt>
      </Panel>
      <Txt kind="heading">Menu yang menantimu</Txt>
      {o.menus.map((m, i) => (
        <Panel key={i}>
          <Photo src={m.image || o.image} height={170} />
          <Txt kind="heading">{m.name}</Txt>
          <Txt kind="small">
            {mealLabel(m.meal)} · {m.description}
          </Txt>
        </Panel>
      ))}
      <Facts
        rows={[
          [
            "Jadwal",
            o.weekdays
              .map((d) => ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d])
              .join(", "),
          ],
          [
            "Waktu pengantaran",
            o.meal === "both"
              ? o.windows.lunch + " & " + o.windows.dinner
              : o.windows[o.meal],
          ],
          ["Cutoff", o.cutoff.slice(0, 5) + " sehari sebelumnya"],
          ["Pembatalan", "Ditinjau melalui bantuan Catera"],
        ]}
      />
      <Btn
        secondary
        label="Tanya katerer"
        onPress={() =>
          router.push({
            pathname: "/messages",
            params: { caterer: o.catererId },
          })
        }
      />
      <Txt kind="heading">Ulasan terverifikasi</Txt>
      {reviews.data?.map((r) => (
        <Panel key={r.id}>
          <Txt kind="label">
            {r.customer} · {r.rating}/5
          </Txt>
          <Txt>{r.body}</Txt>
          {r.reply && (
            <Txt kind="small">
              {o.caterer}: {r.reply}
            </Txt>
          )}
        </Panel>
      ))}
      {!reviews.data?.length && (
        <Txt>
          Belum ada ulasan. Hanya pelanggan yang sudah menerima makanan dapat
          mengulas.
        </Txt>
      )}
    </Screen>
  );
}
export function Comparison() {
  const { offers, compare } = useNative();
  const [qty, setQty] = useState(1);
  return (
    <Screen title="Pilih yang paling pas.">
      <Txt>Jumlah porsi sama untuk setiap paket.</Txt>
      <Qty value={qty} onChange={setQty} />
      {offers
        .filter((o) => compare.includes(o.id))
        .map((o) => (
          <Panel key={o.id}>
            <Photo src={o.image} height={150} />
            <Txt kind="heading">{o.name}</Txt>
            <Txt kind="small">{o.caterer}</Txt>
            <Facts
              rows={[
                ["Total paket", currency(price(o, qty).total)],
                [
                  "Per porsi / hari",
                  currency(price(o, qty).total / o.days / qty),
                ],
                [
                  "Jumlah makanan",
                  o.days * (o.meal === "both" ? 2 : 1) +
                    " kali makan per porsi",
                ],
                ["Durasi", o.days + " hari"],
                ["Waktu makan", mealLabel(o.meal)],
                ["Jadwal", o.flexible ? "Fleksibel" : "Tetap"],
                [
                  "Trial",
                  o.trialPrice
                    ? currency(o.trialPrice * qty)
                    : "Tidak tersedia",
                ],
                ["Pengantaran", "Termasuk"],
              ]}
            />
            <Btn
              label="Lihat paket"
              onPress={() => router.push(("/package/" + o.id) as never)}
            />
          </Panel>
        ))}
      {!compare.length && (
        <Empty title="Pilih hingga tiga paket dari Jelajah." />
      )}
    </Screen>
  );
}
export function LoginScreen() {
  const { demo, demoLogin, login } = useNative();
  const p = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState(""),
    [token, setToken] = useState(""),
    [name, setName] = useState(""),
    [sent, setSent] = useState(false);
  const next =
    p.next?.startsWith("/") && !p.next.startsWith("//") ? p.next : "/";
  return (
    <Screen title="Hari yang baik, dimulai dari makan.">
      <Image
        source={require("../../../packages/brand/assets/welcome.png")}
        style={{ width: 220, height: 200, alignSelf: "center" }}
        resizeMode="contain"
      />
      {demo ? (
        <Run
          label="Jelajah sebagai pelanggan demo"
          action={async () => {
            await demoLogin();
            router.replace(next as never);
          }}
        />
      ) : (
        <>
          <Field
            label="Nomor ponsel"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            placeholder="+6281234567890"
            editable={!sent}
          />
          {sent && (
            <>
              <Field
                label="Kode OTP"
                value={token}
                onChangeText={setToken}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                maxLength={6}
              />
              <Field
                label="Nama"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            </>
          )}
          <Run
            label={sent ? "Verifikasi & masuk" : "Kirim kode OTP"}
            action={async () => {
              if (!sent) {
                await nativeApi.request("auth/send", { phone });
                setSent(true);
              } else {
                await login(phone, token, name);
                router.replace(next as never);
              }
            }}
          />
          {sent && (
            <Btn
              secondary
              label="Ubah nomor / kirim ulang"
              onPress={() => setSent(false)}
            />
          )}
        </>
      )}
    </Screen>
  );
}
export function CheckoutScreen() {
  const {
    id,
    portions,
    trial: trialParam,
  } = useLocalSearchParams<{ id: string; portions?: string; trial?: string }>();
  const { actor, offers, command } = useNative();
  const trial = trialParam === "1",
    key = "catera.checkout." + id + "." + trial;
  const o = offers.find((o) => o.id === id);
  const [qty, setQty] = useState(Number(portions) || 1),
    [date, setDate] = useState(addDays(localDay(), 2)),
    [address, setAddress] = useState(""),
    [promo, setPromo] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [accepted, setAccepted] = useState(false),
    [restored, setRestored] = useState(false);
  const customer = useData<CustomerState>("checkout:" + actor?.id, () =>
    actor
      ? nativeApi.customer()
      : Promise.resolve({
          subscriptions: [],
          deliveries: [],
          addresses: [],
          notifications: [],
          cases: [],
        }),
  );
  useEffect(() => {
    SecureStore.getItemAsync(key).then((v) => {
      if (v)
        try {
          const d = JSON.parse(v);
          setQty(d.qty);
          setDate(d.date);
          setAddress(d.address);
          setPromo(d.promo);
        } catch {}
      setRestored(true);
    });
  }, [key]);
  useEffect(() => {
    if (restored) {
      SecureStore.setItemAsync(
        key,
        JSON.stringify({ qty, date, address, promo }),
      );
      setQuote(null);
      setAccepted(false);
    }
  }, [qty, date, address, promo, restored, key]);
  useEffect(() => {
    if (restored && !address && customer.data?.addresses[0])
      setAddress(customer.data.addresses[0].id);
  }, [restored, customer.data, address]);
  if (!o)
    return (
      <Screen>
        <Empty title="Paket tidak ditemukan" />
      </Screen>
    );
  if (!actor)
    return (
      <Screen title="Pilihanmu tetap tersimpan.">
        <Txt>Masuk untuk memilih alamat dan mengamankan jadwal makanan.</Txt>
        <Btn
          label="Masuk & lanjutkan"
          onPress={() =>
            router.push({
              pathname: "/login",
              params: {
                next:
                  "/checkout/" +
                  id +
                  "?portions=" +
                  qty +
                  "&trial=" +
                  trialParam,
              },
            })
          }
        />
      </Screen>
    );
  return (
    <Screen
      title={
        trial
          ? "Kenalan lewat satu kali makan."
          : "Siapkan hari-hari yang lebih enak."
      }
    >
      <Photo src={o.image} height={170} />
      <Txt kind="heading">{o.name}</Txt>
      <Txt kind="small">
        {o.caterer} · {trial ? "Trial 1 hari" : o.days + " hari"}
      </Txt>
      {!quote ? (
        <>
          <Qty
            value={qty}
            onChange={setQty}
            max={trial ? o.trialMax || 100 : 100}
          />
          <DayPicker
            label="Mulai tanggal"
            value={date}
            onChange={setDate}
            min={localDay()}
          />
          <Select
            label="Alamat pengantaran"
            value={address}
            onChange={setAddress}
            options={
              customer.data?.addresses.map((a) => ({
                value: a.id,
                label: a.label + " · " + a.area,
              })) || []
            }
          />
          <Btn
            secondary
            label="Tambah alamat"
            onPress={() => router.push("/addresses")}
          />
          <Field
            label="Kode promo (opsional)"
            value={promo}
            onChangeText={setPromo}
            autoCapitalize="characters"
          />
          <Run
            label="Tinjau jadwal & harga"
            action={async () =>
              setQuote(
                await nativeApi.quote({
                  packageId: id,
                  addressId: address,
                  portions: qty,
                  startDate: date,
                  trial,
                  promo,
                }),
              )
            }
          />
        </>
      ) : (
        <Panel>
          <Txt kind="heading">Jadwal makananmu</Txt>
          {quote.dates.map((d) => (
            <Txt key={d}>
              {new Date(d + "T12:00:00").toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {qty} porsi
            </Txt>
          ))}
          <Facts
            rows={[
              ["Harga paket", currency(quote.subtotal)],
              ["Diskon porsi", currency(quote.discount)],
              ["Promo", currency(quote.promotion)],
              ["Pengantaran", "Termasuk"],
              ["Biaya layanan", currency(quote.serviceFee)],
              ["Total", currency(quote.total)],
            ]}
          />
          <Txt kind="small">
            {o.flexible
              ? "Tanggal dapat dipindah sebelum cutoff sesuai kapasitas."
              : "Paket memiliki tanggal tetap."}{" "}
            Semua pembatalan dan refund ditinjau melalui bantuan. Tidak ada
            perpanjangan otomatis.
          </Txt>
          <View style={styles.row}>
            <Switch
              value={accepted}
              accessibilityLabel="Setujui jadwal alamat dan aturan"
              onValueChange={setAccepted}
              trackColor={{ true: C.forest }}
            />
            <Txt kind="small" style={{ flex: 1 }}>
              Saya sudah memeriksa jadwal, alamat, dan ketentuan.
            </Txt>
          </View>
          <Run
            label="Lanjutkan ke pembayaran"
            action={async () => {
              if (!accepted)
                throw new Error(
                  "Periksa dan setujui ketentuan terlebih dahulu.",
                );
              const c = await command<Checkout>("checkout.create", {
                expectedQuote: quote,
                packageId: id,
                addressId: address,
                portions: qty,
                startDate: date,
                trial,
                promo,
              });
              await SecureStore.setItemAsync("catera.pendingPayment", c.id);
              await SecureStore.deleteItemAsync(key);
              router.replace(("/payment/" + c.id) as never);
            }}
          />
          <Btn secondary label="Ubah pilihan" onPress={() => setQuote(null)} />
        </Panel>
      )}
    </Screen>
  );
}
export function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { demo, command } = useNative();
  const state = useData<Checkout>("payment:" + id, () =>
    nativeApi.checkout(id),
  );
  useEffect(() => {
    if (state.data?.state !== "pending") return;
    const timer = setInterval(state.reload, 5000);
    return () => clearInterval(timer);
  }, [state.data?.state]);
  const c = state.data;
  return (
    <Gate>
      <Screen
        title={
          c?.subscription_id
            ? "Makanan baik sudah dijadwalkan."
            : "Satu langkah menuju makan enak."
        }
        refresh={state.reload}
      >
        {state.error && <Txt style={styles.error}>{state.error}</Txt>}
        {c && (
          <>
            {c.subscription_id ? (
              <>
                <Image
                  source={require("../../../packages/brand/assets/confirmation.png")}
                  style={{ width: 240, height: 220, alignSelf: "center" }}
                  resizeMode="contain"
                />
                <Txt>
                  {c.quote.offer.name} · {c.quote.portions} porsi ·{" "}
                  {c.quote.dates.length} hari
                </Txt>
                <Btn
                  label="Lihat jadwal makan"
                  onPress={() => router.replace("/calendar")}
                />
                <Btn
                  secondary
                  label="Detail langganan"
                  onPress={() =>
                    router.push(
                      ("/subscriptions/" + c.subscription_id) as never,
                    )
                  }
                />
              </>
            ) : (
              <>
                <Facts
                  rows={[
                    ["Paket", c.quote.offer.name],
                    ["Total", currency(c.quote.total)],
                    [
                      "Batas pembayaran",
                      new Date(c.expires_at).toLocaleString("id-ID"),
                    ],
                  ]}
                />
                {c.state === "payment_exception" ? (
                  <Txt>
                    Pembayaran diterima setelah jadwal tidak tersedia. Tim
                    Catera sedang meninjau penyelesaiannya.
                  </Txt>
                ) : new Date(c.expires_at) > new Date() ? (
                  demo ? (
                    <Run
                      label="Simulasikan pembayaran berhasil"
                      action={() => command("checkout.demo_pay", { id })}
                    />
                  ) : c.payment_url ? (
                    <Run
                      label="Buka pembayaran aman"
                      action={async () => {
                        await WebBrowser.openBrowserAsync(c.payment_url!);
                        state.reload();
                      }}
                    />
                  ) : (
                    <Txt>Tautan pembayaran sedang disiapkan.</Txt>
                  )
                ) : (
                  <Btn
                    label="Pilih jadwal baru"
                    onPress={() =>
                      router.replace(
                        ("/checkout/" + c.quote.packageId) as never,
                      )
                    }
                  />
                )}
                <Txt kind="small">
                  Kembali dari pembayaran tidak membuktikan transaksi berhasil.
                  Status diperiksa dari server.
                </Txt>
                <Btn secondary label="Periksa status" onPress={state.reload} />
              </>
            )}
          </>
        )}
      </Screen>
    </Gate>
  );
}
