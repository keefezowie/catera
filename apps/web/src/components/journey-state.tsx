"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "./context";
import { Dialog } from "./ui";
import { Button } from "./form-controls";
const approvedDepartures = new WeakSet<Event>();

// Query changes are local navigation. Next's native history integration keeps
// Back/Forward and useSearchParams in sync without remounting an active editor.
export function useJourneyQuery() {
  const query = useSearchParams();
  function update(
    values: Record<string, string | number | null>,
    replace = false,
  ) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    const href =
      window.location.pathname +
      (next.size ? "?" + next : "") +
      window.location.hash;
    if (
      href ===
      window.location.pathname + window.location.search + window.location.hash
    )
      return;
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
  }
  return { query, update };
}

export function useUnsavedDeparture(dirty: boolean) {
  const { t } = useApp();
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (approvedDepartures.has(event)) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.target === "_blank" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const target = new URL(link.href, location.href);
      if (
        target.origin === location.origin &&
        target.pathname === location.pathname
      )
        return;
      if (
        !window.confirm(
          t(
            "Ada perubahan yang belum disimpan. Tinggalkan halaman?",
            "You have unsaved changes. Leave this page?",
          ),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      } else approvedDepartures.add(event);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, t]);
}

export function useDiscardChanges(dirty: boolean, discard: () => void) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  useUnsavedDeparture(dirty);
  return {
    close: () => (dirty ? setOpen(true) : discard()),
    confirmation: (
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="confirmation"
        title={t("Tutup tanpa menyimpan?", "Close without saving?")}
        description={t(
          "Perubahan belum disimpan. Lanjutkan mengedit atau buang perubahan.",
          "Your changes are not saved. Keep editing or discard them.",
        )}
      >
        <div className="dialog-actions">
          <Button data-dialog-safe onClick={() => setOpen(false)}>
            {t("Lanjut mengedit", "Keep editing")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
              discard();
            }}
          >
            {t("Buang perubahan", "Discard changes")}
          </Button>
        </div>
      </Dialog>
    ),
  };
}
