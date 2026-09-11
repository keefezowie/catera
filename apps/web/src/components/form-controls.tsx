"use client";

import { Check } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

function withClassName(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export type ButtonVariant =
  "primary" | "secondary" | "cream" | "text" | "icon" | "unstyled";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Use the existing Catera button language; unstyled keeps a surface-specific class intact. */
  variant?: ButtonVariant;
  size?: "default" | "small";
};

function buttonClasses(
  variant: ButtonVariant | undefined,
  size: "default" | "small",
  className?: string,
) {
  const designClass =
    variant === "primary"
      ? "button"
      : variant === "secondary"
        ? "button secondary"
        : variant === "cream"
          ? "button cream"
          : variant === "text"
            ? "text-button"
            : variant === "icon"
              ? "icon-button"
              : "";
  return [
    designClass,
    designClass === "button" && size === "small" ? "small" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Shared button boundary for app actions, icon controls, and surface-specific controls. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant, size = "default", className, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        className={buttonClasses(variant, size, className)}
      />
    );
  },
);

Button.displayName = "Button";

/** Shared text-like field that applies Catera's field surface and focus states. */
export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={withClassName("catera-input", className)}
    />
  );
});

TextInput.displayName = "TextInput";

/** Shared multiline field with the same surface, type, and focus language as TextInput. */
export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={withClassName("catera-textarea", className)}
    />
  );
});

TextArea.displayName = "TextArea";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Shared checkbox control with a custom mark while retaining native form semantics. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <span className="checkbox-control">
        <input
          {...props}
          ref={ref}
          type="checkbox"
          className={withClassName("catera-checkbox", className)}
        />
        <span className="checkbox-mark" aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
      </span>
    );
  },
);

Checkbox.displayName = "Checkbox";

type HiddenInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Shared form-value bridge for composite controls such as DatePicker and TimeInput. */
export const HiddenInput = forwardRef<HTMLInputElement, HiddenInputProps>(
  function HiddenInput(props, ref) {
    return <input {...props} ref={ref} type="hidden" />;
  },
);

HiddenInput.displayName = "HiddenInput";

type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Shared native file bridge used only inside the designed FileUpload surface. */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  function FileInput({ className, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="file"
        className={withClassName("catera-file-input", className)}
      />
    );
  },
);

FileInput.displayName = "FileInput";
