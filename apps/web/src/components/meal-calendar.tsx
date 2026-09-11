"use client";
import "./meal-calendar.css";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { addDays, localDay, type Delivery } from "@catera/domain";
import {
  activePackageCount,
  datesBetween,
  indexDeliveries,
  mealCoverage,
  meals,
  monthEnd,
  monthOf,
  monthsBetween,
  shiftMonth,
  upcoming,
  validDay,
  weekStart,
  type Meal,
} from "../lib/meal-calendar";
import { useMealCalendar } from "./use-meal-calendar";
import { useApp } from "./context";
import { Button, TextInput } from "./form-controls";
import { Heading, Status } from "./ui";

const minimum = "1900-01-01",
  maximum = "9998-12-31";
const bound = (day: string) =>
  day < minimum ? minimum : day > maximum ? maximum : day;
const windowFor = (day: string) => bound(addDays(day, -60));
type Position = {
  day: string;
  offset: number;
  focus?: boolean;
  animate?: boolean;
  center?: boolean;
};

export function MealCalendar() {
  const { actor, locale, t } = useApp();
  const [today, setToday] = useState(localDay());
  const [selected, setSelected] = useState(today);
  const [start, setStart] = useState(windowFor(today));
  const [visible, setVisible] = useState(today);
  const [mode, setMode] = useState<"day" | "upcoming">("day");
  const [agendaEnd, setAgendaEnd] = useState(monthEnd(today));
  const [restored, setRestored] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(monthOf(today));
  const [pickerActive, setPickerActive] = useState(today);
  const pickerDays = useMemo(
    () =>
      datesBetween(weekStart(pickerMonth), addDays(weekStart(pickerMonth), 41)),
    [pickerMonth],
  );
  const [enteredDate, setEnteredDate] = useState(today);
  const strip = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const monthButton = useRef<HTMLButtonElement>(null);
  const pending = useRef<Position | null>({ day: today, offset: 0 });
  const pickerFocus = useRef<string | null>(null);
  const position = useRef<Position>({ day: today, offset: 0 });
  const storageKey = `catera-calendar:${actor?.id}`;
  const formatters = useMemo(
    () => new Map<string, Intl.DateTimeFormat>(),
    [locale],
  );
  const format = (
    day: string,
    options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ) => {
    const key = JSON.stringify(options);
    let formatter = formatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        ...options,
        timeZone: "UTC",
      });
      formatters.set(key, formatter);
    }
    return formatter.format(new Date(day + "T12:00:00Z"));
  };
  const week = weekStart(selected);
  const weekDays = datesBetween(week, addDays(week, 6));
  const required = [
    ...monthsBetween(bound(addDays(visible, -14)), bound(addDays(visible, 45))),
    ...monthsBetween(week, addDays(week, 6)),
    monthOf(today),
    ...(mode === "upcoming" ? monthsBetween(today, agendaEnd) : []),
  ];
  const store = useMealCalendar(required);
  const version = store.snapshot();
  const index = useMemo(
    () =>
      indexDeliveries(
        [...store.months.values()]
          .filter((m) => m.status === "ready")
          .flatMap((m) => m.deliveries),
      ),
    [store, version],
  );
  const days = useMemo(
    () => datesBetween(start, bound(addDays(start, 150))),
    [start],
  );
  const status = (day: string) =>
    store.months.get(monthOf(day))?.status || "loading";
  const weekReady = weekDays.every((day) => status(day) === "ready");
  const weekError = weekDays.some((day) => status(day) === "error");
  const summary = meals.map(
    (meal) => weekDays.filter((day) => index.get(day)?.[meal]).length,
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved && validDay(saved.selected) && validDay(saved.visible)) {
        setSelected(saved.selected);
        setVisible(saved.visible);
        setStart(windowFor(saved.visible));
        setMode(saved.mode === "upcoming" ? "upcoming" : "day");
        if (validDay(saved.agendaEnd) && saved.agendaEnd >= today)
          setAgendaEnd(saved.agendaEnd);
        pending.current = {
          day: saved.visible,
          offset: Math.max(0, Math.min(120, Number(saved.offset) || 0)),
        };
      }
    } catch {
      /* Storage may be unavailable. Navigation still works. */
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    const refresh = () => setToday(localDay());
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!restored) return;
    const save = () => {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            selected,
            visible: position.current.day,
            offset: position.current.offset,
            mode,
            agendaEnd,
          }),
        );
      } catch {}
    };
    save();
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [selected, visible, mode, agendaEnd, storageKey, restored]);

  useLayoutEffect(() => {
    if (!restored || !pending.current || !strip.current) return;
    const target = pending.current;
    const element = strip.current.querySelector<HTMLButtonElement>(
      `[data-day="${target.day}"]`,
    );
    if (!element) return;
    const left = target.center
      ? element.offsetLeft -
        (strip.current.clientWidth - element.offsetWidth) / 2
      : element.offsetLeft + target.offset;
    strip.current.scrollTo({
      left,
      behavior:
        target.animate &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });
    if (target.focus) element.focus({ preventScroll: true });
    position.current = target;
    pending.current = null;
  }, [start, restored, selected]);

  useLayoutEffect(() => {
    if (pickerOpen && pickerFocus.current) {
      picker.current
        ?.querySelector<HTMLButtonElement>(
          `[data-picker-day="${pickerFocus.current}"]`,
        )
        ?.focus();
      pickerFocus.current = null;
    }
  }, [pickerMonth, pickerOpen]);

  function jump(day: string, focus = false, animate = false) {
    if (!validDay(day)) return;
    setSelected(day);
    setMode("day");
    setVisible(day);
    const element = strip.current?.querySelector<HTMLButtonElement>(
      `[data-day="${day}"]`,
    );
    if (element && strip.current) {
      const left = animate
        ? element.offsetLeft -
          (strip.current.clientWidth - element.offsetWidth) / 2
        : element.offsetLeft;
      strip.current.scrollTo({
        left,
        behavior:
          animate && !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "smooth"
            : "auto",
      });
      if (focus) element.focus({ preventScroll: true });
      position.current = {
        day,
        offset: animate ? left - element.offsetLeft : 0,
      };
    } else {
      pending.current = {
        day,
        offset: 0,
        focus,
        animate,
        center: animate,
      };
      setStart(windowFor(day));
    }
  }
  function onScroll() {
    const el = strip.current;
    if (!el || pending.current) return;
    const first = el.querySelector<HTMLButtonElement>("[data-day]");
    if (!first) return;
    const pitch = first.getBoundingClientRect().width + 8;
    const i = Math.floor(el.scrollLeft / pitch);
    const day = bound(addDays(start, i));
    position.current = { day, offset: el.scrollLeft - i * pitch };
    setVisible(day);
    if (
      (i < 15 && start > minimum) ||
      (i > 110 && addDays(start, 150) < maximum)
    ) {
      pending.current = position.current;
      setStart(windowFor(day));
    }
  }
  function scrollPage(direction: number) {
    const el = strip.current;
    if (!el) return;
    el.scrollBy({
      left: direction * (el.clientWidth - 32),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function stripKey(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const movement: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      PageUp: -7,
      PageDown: 7,
    };
    let target =
      event.key === "Home"
        ? weekStart(day)
        : event.key === "End"
          ? addDays(weekStart(day), 6)
          : event.key in movement
            ? addDays(day, movement[event.key])
            : null;
    if (!target) return;
    target = bound(target);
    event.preventDefault();
    const element = strip.current?.querySelector<HTMLButtonElement>(
      `[data-day="${target}"]`,
    );
    if (element) element.focus();
    else {
      pending.current = { day: target, offset: 0, focus: true };
      setStart(windowFor(target));
      setVisible(target);
    }
  }
  function closePicker() {
    picker.current?.hidePopover();
  }
  function pick(day: string) {
    jump(day);
    closePicker();
    monthButton.current?.focus();
  }
  function pickerKey(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const movement: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let target =
      event.key === "Home"
        ? weekStart(day)
        : event.key === "End"
          ? addDays(weekStart(day), 6)
          : event.key in movement
            ? addDays(day, movement[event.key])
            : null;
    if (event.key === "PageUp" || event.key === "PageDown") {
      const month = shiftMonth(
        day,
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1),
      );
      target =
        month.slice(0, 8) +
        String(
          Math.min(Number(day.slice(8)), Number(monthEnd(month).slice(8))),
        ).padStart(2, "0");
    }
    if (!target) return;
    target = bound(target);
    event.preventDefault();
    const element = picker.current?.querySelector<HTMLButtonElement>(
      `[data-picker-day="${target}"]`,
    );
    if (element && monthOf(target) === pickerMonth) element.focus();
    else {
      pickerFocus.current = target;
      setPickerMonth(monthOf(target));
    }
  }
  const failed = [...new Set(required)].filter(
    (m) => store.months.get(m)?.status === "error",
  );
  const next = store.meta?.nextDeliveryDate;
  const last = store.meta?.lastUpcomingDeliveryDate;
  const agendaMonths = monthsBetween(today, agendaEnd);
  const agendaDays = [...index.keys()]
    .filter(
      (day) =>
        day >= today &&
        day <= agendaEnd &&
        index
          .get(day)!
          .deliveries.some((d) => meals.some((meal) => upcoming(d, meal))),
    )
    .sort();

  function dayMeals(day: string, onlyUpcoming = false) {
    if (status(day) !== "ready")
      return (
        <p className="calendar-message" role="status">
          {status(day) === "error"
            ? t(
                "Jadwal belum berhasil dimuat.",
                "The schedule could not be loaded.",
              )
            : t("Memuat jadwal…", "Loading schedule…")}
        </p>
      );
    return meals.map((meal) => {
      const rows = (index.get(day)?.deliveries || []).filter((d) =>
        onlyUpcoming ? upcoming(d, meal) : d.meals.some((m) => m.meal === meal),
      );
      if (onlyUpcoming && !rows.length) return null;
      return (
        <section key={meal} className="calendar-meal-group">
          <h3>
            {meal === "lunch" ? <Sun size={20} /> : <Moon size={20} />}
            {meal === "lunch"
              ? t("Makan siang", "Lunch")
              : t("Makan malam", "Dinner")}
          </h3>
          {rows.map((d) => (
            <CalendarMeal key={d.id} delivery={d} meal={meal} />
          ))}
          {!rows.length && (
            <p className="calendar-empty">
              {t(
                "Belum ada makanan Catera terjadwal.",
                "No Catera meal scheduled.",
              )}
            </p>
          )}
        </section>
      );
    });
  }

  return (
    <div className="content calendar-page">
      <Heading
        title={t(
          "Hari-hari yang sudah terencana.",
          "Your meals, all in one place.",
        )}
        description={t(
          "Semua paket dan katerer, dalam satu jadwal.",
          "Every package and caterer, in one calendar.",
        )}
      />
      <div className="meal-calendar">
        <div className="coverage-toolbar">
          <Button
            ref={monthButton}
            className="calendar-month-button"
            popoverTarget="calendar-date-picker"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            onClick={() => {
              setPickerMonth(monthOf(selected));
              setPickerActive(selected);
              setEnteredDate(selected);
              pickerFocus.current = selected;
            }}
          >
            <CalendarDays size={19} />
            {format(visible, { month: "long", year: "numeric" })}
            <ChevronRight size={16} />
          </Button>
          <div className="calendar-shortcuts">
            <Button
              className="button secondary small"
              onClick={() => jump(today, false, true)}
            >
              {t("Hari ini", "Today")}
            </Button>
            {next && (
              <Button className="calendar-next" onClick={() => jump(next)}>
                {t("Pengantaran berikutnya", "Next delivery")}
                <span>
                  {format(next, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                  <ChevronRight size={16} />
                </span>
              </Button>
            )}
          </div>
        </div>
        <div className="coverage-navigation">
          <Button
            className="icon-button calendar-scroll-arrow"
            aria-label={t("Tanggal sebelumnya", "Earlier dates")}
            onClick={() => scrollPage(-1)}
          >
            <ChevronLeft />
          </Button>
          <div
            ref={strip}
            className="coverage-strip"
            role="group"
            aria-label={t(
              "Tanggal dan cakupan makanan",
              "Dates and meal coverage",
            )}
            onScroll={onScroll}
          >
            {days.map((day) => {
              const dayStatus = status(day);
              const dayData = index.get(day);
              const coverage =
                dayStatus === "ready" ? mealCoverage(dayData) : undefined;
              const packageCount =
                dayStatus === "ready" ? activePackageCount(dayData) : 0;
              const coverageStateText =
                dayStatus === "error"
                  ? t("Gagal dimuat", "Failed to load")
                  : dayStatus !== "ready"
                    ? t("Memuat…", "Loading…")
                    : coverage === "none"
                      ? t("Belum ada makan", "No meals yet")
                      : "";
              const packageText = packageCount
                ? t(
                    `${packageCount} paket`,
                    `${packageCount} ${packageCount === 1 ? "package" : "packages"}`,
                  )
                : "";
              return (
                <Button
                  key={day}
                  data-day={day}
                  data-coverage={coverage}
                  data-load-state={dayStatus}
                  className={
                    "coverage-day" +
                    (selected === day ? " is-selected" : "") +
                    (today === day ? " is-today" : "")
                  }
                  aria-pressed={selected === day}
                  aria-current={today === day ? "date" : undefined}
                  tabIndex={
                    (
                      selected >= start && selected <= days[days.length - 1]
                        ? selected === day
                        : visible === day
                    )
                      ? 0
                      : -1
                  }
                  aria-label={`${format(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. ${meals.map((meal) => `${meal === "lunch" ? t("Siang", "Lunch") : t("Malam", "Dinner")}: ${dayStatus !== "ready" ? (dayStatus === "error" ? t("gagal dimuat", "failed to load") : t("memuat", "loading")) : dayData?.[meal] ? t("terjadwal", "scheduled") : t("belum terjadwal", "not scheduled")}`).join(". ")}${packageText ? `. ${packageText}` : ""}`}
                  onClick={() => {
                    setSelected(day);
                    setMode("day");
                  }}
                  onKeyDown={(e) => stripKey(e, day)}
                >
                  <span className="coverage-day-top">
                    {day === today && (
                      <span className="coverage-today-dot" aria-hidden="true" />
                    )}
                    {day === today
                      ? t("Hari ini", "Today")
                      : format(day, { weekday: "short" })}
                  </span>
                  <strong>{day.slice(8).replace(/^0/, "")}</strong>
                  <span className="coverage-month-marker">
                    {day.endsWith("-01")
                      ? format(day, { month: "short" })
                      : "\u00a0"}
                  </span>
                  <span className="coverage-info">
                    {coverageStateText ? (
                      <span className="coverage-state-text">
                        {coverageStateText}
                      </span>
                    ) : (
                      <span className="coverage-meal-icons" aria-hidden="true">
                        {(coverage === "lunch" || coverage === "both") && (
                          <Sun
                            className="is-lunch"
                            data-meal="lunch"
                            size={16}
                            strokeWidth={2.2}
                          />
                        )}
                        {(coverage === "dinner" || coverage === "both") && (
                          <Moon
                            className="is-dinner"
                            data-meal="dinner"
                            size={16}
                            strokeWidth={2.2}
                          />
                        )}
                      </span>
                    )}
                    {packageText && (
                      <span className="coverage-package-count">
                        {packageText}
                      </span>
                    )}
                  </span>
                </Button>
              );
            })}
          </div>
          <Button
            className="icon-button calendar-scroll-arrow"
            aria-label={t("Tanggal berikutnya", "Later dates")}
            onClick={() => scrollPage(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="coverage-summary" aria-live="polite">
          <span>
            {format(week, { day: "numeric", month: "short" })} –{" "}
            {format(addDays(week, 6), {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <p>
            {weekReady
              ? t(
                  `${summary[0]} hari dengan makan siang · ${summary[1]} hari dengan makan malam`,
                  `${summary[0]} days with lunch · ${summary[1]} days with dinner`,
                )
              : weekError
                ? t("Ringkasan belum tersedia.", "Summary unavailable.")
                : t("Memuat ringkasan minggu…", "Loading week summary…")}
          </p>
        </div>
        {failed.length > 0 && (
          <div className="calendar-load-error" role="alert">
            <span>
              {t(
                "Sebagian jadwal belum berhasil dimuat.",
                "Part of the schedule could not be loaded.",
              )}
            </span>
            <Button
              className="text-button"
              onClick={() =>
                failed.forEach((m) => {
                  void store.ensure(m, true);
                })
              }
            >
              {t("Coba lagi", "Try again")}
            </Button>
          </div>
        )}
        <div
          className="calendar-view-control"
          role="group"
          aria-label={t("Tampilan jadwal", "Schedule view")}
        >
          <Button aria-pressed={mode === "day"} onClick={() => setMode("day")}>
            {t("Per hari", "By day")}
          </Button>
          <Button
            aria-pressed={mode === "upcoming"}
            onClick={() => setMode("upcoming")}
          >
            {t("Mendatang", "Upcoming")}
          </Button>
        </div>
        <div
          className="calendar-details"
          aria-busy={
            mode === "day"
              ? status(selected) === "loading"
              : agendaMonths.some((m) => status(m) === "loading")
          }
        >
          {mode === "day" ? (
            <>
              <h2>
                {format(selected, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              {dayMeals(selected)}
            </>
          ) : (
            <>
              <h2>{t("Pengantaran mendatang", "Upcoming deliveries")}</h2>
              {agendaDays.map((day) => (
                <section key={day} className="calendar-agenda-day">
                  <h3 className="calendar-agenda-date">
                    {format(day, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  {dayMeals(day, true)}
                </section>
              ))}
              {agendaMonths.some((m) => status(m) === "loading") && (
                <p role="status">
                  {t("Memuat pengantaran…", "Loading deliveries…")}
                </p>
              )}
              {!agendaDays.length &&
                agendaMonths.every((m) => status(m) === "ready") && (
                  <p className="calendar-empty">
                    {last
                      ? t(
                          "Belum ada pengantaran dalam rentang ini.",
                          "No deliveries in this range.",
                        )
                      : t(
                          "Belum ada pengantaran mendatang.",
                          "No upcoming deliveries.",
                        )}
                  </p>
                )}
              {last && last > agendaEnd && (
                <Button
                  className="button secondary"
                  onClick={() =>
                    setAgendaEnd(monthEnd(shiftMonth(agendaEnd, 1)))
                  }
                >
                  {t("Muat bulan berikutnya", "Load next month")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div
        id="calendar-date-picker"
        ref={picker}
        popover="auto"
        role="dialog"
        aria-label={t("Pilih tanggal jadwal", "Choose schedule date")}
        className="calendar-date-picker"
        onToggle={(event) => {
          const open = event.newState === "open";
          setPickerOpen(open);
          if (!open) monthButton.current?.focus();
        }}
      >
        <div className="calendar-picker-title">
          <h2>{t("Pilih tanggal", "Choose a date")}</h2>
          <Button
            className="icon-button"
            aria-label={t("Tutup", "Close")}
            onClick={closePicker}
          >
            <X size={20} />
          </Button>
        </div>
        <div className="calendar-picker-navigation">
          <Button
            className="icon-button"
            aria-label={t("Tahun sebelumnya", "Previous year")}
            disabled={pickerMonth < "1901-01-01"}
            onClick={() => setPickerMonth(shiftMonth(pickerMonth, -12))}
          >
            <ChevronsLeft size={18} />
          </Button>
          <Button
            className="icon-button"
            aria-label={t("Bulan sebelumnya", "Previous month")}
            disabled={pickerMonth === minimum}
            onClick={() => setPickerMonth(shiftMonth(pickerMonth, -1))}
          >
            <ChevronLeft size={18} />
          </Button>
          <strong aria-live="polite">
            {format(pickerMonth, { month: "long", year: "numeric" })}
          </strong>
          <Button
            className="icon-button"
            aria-label={t("Bulan berikutnya", "Next month")}
            disabled={pickerMonth === "9998-12-01"}
            onClick={() => setPickerMonth(shiftMonth(pickerMonth, 1))}
          >
            <ChevronRight size={18} />
          </Button>
          <Button
            className="icon-button"
            aria-label={t("Tahun berikutnya", "Next year")}
            disabled={pickerMonth >= "9998-01-01"}
            onClick={() => setPickerMonth(shiftMonth(pickerMonth, 12))}
          >
            <ChevronsRight size={18} />
          </Button>
        </div>
        <div
          className="calendar-picker-grid"
          role="group"
          aria-label={t("Hari dalam bulan", "Days in month")}
        >
          {datesBetween("2026-09-07", "2026-09-13").map((day) => (
            <span key={day} aria-hidden="true">
              {format(day, { weekday: "short" })}
            </span>
          ))}
          {pickerDays.map((day) => (
            <Button
              key={day}
              data-picker-day={day}
              disabled={!validDay(day)}
              className={monthOf(day) !== pickerMonth ? "outside-month" : ""}
              aria-label={format(day)}
              aria-pressed={selected === day}
              aria-current={day === today ? "date" : undefined}
              tabIndex={
                (pickerDays.includes(pickerActive)
                  ? pickerActive
                  : pickerMonth) === day
                  ? 0
                  : -1
              }
              onFocus={() => setPickerActive(day)}
              onClick={() => pick(day)}
              onKeyDown={(e) => pickerKey(e, day)}
            >
              {Number(day.slice(8))}
            </Button>
          ))}
        </div>
        <form
          className="calendar-date-entry"
          onSubmit={(e) => {
            e.preventDefault();
            if (validDay(enteredDate)) pick(enteredDate);
          }}
        >
          <label htmlFor="calendar-direct-date">
            {t("Langsung ke tanggal", "Jump to date")}
          </label>
          <div>
            <TextInput
              id="calendar-direct-date"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="YYYY-MM-DD"
              pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
              value={enteredDate}
              required
              onChange={(e) => setEnteredDate(e.target.value)}
            />
            <Button
              className="button"
              type="submit"
              disabled={!validDay(enteredDate)}
            >
              {t("Lihat", "Go")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalendarMeal({
  delivery: d,
  meal,
}: {
  delivery: Delivery;
  meal: Meal;
}) {
  const { t } = useApp();
  const status =
    d.status === "cancelled"
      ? "cancelled"
      : d.meals.find((m) => m.meal === meal)!.status;
  return (
    <Link
      href={`/deliveries/${d.id}`}
      className="delivery-row calendar-delivery-row"
    >
      <img src={d.offer.image} alt="" />
      <div>
        <small>{d.offer.caterer}</small>
        <h4>{d.offer.name}</h4>
        <p>
          {d.portions} {t("porsi", "portions")} · {d.address.label}
        </p>
      </div>
      <Status status={status} />
      <ArrowUpRight size={18} />
    </Link>
  );
}
