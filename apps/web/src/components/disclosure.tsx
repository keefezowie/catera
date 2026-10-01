"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./disclosure.css";

type DisclosureProps = Omit<ComponentPropsWithoutRef<"details">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  variant?: "inline" | "panel";
};

/** Native disclosure behavior with the shared Catera summary and body spacing. */
export function Disclosure({
  title,
  description,
  variant = "inline",
  className = "",
  children,
  ...props
}: DisclosureProps) {
  return (
    <details
      {...props}
      className={`disclosure disclosure-${variant} ${className}`}
    >
      <summary>
        <span className="disclosure-heading">
          <span className="disclosure-title">{title}</span>
          {description && (
            <span className="disclosure-description">{description}</span>
          )}
        </span>
        <ChevronDown
          className="disclosure-chevron"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
