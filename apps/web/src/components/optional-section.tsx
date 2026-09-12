"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Fields remain mounted when collapsed, retaining drafts and native form values. */
export function OptionalSection({
  title,
  children,
  initiallyOpen = false,
  invalid = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (invalid && ref.current) ref.current.open = true;
  }, [invalid]);
  return (
    <details
      className="optional-section"
      ref={ref}
      open={initiallyOpen || invalid || undefined}
    >
      <summary>
        {title}
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="optional-fields">{children}</div>
    </details>
  );
}
