"use client";
import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Fields remain mounted when collapsed, retaining drafts and native form values. */
export function OptionalSection({
  title,
  children,
  initiallyOpen = false,
  invalid = false,
  summary,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
  invalid?: boolean;
  summary?: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen || invalid);
  const id = useId();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (invalid) setOpen(true);
  }, [invalid]);
  return (
    <details
      className="optional-section"
      ref={ref}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onInvalidCapture={() => {
        if (ref.current) ref.current.open = true;
        setOpen(true);
      }}
    >
      <summary aria-controls={id}>
        <span>
          {title}
          {summary && <small className="optional-summary">{summary}</small>}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div id={id} className="optional-fields">
        {children}
      </div>
    </details>
  );
}
