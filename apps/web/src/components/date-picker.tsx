"use client";

import "./date-picker.css";

import { addDays, localDay } from "@catera/domain";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  datesBetween,
  monthOf,
  shiftMonth,
  validDay,
  weekStart,
} from "../lib/meal-calendar";
import { useApp } from "./context";
import { Button, HiddenInput } from "./form-controls";

const earliestDay = "1900-01-01";
const latestDay = "9998-12-31";

type DatePickerProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  compact?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

function clampDay(day: string, min: string, max: string) {
  return day < min ? min : day > max ? max : day;
}

/** Catera's shared, keyboard-accessible calendar field. */
export function DatePicker({
  value,
  defaultValue = "",
  onValueChange,
  name,
  id,
  min = earliestDay,
  max = latestDay,
  required = false,
  disabled = false,
  allowClear = false,
  compact = false,
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const generatedId = useId().replaceAll(":", "");
  const triggerId = id || `date-picker-${generatedId}`;
  const popoverId = `${triggerId}-calendar`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selected = controlled ? value : internalValue;
  const { locale, t } = useApp();
  const today = localDay();
  const initialFocus = validDay(selected)
    ? selected
    : clampDay(today, min, max);
  const [visibleMonth, setVisibleMonth] = useState(monthOf(initialFocus));
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState(initialFocus);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const language = locale === "en" ? "en-GB" : "id-ID";
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(language, {
      ...options,
      timeZone: "UTC",
    });
  const displayValue = validDay(selected)
    ? format(
        selected,
        compact
          ? { day: "numeric", month: "short", year: "numeric" }
          : { day: "numeric", month: "long", year: "numeric" },
      )
    : t("Pilih tanggal", "Choose a date");
  const firstVisibleDay = weekStart(visibleMonth);
  const days = datesBetween(firstVisibleDay, addDays(firstVisibleDay, 41));
  const canGoBack = shiftMonth(visibleMonth, -1) >= monthOf(min);
  const canGoForward = shiftMonth(visibleMonth, 1) <= monthOf(max);
  const todayAvailable = today >= min && today <= max;

  function placePopover() {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const anchor = trigger.getBoundingClientRect();
    const width = popover.offsetWidth || 336;
    const height = popover.offsetHeight || 430;
    const roomBelow = window.innerHeight - anchor.bottom;
    const top =
      roomBelow >= height + 12
        ? anchor.bottom + 8
        : Math.max(12, anchor.top - height - 8);
    const left = Math.min(
      Math.max(12, anchor.left),
      Math.max(12, window.innerWidth - width - 12),
    );
    popover.style.setProperty("--date-picker-top", `${top}px`);
    popover.style.setProperty("--date-picker-left", `${left}px`);
  }

  useEffect(() => {
    if (!open) return;
    const reposition = () => placePopover();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    placePopover();
    popoverRef.current
      ?.querySelector<HTMLButtonElement>(`[data-calendar-day="${focusDay}"]`)
      ?.focus({ preventScroll: true });
  }, [focusDay, open, visibleMonth]);

  function close() {
    popoverRef.current?.hidePopover();
  }

  function update(next: string) {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
  }

  function choose(day: string) {
    update(day);
    close();
  }

  function moveFocus(day: string, amount: number) {
    const next = clampDay(addDays(day, amount), min, max);
    setFocusDay(next);
    if (monthOf(next) !== visibleMonth) setVisibleMonth(monthOf(next));
  }

  function handleDayKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    day: string,
  ) {
    const movement: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in movement) {
      event.preventDefault();
      moveFocus(day, movement[event.key]);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveFocus(
        day,
        event.key === "Home"
          ? -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7)
          : 6 - ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7),
      );
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const targetMonth = shiftMonth(day, event.key === "PageUp" ? -1 : 1);
      const target = clampDay(
        `${targetMonth.slice(0, 8)}${Math.min(
          Number(day.slice(8)),
          Number(addDays(shiftMonth(targetMonth, 1), -1).slice(8)),
        )
          .toString()
          .padStart(2, "0")}`,
        min,
        max,
      );
      setFocusDay(target);
      setVisibleMonth(monthOf(target));
    }
  }

  return (
    <span
      className={`date-picker${compact ? " date-picker-compact" : ""}${className ? ` ${className}` : ""}`}
    >
      {name && <HiddenInput name={name} value={selected} />}
      <Button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="date-picker-trigger"
        popoverTarget={popoverId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required}
        data-value={selected}
        disabled={disabled}
        onClick={() => {
          const next = validDay(selected)
            ? selected
            : clampDay(today, min, max);
          setVisibleMonth(monthOf(next));
          setFocusDay(next);
        }}
      >
        <CalendarDays size={17} aria-hidden="true" />
        <span>{displayValue}</span>
      </Button>
      <div
        id={popoverId}
        ref={popoverRef}
        popover="auto"
        role="dialog"
        aria-label={t("Pilih tanggal", "Choose a date")}
        className="date-picker-popover"
        data-open={open || undefined}
        data-visible-month={visibleMonth.slice(0, 7)}
        onToggle={(event) => {
          const isOpen = event.newState === "open";
          setOpen(isOpen);
          if (isOpen) requestAnimationFrame(placePopover);
          else triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        <div className="date-picker-header">
          <Button
            type="button"
            className="icon-button"
            aria-label={t("Bulan sebelumnya", "Previous month")}
            disabled={!canGoBack}
            data-date-picker-previous
            onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
          >
            <ChevronLeft size={18} />
          </Button>
          <strong aria-live="polite">
            {format(visibleMonth, { month: "long", year: "numeric" })}
          </strong>
          <Button
            type="button"
            className="icon-button"
            aria-label={t("Bulan berikutnya", "Next month")}
            disabled={!canGoForward}
            data-date-picker-next
            onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <div
          className="date-picker-grid"
          role="grid"
          aria-label={t("Hari dalam bulan", "Days in month")}
        >
          {datesBetween("2026-09-07", "2026-09-13").map((day) => (
            <span
              key={day}
              role="columnheader"
              aria-label={format(day, { weekday: "long" })}
            >
              {format(day, { weekday: "narrow" })}
            </span>
          ))}
          {days.map((day) => {
            const unavailable = day < min || day > max;
            return (
              <Button
                key={day}
                type="button"
                role="gridcell"
                data-calendar-day={day}
                className={monthOf(day) !== visibleMonth ? "outside-month" : ""}
                disabled={unavailable}
                tabIndex={day === focusDay ? 0 : -1}
                aria-label={format(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                aria-selected={selected === day}
                aria-current={day === today ? "date" : undefined}
                onClick={() => choose(day)}
                onKeyDown={(event) => handleDayKeyDown(event, day)}
              >
                {Number(day.slice(8))}
              </Button>
            );
          })}
        </div>
        <div className="date-picker-footer">
          {allowClear && !required ? (
            <Button
              type="button"
              className="text-button"
              onClick={() => choose("")}
            >
              {t("Hapus", "Clear")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            className="text-button"
            disabled={!todayAvailable}
            onClick={() => choose(today)}
          >
            {t("Hari ini", "Today")}
          </Button>
        </div>
      </div>
    </span>
  );
}
