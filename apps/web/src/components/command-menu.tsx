"use client";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useApp } from "./context";
import { Button } from "./form-controls";
import { Dialog } from "./ui";
import "./command-menu.css";

export type Command = {
  label: string;
  /** A page to open, or an action to run. */
  href?: string;
  run?: () => void;
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
};

/** True while focus is in a field, so a shortcut never eats a keystroke someone is typing. */
export function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, [contenteditable]") !== null)
  );
}

/** ⌘ on Apple platforms, Ctrl elsewhere. Read after mount, so the server render and hydration agree on "Ctrl". */
export function useModifier() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac
    ? { mac, key: "⌘", aria: "Meta+K" }
    : { mac, key: "Ctrl", aria: "Control+K" };
}

/** Ctrl+K (⌘K on a Mac) search over every workspace page and action, usable with the keyboard alone. */
export function CommandMenu({ commands }: { commands: Command[] }) {
  const { t } = useApp();
  const router = useRouter();
  const modifier = useModifier();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const needle = query.trim().toLocaleLowerCase();
  const matches = commands.filter((command) =>
    command.label.toLocaleLowerCase().includes(needle),
  );
  const current = Math.min(active, matches.length - 1);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || event.altKey || event.shiftKey)
        return;
      if (!(modifier.mac ? event.metaKey : event.ctrlKey)) return;
      if (typing(event.target)) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modifier.mac]);

  // Every opening starts from an empty search, whether by shortcut or button.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
  }, [open]);

  // The arrow keys can move past the list's visible height; keep the active option in view.
  useEffect(() => {
    if (open)
      document
        .getElementById(listId + "-" + current)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, current, listId]);

  function choose(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    if (command.href) router.push(command.href);
    else command.run?.();
  }

  return (
    <>
      <Button
        type="button"
        className="icon-button command-trigger"
        onClick={() => setOpen(true)}
        aria-label={t("Cari halaman dan tindakan", "Search pages and actions")}
        aria-keyshortcuts={modifier.aria}
        aria-haspopup="dialog"
        title={
          t("Cari", "Search") +
          " (" +
          modifier.key +
          (modifier.mac ? "K" : "+K") +
          ")"
        }
      >
        <Search size={19} aria-hidden="true" />
        <kbd className="command-key" aria-hidden="true">
          {modifier.key}
          {modifier.mac ? "K" : " K"}
        </kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Cari halaman atau tindakan", "Search pages or actions")}
        className="command-menu"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <input
          className="command-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            matches.length ? listId + "-" + current : undefined
          }
          aria-label={t("Cari", "Search")}
          placeholder={t("Ketik nama halaman…", "Type a page name…")}
          ref={input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive(
                (current + step + matches.length) % Math.max(1, matches.length),
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(matches[current]);
            }
          }}
        />
        <ul id={listId} role="listbox" className="command-list">
          {matches.map((command, index) => (
            <li
              key={command.label}
              id={listId + "-" + index}
              role="option"
              aria-selected={index === current}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(command)}
            >
              <command.Icon size={18} aria-hidden={true} />
              {command.label}
            </li>
          ))}
        </ul>
        {!matches.length && (
          <p className="command-empty" role="status">
            {t("Tidak ada yang cocok.", "Nothing matches.")}
          </p>
        )}
        <p className="command-help">
          <kbd>↑</kbd> <kbd>↓</kbd> {t("pilih", "move")} · <kbd>Enter</kbd>{" "}
          {t("buka", "open")} · <kbd>Esc</kbd> {t("tutup", "close")}
        </p>
      </Dialog>
    </>
  );
}
