import { PackageContents } from "./package-contents";
import { menuSummary } from "@catera/domain";
import { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Switch,
  ScrollView,
  AccessibilityInfo,
} from "react-native";
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
import { nativeReturnPath, nativeSignInPath } from "./auth";
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
  LanguageSelect,
  Qty,
  Facts,
  Empty,
  Gate,
  DayPicker,
  C,
  styles,
} from "./ui";
export function Discover() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { offers, area, setArea, compare, error, refresh, t, locale } = useNative();
  const [search, setSearch] = useState(""),
    [meal, setMeal] = useState("all"),
    [packageType, setPackageType] = useState("all"),
    [trial, setTrial] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const sections = useRef({ packages: 0, how: 0 });
  async function scrollTo(section: "packages" | "how") {
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    scroll.current?.scrollTo({
      y: sections.current[section],
      animated: !reduceMotion,
    });
  }
  const filtered = offers
    .filter(
      (o) =>
        (!search ||
          [o.name, o.caterer, ...o.tags, ...o.menus.map((m) => menuSummary(m, locale))]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (meal === "all" || o.meal === meal) &&
        (packageType === "all" || o.packageType === packageType) &&
        (!trial || o.trialPrice),
    )
    .sort(
      (a, b) => Number(b.areas.includes(area)) - Number(a.areas.includes(area)),
    );
  return (
    <Screen refresh={refresh} scrollRef={scroll}>
      <Image
        source={require("../../../packages/brand/assets/wordmark.png")}
        style={{ width: 148, height: 50, alignSelf: "center" }}
        resizeMode="contain"
      />
      <LanguageSelect />
      <View style={styles.row}>
        <Btn
          secondary
          label={t("Jelajah katering", "Explore caterers")}
          onPress={() => void scrollTo("packages")}
        />
        <Btn
          secondary
          label={t("Cara berlangganan", "How it works")}
          onPress={() => void scrollTo("how")}
        />
      </View>
      <Select
        label={t("Area pengantaran", "Delivery area")}
        value={area}
        onChange={setArea}
        options={[
          { value: "", label: t("Pilih area", "Choose your area") },
          ...areaOptions.map((v) => ({ value: v, label: v })),
        ]}
      />
      <Field
        label={t("Cari makanan favorit", "Find your favorite meals")}
        value={search}
        onChangeText={setSearch}
        placeholder={t(
          "Paket, menu, atau katerer",
          "Package, meal, or caterer",
        )}
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
          {t("Makan enak.\nSetiap hari.", "Eat well.\nEvery day.")}
        </Txt>
        <Txt style={{ color: "#DDE7D5", fontSize: 12 }}>
          {t(
            "Pilih makanannya, atur jadwalnya, nikmati harinya.",
            "Choose your meals, plan your schedule, enjoy your day.",
          )}
        </Txt>
        <Photo src="/assets/food/ayam-panggang.png" height={190} />
      </View>
      <View
        nativeID="packages"
        onLayout={(event) => {
          sections.current.packages = event.nativeEvent.layout.y;
        }}
      >
        <Txt kind="heading">
          {t("Mau makan apa hari ini?", "What sounds good today?")}
        </Txt>
      </View>
      <Select
        label={t("Waktu makan", "Meal time")}
        value={meal}
        onChange={setMeal}
        options={[
          { label: t("Semua paket", "All packages"), value: "all" },
          { label: t("Makan siang", "Lunch"), value: "lunch" },
          { label: t("Makan malam", "Dinner"), value: "dinner" },
          { label: t("Siang + malam", "Lunch + dinner"), value: "both" },
        ]}
      />
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Txt>{t("Paket yang bisa dicoba dulu", "Packages with a trial")}</Txt>
        <Switch
          accessibilityLabel={t("Trial tersedia", "Trial available")}
          value={trial}
          onValueChange={setTrial}
          trackColor={{ true: C.forest }}
        />
      </View>
      {error && <Txt style={styles.error}>{error}</Txt>}
      {compare.length > 0 && (
        <Btn
          label={
            t("Bandingkan ", "Compare ") +
            compare.length +
            t(" paket", " packages")
          }
          onPress={() => router.push("/compare")}
        />
      )}
      <Txt kind="small">
        {filtered.length}{" "}
        {t(
          "paket untuk hari-hari yang lebih baik",
          "packages for better everyday meals",
        )}
      </Txt>
      <Select
        label={t("Jenis paket", "Package type")}
        value={packageType}
        onChange={setPackageType}
        options={[
          { value: "all", label: t("Semua jenis", "All types") },
          { value: "ala_carte", label: t("À la carte", "À la carte") },
          { value: "nasi_box", label: t("Nasi box", "Rice box") },
        ]}
      />
      {filtered.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}
      {!filtered.length && (
        <Empty
          title={t("Belum ada paket yang cocok.", "No matching packages yet.")}
          body={t(
            "Coba pencarian atau filter lain.",
            "Try another search or filter.",
          )}
        />
      )}
      <View
        nativeID="how-it-works"
        style={styles.stack}
        onLayout={(event) => {
          sections.current.how = event.nativeEvent.layout.y;
          if (section === "how-it-works")
            scroll.current?.scrollTo({
              y: sections.current.how,
              animated: false,
            });
        }}
      >
        <Txt kind="heading">{t("Cara berlangganan", "How it works")}</Txt>
        <Txt>
          {t(
            "Pilih katerer dan paket yang menjangkau alamatmu.",
            "Choose a caterer and package that deliver to your address.",
          )}
        </Txt>
        <Txt>
          {t(
            "Tentukan porsi dan tanggal mulai, lalu tinjau jadwal serta harga sebelum membayar.",
            "Set portions and a start date, then review the schedule and price before paying.",
          )}
        </Txt>
        <Txt>
          {t(
            "Pantau pengantaran di Jadwal. Beli paket berikutnya saat kamu siap; tidak ada perpanjangan otomatis.",
            "Track deliveries in Calendar. Buy your next package when ready; there is no automatic renewal.",
          )}
        </Txt>
        <Btn
          label={t("Temukan paketmu", "Find your package")}
          onPress={() => void scrollTo("packages")}
        />
      </View>
    </Screen>
  );
}
export function PackageScreen() {
  const { id, section, meal } = useLocalSearchParams<{
    id: string;
    section?: string;
    meal?: string;
  }>();
  const { offers, area, setArea, compare, toggleCompare, t, locale } =
    useNative();
  const scrollRef = useRef<ScrollView>(null);
  const [contentsY, setContentsY] = useState<number | null>(null);
  const [mealOffsets, setMealOffsets] = useState<Record<string, number>>({});
  const jumped = useRef("");
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
  const targetMeal = meal === "lunch" || meal === "dinner" ? meal : undefined;
  useEffect(() => {
    const key = id + ":" + section + ":" + meal;
    if (
      !o ||
      section !== "contents" ||
      (meal && !targetMeal) ||
      (targetMeal && !o.menus.some((m) => m.meal === targetMeal)) ||
      contentsY == null ||
      jumped.current === key
    )
      return;
    const offset = targetMeal ? mealOffsets[targetMeal] : 0;
    if (offset == null) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: contentsY + offset, animated: false });
      jumped.current = key;
    });
    return () => cancelAnimationFrame(frame);
  }, [id, section, meal, targetMeal, contentsY, mealOffsets, o]);
  if (!o)
    return (
      <Screen>
        <Empty title={t("Paket tidak ditemukan.", "Package not found.")} />
      </Screen>
    );
  const total = price(o, qty);
  const inArea = !area || o.areas.includes(area);
  return (
    <Screen scrollRef={scrollRef}>
      <Photo src={o.image} height={275} />
      <Txt kind="small">{o.caterer}</Txt>
      <Txt kind="title">{o.name}</Txt>
      <Txt>{o.description}</Txt>
      <Select
        label={t("Area pengantaran", "Delivery area")}
        value={area}
        onChange={setArea}
        options={areaOptions.map((v) => ({ value: v, label: v }))}
      />
      <View style={{ gap: 4 }}>
        <Txt>
          {o.days} {t("hari", "days")} · {mealLabel(o.meal, locale)}
        </Txt>
        <Txt kind="small">
          {o.flexible
            ? t("Jadwal fleksibel", "Flexible schedule")
            : t("Jadwal tetap", "Fixed schedule")}{" "}
          ·{" "}
          {inArea
            ? t("Pengantaran termasuk", "Delivery included")
            : t("Di luar area pengantaran", "Outside delivery area")}
        </Txt>
      </View>
      <Txt kind="heading">{t("Isi paket", "Included dishes")}</Txt>
      <View
        nativeID="package-contents"
        onLayout={(e) => setContentsY(e.nativeEvent.layout.y)}
      >
        <PackageContents
          offer={o}
          presentation="gallery"
          coverImage={o.image}
          onMealLayout={(value, y) =>
            setMealOffsets((previous) =>
              previous[value] === y ? previous : { ...previous, [value]: y },
            )
          }
        />
      </View>
      <Panel>
        <Txt kind="heading">
          {currency(o.price, locale)} / {t("porsi / hari", "portion / day")}
        </Txt>
        <Txt kind="small">
          {mealLabel(o.meal, locale)} · {o.days} {t("hari", "days")} ·{" "}
          {o.flexible
            ? t("Paket fleksibel", "Flexible package")
            : t("Paket tetap", "Fixed package")}
        </Txt>
        <Qty value={qty} onChange={setQty} />
        <Facts
          rows={[
            [t("Harga paket", "Package price"), currency(total.total, locale)],
            [
              t("Diskon kuantitas", "Quantity discount"),
              total.discountPercent + "%",
            ],
            [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
          ]}
        />
        <Btn
          disabled={!inArea}
          label={
            inArea
              ? t("Pilih paket ini", "Choose this package")
              : t("Di luar area pengantaran", "Outside delivery area")
          }
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
            label={
              t("Coba 1 hari", "Try 1 day") +
              " · " +
              currency(o.trialPrice * qty, locale)
            }
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
            compare.includes(id)
              ? t("Hapus perbandingan", "Remove comparison")
              : t("Bandingkan paket", "Compare package")
          }
          onPress={() => toggleCompare(id)}
        />
        <Txt kind="small">
          {t(
            "Biaya layanan ditampilkan saat checkout. Tidak ada perpanjangan otomatis.",
            "Service fee appears at checkout. No automatic renewal.",
          )}
        </Txt>
      </Panel>
      <Facts
        rows={[
          [
            t("Jadwal", "Schedule"),
            o.weekdays
              .map((d) =>
                (locale === "id"
                  ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
                  : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[d],
              )
              .join(", "),
          ],
          [
            t("Waktu pengantaran", "Delivery window"),
            o.meal === "both"
              ? o.windows.lunch + " & " + o.windows.dinner
              : o.windows[o.meal],
          ],
          [
            t("Batas perubahan", "Change cutoff"),
            o.cutoff.slice(0, 5) +
              " " +
              t("sehari sebelumnya", "the day before delivery"),
          ],
          [
            t("Pembatalan", "Cancellation"),
            t("Ditinjau melalui bantuan Catera", "Reviewed through Catera support"),
          ],
        ]}
      />
      <Btn
        secondary
        label={t("Tanya katerer", "Ask the caterer")}
        onPress={() =>
          router.push({
            pathname: "/messages",
            params: { caterer: o.catererId },
          })
        }
      />
      <Txt kind="heading">{t("Ulasan terverifikasi", "Verified reviews")}</Txt>
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
          {t(
            "Belum ada ulasan. Hanya pelanggan yang sudah menerima makanan dapat mengulas.",
            "No reviews yet. Only customers who have received a meal can review.",
          )}
        </Txt>
      )}
    </Screen>
  );
}
export function Comparison() {
  const { offers, compare, t, locale } = useNative();
  const [qty, setQty] = useState(1);
  return (
    <Screen title={t("Pilih yang paling pas.", "Find your best fit.")}>
      <Txt>
        {t(
          "Jumlah porsi sama untuk setiap paket.",
          "The same portion quantity applies to every package.",
        )}
      </Txt>
      <Qty value={qty} onChange={setQty} />
      {offers
        .filter((o) => compare.includes(o.id))
        .map((o) => (
          <Panel key={o.id}>
            <Photo src={o.image} height={150} />
            <Txt kind="heading">{o.name}</Txt>
            <PackageContents offer={o} />
            <Txt kind="small">{o.caterer}</Txt>
            <Facts
              rows={[
                [t("Total paket", "Package total"), currency(price(o, qty).total, locale)],
                [
                  t("Per porsi / hari", "Per portion / day"),
                  currency(price(o, qty).total / o.days / qty, locale),
                ],
                [
                  t("Jumlah makanan", "Meal count"),
                  o.days * (o.meal === "both" ? 2 : 1) +
                    " " + t("kali makan per porsi", "meals per portion"),
                ],
                [t("Durasi", "Duration"), o.days + " " + t("hari", "days")],
                [t("Waktu makan", "Meal time"), mealLabel(o.meal, locale)],
                [
                  t("Jadwal", "Schedule"),
                  o.flexible ? t("Fleksibel", "Flexible") : t("Tetap", "Fixed"),
                ],
                [
                  t("Trial", "Trial"),
                  o.trialPrice
                    ? currency(o.trialPrice * qty, locale)
                    : t("Tidak tersedia", "Unavailable"),
                ],
                [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
              ]}
            />
            <Btn
              label={t("Lihat paket", "View package")}
              onPress={() => router.push(("/package/" + o.id) as never)}
            />
          </Panel>
        ))}
      {!compare.length && (
        <Empty
          title={t(
            "Pilih hingga tiga paket dari Jelajah.",
            "Choose up to three packages from Discover.",
          )}
        />
      )}
    </Screen>
  );
}
export function LoginScreen() {
  const { demo, demoLogin, login, passwordLogin, t } = useNative();
  const p = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [name, setName] = useState(""),
    [sent, setSent] = useState(false),
    [method, setMethod] = useState<"email" | "phone">("email");
  const next = nativeReturnPath(p.next);
  return (
    <Screen
      title={t(
        "Hari yang baik, dimulai dari makan.",
        "A good day starts with a good meal.",
      )}
    >
      <LanguageSelect />
      <Image
        source={require("../../../packages/brand/assets/welcome.png")}
        style={{ width: 220, height: 200, alignSelf: "center" }}
        resizeMode="contain"
      />
      {demo ? (
        <Run
          label={t(
            "Jelajah sebagai pelanggan demo",
            "Explore as a demo customer",
          )}
          successMessage=""
          action={async () => {
            await demoLogin();
            router.replace(next as never);
          }}
        />
      ) : (
        <>
          <Select
            label={t("Metode masuk", "Sign-in method")}
            value={method}
            onChange={(v) => setMethod(v as "email" | "phone")}
            options={[
              {
                label: t("Email & kata sandi", "Email & password"),
                value: "email",
              },
              { label: t("Kode ponsel", "Phone code"), value: "phone" },
            ]}
          />
          {method === "email" ? (
            <>
              <Field
                label={t("Email", "Email")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder={t("nama@contoh.com", "name@example.com")}
              />
              <Field
                label={t("Kata sandi", "Password")}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={256}
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
              />
              <Run
                label={t("Masuk", "Sign in")}
                successMessage=""
                action={async () => {
                  const actor = await passwordLogin(email, password);
                  router.replace(nativeSignInPath(actor, next) as never);
                }}
              />
              <Txt kind="small">
                {t(
                  "Belum punya akun? Gunakan kode ponsel untuk mendaftar.",
                  "New here? Use a phone code to register.",
                )}
              </Txt>
            </>
          ) : (
            <>
              <Field
                label={t("Nomor ponsel", "Phone number")}
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
                    label={t("Kode OTP", "Verification code")}
                    value={token}
                    onChangeText={setToken}
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    maxLength={6}
                  />
                  <Field
                    label={t("Nama", "Name")}
                    value={name}
                    onChangeText={setName}
                    autoComplete="name"
                  />
                </>
              )}
              <Run
                key={sent ? "verify" : "send"}
                label={
                  sent
                    ? t("Verifikasi & masuk", "Verify & sign in")
                    : t("Kirim kode OTP", "Send verification code")
                }
                successMessage=""
                action={async () => {
                  if (!sent) {
                    await nativeApi.request("auth/send", { phone });
                    setSent(true);
                  } else {
                    const actor = await login(phone, token, name);
                    router.replace(nativeSignInPath(actor, next) as never);
                  }
                }}
              />
              {sent && (
                <Btn
                  secondary
                  label={t(
                    "Ubah nomor / kirim ulang",
                    "Change number / resend",
                  )}
                  onPress={() => {
                    setSent(false);
                    setToken("");
                  }}
                />
              )}
            </>
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
  const { actor, offers, command, t, locale } = useNative();
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
        <Empty title={t("Paket tidak ditemukan", "Package not found")} />
      </Screen>
    );
  if (!actor)
    return (
      <Screen title={t("Pilihanmu tetap tersimpan.", "Your selection is saved.")}>
        <Txt>
          {t(
            "Masuk untuk memilih alamat dan mengamankan jadwal makanan.",
            "Sign in to choose an address and reserve your meals.",
          )}
        </Txt>
        <Btn
          label={t("Masuk & lanjutkan", "Sign in & continue")}
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
          ? t("Kenalan lewat satu kali makan.", "Start with a first taste.")
          : t("Siapkan hari-hari yang lebih enak.", "Make room for good meals.")
      }
    >
      <Photo src={o.image} height={170} />
      <Txt kind="heading">{o.name}</Txt>
      <Txt kind="small">
        {o.caterer} · {trial ? t("Trial 1 hari", "1-day trial") : o.days + " " + t("hari", "days")}
      </Txt>
      <PackageContents offer={quote?.offer || o} />
      {!quote ? (
        <>
          <Qty
            value={qty}
            onChange={setQty}
            max={trial ? o.trialMax || 100 : 100}
          />
          <DayPicker
            label={t("Mulai tanggal", "Start date")}
            value={date}
            onChange={setDate}
            min={localDay()}
          />
          <Select
            label={t("Alamat pengantaran", "Delivery address")}
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
            label={t("Tambah alamat", "Add an address")}
            onPress={() => router.push("/addresses")}
          />
          <Field
            label={t("Kode promo (opsional)", "Promo code (optional)")}
            value={promo}
            onChangeText={setPromo}
            autoCapitalize="characters"
          />
          <Run
            label={t("Tinjau jadwal & harga", "Review schedule & price")}
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
          <Txt kind="heading">{t("Jadwal makananmu", "Your meal schedule")}</Txt>
          {quote.dates.map((d) => (
            <Txt key={d}>
              {new Date(d + "T12:00:00").toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {qty} {t("porsi", "portions")}
            </Txt>
          ))}
          <Facts
            rows={[
              [t("Harga paket", "Package subtotal"), currency(quote.subtotal, locale)],
              [t("Diskon porsi", "Portion discount"), currency(quote.discount, locale)],
              [t("Promo", "Promo"), currency(quote.promotion, locale)],
              [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
              [t("Biaya layanan", "Service fee"), currency(quote.serviceFee, locale)],
              [t("Total", "Total"), currency(quote.total, locale)],
            ]}
          />
          <Txt kind="small">
            {o.flexible
              ? t(
                  "Tanggal dapat dipindah sebelum cutoff sesuai kapasitas.",
                  "Dates can be moved before cutoff, subject to capacity.",
                )
              : t("Paket memiliki tanggal tetap.", "This package uses fixed dates.")}{" "}
            {t(
              "Semua pembatalan dan refund ditinjau melalui bantuan. Tidak ada perpanjangan otomatis.",
              "Cancellation and refund requests are reviewed through support. No automatic renewal.",
            )}
          </Txt>
          <View style={styles.row}>
            <Switch
              value={accepted}
              accessibilityLabel={t("Setujui jadwal alamat dan aturan", "Agree to the schedule, address, and terms")}
              onValueChange={setAccepted}
              trackColor={{ true: C.forest }}
            />
            <Txt kind="small" style={{ flex: 1 }}>
              {t(
                "Saya sudah memeriksa jadwal, alamat, dan ketentuan.",
                "I have reviewed the schedule, address, and terms.",
              )}
            </Txt>
          </View>
          <Run
            label={t("Lanjutkan ke pembayaran", "Continue to payment")}
            action={async () => {
              if (!accepted)
                throw new Error(
                  t(
                    "Periksa dan setujui ketentuan terlebih dahulu.",
                    "Review and agree to the terms first.",
                  ),
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
          <Btn
            secondary
            label={t("Ubah pilihan", "Edit selection")}
            onPress={() => setQuote(null)}
          />
        </Panel>
      )}
    </Screen>
  );
}
export function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { demo, command, t, locale } = useNative();
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
            ? t("Makanan baik sudah dijadwalkan.", "Good meals are on the calendar.")
            : t("Satu langkah menuju makan enak.", "One step away from good meals.")
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
                  {c.quote.offer.name} · {c.quote.portions} {t("porsi", "portions")} ·{" "}
                  {c.quote.dates.length} {t("hari", "days")}
                </Txt>
                <Btn
                  label={t("Lihat jadwal makan", "View meal calendar")}
                  onPress={() => router.replace("/calendar")}
                />
                <Btn
                  secondary
                  label={t("Detail langganan", "Subscription details")}
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
                    [t("Paket", "Package"), c.quote.offer.name],
                    [t("Total", "Total"), currency(c.quote.total, locale)],
                    [
                      t("Batas pembayaran", "Payment deadline"),
                      new Date(c.expires_at).toLocaleString(locale === "id" ? "id-ID" : "en-GB"),
                    ],
                  ]}
                />
                {c.state === "payment_exception" ? (
                  <Txt>
                    {t(
                      "Pembayaran diterima setelah jadwal tidak tersedia. Tim Catera sedang meninjau penyelesaiannya.",
                      "Payment arrived after the schedule became unavailable. Catera is reviewing the resolution.",
                    )}
                  </Txt>
                ) : new Date(c.expires_at) > new Date() ? (
                  demo ? (
                    <Run
                      label={t("Simulasikan pembayaran berhasil", "Simulate successful payment")}
                      action={() => command("checkout.demo_pay", { id })}
                    />
                  ) : c.payment_url ? (
                    <Run
                      label={t("Buka pembayaran aman", "Open secure payment")}
                      action={async () => {
                        await WebBrowser.openBrowserAsync(c.payment_url!);
                        state.reload();
                      }}
                    />
                  ) : (
                    <Txt>
                      {t(
                        "Tautan pembayaran sedang disiapkan.",
                        "Your payment link is being prepared.",
                      )}
                    </Txt>
                  )
                ) : (
                  <Btn
                    label={t("Pilih jadwal baru", "Choose a new schedule")}
                    onPress={() =>
                      router.replace(
                        ("/checkout/" + c.quote.packageId) as never,
                      )
                    }
                  />
                )}
                <Txt kind="small">
                  {t(
                    "Kembali dari pembayaran tidak membuktikan transaksi berhasil. Status diperiksa dari server.",
                    "Returning from payment does not prove the transaction succeeded. Status is checked with the server.",
                  )}
                </Txt>
                <Btn
                  secondary
                  label={t("Periksa status", "Check status")}
                  onPress={state.reload}
                />
              </>
            )}
          </>
        )}
      </Screen>
    </Gate>
  );
}
