"use client";

import { Check, Clock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { AnchoredPopover } from "./anchored-popover";
import { useApp } from "./context";
import { Select, SelectOption } from "./select";
import { Button, HiddenInput } from "./form-controls";

type TimeInputProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

const hours = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, "0"),
);
const minutes = Array.from({ length: 60 }, (_, value) =>
  String(value).padStart(2, "0"),
);

function validTime(value: string | undefined): value is string {
  return !!value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parts(value: string | undefined) {
  const [hour = "00", minute = "00"] = validTime(value) ? value.split(":") : [];
  return { hour, minute };
}

/** Shared, locale-independent 24-hour time field for operational settings. */
export function TimeInput({
  value,
  defaultValue = "",
  onValueChange,
  name,
  id,
  required = false,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: TimeInputProps) {
  const generatedId = useId().replaceAll(":", "");
  const triggerId = id || `time-input-${generatedId}`;
  const popoverId = `${triggerId}-picker`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selected = controlled ? value : internalValue;
  const [draft, setDraft] = useState(() => parts(selected));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useApp();

  useEffect(() => {
    if (!open) setDraft(parts(selected));
  }, [open, selected]);

  function update(next: string) {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
  }

  function commit() {
    update(`${draft.hour}:${draft.minute}`);
    setOpen(false);
  }

  return (
    <span className={`time-input${className ? ` ${className}` : ""}`}>
      {name && <HiddenInput name={name} value={selected || ""} />}
      {required && (
        <span id={`${triggerId}-required`} className="sr-only">
          {t("Wajib diisi", "Required")}
        </span>
      )}
      <AnchoredPopover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            ref={triggerRef}
            id={triggerId}
            type="button"
            className="time-input-trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={
              [ariaDescribedBy, required ? `${triggerId}-required` : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={ariaInvalid}
            data-value={selected}
            disabled={disabled}
            onClick={() => setDraft(parts(selected))}
          >
            <Clock size={17} aria-hidden="true" />
            <span>
              {validTime(selected)
                ? selected
                : t("Pilih waktu", "Choose a time")}
            </span>
          </Button>
        }
        id={popoverId}
        aria-label={t("Pilih waktu", "Choose a time")}
        className="time-input-popover"
        data-open={open || undefined}
      >
        <div className="time-input-fields">
          <Select
            aria-label={t("Jam", "Hour")}
            value={draft.hour}
            onValueChange={(hour) =>
              setDraft((current) => ({ ...current, hour }))
            }
          >
            {hours.map((hour) => (
              <SelectOption value={hour} key={hour}>
                {hour}
              </SelectOption>
            ))}
          </Select>
          <span className="time-input-colon" aria-hidden="true">
            :
          </span>
          <Select
            aria-label={t("Menit", "Minute")}
            value={draft.minute}
            onValueChange={(minute) =>
              setDraft((current) => ({ ...current, minute }))
            }
          >
            {minutes.map((minute) => (
              <SelectOption value={minute} key={minute}>
                {minute}
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className="time-input-footer">
          <Button type="button" variant="primary" size="small" onClick={commit}>
            <Check size={16} aria-hidden="true" />
            {t("Simpan", "Save")}
          </Button>
        </div>
      </AnchoredPopover>
    </span>
  );
}
