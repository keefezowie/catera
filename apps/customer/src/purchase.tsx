import { PackageContents } from "./package-contents";
import type { Offer } from "@catera/domain";
import { NativeSaveButton, NativeSavedIntent } from "./saved";
import { useEffect, useRef, useState } from "react";
import { View, Image, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { currency, mealLabel, price, areaOptions } from "@catera/domain";
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
  Select,
  LanguageSelect,
  Qty,
  Facts,
  Empty,
  styles,
} from "./ui";
export { NativeDiscover as Discover } from "./discovery";
export function PackageScreen() {
  const { id, section, meal, next } = useLocalSearchParams<{
    id: string;
    section?: string;
    meal?: string;
    next?: string;
  }>();
  const { offers, area, setArea, compare, toggleCompare, t, locale } =
    useNative();
  const scrollRef = useRef<ScrollView>(null);
  const [contentsY, setContentsY] = useState<number | null>(null);
  const [mealOffsets, setMealOffsets] = useState<Record<string, number>>({});
  const jumped = useRef("");
  const [qty, setQty] = useState(1);
  const currentOffer = useData<{ offer: Offer | null }>(
    "public-offer:" + id,
    () => nativeApi.offer(id),
  );
  const o = currentOffer.data
    ? currentOffer.data.offer
    : offers.find((o) => o.id === id);
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
        {currentOffer.error ? (
          <>
            <Txt style={styles.error}>{currentOffer.error}</Txt>
            <Btn
              secondary
              label={t("Coba lagi", "Retry")}
              onPress={currentOffer.reload}
            />
          </>
        ) : (
          <Empty
            title={
              currentOffer.data
                ? t("Paket tidak ditemukan.", "Package not found.")
                : t("Memuat paket…", "Loading package…")
            }
          />
        )}
      </Screen>
    );
  const total = price(o, qty);
  const inArea = !area || o.areas.includes(area);
  return (
    <Screen scrollRef={scrollRef}>
      {next && (
        <Btn
          secondary
          label={t("Kembali ke paket", "Back to packages")}
          onPress={() => router.replace(nativeReturnPath(next) as never)}
        />
      )}
      <NativeSavedIntent />
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
        <NativeSaveButton
          packageId={o.id}
          name={o.name}
          returnPath={next || "/package/" + id}
        />
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
              .map(
                (d) =>
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
            t(
              "Ditinjau melalui bantuan Catera",
              "Reviewed through Catera support",
            ),
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
  const { next } = useLocalSearchParams<{ next?: string }>();
  const resolved = useData<{ offers: Offer[] }>(
    "comparison:" + compare.join(","),
    async () => ({
      offers: (
        await Promise.all(compare.map((id) => nativeApi.offer(id)))
      ).flatMap((item) => (item.offer ? [item.offer] : [])),
    }),
  );
  const selected =
    resolved.data?.offers ||
    offers.filter((offer) => compare.includes(offer.id));
  const [qty, setQty] = useState(1);
  return (
    <Screen title={t("Pilih yang paling pas.", "Find your best fit.")}>
      {next && (
        <Btn
          secondary
          label={t("Kembali ke paket", "Back to packages")}
          onPress={() => router.replace(nativeReturnPath(next) as never)}
        />
      )}
      {resolved.error && (
        <>
          <Txt style={styles.error}>{resolved.error}</Txt>
          <Btn
            secondary
            label={t("Coba lagi", "Retry")}
            onPress={resolved.reload}
          />
        </>
      )}
      <Txt>
        {t(
          "Jumlah porsi sama untuk setiap paket.",
          "The same portion quantity applies to every package.",
        )}
      </Txt>
      <Qty value={qty} onChange={setQty} />
      {selected.map((o) => (
        <Panel key={o.id}>
          <Photo src={o.image} height={150} />
          <Txt kind="heading">{o.name}</Txt>
          <PackageContents offer={o} />
          <Txt kind="small">{o.caterer}</Txt>
          <Facts
            rows={[
              [
                t("Total paket", "Package total"),
                currency(price(o, qty).total, locale),
              ],
              [
                t("Per porsi / hari", "Per portion / day"),
                currency(price(o, qty).total / o.days / qty, locale),
              ],
              [
                t("Jumlah makanan", "Meal count"),
                o.days * (o.meal === "both" ? 2 : 1) +
                  " " +
                  t("kali makan per porsi", "meals per portion"),
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
              <Btn
                secondary
                label={t("Lupa kata sandi?", "Forgot password?")}
                onPress={() =>
                  router.push({
                    pathname: "/recover" as never,
                    params: { next },
                  })
                }
              />
              <Btn
                secondary
                label={t(
                  "Buat akun / verifikasi email",
                  "Create account / verify email",
                )}
                onPress={() =>
                  router.push({
                    pathname: "/register" as never,
                    params: { next },
                  })
                }
              />
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
export { CheckoutScreen } from "./checkout";
export { PaymentScreen } from "./payment";
