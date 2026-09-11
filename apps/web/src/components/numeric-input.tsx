"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from "react";
import { TextInput } from "./form-controls";

type NumericValue = number | string;

export type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | "type"
  | "value"
  | "defaultValue"
  | "min"
  | "max"
  | "step"
  | "onChange"
  | "onBlur"
  | "onFocus"
  | "onClick"
  | "onKeyDown"
> & {
  /** A controlled value. While focused, the local draft remains authoritative. */
  value?: NumericValue;
  defaultValue?: NumericValue;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  /** Receives valid numeric drafts and the normalized value on blur. */
  onValueChange?: (value: number) => void;
  /** Receives the exact draft, including an empty string. */
  onDraftChange?: (value: string) => void;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onClick?: MouseEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Keep optional numeric fields blank instead of applying their minimum. */
  normalizeOnBlur?: boolean;
};

function textValue(value: NumericValue | undefined) {
  return value === undefined ? "" : String(value);
}

function finiteNumber(value: number | string | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerStep(step: number | string | undefined) {
  if (step === "any") return false;
  const parsed = finiteNumber(step === undefined ? 1 : step);
  return parsed === undefined || parsed >= 1;
}

function liveNumber(
  raw: string,
  max: number | undefined,
  step: number | string | undefined,
) {
  if (raw.trim() === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  const whole = integerStep(step) ? Math.trunc(parsed) : parsed;
  return max === undefined ? whole : Math.min(max, whole);
}

function normalizedNumber(
  raw: string,
  min: number | undefined,
  max: number | undefined,
  step: number | string | undefined,
) {
  const parsed = Number(raw);
  let next = Number.isFinite(parsed) ? parsed : (min ?? 1);
  if (integerStep(step)) next = Math.trunc(next);
  next = Math.max(min ?? 1, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

/**
 * Numeric fields keep an editable string draft. This lets users replace a
 * single digit with Backspace, see 0 while editing, and normalize only when
 * the field is committed with blur or Enter.
 */
export function NumericInput({
  value,
  defaultValue,
  min,
  max,
  step,
  onValueChange,
  onDraftChange,
  onChange,
  onBlur,
  onFocus,
  onClick,
  onKeyDown,
  normalizeOnBlur = true,
  ...rest
}: NumericInputProps) {
  const controlled = value !== undefined;
  const [draft, setDraft] = useState(() =>
    textValue(controlled ? value : defaultValue),
  );
  const focused = useRef(false);
  const minimum = finiteNumber(min);
  const maximum = finiteNumber(max);

  useEffect(() => {
    if (controlled && !focused.current) setDraft(textValue(value));
  }, [controlled, value]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    setDraft(raw);
    onDraftChange?.(raw);
    onChange?.(event);
    const next = liveNumber(raw, maximum, step);
    if (next !== undefined) onValueChange?.(next);
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    focused.current = false;
    if (normalizeOnBlur) {
      const next = normalizedNumber(draft, minimum, maximum, step);
      setDraft(String(next));
      onDraftChange?.(String(next));
      onValueChange?.(next);
    }
    onBlur?.(event);
  }

  return (
    <TextInput
      {...rest}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={handleChange}
      onFocus={(event) => {
        focused.current = true;
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onClick={(event) => {
        event.currentTarget.select();
        onClick?.(event);
      }}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        onKeyDown?.(event);
      }}
    />
  );
}
