"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChefHat, LogOut, UserRound } from "lucide-react";
import type { WorkspaceMode } from "@catera/domain";
import { canSwitchWorkspace } from "@/lib/workspace";
import { api, useApp } from "./context";
import { Button } from "./form-controls";

const workspaceOptions: {
  value: WorkspaceMode;
  id: string;
  en: string;
}[] = [
  { value: "caterer", id: "Katerer", en: "Caterer" },
  { value: "customer", id: "Pelanggan", en: "Customer" },
];

export function ProfileMenu() {
  const { actor, workspace, t } = useApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function closeMenu(returnFocus = false) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>("[data-profile-menu-item]")
        ?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      )
        closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        "[data-profile-menu-item]",
      ) || [],
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current < 0 || items.length === 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  }

  async function selectWorkspace(next: WorkspaceMode) {
    setError("");
    if (next === activeWorkspace) {
      closeMenu();
      return;
    }
    setPending(true);
    try {
      const result = await api.request<{ workspace: WorkspaceMode }>(
        "auth/workspace",
        { workspace: next },
      );
      location.assign(result.workspace === "caterer" ? "/seller" : "/");
    } catch {
      setPending(false);
      setError(
        t(
          "Ruang kerja belum berhasil diganti. Coba lagi.",
          "The workspace could not be changed. Try again.",
        ),
      );
    }
  }

  async function logout() {
    setError("");
    setPending(true);
    try {
      await api.request("auth/logout", {});
      location.assign("/");
    } catch {
      setPending(false);
      setError(
        t(
          "Belum berhasil keluar. Coba lagi.",
          "Could not sign out. Try again.",
        ),
      );
    }
  }

  if (!actor) return null;

  const activeWorkspace: WorkspaceMode =
    workspace === "caterer" ? "caterer" : "customer";
  const workspaceLabel =
    workspace === "admin"
      ? "Catera Admin"
      : activeWorkspace === "caterer"
        ? t("Ruang katerer", "Caterer workspace")
        : t("Ruang pelanggan", "Customer workspace");
  const canSwitch = canSwitchWorkspace(actor);

  return (
    <div className="profile-menu-wrap">
      <Button
        ref={triggerRef}
        className="profile-menu-trigger"
        type="button"
        aria-label={t("Buka menu akun", "Open account menu")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="profile-menu"
        onClick={() => {
          setError("");
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="avatar" aria-hidden="true">
          {actor.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      </Button>
      {open && (
        <div
          ref={menuRef}
          id="profile-menu"
          className="profile-menu-panel"
          role="menu"
          aria-label={t("Menu akun", "Account menu")}
          aria-busy={pending || undefined}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="profile-menu-identity">
            <span className="avatar" aria-hidden="true">
              {actor.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div>
              <strong>{actor.name}</strong>
              <small>{workspaceLabel}</small>
            </div>
          </div>
          {canSwitch && (
            <fieldset className="profile-menu-workspaces">
              <legend>{t("Ruang kerja", "Workspace")}</legend>
              {workspaceOptions.map((option) => {
                const selected = activeWorkspace === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    data-profile-menu-item
                    className="profile-menu-item"
                    disabled={pending}
                    onClick={() => selectWorkspace(option.value)}
                  >
                    <span>
                      {option.value === "caterer" ? (
                        <ChefHat size={17} aria-hidden="true" />
                      ) : (
                        <UserRound size={17} aria-hidden="true" />
                      )}
                      <span>
                        <strong>{t(option.id, option.en)}</strong>
                        <small>
                          {option.value === "caterer"
                            ? t("Kelola katering", "Manage catering")
                            : t("Jelajah dan pesan", "Browse and order")}
                        </small>
                      </span>
                    </span>
                    {selected && <Check size={17} aria-hidden="true" />}
                  </button>
                );
              })}
            </fieldset>
          )}
          <div className="profile-menu-links">
            <Link
              href="/account"
              role="menuitem"
              data-profile-menu-item
              onClick={() => closeMenu()}
            >
              <UserRound size={17} aria-hidden="true" />
              {t("Akun", "Account")}
            </Link>
            <button
              type="button"
              role="menuitem"
              data-profile-menu-item
              className="profile-menu-item"
              disabled={pending}
              onClick={logout}
            >
              <LogOut size={17} aria-hidden="true" />
              {t("Keluar", "Sign out")}
            </button>
          </div>
          {error && (
            <p className="profile-menu-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
