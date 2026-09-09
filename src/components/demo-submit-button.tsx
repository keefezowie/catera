"use client";
import { useFormStatus } from "react-dom";

export function DemoSubmitButton({ label, pendingLabel, primary }: {
  label: string;
  pendingLabel: string;
  primary: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}
      className={"button full " + (primary ? "primary" : "secondary")}>
      {pending ? pendingLabel : label}
    </button>
  );
}
