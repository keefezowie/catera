import { Renewal } from "./renewal";
import { DeliveryCard as Meal } from "./agenda";
import { PackageContents } from "./package-contents";
import {
  NativeDeliveryIssueReport,
  NativeDeliveryIssues,
} from "./delivery-issues";
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
export { Home, Calendar } from "./agenda";
export { DeliveryScreen } from "./delivery";
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
export function SupportScreen() {
  const { actor } = useNative();
  const params = useLocalSearchParams<{
    subscription?: string;
    delivery?: string;
    issue?: string;
    case?: string;
    checkoutId?: string;
  }>();
  return <Support key={`${actor?.id}:${JSON.stringify(params)}`} />;
}
function Support() {
  const params = useLocalSearchParams<{
    subscription?: string;
    delivery?: string;
    issue?: string;
    case?: string;
    checkoutId?: string;
  }>();
  const { command, t, locale } = useNative();
  const s = useData<CustomerState>("support", () => nativeApi.customer());
  const checkout = useData("support-checkout:" + params.checkoutId, () =>
    params.checkoutId
      ? nativeApi.checkout(params.checkoutId)
      : Promise.resolve(null),
  );
  const [open, setOpen] = useState(!!params.subscription),
    [subscription, setSubscription] = useState(params.subscription || ""),
    [subject, setSubject] = useState("Makanan belum diterima"),
    [description, setDescription] = useState("");
  return (
    <Gate
      next={
        "/support?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(([, v]) => typeof v === "string"),
          ) as Record<string, string>,
        )
      }
    >
      <Screen title={t("Bantuan", "Support")} refresh={s.reload}>
        <ResourceNotice resource={s} />
        {params.checkoutId && <ResourceNotice resource={checkout} />}
        {checkout.data && (
          <Panel>
            <Txt kind="heading">
              {t("Bantuan pembayaran", "Payment support")}
            </Txt>
            <Txt>{checkout.data.quote.offer.name}</Txt>
            <Txt kind="small">
              {t("Nomor pesanan", "Order reference")}: {checkout.data.id}
            </Txt>
            <Btn
              secondary
              label={t(
                "Hubungi katerer tentang pesanan",
                "Contact caterer about this order",
              )}
              onPress={() =>
                router.push({
                  pathname: "/messages",
                  params: {
                    caterer: checkout.data!.quote.offer.catererId,
                    checkoutId: checkout.data!.id,
                  },
                })
              }
            />
          </Panel>
        )}
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
        <Btn
          label={t("Ajukan bantuan", "Request support")}
          disabled={!s.canWrite || !s.data?.subscriptions.length}
          onPress={() => setOpen(!open)}
        />
        {params.delivery && (
          <NativeDeliveryIssueReport
            key={params.delivery}
            id={params.delivery}
          />
        )}
        <NativeDeliveryIssues issue={params.issue} />
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
              disabled={!s.canWrite || !subscription || !description.trim()}
              action={async () => {
                await command("support.create", {
                  subscriptionId: subscription,
                  deliveryId: params.delivery || undefined,
                  subject,
                  description,
                });
                setOpen(false);
                setDescription("");
              }}
            />
          </Panel>
        )}
        {(params.case || params.checkoutId) && (
          <Btn
            secondary
            label={t("Semua permintaan bantuan", "All support requests")}
            onPress={() => router.replace("/support")}
          />
        )}
        {params.case &&
          s.data &&
          !s.data.cases.some((c) => c.id === params.case) && (
            <Empty
              title={t("Permintaan tidak ditemukan", "Request not found")}
              body={t(
                "Buka semua permintaan bantuan untuk melihat status terbaru.",
                "Open all support requests to see the latest status.",
              )}
            />
          )}
        {s.data?.cases
          .filter(
            (c) =>
              (!params.case || c.id === params.case) &&
              (!params.checkoutId || c.checkout_id === params.checkoutId),
          )
          .map((c) => (
            <Panel key={c.id}>
              <Txt kind="heading">{c.subject}</Txt>
              <Status status={c.status} />
              <Txt>{c.description}</Txt>
              {c.resolution && <Txt>{c.resolution}</Txt>}
              {!!c.amount && (
                <Txt>
                  {t("Refund disetujui", "Refund approved")}:{" "}
                  {currency(c.amount, locale)}
                </Txt>
              )}
              {s.data?.refunds
                ?.filter((r) => r.case_id === c.id)
                .map((r) => (
                  <View key={r.id} style={styles.stack}>
                    <Txt kind="label">
                      {t("Pengembalian dana", "Refund")}:{" "}
                      {currency(r.amount, locale)}
                    </Txt>
                    <Status status={r.state} />
                    {r.state !== "succeeded" && (
                      <Txt kind="small">
                        {t(
                          "Persetujuan kasus belum berarti dana sudah kembali. Status ini mengikuti pemrosesan pembayaran.",
                          "Case approval does not mean funds have arrived. This status follows payment processing.",
                        )}
                      </Txt>
                    )}
                    {r.state === "needs_attention" && (
                      <Txt>
                        {t(
                          "Catera sedang menangani refund ini. Dana belum dikembalikan.",
                          "Catera is reviewing this refund. Funds have not been returned yet.",
                        )}
                      </Txt>
                    )}
                  </View>
                ))}
              {c.status === "responded" && (
                <Run
                  label={t("Minta Catera meninjau", "Ask Catera to review")}
                  disabled={!s.canWrite}
                  action={() => command("support.escalate", { id: c.id })}
                />
              )}
            </Panel>
          ))}
        {s.data && !s.data.cases.length && !open && (
          <Empty
            title={t(
              "Belum ada kasus bantuan langganan.",
              "No subscription support cases.",
            )}
            body={t(
              "Kasus langganan atau keuangan ditampilkan di bagian ini.",
              "Subscription or financial cases appear in this section.",
            )}
          />
        )}
        <ResourceNotice resource={s} />
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
