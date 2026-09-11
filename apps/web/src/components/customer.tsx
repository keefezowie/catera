"use client";
import { MealCalendar } from "./meal-calendar";
import { Select, SelectOption } from "./select";
import { DatePicker } from "./date-picker";
import { PackageContents } from "./package-contents";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  MapPin,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sun,
  Moon,
  MessageCircle,
  Send,
  Check,
  Bell,
  LogOut,
  Settings,
  Star,
  LifeBuoy,
  Package,
  Truck,
} from "lucide-react";
import {
  localDay,
  addDays,
  currency,
  mealLabel,
  areaOptions,
  type CustomerState,
  type Delivery,
  type Conversation,
  type Subscription,
  type Address,
  type Locale,
} from "@catera/domain";
import { useApp, useResource, api } from "./context";
import {
  Heading,
  Loading,
  ErrorNotice,
  Empty,
  Status,
  Dialog,
  ActionForm,
  Field,
  Facts,
} from "./ui";
const dateLabel = (d: string, locale: Locale = "id") =>
  new Date(d + "T12:00:00").toLocaleDateString(
    locale === "id" ? "id-ID" : "en-GB",
    { weekday: "long", day: "numeric", month: "long" },
  );
export function Customer(props: { view: string; id?: string }) {
  return props.view === "calendar" ? <MealCalendar /> : <CustomerOverview {...props} />;
}
function CustomerOverview({ view, id }: { view: string; id?: string }) {
  const { actor, t, locale } = useApp();
  const [date] = useState(localDay());
  const state = useResource<CustomerState>("customer:" + date, () =>
    api.customer("?from=" + addDays(date, -7) + "&to=" + addDays(date, 60)),
  );
  if (state.error)
    return (
      <div className="content">
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>
    );
  if (!state.data) return <Loading />;
  const c = state.data;
  const next = c.deliveries.find(
    (d) =>
      !["delivered", "cancelled"].includes(d.status) &&
      d.service_date >= localDay(),
  );
  if (view === "subscriptions")
    return (
      <div className="content narrow-wide">
        <Heading
          title={t("Paket yang menemani harimu", "Your everyday meal packages")}
          description={t(
            "Setiap paket punya porsi, jadwal, dan ketentuannya sendiri.",
            "Each package keeps its own portions, schedule, and terms.",
          )}
        />
        {id ? (
          <SubscriptionDetail
            subscription={c.subscriptions.find((s) => s.id === id)}
            deliveries={c.deliveries}
          />
        ) : (
          <div className="subscription-list">
            {c.subscriptions.map((s) => (
              <SubscriptionCard key={s.id} subscription={s} />
            ))}
          </div>
        )}
      </div>
    );
  return (
    <div
      className={"content " + (view === "home" ? "home-page" : "calendar-page")}
    >
      <Heading
        title={
          view === "home"
            ? t(
                "Halo, " + actor?.name.split(" ")[0] + ". Mau makan enak?",
                "Hello, " +
                  actor?.name.split(" ")[0] +
                  ". Ready for a good meal?",
              )
            : t(
                "Hari-hari yang sudah terencana.",
                "Your meals, all in one place.",
              )
        }
        description={
          view === "home"
            ? t(
                "Lebih sedikit memikirkan makan. Lebih banyak menikmati hari.",
                "Less meal planning. More enjoying your day.",
              )
            : t(
                "Semua paket dan katerer, dalam satu jadwal.",
                "Every package and caterer, in one calendar.",
              )
        }
      >
        {view === "home" && (
          <Link className="button secondary" href="/#packages">
            {t("Temukan favorit baru", "Find a new favorite")}
            <ArrowUpRight size={17} />
          </Link>
        )}
      </Heading>
      {view === "home" ? (
        <>
          <div className="home-main">
            {next ? (
              <NextMeal delivery={next} />
            ) : (
              <Empty
                title="Belum ada makanan berikutnya"
                description="Yuk, temukan paket untuk keseharianmu."
                href="/#packages"
                label="Jelajah katering"
              />
            )}
            <section className="daily-agenda">
              <div className="section-heading">
                <div>
                  <h2>{t("Agenda makan", "Meal agenda")}</h2>
                  <p>
                    {next?.service_date === localDay()
                      ? t("Hari ini", "Today")
                      : next
                        ? dateLabel(next.service_date, locale)
                        : t("Belum ada jadwal", "No scheduled meals")}
                  </p>
                </div>
                <Link
                  href="/calendar"
                  className="text-button"
                  aria-label={t("Lihat kalender", "View calendar")}
                >
                  <ArrowUpRight size={19} />
                </Link>
              </div>
              {c.deliveries
                .filter(
                  (d) =>
                    d.service_date === (next?.service_date || localDay()) &&
                    d.status !== "cancelled",
                )
                .flatMap((d) =>
                  d.meals.map((m) => (
                    <Link
                      key={d.id + m.meal}
                      href={"/deliveries/" + d.id}
                      className="home-agenda-row"
                    >
                      {m.meal === "lunch" ? (
                        <Sun size={20} />
                      ) : (
                        <Moon size={20} />
                      )}
                      <div>
                        <small>
                          {mealLabel(m.meal, locale)} ·{" "}
                          {d.offer.windows[m.meal as "lunch" | "dinner"]}
                        </small>
                        <strong>{d.offer.name}</strong>
                        <p>
                          {d.offer.caterer} · {d.portions}{" "}
                          {t("porsi", "portions")}
                        </p>
                      </div>
                      <Status status={m.status} />
                    </Link>
                  )),
                )}
              {!next && (
                <p className="quiet-empty">
                  {t(
                    "Temukan paket untuk mulai mengisi jadwal.",
                    "Find a package to start your meal calendar.",
                  )}
                </p>
              )}
            </section>
          </div>
          <section className="active-packages home-subscriptions">
            <div className="section-heading">
              <h2>{t("Paket aktif", "Active packages")}</h2>
              <Link href="/subscriptions">
                <ArrowUpRight size={19} />
              </Link>
            </div>
            {c.subscriptions
              .filter((s) => s.status === "active")
              .map((s) => (
                <SubscriptionCard key={s.id} subscription={s} compact />
              ))}
            {!c.subscriptions.length && <p>Belum ada paket aktif.</p>}
            <Link className="add-package" href="/#packages">
              <Plus size={20} />
              {t("Tambah paket yang kamu suka", "Add another favorite")}
            </Link>
          </section>
          <div className="section-heading spaced">
            <div>
              <h2>{t("Setelah ini, ada apa?", "What comes next?")}</h2>
              <p>
                {t(
                  "Makanan berikutnya dari semua katerermu.",
                  "Upcoming meals from all your caterers.",
                )}
              </p>
            </div>
            <Link className="text-button" href="/calendar">
              {t("Lihat semua jadwal", "View full calendar")}
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="upcoming-grid">
            {c.deliveries
              .filter((d) => d.id !== next?.id && d.status === "scheduled")
              .slice(0, 3)
              .map((d) => (
                <DeliveryRow key={d.id} delivery={d} />
              ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
function NextMeal({ delivery: d }: { delivery: Delivery }) {
  const { t, locale } = useApp();
  const upcoming =
    d.meals.find((m) => !["delivered", "cancelled"].includes(m.status)) ||
    d.meals[0];
  return (
    <section className="next-meal-card">
      <div className="next-meal-photo">
        <img src={d.offer.image} alt={d.offer.name} />
        <span className="image-label">
          <Clock size={14} />
          {t("Makanan berikutnya", "Your next meal")}
        </span>
      </div>
      <div className="next-meal-content">
        <div className="caterer-line">
          <span>{d.offer.caterer}</span>
          <Status status={upcoming.status} />
        </div>
        <h2>{d.offer.name}</h2>
        <p>
          {dateLabel(d.service_date, locale)} · {d.portions}{" "}
          {t("porsi", "portions")}
        </p>
        <div className="next-meal-info">
          <span>
            <Clock size={16} />
            {mealLabel(upcoming.meal, locale)} ·{" "}
            {upcoming.meal === "dinner"
              ? d.offer.windows.dinner
              : d.offer.windows.lunch}
          </span>
          <span>
            <MapPin size={16} />
            {d.address.label} · {d.address.area}
          </span>
        </div>
        <Link className="button" href={"/deliveries/" + d.id}>
          {t("Lihat pengantaran", "View delivery")}
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
function SubscriptionCard({
  subscription: s,
  compact = false,
}: {
  subscription: Subscription;
  compact?: boolean;
}) {
  const { t, locale } = useApp();
  return (
    <Link
      href={"/subscriptions/" + s.id}
      className={"subscription-card " + (compact ? "compact" : "")}
    >
      <img src={s.snapshot.offer.image} alt="" />
      <div>
        <small>{s.snapshot.offer.caterer}</small>
        <h3>{s.snapshot.offer.name}</h3>
        <p>
          {s.portions} {t("porsi", "portions")} ·{" "}
          {mealLabel(s.snapshot.offer.meal, locale)}
        </p>
        <span className="remaining">
          {s.remaining} {t("hari tersisa", "days remaining")}
        </span>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
function DeliveryRow({ delivery: d }: { delivery: Delivery }) {
  const { locale, t } = useApp();
  return (
    <Link href={"/deliveries/" + d.id} className="delivery-row">
      <img src={d.offer.image} alt="" />
      <div>
        <small>
          {d.offer.caterer} · {dateLabel(d.service_date, locale)}
        </small>
        <h3>{d.offer.name}</h3>
        <p>
          {mealLabel(d.offer.meal, locale)} · {d.portions}{" "}
          {t("porsi", "portions")} · {d.address.label}
        </p>
      </div>
      <Status status={d.status} />
      <ArrowUpRight size={18} />
    </Link>
  );
}
function SubscriptionDetail({
  subscription: s,
  deliveries,
}: {
  subscription: Subscription | undefined;
  deliveries: Delivery[];
}) {
  const { t, locale, perform } = useApp();
  const [review, setReview] = useState(false);
  if (!s) return <Empty title="Langganan tidak ditemukan" />;
  return (
    <>
      <SubscriptionCard subscription={s} />
      <PackageContents offer={s.snapshot.offer} />
      <Facts
        rows={[
          [
            t("Sisa pengantaran", "Remaining days"),
            s.remaining + " " + t("hari", "days"),
          ],
          [t("Porsi tetap", "Fixed portions"), s.portions],
          [
            t("Mulai / selesai", "Start / end"),
            s.starts_on + " — " + s.ends_on,
          ],
          [
            t("Nilai pembelian", "Purchase total"),
            currency(s.snapshot.total, locale),
          ],
          [
            t("Aturan", "Terms"),
            s.snapshot.offer.flexible ? "Fleksibel" : "Tetap",
          ],
          [
            t("Asal pembelian", "Purchase source"),
            s.legacy ? "Langganan lama / pembayaran eksternal" : "Catera",
          ],
        ]}
      />
      <div className="action-row">
        <Link
          className="button"
          href={"/checkout/" + s.package_id + "?portions=" + s.portions}
        >
          {t("Beli paket berikutnya", "Buy the next package")}
          <ArrowRight size={17} />
        </Link>
        <Link
          className="button secondary"
          href={"/support?subscription=" + s.id}
        >
          {t("Ajukan pembatalan / bantuan", "Request cancellation / help")}
        </Link>
        {deliveries.some(
          (d) => d.subscription_id === s.id && d.status === "delivered",
        ) && (
          <button className="button secondary" onClick={() => setReview(true)}>
            <Star size={17} />
            {t("Tulis ulasan", "Write a review")}
          </button>
        )}
      </div>
      <p className="notice">
        {t(
          "Pembelian berikutnya memakai harga dan aturan terbaru. Tinjau semuanya sebelum membayar.",
          "The next purchase uses current prices and terms. Review them before paying.",
        )}
      </p>
      <h2 className="spaced">
        {t("Pengantaran dalam paket", "Deliveries in this package")}
      </h2>
      {deliveries
        .filter((d) => d.subscription_id === s.id)
        .map((d) => (
          <DeliveryRow key={d.id} delivery={d} />
        ))}
      <Dialog
        open={review}
        onOpenChange={setReview}
        title="Ceritakan pengalamanmu"
      >
        <ActionForm
          submit="Kirim ulasan"
          onSubmit={async (f) => {
            await perform("review.save", {
              subscriptionId: s.id,
              rating: Number(f.get("rating")),
              food: Number(f.get("food")),
              delivery: Number(f.get("delivery")),
              value: Number(f.get("value")),
              body: f.get("body"),
            });
            setReview(false);
          }}
        >
          {[
            ["rating", "Keseluruhan"],
            ["food", "Makanan"],
            ["delivery", "Pengantaran"],
            ["value", "Nilai paket"],
          ].map(([name, label]) => (
            <Field key={name} label={label}>
              <Select name={name} defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectOption key={n}>{n}</SelectOption>
                ))}
              </Select>
            </Field>
          ))}
          <Field label="Ulasan">
            <textarea name="body" required maxLength={2000} />
          </Field>
        </ActionForm>
      </Dialog>
    </>
  );
}
export function DeliveryPage({ id }: { id: string }) {
  const { t, locale, perform } = useApp();
  const state = useResource<CustomerState>("delivery:" + id, () =>
    api.customer("?deliveryId=" + id),
  );
  const [dialog, setDialog] = useState("");
  const [replacement, setReplacement] = useState("");
  const [review, setReview] = useState(false);
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  const d = state.data.deliveries.find((d) => d.id === id);
  if (!d) return <Empty title="Pengantaran tidak ditemukan" />;
  const canAddress =
    d.status === "scheduled" && new Date(d.cutoff_at) > new Date();
  return (
    <div className="content narrow-wide">
      <Link className="back-link" href="/calendar">
        <ArrowLeft size={17} />
        {t("Jadwal makan", "Meal calendar")}
      </Link>
      <NextMeal delivery={d} />
      <div className="delivery-timeline">
        {["scheduled", "preparing", "out_for_delivery", "delivered"].map(
          (s, i) => (
            <div
              key={s}
              className={
                [
                  "scheduled",
                  "preparing",
                  "out_for_delivery",
                  "delivered",
                ].indexOf(d.status) >= i
                  ? "complete"
                  : ""
              }
            >
              <span>
                <Check size={15} />
              </span>
              <Status status={s} />
            </div>
          ),
        )}
      </div>
      <PackageContents offer={d.offer} />
      <Facts
        rows={[
          ...d.meals.map(
            (m) =>
              [
                mealLabel(m.meal, locale),
                <Status key={m.meal} status={m.status} />,
              ] as [string, React.ReactNode],
          ),
          [
            t("Alamat lengkap", "Full address"),
            d.address.line + ", " + d.address.area,
          ],
          [
            t("Catatan pengantaran", "Delivery instructions"),
            d.address.instructions || "—",
          ],
          [
            t("Batas perubahan", "Change cutoff"),
            new Date(d.cutoff_at).toLocaleString(
              locale === "id" ? "id-ID" : "en-GB",
              { timeZone: d.offer.timezone },
            ),
          ],
          [t("Porsi", "Portions"), d.portions],
          [t("Jadwal", "Schedule"), d.offer.flexible ? "Fleksibel" : "Tetap"],
        ]}
      />
      <div className="action-row">
        {canAddress && (
          <button
            className="button secondary"
            onClick={() => setDialog("address")}
          >
            <MapPin size={17} />
            {t("Ubah alamat", "Change address")}
          </button>
        )}
        {d.canChange && (
          <>
            <button
              className="button"
              onClick={() => {
                setDialog("reschedule");
                setReview(false);
              }}
            >
              <CalendarDays size={17} />
              {t("Ganti tanggal", "Change date")}
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setDialog("skip");
                setReview(false);
              }}
            >
              {t("Lewati & pilih pengganti", "Skip & choose replacement")}
            </button>
          </>
        )}
        <Link
          className="button secondary"
          href={"/messages?caterer=" + d.offer.catererId}
        >
          <MessageCircle size={17} />
          {t("Hubungi katerer", "Contact caterer")}
        </Link>
        <Link className="text-button" href={"/support?delivery=" + d.id}>
          {t("Laporkan masalah", "Report an issue")}
        </Link>
      </div>
      {!d.canChange && (
        <p className="notice">
          {d.offer.flexible
            ? t(
                "Pengantaran sudah melewati batas perubahan atau sedang diproses.",
                "This delivery is past cutoff or is already being prepared.",
              )
            : t(
                "Paket ini memiliki jadwal tetap. Hubungi katerer jika membutuhkan bantuan.",
                "This package has fixed dates. Contact your caterer if you need help.",
              )}
        </p>
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(o) => {
          if (!o) setDialog("");
        }}
        title={
          dialog === "address"
            ? "Ubah alamat pengantaran"
            : dialog === "skip"
              ? "Pilih tanggal pengganti"
              : "Ganti tanggal pengantaran"
        }
        description={
          d.offer.meal === "both"
            ? "Makan siang dan malam berpindah bersama dengan alamat yang sama."
            : "Porsi dan ketentuan paket tidak berubah."
        }
      >
        {dialog === "address" ? (
          <ActionForm
            submit="Simpan alamat pengantaran"
            onSubmit={async (f) => {
              await perform("delivery.address", {
                id: d.id,
                version: d.version,
                addressId: f.get("addressId"),
              });
              setDialog("");
            }}
          >
            <Field label="Alamat baru">
              <Select name="addressId" defaultValue={d.address.id}>
                {state.data.addresses.map((a) => (
                  <SelectOption key={a.id} value={a.id}>
                    {a.label} — {a.line}
                  </SelectOption>
                ))}
              </Select>
            </Field>
          </ActionForm>
        ) : (
          <ActionForm
            submit={
              review ? "Konfirmasi tanggal pengganti" : "Tinjau perubahan"
            }
            onSubmit={async () => {
              if (!review) {
                const choices = await api.request<
                  { available: boolean; reason: string }[]
                >(
                  "availability/" +
                    id +
                    "?from=" +
                    replacement +
                    "&to=" +
                    replacement,
                );
                if (!choices[0]?.available)
                  throw new Error(choices[0]?.reason || "INVALID_DATE");
                setReview(true);
                return;
              }
              await perform("delivery.reschedule", {
                id: d.id,
                version: d.version,
                date: replacement,
                kind: dialog,
              });
              setDialog("");
            }}
          >
            <Field label="Tanggal pengganti">
              <DatePicker
                required
                min={localDay()}
                value={replacement}
                onValueChange={(value) => {
                  setReplacement(value);
                  setReview(false);
                }}
              />
            </Field>
            {review && (
              <Facts
                rows={[
                  ["Dari", dateLabel(d.service_date, locale)],
                  ["Menjadi", dateLabel(replacement, locale)],
                  ["Porsi", d.portions],
                ]}
              />
            )}
            <p className="notice">
              Tanggal lama tetap aman apabila tanggal baru penuh. Pengantaran
              tidak hangus.
            </p>
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
export function Messages() {
  const { actor, t, perform, offers } = useApp();
  const query = useSearchParams();
  const selectedCaterer = query.get("caterer");
  const state = useResource<Conversation[]>("conversations", () =>
    api.conversations(),
  );
  const [selected, setSelected] = useState("");
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  const c =
    state.data.find((c) => c.id === selected) ||
    state.data.find((c) => c.caterer_id === selectedCaterer) ||
    state.data[0];
  const newCaterer =
    selectedCaterer && !state.data.some((c) => c.caterer_id === selectedCaterer)
      ? offers.find((o) => o.catererId === selectedCaterer)
      : null;
  return (
    <div className="content messages-page">
      <Heading
        title={t("Obrolan yang bikin jelas.", "A little conversation helps.")}
        description={t(
          "Tanya menu, atur pengantaran, atau sampaikan sesuatu ke katerermu.",
          "Ask about meals, coordinate a delivery, or talk to your caterer.",
        )}
      />
      <div className="messages-layout">
        <aside>
          <h2>{t("Percakapan", "Conversations")}</h2>
          {newCaterer && (
            <div className="conversation-preview active">
              <span className="mini-avatar">{newCaterer.caterer[0]}</span>
              <strong>{newCaterer.caterer}</strong>
            </div>
          )}
          {state.data.map((x) => (
            <button
              key={x.id}
              className={
                "conversation-preview " +
                (c?.id === x.id && !newCaterer ? "active" : "")
              }
              onClick={() => setSelected(x.id)}
            >
              <span className="mini-avatar">{x.caterer[0]}</span>
              <div>
                <strong>
                  {actor?.role === "customer" ? x.caterer : x.customer}
                </strong>
                <small>
                  {x.messages.at(-1)?.body.slice(0, 60) || "Mulai percakapan"}
                </small>
              </div>
            </button>
          ))}
        </aside>
        <section className="conversation">
          {c || newCaterer ? (
            <>
              <header>
                <span className="mini-avatar">
                  {(newCaterer?.caterer || c?.caterer || "C")[0]}
                </span>
                <div>
                  <h2>{newCaterer?.caterer || c?.caterer}</h2>
                  <p>
                    {t(
                      "Koordinasi langsung dengan katerer",
                      "Coordinate directly with your caterer",
                    )}
                  </p>
                </div>
              </header>
              <div className="chat-notice">
                <ShieldCheckIcon />
                {t(
                  "Lakukan pembayaran melalui Catera agar transaksi dan bantuan tercatat.",
                  "Keep payments on Catera so your purchase and support stay connected.",
                )}
              </div>
              <div className="message-stream">
                {!newCaterer &&
                  c?.messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        "message " + (m.sender_id === actor?.id ? "mine" : "")
                      }
                    >
                      <p>{m.body}</p>
                      <small>
                        {new Date(m.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  ))}
              </div>
              <ActionForm
                className="composer"
                submit={t("Kirim", "Send")}
                onSubmit={async (f) => {
                  const result = await perform<{ id: string }>("message.send", {
                    conversationId: newCaterer ? undefined : c?.id,
                    catererId: newCaterer?.catererId || c?.caterer_id,
                    body: f.get("body"),
                  });
                  setSelected(result.id);
                }}
              >
                <label className="sr-only" htmlFor="message-body">
                  Pesan
                </label>
                <textarea
                  id="message-body"
                  name="body"
                  placeholder={t("Tulis pesan…", "Write a message…")}
                  required
                  maxLength={2000}
                />
              </ActionForm>
            </>
          ) : (
            <Empty
              title="Belum ada percakapan"
              description="Buka profil katerer untuk mulai bertanya."
              href="/#packages"
              label="Jelajah katerer"
            />
          )}
        </section>
      </div>
    </div>
  );
}
function ShieldCheckIcon() {
  return <Check size={16} />;
}
export function Account({ view }: { view: string }) {
  const { actor, t, locale, setLocale, perform } = useApp();
  const params = useSearchParams();
  const state = useResource<CustomerState>("account", () => api.customer());
  const [editing, setEditing] = useState<Address | null | undefined>(undefined);
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const c = state.data;
  if (view === "notifications")
    return (
      <div className="content narrow-wide">
        <Heading title={t("Kabar untukmu", "Updates for you")} />
        {c.notifications.map((n) => (
          <div
            className={"notification " + (!n.read_at ? "unread" : "")}
            key={n.id}
          >
            <Bell size={19} />
            <Link
              href={n.href}
              onClick={() =>
                perform("notification.read", { id: n.id }).catch(() => {})
              }
            >
              <strong>{n.body}</strong>
              <small>
                {new Date(n.created_at).toLocaleString(
                  locale === "id" ? "id-ID" : "en-GB",
                )}
              </small>
            </Link>
          </div>
        ))}
        {!c.notifications.length && <Empty title="Belum ada kabar baru" />}
      </div>
    );
  return (
    <div className="content narrow-wide">
      <Heading
        title={
          view === "addresses"
            ? t("Makanan diantar ke mana?", "Where should we deliver?")
            : t("Akunmu, keseharianmu.", "Your account, your everyday.")
        }
      />
      {view === "account" && (
        <>
          <div className="account-person">
            <span className="large-avatar">{actor?.name[0]}</span>
            <div>
              <h2>{actor?.name}</h2>
              <p>
                {t(
                  "Selamat menikmati hari-hari yang lebih teratur.",
                  "Enjoy a more effortless everyday.",
                )}
              </p>
            </div>
          </div>
          <div className="account-links">
            {[
              ["/subscriptions", "Paket saya", Package],
              ["/notifications", "Notifikasi", Bell],
              ["/support", "Bantuan & pembatalan", LifeBuoy],
              ["/messages", "Pesan", MessageCircle],
              ...(actor?.catererId
                ? [["/seller", "Ruang katerer", Settings]]
                : []),
            ].map(([href, label, Icon]) => {
              const I = Icon as typeof Bell;
              return (
                <Link key={href as string} href={href as string}>
                  <I size={20} />
                  <span>{label as string}</span>
                  <ArrowUpRight size={17} />
                </Link>
              );
            })}
            <button onClick={() => setLocale(locale === "id" ? "en" : "id")}>
              <span>Bahasa / Language</span>
              <strong>{locale === "id" ? "Indonesia" : "English"}</strong>
            </button>
          </div>
        </>
      )}
      <div className="section-heading spaced">
        <h2>{t("Alamat tersimpan", "Saved addresses")}</h2>
        <button
          className="button secondary small"
          onClick={() => setEditing(null)}
        >
          <Plus size={17} />
          {t("Tambah alamat", "Add address")}
        </button>
      </div>
      {c.addresses.map((a) => (
        <div className="address-card" key={a.id}>
          <MapPin size={22} />
          <div>
            <h3>{a.label}</h3>
            <p>{a.line}</p>
            <p>
              {a.area}, {a.city}
            </p>
            <small>{a.instructions}</small>
          </div>
          <button className="text-button" onClick={() => setEditing(a)}>
            {t("Ubah", "Edit")}
          </button>
        </div>
      ))}
      {view === "account" && (
        <button
          className="text-button spaced danger"
          onClick={async () => {
            await api.request("auth/logout", {});
            location.assign("/");
          }}
        >
          <LogOut size={17} />
          {t("Keluar", "Sign out")}
        </button>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        title={editing ? "Ubah alamat" : "Tambah alamat"}
        description="Alamat pengantaran yang sudah dijadwalkan hanya berubah jika Anda mengubahnya dari detail pengantaran."
      >
        <ActionForm
          onSubmit={async (f) => {
            await perform("address.save", {
              id: editing?.id,
              version: editing?.version,
              label: f.get("label"),
              line: f.get("line"),
              area: f.get("area"),
              city: f.get("city"),
              instructions: f.get("instructions"),
            });
            setEditing(undefined);
            const next = params.get("next");
            if (next?.startsWith("/") && !next.startsWith("//"))
              location.assign(next);
          }}
        >
          <Field label="Label alamat">
            <input
              name="label"
              defaultValue={editing?.label}
              placeholder="Rumah / Kantor"
              required
              maxLength={40}
            />
          </Field>
          <Field label="Jalan, nomor, dan detail alamat">
            <textarea
              name="line"
              defaultValue={editing?.line}
              required
              minLength={5}
              maxLength={240}
            />
          </Field>
          <Field label="Area">
            <Select
              name="area"
              defaultValue={editing?.area || "Jakarta Selatan"}
            >
              {areaOptions.map((a) => (
                <SelectOption key={a}>{a}</SelectOption>
              ))}
            </Select>
          </Field>
          <Field label="Kota">
            <input
              name="city"
              defaultValue={editing?.city || "Jakarta"}
              required
            />
          </Field>
          <Field label="Petunjuk pengantaran">
            <textarea
              name="instructions"
              defaultValue={editing?.instructions}
              maxLength={400}
            />
          </Field>
        </ActionForm>
      </Dialog>
    </div>
  );
}
export function Support() {
  const { t, perform } = useApp();
  const params = useSearchParams();
  const state = useResource<CustomerState>("support", () => api.customer());
  const [open, setOpen] = useState(
    !!params.get("subscription") || !!params.get("delivery"),
  );
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  return (
    <div className="content narrow-wide">
      <Heading
        title={t("Kami bantu sampai selesai.", "Let’s work it out.")}
        description={t(
          "Ceritakan kendalamu. Katerer merespons lebih dulu, dan Catera siap membantu jika perlu.",
          "Tell us what happened. Your caterer responds first, with Catera available to help.",
        )}
      >
        <button className="button" onClick={() => setOpen(true)}>
          <Plus size={17} />
          {t("Ajukan bantuan", "Request help")}
        </button>
      </Heading>
      <p className="notice">
        {t(
          "Permintaan pembatalan dan refund ditinjau satu per satu. Jadwal tetap berjalan sampai ada keputusan yang dikonfirmasi.",
          "Cancellation and refund requests are individually reviewed. Your schedule remains active until a confirmed decision.",
        )}
      </p>
      {state.data.cases.map((c) => (
        <div className="support-case" key={c.id}>
          <div className="section-heading">
            <h2>{c.subject}</h2>
            <Status status={c.status} />
          </div>
          <p>{c.description}</p>
          {c.resolution && (
            <div className="support-response">
              <strong>{t("Tanggapan", "Response")}</strong>
              <p>{c.resolution}</p>
              {!!c.amount && <p>{currency(c.amount)}</p>}
            </div>
          )}
          {c.status === "responded" && (
            <ActionForm
              submit="Minta Catera meninjau"
              onSubmit={async () => {
                await perform("support.escalate", { id: c.id });
              }}
            >
              <span />
            </ActionForm>
          )}
        </div>
      ))}
      {!state.data.cases.length && (
        <Empty
          title="Semoga setiap makanan menyenangkan."
          description="Jika ada kendala, semua permintaan bantuan akan tampil di sini."
        />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Ceritakan yang terjadi">
        <ActionForm
          submit="Kirim permintaan bantuan"
          onSubmit={async (f) => {
            await perform("support.create", {
              subscriptionId: f.get("subscriptionId"),
              deliveryId: params.get("delivery") || undefined,
              subject: f.get("subject"),
              description: f.get("description"),
            });
            setOpen(false);
          }}
        >
          <Field label="Paket terkait">
            <Select
              name="subscriptionId"
              required
              defaultValue={params.get("subscription") || undefined}
            >
              {state.data.subscriptions.map((s) => (
                <SelectOption key={s.id} value={s.id}>
                  {s.snapshot.offer.name}
                </SelectOption>
              ))}
            </Select>
          </Field>
          <Field label="Jenis permintaan">
            <Select name="subject">
              {[
                "Makanan belum diterima",
                "Pengantaran terlambat",
                "Menu tidak sesuai",
                "Kemasan rusak",
                "Kualitas makanan",
                "Ajukan pembatalan",
                "Lainnya",
              ].map((x) => (
                <SelectOption key={x}>{x}</SelectOption>
              ))}
            </Select>
          </Field>
          <Field label="Ceritakan kendalanya">
            <textarea
              name="description"
              required
              minLength={5}
              maxLength={2000}
            />
          </Field>
        </ActionForm>
      </Dialog>
    </div>
  );
}
