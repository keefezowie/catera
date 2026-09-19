"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localDay, type Delivery } from "@catera/domain";
import {
  datesBetween,
  monthOf,
  monthEnd,
  shiftMonth,
  weekStart,
} from "../lib/meal-calendar";
import { Button } from "./form-controls";
import { Select, SelectOption } from "./select";
import { Status } from "./ui";
import { useApp } from "./context";
import "./meal-calendar.css";
import "./seller-experience.css";

export function CustomerDeliveryCalendar({
  deliveries,
  changed,
  onChange,
}: {
  deliveries: Delivery[];
  changed?: Delivery;
  onChange: (d: Delivery) => void;
}) {
  const { t, locale } = useApp();
  const timezone = deliveries[0]?.offer.timezone || "Asia/Jakarta";
  const today = localDay(new Date(), timezone);
  const [selected, setSelected] = useState(
    () =>
      deliveries
        .filter((d) => d.service_date >= today && d.status !== "cancelled")
        .sort((a, b) => a.service_date.localeCompare(b.service_date))[0]
        ?.service_date || today,
  );
  const [month, setMonth] = useState(monthOf(selected));
  const [view, setView] = useState("calendar"),
    [packageId, setPackageId] = useState(""),
    [meal, setMeal] = useState("all");
  useEffect(() => {
    if (changed) {
      setSelected(changed.service_date);
      setMonth(monthOf(changed.service_date));
      setPackageId((current) =>
        current && current !== changed.offer.id ? changed.offer.id : current,
      );
      setMeal((current) =>
        current === "all" || changed.meals.some((m) => m.meal === current)
          ? current
          : "all",
      );
    }
  }, [changed]);
  const rows = deliveries.filter(
    (d) =>
      (!packageId || d.offer.id === packageId) &&
      (meal === "all" || d.meals.some((m) => m.meal === meal)),
  );
  const packages = [
    ...new Map(deliveries.map((d) => [d.offer.id, d.offer])).values(),
  ];
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(day + "T12:00:00Z").toLocaleDateString(
      locale === "id" ? "id-ID" : "en-GB",
      { ...options, timeZone: "UTC" },
    );
  return (
    <section className="panel customer-delivery-calendar">
      <h2>{t("Jadwal pengantaran", "Delivery schedule")}</h2>
      <div className="action-row">
        <Select
          aria-label={t("Tampilan jadwal", "Schedule view")}
          value={view}
          onValueChange={setView}
        >
          <SelectOption value="calendar">
            {t("Kalender", "Calendar")}
          </SelectOption>
          <SelectOption value="list">{t("Daftar", "List")}</SelectOption>
        </Select>
        <Select
          aria-label={t("Paket", "Package")}
          value={packageId}
          onValueChange={setPackageId}
        >
          <SelectOption value="">
            {t("Semua paket", "All packages")}
          </SelectOption>
          {packages.map((p) => (
            <SelectOption key={p.id} value={p.id}>
              {p.name}
            </SelectOption>
          ))}
        </Select>
        <Select
          aria-label={t("Waktu makan", "Meal period")}
          value={meal}
          onValueChange={setMeal}
        >
          <SelectOption value="all">{t("Semua", "All")}</SelectOption>
          <SelectOption value="lunch">{t("Siang", "Lunch")}</SelectOption>
          <SelectOption value="dinner">{t("Malam", "Dinner")}</SelectOption>
        </Select>
      </div>
      {view === "calendar" && (
        <>
          <div className="action-row calendar-month-heading">
            <Button
              aria-label={t("Bulan sebelumnya", "Previous month")}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <h3>{format(month, { month: "long", year: "numeric" })}</h3>
            <Button
              aria-label={t("Bulan berikutnya", "Next month")}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="customer-month-grid">
            {datesBetween("2026-09-14", "2026-09-20").map((day) => (
              <strong key={day}>{format(day, { weekday: "short" })}</strong>
            ))}
            {datesBetween(weekStart(month), monthEnd(month)).map((day) => {
              const count = rows.filter((d) => d.service_date === day).length;
              return (
                <Button
                  key={day}
                  className={
                    (count ? "has-delivery " : "") +
                    (selected === day ? "selected" : "")
                  }
                  disabled={day < month}
                  aria-pressed={selected === day}
                  aria-label={`${format(day, { dateStyle: "full" })}, ${count} ${t("pengantaran", "deliveries")}`}
                  onClick={() => setSelected(day)}
                >
                  <span>{Number(day.slice(-2))}</span>
                  {count > 0 && (
                    <small>
                      {count}{" "}
                      <span className="sr-only">
                        {t("pengantaran", "deliveries")}
                      </span>
                      ●
                    </small>
                  )}
                </Button>
              );
            })}
          </div>
          <h3>{format(selected, { dateStyle: "full" })}</h3>
        </>
      )}
      {rows
        .filter((d) => view === "list" || d.service_date === selected)
        .sort((a, b) => a.service_date.localeCompare(b.service_date))
        .map((d) => (
          <article
            key={d.id}
            className="pilot-delivery"
            data-delivery-id={d.id}
          >
            <div>
              <strong>
                {d.service_date} · {d.offer.name}
              </strong>
              <p>
                {d.address.line}, {d.address.area}, {d.address.city}
              </p>
              <p>{d.address.instructions}</p>
              <Status status={d.status} />
              {d.meals
                .filter((m) => meal === "all" || m.meal === meal)
                .map((m) => (
                  <p key={m.meal}>
                    {m.meal === "lunch"
                      ? t("Siang", "Lunch")
                      : t("Malam", "Dinner")}{" "}
                    · <Status status={m.status} />
                  </p>
                ))}
            </div>
            {d.status === "scheduled" && new Date(d.cutoff_at) > new Date() && (
              <Button className="button secondary" onClick={() => onChange(d)}>
                {t("Ubah sesuai permintaan", "Change on request")}
              </Button>
            )}
          </article>
        ))}
      {!rows.some((d) => view === "list" || d.service_date === selected) && (
        <p>{t("Tidak ada pengantaran.", "No deliveries.")}</p>
      )}
    </section>
  );
}
