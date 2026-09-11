"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Children, isValidElement, useState, type ReactNode } from "react";

const emptyOption = "__catera_empty_option__";
type OptionProps = {
  value?: string | number;
  children: ReactNode;
  disabled?: boolean;
};
type SelectProps = {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  displayValue?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** Shared, keyboard-accessible select with a viewport-aware, portaled menu. */
export function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  displayValue,
  className = "",
  id,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  ...props
}: SelectProps) {
  const options = Children.toArray(children).filter(
    isValidElement<OptionProps>,
  );
  const first = options[0]?.props;
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? (first ? String(first.value ?? first.children) : ""),
  );
  const current = value ?? internalValue;
  const placeholder =
    options.find((option) => option.props.value === "")?.props.children ?? "—";
  return (
    <SelectPrimitive.Root
      {...props}
      value={current}
      onValueChange={(next) => {
        const selected = next === emptyOption ? "" : next;
        setInternalValue(selected);
        onValueChange?.(selected);
      }}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`select-trigger ${className}`}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {displayValue}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-menu"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll">
            <ChevronUp size={16} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport
            className="select-options"
            role="group"
            tabIndex={0}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll">
            <ChevronDown size={16} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectOption({ value, children, disabled }: OptionProps) {
  return (
    <SelectPrimitive.Item
      className="select-option"
      value={String(value ?? children) || emptyOption}
      disabled={disabled}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="select-check">
        <Check size={16} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
