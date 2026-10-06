"use client";
import { Disclosure } from "./disclosure";
import {
  PurchasePriceBreakdown,
  PurchaseSchedule,
} from "./purchase-price-breakdown";
import { MealCalendar } from "./meal-calendar";
import { DeliveryIssues, ReportDeliveryIssue } from "./delivery-issues";
import { StartConversation } from "./start-conversation";
import { Select, SelectOption } from "./select";
import { DatePicker } from "./date-picker";
import { PackageContents } from "./package-contents";
import { FoodImage } from "./food-image";
import { OptionalSection } from "./optional-section";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  statusLabel,
  areaOptions,
  availabilityReasonCounts,
  availabilityReasonLabel,
  earliestAvailable,
  customerActionPresentation,
  groupCustomerActions,
  type CustomerState,
  type CustomerActionFeed,
  type CustomerActionItem,
  type CustomerActionGroup,
  type DeliveryAvailability,
  type Delivery,
  type Conversation,
  type Subscription,
  type Address,
  type Locale,
} from "@catera/domain";
import { useApp, useResource, api, useWorkspaceDraft } from "./context";
import { useJourneyQuery, useUnsavedDeparture } from "./journey-state";
import { Button, TextArea, TextInput } from "./form-controls";
import "./customer-account.css";
import { CatererEntry } from "./profile-menu";
import {
  Heading,
  Loading,
  ErrorNotice,
  RefreshNotice,
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
function agendaEntries(deliveries: Delivery[], today: string) {
  return deliveries
    .filter(
      (delivery) =>
        delivery.service_date >= today && delivery.status !== "cancelled",
    )
    .flatMap((delivery) =>
      delivery.meals
        .filter((meal) => meal.status !== "cancelled")
        .map((meal) => ({ delivery, meal })),
    )
    .sort(
      (left, right) =>
        left.delivery.service_date.localeCompare(right.delivery.service_date) ||
        (left.meal.meal === "lunch" ? 0 : 1) -
          (right.meal.meal === "lunch" ? 0 : 1) ||
        left.delivery.offer.caterer.localeCompare(
          right.delivery.offer.caterer,
        ) ||
        left.delivery.offer.name.localeCompare(right.delivery.offer.name) ||
        left.delivery.id.localeCompare(right.delivery.id),
    );
}
export function Customer(props: { view: string; id?: string }) {
  return props.view === "calendar" ? (
    <MealCalendar />
  ) : (
    <CustomerOverview {...props} />
  );
}
function CustomerOverview({ view, id }: { view: string; id?: string }) {
  const { actor, t, locale } = useApp();
  const [date] = useState(localDay());
  const state = useResource<CustomerState>("customer:" + date, () =>
    api.customer("?from=" + addDays(date, -7) + "&to=" + addDays(date, 60)),
  );
  const actions = useResource<CustomerActionFeed>("customer-actions", () =>
    api.customerActions(20),
  );
  const actionGroups = groupCustomerActions(actions.data?.items ?? []);
  if (state.error && !state.data)
    return (
      <div className="content">
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>
    );
  if (!state.data) return <Loading />;
  const c = state.data;
  const nextMeal = agendaEntries(c.deliveries, date).find(
    ({ meal }) => meal.status !== "delivered",
  );
  const activeSubscriptions = c.subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  if (view === "subscriptions")
    return (
      <div className="content narrow-wide">
        <Heading
          title={t("Langganan saya", "My subscriptions")}
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
            ? t("Makanan saya", "My meals")
            : t("Jadwal makan", "Meal calendar")
        }
        description={
          view === "home"
            ? undefined
            : t(
                "Semua paket dan katerer, dalam satu jadwal.",
                "Every package and caterer, in one calendar.",
              )
        }
      >
        {view === "home" && (
          <Link className="button secondary" href="/#packages">
            {t("Jelajah katering", "Explore catering")}
            <ArrowUpRight size={17} />
          </Link>
        )}
      </Heading>
      <RefreshNotice error={state.error} reload={state.reload} />
      {view === "home" ? (
        <>
          <CustomerActionFeedNotice state={actions} />
          <CustomerActions items={actionGroups.review} group="review" />
          <CustomerActions items={actionGroups.urgent} group="urgent" />
          <div className="home-overview">
            <div className="home-delivery-column">
              {nextMeal && (
                <NextMeal
                  delivery={{ ...nextMeal.delivery, meals: [nextMeal.meal] }}
                />
              )}
              <CustomerActions items={actionGroups.updates} group="updates" />
              <DateGroupedAgenda deliveries={c.deliveries} />
              <CustomerActions items={actionGroups.later} group="later" />
            </div>
            <aside
              className="home-package-column"
              aria-label={t("Paket Anda", "Your packages")}
            >
              <section className="active-packages home-subscriptions">
                <div className="section-heading">
                  <h2>{t("Paket aktif", "Active packages")}</h2>
                  <Link href="/subscriptions" className="text-button">
                    {t("Lihat semua", "View all")}
                    <ArrowUpRight size={19} aria-hidden="true" />
                  </Link>
                </div>
                {activeSubscriptions.map((s) => (
                  <div className="home-subscription-row" key={s.id}>
                    <SubscriptionCard subscription={s} compact />
                    <Link className="text-button" href={"/renew/" + s.id}>
                      {t("Perpanjang", "Renew")}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                ))}
                {!activeSubscriptions.length && (
                  <p>
                    {t("Belum ada paket aktif.", "No active packages yet.")}
                  </p>
                )}
                <Link className="add-package" href="/#packages">
                  <Plus size={20} />
                  {t("Tambah paket", "Add a package")}
                </Link>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function CustomerActionFeedNotice({
  state,
}: {
  state: ReturnType<typeof useResource<CustomerActionFeed>>;
}) {
  const { t } = useApp();
  const count = state.data?.items.length ?? 0;
  const total = state.data?.total ?? 0;
  if (!state.loading && !state.error && count >= total) return null;
  return (
    <div className="customer-action-feed-notice">
      {state.loading && (
        <p role="status">
          {state.data
            ? t("Memperbarui kabar terbaru…", "Refreshing updates…")
            : t("Memuat kabar terbaru…", "Loading updates…")}
        </p>
      )}
      {state.data ? (
        <RefreshNotice error={state.error} reload={state.reload} />
      ) : (
        state.error && (
          <ErrorNotice message={state.error} retry={state.reload} />
        )
      )}
      {count < total && (
        <p role="status">
          {t(
            `Menampilkan ${count} dari ${total} pembaruan.`,
            `Showing ${count} of ${total} updates.`,
          )}
        </p>
      )}
    </div>
  );
}

function CustomerActions({
  items,
  group,
}: {
  items: CustomerActionItem[];
  group: CustomerActionGroup;
}) {
  const { t, locale } = useApp();
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const customerOwned = group === "urgent" || group === "later";
  const title = {
    review: t("Pemesanan perlu ditinjau", "Booking needs review"),
    urgent: t("Perlu tindakan Anda", "Action needed"),
    updates: t("Status pembayaran & kendala", "Payment and issue updates"),
    later: t("Pilihan menu berikutnya", "Upcoming menu choices"),
  }[group];
  const description = {
    review: t(
      "Catera perlu meninjau pemesanan Anda. Lihat pesanan untuk perkembangannya.",
      "Catera needs to review your booking. View the order for updates.",
    ),
    urgent: t(
      "Selesaikan pembayaran, tinjau tanggapan, atau pilih menu sebelum batas waktu.",
      "Complete payment, review a response, or choose your menu before cutoff.",
    ),
    updates: t(
      "Menunggu pemeriksaan atau tanggapan. Pembaruan ini belum memerlukan tindakan Anda.",
      "Awaiting a check or response. These updates need no action from you for now.",
    ),
    later: t(
      "Pilih sebelum batas waktu yang tercantum.",
      "Choose before the listed deadlines.",
    ),
  }[group];
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <section
      className={"customer-actions " + group}
      aria-labelledby={`customer-actions-${group}-title`}
    >
      <div className="section-heading">
        <div>
          <h2 id={`customer-actions-${group}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span
          className={customerOwned ? "action-count" : "update-count"}
          aria-label={
            customerOwned
              ? t("Jumlah tindakan", "Action count")
              : group === "review"
                ? t("Jumlah pemesanan ditinjau", "Booking review count")
                : t("Jumlah pembaruan", "Update count")
          }
        >
          {items.length}
        </span>
      </div>
      <div className="customer-action-list">
        {visible.map((item) => (
          <CustomerAction key={item.id} item={item} locale={locale} />
        ))}
      </div>
      {items.length > 3 && (
        <Button
          type="button"
          variant="text"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded
            ? t("Tampilkan tiga teratas", "Show top three")
            : customerOwned
              ? t(
                  `Lihat semua ${items.length} tindakan`,
                  `View all ${items.length} actions`,
                )
              : t(
                  `Lihat semua ${items.length} pembaruan`,
                  `View all ${items.length} updates`,
                )}
        </Button>
      )}
    </section>
  );
}

function CustomerAction({
  item,
  locale,
}: {
  item: CustomerActionItem;
  locale: Locale;
}) {
  const { t } = useApp();
  const presentation = customerActionPresentation(item, locale);
  const timing = item.dueAt
    ? new Date(item.dueAt).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : item.serviceDate
      ? dateLabel(item.serviceDate, locale)
      : null;
  return (
    <article className={`customer-action ${presentation.tone}`}>
      <Bell size={20} aria-hidden="true" />
      <div>
        <h3>{presentation.title}</h3>
        <p>
          {[
            item.packageName,
            item.catererName,
            item.meal ? mealLabel(item.meal, locale) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {timing && (
          <small>
            {item.dueAt
              ? t("Batas waktu", "Due")
              : t("Tanggal layanan", "Service date")}
            : {timing}
          </small>
        )}
      </div>
      <Link className="button secondary" href={item.href}>
        {presentation.action}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

function DateGroupedAgenda({ deliveries }: { deliveries: Delivery[] }) {
  const { t, locale } = useApp();
  const today = localDay();
  const upcoming = agendaEntries(deliveries, today);
  const dates = [
    ...new Set(upcoming.map(({ delivery }) => delivery.service_date)),
  ].slice(0, 3);
  return (
    <section className="date-agenda" aria-labelledby="date-agenda-title">
      <div className="section-heading">
        <div>
          <h2 id="date-agenda-title">
            {t("Jadwal makan berikutnya", "Your next meals")}
          </h2>
          <p>
            {t(
              "Diurutkan per tanggal dan waktu makan.",
              "Ordered by date and meal time.",
            )}
          </p>
        </div>
        <Link className="text-button" href="/calendar">
          {t("Lihat kalender", "View calendar")}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      {!dates.length ? (
        <Empty
          title={t("Belum ada makanan berikutnya", "No upcoming meals yet")}
          description={t(
            "Temukan paket untuk mulai mengisi jadwal.",
            "Find a package to start your meal calendar.",
          )}
          href="/#packages"
          label={t("Jelajah katering", "Explore caterers")}
        />
      ) : (
        <div className="date-agenda-groups">
          {dates.map((serviceDate) => (
            <section className="date-agenda-group" key={serviceDate}>
              <h3>
                {serviceDate === today
                  ? t("Hari ini", "Today")
                  : dateLabel(serviceDate, locale)}
              </h3>
              <div className="date-agenda-meals">
                {upcoming
                  .filter(
                    ({ delivery }) => delivery.service_date === serviceDate,
                  )
                  .map(({ delivery, meal }) => (
                    <Link
                      key={`${delivery.id}-${meal.meal}`}
                      href={"/deliveries/" + delivery.id}
                      className="home-agenda-row"
                    >
                      {meal.meal === "lunch" ? (
                        <Sun size={20} />
                      ) : (
                        <Moon size={20} />
                      )}
                      <div>
                        <small>
                          {mealLabel(meal.meal, locale)} ·{" "}
                          {
                            delivery.offer.windows[
                              meal.meal as "lunch" | "dinner"
                            ]
                          }
                        </small>
                        <strong>{delivery.offer.name}</strong>
                        <p>
                          {delivery.offer.caterer} · {delivery.portions}{" "}
                          {t(
                            "porsi",
                            delivery.portions === 1 ? "portion" : "portions",
                          )}
                        </p>
                      </div>
                      <Status status={meal.status} />
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
function NextMeal({
  delivery: d,
  detail = false,
}: {
  delivery: Delivery;
  detail?: boolean;
}) {
  const { t, locale } = useApp();
  const upcoming =
    d.meals.find((m) => !["delivered", "cancelled"].includes(m.status)) ||
    d.meals[0];
  return (
    <section className={"next-meal-card" + (detail ? " delivery-summary" : "")}>
      <div className="next-meal-photo">
        <FoodImage
          src={d.offer.image}
          alt={d.offer.name}
          width={800}
          height={600}
          sizes="(max-width: 700px) 100vw, 700px"
        />
        <span className="image-label">
          <Clock size={14} />
          {detail
            ? t("Pengantaran", "Delivery")
            : t("Makanan berikutnya", "Your next meal")}
        </span>
      </div>
      <div className="next-meal-content">
        <div className="caterer-line">
          <span>{d.offer.caterer}</span>
          <Status status={upcoming.status} />
        </div>
        {detail ? <h1>{d.offer.name}</h1> : <h2>{d.offer.name}</h2>}
        <p>
          {dateLabel(d.service_date, locale)} · {d.portions}{" "}
          {t("porsi", d.portions === 1 ? "portion" : "portions")}
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
            {d.address.label} · {detail ? d.address.line + ", " : ""}
            {d.address.area}
          </span>
        </div>
        {!detail && (
          <Link className="button" href={"/deliveries/" + d.id}>
            {t("Lihat pengantaran", "View delivery")}
            <ArrowRight size={18} />
          </Link>
        )}
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
  const Title = compact ? "h3" : "h2";
  return (
    <Link
      href={"/subscriptions/" + s.id}
      className={"subscription-card " + (compact ? "compact" : "")}
    >
      <FoodImage
        src={s.snapshot.offer.image}
        alt=""
        width={100}
        height={100}
        sizes="100px"
      />
      <div>
        <small>{s.snapshot.offer.caterer}</small>
        <Title className="subscription-title">{s.snapshot.offer.name}</Title>
        <p>
          {s.portions} {t("porsi", s.portions === 1 ? "portion" : "portions")} ·{" "}
          {mealLabel(s.snapshot.offer.meal, locale)}
        </p>
        <span className="remaining">
          {s.remaining}{" "}
          {t(
            "hari tersisa",
            s.remaining === 1 ? "day remaining" : "days remaining",
          )}
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
      <FoodImage
        src={d.offer.image}
        alt=""
        width={80}
        height={80}
        sizes="80px"
      />
      <div>
        <small>
          {d.offer.caterer} · {dateLabel(d.service_date, locale)}
        </small>
        <h3>{d.offer.name}</h3>
        <p>
          {mealLabel(d.offer.meal, locale)} · {d.portions}{" "}
          {t("porsi", d.portions === 1 ? "portion" : "portions")} ·{" "}
          {d.address.label}
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
  if (!s)
    return (
      <Empty title={t("Langganan tidak ditemukan", "Subscription not found")} />
    );
  return (
    <>
      <SubscriptionCard subscription={s} />
      {s.snapshot.offer.menuSelectionMode === "customer" && (
        <Link className="button" href={"/subscriptions/" + s.id + "/menu"}>
          {t("Pilih menu sendiri", "Choose your menu")}
        </Link>
      )}
      <PackageContents offer={s.snapshot.offer} />
      <Facts
        rows={[
          [
            t("Sisa pengantaran", "Remaining days"),
            s.remaining + " " + t("hari", s.remaining === 1 ? "day" : "days"),
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
            s.snapshot.offer.flexible
              ? t("Fleksibel", "Flexible")
              : t("Tetap", "Fixed"),
          ],
          [
            t("Asal pembelian", "Purchase source"),
            s.legacy
              ? t(
                  "Langganan lama / pembayaran eksternal",
                  "Legacy subscription / external payment",
                )
              : "Catera",
          ],
        ]}
      />
      <Disclosure
        className="spaced"
        title={t(
          "Harga & jadwal saat pembelian",
          "Original purchase price & schedule",
        )}
      >
        <PurchasePriceBreakdown quote={s.snapshot} />
        <PurchaseSchedule quote={s.snapshot} />
      </Disclosure>
      <div className="action-row">
        <Link className="button" href={"/renew/" + s.id}>
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
          <Button className="button secondary" onClick={() => setReview(true)}>
            <Star size={17} />
            {t("Tulis ulasan", "Write a review")}
          </Button>
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
        title={t("Ceritakan pengalamanmu", "Tell us about your experience")}
      >
        <ActionForm
          submit={t("Kirim ulasan", "Send review")}
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
            ["rating", t("Keseluruhan", "Overall")],
            ["food", t("Makanan", "Food")],
            ["delivery", t("Pengantaran", "Delivery")],
            ["value", t("Nilai paket", "Package value")],
          ].map(([name, label]) => (
            <Field key={name} label={label}>
              <Select name={name} defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectOption key={n}>{n}</SelectOption>
                ))}
              </Select>
            </Field>
          ))}
          <Field label={t("Ulasan", "Review")}>
            <TextArea name="body" required maxLength={2000} />
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
  const [changeRejected, setChangeRejected] = useState(false);
  const managementHeading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const recoveryNotice = useRef<HTMLParagraphElement>(null);
  const refreshNotice = useRef<HTMLDivElement>(null);
  const replacementPicker = useRef<HTMLDivElement>(null);
  const d = state.data?.deliveries.find((delivery) => delivery.id === id);
  const [now, setNow] = useState(() => Date.now());
  const changeClosed =
    !!dialog &&
    !!d &&
    (!(dialog === "address" ? d.status === "scheduled" : d.canChange) ||
      Date.parse(d.cutoff_at) <= now);
  useEffect(() => {
    if (changeClosed && !state.stale) recoveryNotice.current?.focus();
    else if (changeRejected && dialog && !review)
      refreshNotice.current?.focus({ preventScroll: true });
    else if (review && dialog === "schedule" && !state.loading)
      reviewHeading.current?.focus();
  }, [
    changeClosed,
    review,
    dialog,
    changeRejected,
    state.stale,
    state.loading,
  ]);
  useEffect(() => {
    if (!d?.cutoff_at) return;
    const cutoffAt = Date.parse(d.cutoff_at);
    if (cutoffAt <= now) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(60000, cutoffAt - now + 1),
    );
    return () => window.clearTimeout(timer);
  }, [d?.cutoff_at, now]);
  const scheduleOpen = dialog === "schedule";
  const todayInDeliveryZone = d
    ? localDay(new Date(), d.offer.timezone)
    : localDay();
  const availabilityFrom =
    d && d.service_date > todayInDeliveryZone
      ? d.service_date
      : todayInDeliveryZone;
  const availabilityTo = addDays(availabilityFrom, 60);
  const availability = useResource<DeliveryAvailability[]>(
    `delivery-availability:${id}:${scheduleOpen ? availabilityFrom : "closed"}`,
    () =>
      scheduleOpen
        ? api.deliveryAvailability(id, availabilityFrom, availabilityTo)
        : Promise.resolve([]),
  );
  const availableOn = new Map(
    (availability.data || []).map((row) => [row.date, row]),
  );
  const earliestReplacement = earliestAvailable(availability.data || []);
  const unavailableReasons = availabilityReasonCounts(availability.data || []);
  useEffect(() => {
    if (scheduleOpen && !replacement && earliestReplacement)
      setReplacement(earliestReplacement);
  }, [scheduleOpen, replacement, earliestReplacement]);
  if (state.error && !state.hasData)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  if (!d)
    return (
      <Empty title={t("Pengantaran tidak ditemukan", "Delivery not found")} />
    );
  const canAddress = d.status === "scheduled" && Date.parse(d.cutoff_at) > now;
  const canChange = d.canChange && Date.parse(d.cutoff_at) > now;
  const mutationsDisabled = state.stale || state.loading;
  const cutoff = new Date(d.cutoff_at).toLocaleString(
    locale === "id" ? "id-ID" : "en-GB",
    {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: d.offer.timezone,
    },
  );
  return (
    <div className="content narrow-wide delivery-detail-page">
      <Link className="back-link" href="/calendar">
        <ArrowLeft size={17} />
        {t("Jadwal makan", "Meal calendar")}
      </Link>
      <NextMeal delivery={d} detail />
      {state.stale && (
        <ErrorNotice message={state.error} retry={state.reload} />
      )}
      <section className="delivery-management-summary">
        <h2 ref={managementHeading} tabIndex={-1}>
          {t("Kelola pengantaran", "Manage delivery")}
        </h2>
        {!canChange && (
          <p className="notice delivery-change-reason">
            {!d.offer.flexible
              ? t(
                  "Paket ini memiliki jadwal tetap. Hubungi katerer jika membutuhkan bantuan.",
                  "This package has fixed dates. Contact your caterer if you need help.",
                )
              : Date.parse(d.cutoff_at) <= now
                ? t(
                    `Batas perubahan telah lewat: ${cutoff} (${d.offer.timezone}). Hubungi katerer untuk bantuan.`,
                    `Changes closed at ${cutoff} (${d.offer.timezone}). Contact your caterer for help.`,
                  )
                : d.status !== "scheduled"
                  ? t(
                      `Perubahan tidak tersedia pada status ${statusLabel(d.status, locale)}. Hubungi katerer untuk bantuan.`,
                      `Changes are unavailable while this delivery is ${statusLabel(d.status, locale).toLowerCase()}. Contact your caterer for help.`,
                    )
                  : t(
                      "Perubahan jadwal tidak tersedia untuk pengantaran ini. Hubungi katerer untuk bantuan.",
                      "Schedule changes are unavailable for this delivery. Contact your caterer for help.",
                    )}
          </p>
        )}
        <Facts
          rows={[
            ...d.meals.map(
              (meal) =>
                [
                  mealLabel(meal.meal, locale),
                  <Status key={meal.meal} status={meal.status} />,
                ] as [string, React.ReactNode],
            ),
            [
              t("Batas perubahan", "Change cutoff"),
              `${cutoff} (${d.offer.timezone})`,
            ],
          ]}
        />
      </section>
      <div className="action-row delivery-actions">
        {d.offer.menuSelectionMode === "customer" && (
          <Link
            className="button secondary"
            href={
              "/subscriptions/" +
              d.subscription_id +
              "/menu?date=" +
              d.service_date
            }
          >
            {t("Menu pilihan Anda", "Your menu choices")}
          </Link>
        )}
        {canAddress && (
          <Button
            className="button secondary"
            disabled={mutationsDisabled}
            onClick={() => {
              setChangeRejected(false);
              setDialog("address");
            }}
          >
            <MapPin size={17} />
            {t("Ubah alamat", "Change address")}
          </Button>
        )}
        {canChange && (
          <Button
            className="button"
            disabled={mutationsDisabled}
            onClick={() => {
              setChangeRejected(false);
              setDialog("schedule");
              setReplacement("");
              setReview(false);
            }}
          >
            <CalendarDays size={17} />
            {t("Ubah jadwal", "Change schedule")}
          </Button>
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
      <OptionalSection title={t("Alamat & ketentuan", "Address & rules")}>
        <Facts
          rows={[
            [
              t("Alamat lengkap", "Full address"),
              d.address.line + ", " + d.address.area,
            ],
            [
              t("Catatan pengantaran", "Delivery instructions"),
              d.address.instructions || "—",
            ],
            [t("Porsi", "Portions"), d.portions],
            [
              t("Jadwal", "Schedule"),
              d.offer.flexible
                ? t("Fleksibel", "Flexible")
                : t("Tetap", "Fixed"),
            ],
          ]}
        />
      </OptionalSection>
      <OptionalSection title={t("Isi paket", "Package contents")}>
        <PackageContents offer={d.offer} />
      </OptionalSection>
      <Dialog
        open={!!dialog}
        fallbackFocus={managementHeading}
        onOpenChange={(o) => {
          if (!o) setDialog("");
        }}
        title={
          dialog === "address"
            ? t("Ubah alamat pengantaran", "Change delivery address")
            : t("Ubah jadwal pengantaran", "Change delivery schedule")
        }
        description={
          d.offer.meal === "both"
            ? t(
                "Makan siang dan malam berpindah bersama dengan alamat yang sama.",
                "Lunch and dinner move together using the same address.",
              )
            : t(
                "Porsi dan ketentuan paket tidak berubah.",
                "Portions and package terms stay unchanged.",
              )
        }
      >
        {dialog && !(dialog === "address" ? canAddress : canChange) && (
          <p className="notice" role="alert" tabIndex={-1} ref={recoveryNotice}>
            {Date.parse(d.cutoff_at) <= now
              ? t(
                  "Batas perubahan telah lewat. Tutup jendela ini untuk melihat jadwal terbaru.",
                  "The change cutoff has passed. Close this window to review the current schedule.",
                )
              : t(
                  `Perubahan tidak tersedia pada status ${statusLabel(d.status, locale)}. Tutup jendela ini untuk melihat jadwal terbaru.`,
                  `Changes are unavailable while this delivery is ${statusLabel(d.status, locale).toLowerCase()}. Close this window to review the current schedule.`,
                )}
          </p>
        )}
        {(state.stale ||
          (changeRejected &&
            (dialog === "address" ? canAddress : canChange))) && (
          <div
            className="notice"
            role={state.stale ? "alert" : "status"}
            ref={refreshNotice}
            tabIndex={-1}
          >
            {state.loading
              ? t(
                  "Memuat status pengantaran terbaru…",
                  "Refreshing delivery status and replacement dates…",
                )
              : state.stale
                ? t(
                    "Perubahan belum dapat dikonfirmasi, dan status terbaru gagal dimuat. Muat ulang status dan tanggal sebelum meninjau lagi. Pilihan tanggal Anda tetap tersimpan.",
                    "The change could not be confirmed, and current details could not be loaded. Reload status and dates before reviewing again. Your selected date is retained.",
                  )
                : availability.error && dialog === "schedule"
                  ? t(
                      "Status pengantaran sudah dimuat ulang, tetapi tanggal pengganti gagal dimuat. Muat ulang tanggal sebelum meninjau lagi.",
                      "Delivery status refreshed, but replacement dates could not load. Reload dates before reviewing again.",
                    )
                  : t(
                      "Status pengantaran sudah dimuat ulang. Periksa cakupan terbaru sebelum mencoba lagi.",
                      "Delivery status refreshed. Review the current details before trying again.",
                    )}
            <Button
              variant="text"
              disabled={state.loading || availability.loading}
              onClick={() => {
                state.reload();
                availability.reload();
                setReview(false);
              }}
            >
              {t("Muat ulang status & tanggal", "Reload status & dates")}
            </Button>
          </div>
        )}
        {!state.stale && !(dialog === "address" ? canAddress : canChange) ? (
          <div className="action-row">
            <Button variant="secondary" onClick={() => setDialog("")}>
              {t("Tutup", "Close")}
            </Button>
            <Link
              className="button secondary"
              href={"/messages?caterer=" + d.offer.catererId}
            >
              {t("Hubungi katering", "Contact caterer")}
            </Link>
          </div>
        ) : dialog === "address" ? (
          <ActionForm
            key={"address:" + d.version}
            errorResetKey={state.data}
            errorHandled={changeRejected}
            disabled={!canAddress || mutationsDisabled}
            submit={t("Simpan alamat pengantaran", "Save delivery address")}
            onSubmit={async (f) => {
              if (!canAddress) throw new Error("CUTOFF_PASSED");
              try {
                await perform("delivery.address", {
                  id: d.id,
                  version: d.version,
                  addressId: f.get("addressId"),
                });
                setDialog("");
              } catch (error) {
                setChangeRejected(true);
                state.reload();
                throw error;
              }
            }}
          >
            <Field label={t("Alamat baru", "New address")}>
              <Select
                name="addressId"
                defaultValue={d.address.id}
                disabled={!canAddress || mutationsDisabled}
              >
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
            key={"schedule:" + d.version + ":" + replacement}
            errorResetKey={state.data}
            errorHandled={changeRejected}
            disabled={
              !canChange ||
              !replacement ||
              availability.loading ||
              !!availability.error ||
              availability.stale ||
              mutationsDisabled
            }
            submit={
              review
                ? t("Konfirmasi perubahan jadwal", "Confirm schedule change")
                : t("Tinjau perubahan", "Review change")
            }
            onSubmit={async () => {
              if (!canChange) throw new Error("CUTOFF_PASSED");
              if (!review) {
                const choice = availableOn.get(replacement);
                if (!choice?.available)
                  throw new Error(choice?.reason || "INVALID_DATE");
                setChangeRejected(false);
                setReview(true);
                return;
              }
              try {
                await perform("delivery.reschedule", {
                  id: d.id,
                  version: d.version,
                  date: replacement,
                  kind: "reschedule",
                });
                setDialog("");
              } catch (error) {
                const code = (error as { code?: string }).code;
                if (["CAPACITY", "CONFLICT", "CUTOFF"].includes(code || "")) {
                  setChangeRejected(true);
                  setReview(false);
                  state.reload();
                  availability.reload();
                }
                throw error;
              }
            }}
          >
            {!review && (
              <>
                <p className="schedule-replacement-explanation">
                  {t(
                    "Untuk melewati tanggal ini, pilih tanggal pengganti yang tersedia. Jumlah pengantaran dan porsi tetap sama.",
                    "To skip this date, choose an available replacement. Your number of deliveries and portions stay the same.",
                  )}
                </p>
                {availability.loading && !availability.hasData && (
                  <p role="status">
                    {t(
                      "Memuat tanggal yang tersedia…",
                      "Loading available dates…",
                    )}
                  </p>
                )}
                {availability.error && !state.stale && !changeRejected && (
                  <ErrorNotice
                    message={availability.error}
                    retry={availability.reload}
                  />
                )}
                {earliestReplacement && !state.stale && (
                  <p className="notice" role="status">
                    {t("Pengganti paling awal", "Earliest replacement")}:{" "}
                    <strong>{dateLabel(earliestReplacement, locale)}</strong>
                  </p>
                )}
                <div ref={replacementPicker}>
                  <Field label={t("Tanggal pengganti", "Replacement date")}>
                    <DatePicker
                      required
                      min={availabilityFrom}
                      max={availabilityTo}
                      disabled={
                        !canChange ||
                        mutationsDisabled ||
                        availability.loading ||
                        !!availability.error
                      }
                      isDateUnavailable={(day) =>
                        !availableOn.get(day)?.available
                      }
                      value={replacement}
                      onValueChange={(value) => {
                        setReplacement(value);
                        setReview(false);
                      }}
                    />
                  </Field>
                </div>
                {replacement && availableOn.get(replacement) && (
                  <p className="small muted" role="status">
                    {availabilityReasonLabel(
                      availableOn.get(replacement)?.reason,
                      locale,
                    )}
                  </p>
                )}
                {Object.keys(unavailableReasons).length > 0 && (
                  <Disclosure
                    className="availability-reasons"
                    title={t(
                      "Mengapa sebagian tanggal tidak tersedia?",
                      "Why are some dates unavailable?",
                    )}
                  >
                    <ul>
                      {Object.entries(unavailableReasons).map(
                        ([reason, count]) => (
                          <li key={reason}>
                            {availabilityReasonLabel(reason, locale)} · {count}{" "}
                            {t("tanggal", "dates")}
                          </li>
                        ),
                      )}
                    </ul>
                  </Disclosure>
                )}
              </>
            )}
            {review && (
              <section
                className="delivery-change-review"
                aria-labelledby="delivery-review-heading"
              >
                <h3
                  id="delivery-review-heading"
                  ref={reviewHeading}
                  tabIndex={-1}
                >
                  {t("Tinjau jadwal baru", "Review the new schedule")}
                </h3>
                <Button
                  type="button"
                  variant="text"
                  disabled={mutationsDisabled}
                  onClick={() => {
                    setReview(false);
                    requestAnimationFrame(() =>
                      replacementPicker.current
                        ?.querySelector<HTMLElement>("button")
                        ?.focus({ preventScroll: true }),
                    );
                  }}
                >
                  {t("Ubah tanggal pilihan", "Edit selected date")}
                </Button>
                <Facts
                  rows={[
                    [t("Dari", "From"), dateLabel(d.service_date, locale)],
                    [t("Menjadi", "To"), dateLabel(replacement, locale)],
                    [t("Waktu makan", "Meal"), mealLabel(d.offer.meal, locale)],
                    [t("Porsi", "Portions"), d.portions],
                    [
                      t("Alamat", "Address"),
                      `${d.address.label} — ${d.address.line}, ${d.address.area}`,
                    ],
                    [
                      t("Pilihan menu", "Menu choice"),
                      d.offer.menuSelectionMode === "customer"
                        ? t(
                            "Pilih ulang untuk tanggal baru",
                            "Choose again for the new date",
                          )
                        : t(
                            "Tidak perlu tindakan pelanggan",
                            "No customer action needed",
                          ),
                    ],
                  ]}
                />
              </section>
            )}
            <p className="notice">
              {t(
                "Tanggal lama tetap aman apabila tanggal baru penuh. Pengantaran tidak hangus.",
                "Your original date remains safe if the new date is full. No delivery is lost.",
              )}
            </p>
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
export function Messages({ embedded = false }: { embedded?: boolean }) {
  const { actor, workspace, t, perform, offers, locale } = useApp();
  const { query, update } = useJourneyQuery();
  const selectedCaterer = query.get("caterer");
  const state = useResource<Conversation[]>("conversations", () =>
    api.conversations(),
  );
  const selected =
    query.get("conversation") ||
    (selectedCaterer ? "caterer:" + selectedCaterer : "");
  const setSelected = (value: string) => update({ conversation: value });
  const [drafts, setDrafts] = useWorkspaceDraft<Record<string, string>>(
    "message-drafts",
    {},
  );
  useUnsavedDeparture(Object.values(drafts).some((value) => !!value.trim()));
  const [sending, setSending] = useState(false);
  if (state.error && !state.data)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  const requestedCaterer = selected.startsWith("caterer:")
    ? selected.slice(8)
    : null;
  const c =
    state.data.find((c) => c.id === selected) ||
    state.data.find((c) => c.caterer_id === requestedCaterer) ||
    (!selected ? state.data[0] : undefined);
  const newCaterer =
    requestedCaterer &&
    !state.data.some((c) => c.caterer_id === requestedCaterer)
      ? offers.find((o) => o.catererId === requestedCaterer)
      : null;
  const conversationKey = newCaterer
    ? "caterer:" + newCaterer.catererId
    : c?.id || "";
  return (
    <div
      className={embedded ? "messages-page embedded" : "content messages-page"}
    >
      {!embedded && (
        <Heading
          title={t("Pesan", "Messages")}
          description={t(
            "Tanya menu, atur pengantaran, atau sampaikan sesuatu ke katerermu.",
            "Ask about meals, coordinate a delivery, or talk to your caterer.",
          )}
        />
      )}
      {state.error && (
        <ErrorNotice message={state.error} retry={state.reload} />
      )}
      <div className="messages-layout">
        <aside aria-label={t("Daftar percakapan", "Conversations")}>
          <h2>{t("Percakapan", "Conversations")}</h2>
          {embedded && actor?.catererId && (
            <StartConversation onStarted={setSelected} disabled={sending} />
          )}
          {newCaterer && (
            <div className="conversation-preview active">
              <span className="mini-avatar">{newCaterer.caterer[0]}</span>
              <strong>{newCaterer.caterer}</strong>
            </div>
          )}
          {state.data.map((x) => (
            <Button
              key={x.id}
              aria-pressed={!newCaterer && c?.id === x.id}
              disabled={sending}
              className={
                "conversation-preview " +
                (c?.id === x.id && !newCaterer ? "active" : "")
              }
              onClick={() => setSelected(x.id)}
            >
              <span className="mini-avatar">
                {(workspace === "customer" ? x.caterer : x.customer)[0]}
              </span>
              <div>
                <strong>
                  {workspace === "customer" ? x.caterer : x.customer}
                </strong>
                <small>
                  {x.messages.at(-1)?.body.slice(0, 60) ||
                    t("Mulai percakapan", "Start a conversation")}
                </small>
              </div>
            </Button>
          ))}
        </aside>
        <section className="conversation">
          {c || newCaterer ? (
            <>
              <header>
                <span className="mini-avatar">
                  {
                    (newCaterer?.caterer ||
                      (workspace === "customer" ? c?.caterer : c?.customer) ||
                      "C")[0]
                  }
                </span>
                <div>
                  <h2>
                    {newCaterer?.caterer ||
                      (workspace === "customer" ? c?.caterer : c?.customer)}
                  </h2>
                  <p>
                    {workspace !== "customer"
                      ? t(
                          "Koordinasi dengan pelanggan",
                          "Coordinate with your customer",
                        )
                      : t(
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
              <div
                className="message-stream"
                tabIndex={0}
                role="region"
                aria-label={t("Riwayat percakapan", "Conversation history")}
              >
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
                        {new Date(m.created_at).toLocaleTimeString(
                          locale === "id" ? "id-ID" : "en-GB",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </small>
                    </div>
                  ))}
              </div>
              <ActionForm
                key={conversationKey}
                className="composer"
                onPendingChange={setSending}
                disabled={!(drafts[conversationKey] || "").trim()}
                submit={t("Kirim", "Send")}
                onSubmit={async (f) => {
                  const body = String(f.get("body") || "");
                  const result = await perform<{ id: string }>("message.send", {
                    conversationId: newCaterer ? undefined : c?.id,
                    catererId: newCaterer?.catererId || c?.caterer_id,
                    body,
                  });
                  setDrafts((previous) => ({
                    ...previous,
                    [conversationKey]: "",
                  }));
                  // A new conversation keeps its known recipient visible until
                  // the confirmed conversation arrives in the refreshed read.
                  if (!newCaterer) setSelected(result.id);
                }}
              >
                <label className="sr-only" htmlFor="message-body">
                  {t("Pesan", "Message")}
                </label>
                <TextArea
                  id="message-body"
                  name="body"
                  value={drafts[conversationKey] || ""}
                  onChange={(event) =>
                    setDrafts({
                      ...drafts,
                      [conversationKey]: event.target.value,
                    })
                  }
                  placeholder={t("Tulis pesan…", "Write a message…")}
                  required
                  maxLength={2000}
                />
              </ActionForm>
            </>
          ) : state.loading ? (
            <Loading />
          ) : (
            <Empty
              title={t("Belum ada percakapan", "No conversations yet")}
              description={
                embedded
                  ? t(
                      "Pilih ‘Mulai percakapan’ untuk menghubungi pelanggan yang sudah terhubung. Pelanggan belum terhubung dapat diundang dari halaman Pelanggan.",
                      "Choose ‘Start conversation’ to contact a linked customer. Customers who are not linked can be invited from Customers.",
                    )
                  : t(
                      "Buka profil katerer untuk mulai bertanya.",
                      "Open a caterer profile to start a conversation.",
                    )
              }
              href={embedded ? "/seller/customers" : "/#packages"}
              label={
                embedded
                  ? t("Lihat pelanggan", "View customers")
                  : t("Jelajah katerer", "Explore caterers")
              }
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await api.request("auth/logout", {});
      location.assign("/");
    } catch {
      setLogoutError(
        t(
          "Gagal keluar. Sesi masih aktif; coba lagi.",
          "Sign out failed. Your session remains open; try again.",
        ),
      );
    } finally {
      setLoggingOut(false);
    }
  };
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const c = state.data;
  return (
    <div
      className={
        "content account-page " + (view === "addresses" ? "addresses-page" : "")
      }
    >
      <Heading
        title={
          view === "addresses"
            ? t("Alamat pengantaran", "Delivery addresses")
            : t("Akun", "Account")
        }
      />
      <RefreshNotice error={state.error} reload={state.reload} />
      <div className="account-layout">
        {view === "account" && (
          <aside className="account-sidebar">
            <div className="account-identity">
              <span className="account-avatar" aria-hidden="true">
                {actor?.name[0]}
              </span>
              <h2>{actor?.name}</h2>
            </div>
            <nav
              className="account-navigation"
              aria-label={t("Navigasi akun", "Account navigation")}
            >
              <h3>{t("Makanan saya", "My meals")}</h3>
              {[
                [
                  "/subscriptions",
                  t("Langganan saya", "My subscriptions"),
                  Package,
                ],
                ["/saved", t("Paket tersimpan", "Saved packages"), Package],
                ["/messages", t("Pesan", "Messages"), MessageCircle],
                ["/notifications", t("Notifikasi", "Notifications"), Bell],
              ].map(([href, label, Icon]) => {
                const I = Icon as typeof Bell;
                return (
                  <Link key={href as string} href={href as string}>
                    <I size={18} aria-hidden="true" />
                    <span>{label as string}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                );
              })}
              <h3>{t("Bantuan", "Support")}</h3>
              <Link href="/support">
                <LifeBuoy size={18} aria-hidden="true" />
                <span>
                  {t("Bantuan & pembatalan", "Support & cancellation")}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
              {actor?.catererId && (
                <>
                  <h3>{t("Usaha katering", "Catering business")}</h3>
                  <CatererEntry>
                    <Settings size={18} aria-hidden="true" />
                    <span>{t("Ruang katerer", "Caterer workspace")}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </CatererEntry>
                </>
              )}
            </nav>
          </aside>
        )}
        <div className="account-settings">
          {view === "addresses" && (
            <Link className="account-back text-button" href="/account">
              <ArrowLeft size={17} aria-hidden="true" />{" "}
              {t("Kembali ke akun", "Back to account")}
            </Link>
          )}
          <section
            className="account-section"
            aria-labelledby="saved-addresses-title"
          >
            <div className="account-section-heading">
              <h2 id="saved-addresses-title">
                {t("Alamat tersimpan", "Saved addresses")}
              </h2>
              <Button
                className="button secondary small"
                onClick={() => setEditing(null)}
              >
                <Plus size={17} />
                {t("Tambah alamat", "Add address")}
              </Button>
            </div>
            {c.addresses.length === 0 && (
              <div className="account-address-empty">
                <MapPin size={22} aria-hidden="true" />
                <div>
                  <strong>
                    {t("Belum ada alamat tersimpan", "No saved addresses yet")}
                  </strong>
                  <p>
                    {t(
                      "Tambahkan alamat untuk digunakan saat memesan.",
                      "Add an address to use when ordering.",
                    )}
                  </p>
                </div>
              </div>
            )}
            {c.addresses.map((a) => (
              <div className="address-card" key={a.id}>
                <MapPin size={20} aria-hidden="true" />
                <div>
                  <h3>{a.label}</h3>
                  <p>{a.line}</p>
                  <p>
                    {a.area}, {a.city}
                  </p>
                  <small>{a.instructions}</small>
                </div>
                <Button className="text-button" onClick={() => setEditing(a)}>
                  {t("Ubah", "Edit")}
                </Button>
              </div>
            ))}
          </section>
          {view === "account" && (
            <>
              <section
                className="account-section"
                aria-labelledby="account-preferences-title"
              >
                <div className="account-section-heading">
                  <h2 id="account-preferences-title">
                    {t("Preferensi", "Preferences")}
                  </h2>
                </div>
                <div className="account-setting-row">
                  <label id="account-language-label" htmlFor="account-language">
                    {t("Bahasa", "Language")}
                  </label>
                  <Select
                    id="account-language"
                    aria-labelledby="account-language-label"
                    value={locale}
                    onValueChange={(value) => setLocale(value as Locale)}
                  >
                    <SelectOption value="id">Bahasa Indonesia</SelectOption>
                    <SelectOption value="en">English</SelectOption>
                  </Select>
                </div>
              </section>
              <div className="account-session">
                <Button
                  variant="text"
                  onClick={logout}
                  disabled={loggingOut}
                  aria-busy={loggingOut}
                >
                  <LogOut size={17} aria-hidden="true" />
                  {loggingOut
                    ? t("Sedang keluar…", "Signing out…")
                    : t("Keluar", "Sign out")}
                </Button>
                {logoutError && (
                  <ErrorNotice message={logoutError} retry={logout} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        title={
          editing
            ? t("Ubah alamat", "Edit address")
            : t("Tambah alamat", "Add address")
        }
        description={t(
          "Alamat pengantaran yang sudah dijadwalkan hanya berubah jika Anda mengubahnya dari detail pengantaran.",
          "A scheduled delivery address can only be changed from its delivery details.",
        )}
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
          <Field label={t("Label alamat", "Address label")}>
            <TextInput
              name="label"
              defaultValue={editing?.label}
              placeholder={t("Rumah / Kantor", "Home / Office")}
              required
              maxLength={40}
            />
          </Field>
          <Field
            label={t(
              "Jalan, nomor, dan detail alamat",
              "Street, number, and address details",
            )}
          >
            <TextArea
              name="line"
              defaultValue={editing?.line}
              required
              minLength={5}
              maxLength={240}
            />
          </Field>
          <Field label={t("Area", "Area")}>
            <Select
              name="area"
              defaultValue={editing?.area || "Jakarta Selatan"}
            >
              {areaOptions.map((a) => (
                <SelectOption key={a}>{a}</SelectOption>
              ))}
            </Select>
          </Field>
          <Field label={t("Kota", "City")}>
            <TextInput
              name="city"
              defaultValue={editing?.city || "Jakarta"}
              required
            />
          </Field>
          <Field label={t("Petunjuk pengantaran", "Delivery instructions")}>
            <TextArea
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
  const { t, perform, locale } = useApp();
  const params = useSearchParams();
  const state = useResource<CustomerState>("support", () => api.customer());
  const [open, setOpen] = useState(!!params.get("subscription"));
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  return (
    <div className="content narrow-wide">
      <Heading
        title={t("Bantuan & pembatalan", "Support & cancellation")}
        description={t(
          "Ceritakan kendalamu. Katerer merespons lebih dulu, dan Catera siap membantu jika perlu.",
          "Tell us what happened. Your caterer responds first, with Catera available to help.",
        )}
      >
        <Button className="button" onClick={() => setOpen(true)}>
          <Plus size={17} />
          {t("Ajukan bantuan", "Request help")}
        </Button>
      </Heading>
      <RefreshNotice error={state.error} reload={state.reload} />
      <p className="notice">
        {t(
          "Permintaan pembatalan dan refund ditinjau satu per satu. Jadwal tetap berjalan sampai ada keputusan yang dikonfirmasi.",
          "Cancellation and refund requests are individually reviewed. Your schedule remains active until a confirmed decision.",
        )}
      </p>
      {params.get("delivery") && (
        <ReportDeliveryIssue
          key={params.get("delivery")}
          id={params.get("delivery")!}
        />
      )}
      <DeliveryIssues />
      {params.get("case") && (
        <Link href="/support">
          {t("Semua permintaan bantuan", "All support requests")}
        </Link>
      )}
      {state.data.cases
        .filter((c) => !params.get("case") || c.id === params.get("case"))
        .map((c) => (
          <div className="support-case" key={c.id}>
            <div className="section-heading">
              <h2>{c.subject}</h2>
              <Status status={c.status} />
            </div>
            <p>{c.description}</p>
            {state.data?.refunds
              ?.filter((r) => r.case_id === c.id)
              .map((r) => (
                <div className="notice" key={r.id}>
                  <strong>
                    {t("Pengembalian dana", "Refund")}:{" "}
                    {currency(r.amount, locale)}
                  </strong>{" "}
                  <Status status={r.state} />
                  {r.state === "needs_attention" && (
                    <p>
                      {t(
                        "Pengembalian dana sedang ditangani Catera. Dana belum dikembalikan.",
                        "Catera is reviewing your refund. Funds have not been returned yet.",
                      )}
                    </p>
                  )}
                </div>
              ))}
            {c.resolution && (
              <div className="support-response">
                <strong>{t("Tanggapan", "Response")}</strong>
                <p>{c.resolution}</p>
                {!!c.amount && <p>{currency(c.amount, locale)}</p>}
              </div>
            )}
            {c.status === "responded" && (
              <ActionForm
                submit={t("Minta Catera meninjau", "Ask Catera to review")}
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
          title={t(
            "Belum ada kasus bantuan langganan.",
            "No subscription support cases.",
          )}
          description={t(
            "Kasus langganan atau keuangan ditampilkan di bagian ini.",
            "Subscription or financial cases appear in this section.",
          )}
        />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Ceritakan yang terjadi", "Tell us what happened")}
      >
        <ActionForm
          submit={t("Kirim permintaan bantuan", "Send support request")}
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
          <Field label={t("Paket terkait", "Related package")}>
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
          <Field label={t("Jenis permintaan", "Request type")}>
            <Select name="subject">
              {[
                ["Makanan belum diterima", "Meal not received"],
                ["Pengantaran terlambat", "Delivery is late"],
                ["Menu tidak sesuai", "Menu is incorrect"],
                ["Kemasan rusak", "Packaging is damaged"],
                ["Kualitas makanan", "Food quality"],
                ["Ajukan pembatalan", "Request cancellation"],
                ["Lainnya", "Other"],
              ].map(([id, en]) => (
                <SelectOption key={id}>{t(id, en)}</SelectOption>
              ))}
            </Select>
          </Field>
          <Field label={t("Ceritakan kendalanya", "Tell us what happened")}>
            <TextArea
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
