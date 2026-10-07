import { Renewal } from "./renewal";
import { DeliveryCard as Meal } from "./agenda";
import { PackageContents } from "./package-contents";
import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  currency,
  areaOptions,
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
  Status,
  C,
  styles,
  ResourceNotice,
} from "./ui";
export function SubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { command, t, locale } = useNative();
  const state = useData<CustomerState>("subscription:" + id, () =>
    nativeApi.customer(),
  );
  const [review, setReview] = useState(false),
    [rating, setRating] = useState("5"),
    [body, setBody] = useState("");
  const s = state.data?.subscriptions.find((s) => s.id === id);
  return (
    <Gate>
      <Screen title={t("Langganan", "Subscription")} refresh={state.reload}>
        <ResourceNotice resource={state} />
        {state.data && !s && (
          <Empty
            title={t("Langganan tidak ditemukan", "Subscription not found")}
          />
        )}
        {s && (
          <>
            <Photo src={s.snapshot.offer.image} height={220} />
            <PackageContents offer={s.snapshot.offer} />
            {s.snapshot.offer.menuSelectionMode === "customer" && (
              <Btn
                secondary
                label={t("Pilih menu", "Choose menus")}
                onPress={() =>
                  router.push(("/subscriptions/" + s.id + "/menu") as never)
                }
              />
            )}
            <Txt kind="heading">{s.snapshot.offer.name}</Txt>
            <Txt>{s.snapshot.offer.caterer}</Txt>
            <Status status={s.status} />
            <Facts
              rows={[
                [
                  t("Sisa pengantaran", "Remaining deliveries"),
                  s.remaining + " " + t("hari", "days"),
                ],
                [t("Porsi tetap", "Fixed portions"), s.portions],
                [
                  t("Mulai / selesai", "Start / end"),
                  s.starts_on + " — " + s.ends_on,
                ],
                [
                  t("Pembelian", "Purchase"),
                  currency(s.snapshot.total, locale),
                ],
                [
                  t("Aturan", "Terms"),
                  s.snapshot.offer.flexible
                    ? t("Fleksibel", "Flexible")
                    : t("Tetap", "Fixed"),
                ],
              ]}
            />
            <Renewal subscription={s} />
            <Btn
              secondary
              label={t(
                "Ajukan bantuan / pembatalan",
                "Request help / cancellation",
              )}
              onPress={() =>
                router.push({
                  pathname: "/bantuan",
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
                    disabled={!state.canWrite}
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
        <ResourceNotice resource={state} />
      </Screen>
    </Gate>
  );
}
export function MessagesScreen() {
  const { actor } = useNative();
  const params = useLocalSearchParams<{
    caterer?: string;
    checkoutId?: string;
  }>();
  return <Messages key={`${actor?.id}:${params.caterer || "all"}`} />;
}
function Messages() {
  const { actor, offers, command, t, locale } = useNative();
  const params = useLocalSearchParams<{
    caterer?: string;
    checkoutId?: string;
  }>();
  const state = useData<Conversation[]>("messages:" + actor?.id, () =>
    nativeApi.conversations(),
  );
  const [selected, setSelected] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const conversation =
    state.data?.find((c) => c.id === selected) ||
    state.data?.find((c) => c.caterer_id === params.caterer) ||
    (!params.caterer ? state.data?.[0] : undefined);
  const caterer = conversation?.caterer_id || params.caterer;
  const draftKey = `${actor?.id}:${caterer || "none"}`;
  const body =
    drafts[draftKey] ??
    (params.checkoutId
      ? t("Bantuan untuk pesanan ", "Help with order ") +
        params.checkoutId +
        "\n"
      : "");
  const setBody = (value: string) =>
    setDrafts((d) => ({ ...d, [draftKey]: value }));
  return (
    <Gate
      next={"/messages" + (params.caterer ? "?caterer=" + params.caterer : "")}
    >
      <Screen title={t("Pesan", "Messages")} refresh={state.reload}>
        <ResourceNotice resource={state} />
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
                  {new Date(m.created_at).toLocaleTimeString(
                    locale === "id" ? "id-ID" : "en-GB",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
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
              disabled={!state.canWrite || !body.trim()}
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
        ) : state.data ? (
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
        ) : null}
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
      <Screen title={t("Akun", "Account")} refresh={s.reload}>
        <ResourceNotice resource={s} />
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
          label={t("Paket tersimpan", "Saved packages")}
          icon="bookmark-outline"
          onPress={() => router.push("/saved")}
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
          onPress={() => router.push("/bantuan")}
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
  const { actor } = useNative();
  return <AddressBook key={actor?.id || "guest"} />;
}
function AddressBook() {
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
      <Screen
        title={t(
          "Makanan diantar ke mana?",
          "Where should meals be delivered?",
        )}
        refresh={s.reload}
      >
        <ResourceNotice resource={s} />
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
        <Btn
          label={t("Tambah alamat", "Add address")}
          onPress={() => edit(null)}
        />
        {editing !== undefined && (
          <Panel>
            <Field
              label={t("Label alamat", "Address label")}
              value={label}
              onChangeText={setLabel}
            />
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
            <Field
              label={t("Kota", "City")}
              value={city}
              onChangeText={setCity}
            />
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
              disabled={
                !s.canWrite ||
                !label.trim() ||
                line.trim().length < 5 ||
                !city.trim()
              }
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
export function NotificationsScreen() {
  const { command, t, locale } = useNative();
  const s = useData<CustomerState>("notifications", () => nativeApi.customer());
  return (
    <Gate>
      <Screen title={t("Notifikasi", "Notifications")} refresh={s.reload}>
        <ResourceNotice resource={s} />
        {s.data?.notifications.map((n) => (
          <Panel key={n.id}>
            {!n.read_at && (
              <Txt kind="label">{t("Belum dibaca", "Unread")}</Txt>
            )}
            <Txt>{n.body}</Txt>
            <Txt kind="small">
              {new Date(n.created_at).toLocaleString(
                locale === "id" ? "id-ID" : "en-GB",
              )}
            </Txt>
            <Run
              secondary
              label={t("Lihat pembaruan", "View update")}
              disabled={!s.canWrite}
              successMessage=""
              action={async () => {
                if (!n.read_at)
                  await command("notification.read", { id: n.id });
                router.push(nativeLink(n.href) as never);
              }}
            />
          </Panel>
        ))}
        {s.data && !s.data.notifications.length && (
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
