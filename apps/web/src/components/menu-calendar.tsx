"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Library,
  LockKeyhole,
  Save,
  Utensils,
} from "lucide-react";
import {
  defaultDishCategories,
  mealLabel,
  selectLibraryDish,
  slotMenuIssues,
  localizedMessage,
  type SellerState,
  type MealMenu,
  type LibraryDish,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button } from "./form-controls";
import { Select, SelectOption } from "./select";
import { Dialog, ErrorNotice, Field } from "./ui";
import { MenuPanel, MenuSlots } from "./menu-assembly";
import { PackageContents } from "./package-contents";
import { MenuLibrary } from "./menu-library";
import {
  monthOf,
  shiftMonth,
  weekStart,
  datesBetween,
  monthEnd,
} from "../lib/meal-calendar";
import "./menu-calendar.css";

type Edit = {
  dates: string[];
  versions: Record<string, number>;
  menu: MealMenu;
  different: boolean;
  readOnly: boolean;
  existing: string[];
};
export function MenuCalendar({
  state: s,
  date,
}: {
  state: SellerState;
  date: string;
}) {
  const { t, locale, perform } = useApp();
  const router = useRouter();
  const query = useSearchParams();
  const [selection, setSelection] = useState(""),
    [meal, setMeal] = useState("lunch"),
    [month, setMonth] = useState(monthOf(date));
  const [multi, setMulti] = useState(false),
    [dates, setDates] = useState<string[]>([]),
    [edit, setEdit] = useState<Edit | null>(null);
  const [dirty, setDirty] = useState(false),
    [leaving, setLeaving] = useState(false),
    [confirmSave, setConfirmSave] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [slot, setSlot] = useState(""),
    [libraryOpen, setLibraryOpen] = useState(query.get("library") === "1");
  const [replacement, setReplacement] = useState<{
    id: string;
    dish: LibraryDish;
  } | null>(null);
  const [dragging, setDragging] = useState<LibraryDish | null>(null);
  const deferred = useRef<(() => void) | null>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const calendarHeading = useRef<HTMLHeadingElement>(null);
  const libraryTrigger = useRef<HTMLButtonElement>(null);
  const libraryReturnTarget = useRef<HTMLElement | null>(null);
  const desktopLibrary = useRef<HTMLElement>(null);
  const wasEditing = useRef(false);
  useLayoutEffect(() => {
    if (wasEditing.current && !edit) calendarHeading.current?.focus();
    wasEditing.current = Boolean(edit);
  }, [edit]);
  const revisions = s.contentRevisions || [],
    selected =
      revisions.find((r) => r.packageId + ":" + r.revision === selection) ||
      revisions[0];
  const activeMeal =
    selected?.contents.meal === "both"
      ? meal
      : selected?.contents.meal || "lunch";
  const context = [
    selected?.packageId,
    selected?.revision,
    month,
    activeMeal,
  ].join(":");
  const resource = useResource("menu-month:" + context, async () => ({
    context,
    value: selected
      ? await api.menuMonth(
          selected.packageId,
          selected.revision,
          month,
          activeMeal,
        )
      : { dates: [], categories: defaultDishCategories },
  }));
  const data = resource.data?.context === context ? resource.data.value : null;
  const categories = s.categories || data?.categories || defaultDishCategories;
  const template = selected?.contents.menus.find((m) => m.meal === activeMeal);
  const activeSlot = edit?.menu.items?.find((i) => i.id === slot);
  const categoryId = edit?.menu.composition?.find(
    (g) => g.id === activeSlot?.groupId,
  )?.categoryId;
  function guard(action: () => void) {
    if (busy) return;
    if (dirty) {
      deferred.current = action;
      setLeaving(true);
    } else action();
  }
  function back() {
    guard(() => {
      setEdit(null);
      setError("");
    });
  }
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a");
      if (
        a?.href &&
        !e.ctrlKey &&
        !e.metaKey &&
        a.target !== "_blank" &&
        new URL(a.href).origin === location.origin
      ) {
        e.preventDefault();
        e.stopPropagation();
        deferred.current = () => router.push(a.href);
        setLeaving(true);
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, router]);
  function openDates(chosen: string[]) {
    if (!template || !data) return;
    const entries = data.dates.filter((d) => chosen.includes(d.date));
    const readOnly = entries.some((d) => !d.editable);
    const signatures = entries.map((d) =>
      JSON.stringify(d.details ? { ...d.details, source: undefined } : null),
    );
    const different = new Set(signatures).size > 1;
    const savedMenu =
      !different && entries[0]?.version ? entries[0].details : null;
    let menu: MealMenu = structuredClone(
      savedMenu
        ? { ...savedMenu, meal: activeMeal }
        : { ...template, nutrition: null },
    );
    if (menu.contentModel === "slots" && (!savedMenu || !menu.items?.length))
      menu = {
        ...menu,
        name: "",
        description: "",
        image: "",
        source: undefined,
        items: (menu.composition || []).flatMap((g) =>
          Array.from({ length: g.slots }, (_, n) => ({
            id: g.id + ":" + n,
            groupId: g.id,
            categoryId: g.categoryId,
            name: "",
            description: "",
            image: "",
            serving: "",
          })),
        ),
        nutrition: null,
      };
    else if (!savedMenu)
      menu = {
        ...menu,
        name: "",
        description: "",
        image: "",
        source: undefined,
        items: menu.items?.map((i) => ({
          ...i,
          name: "",
          description: "",
          image: "",
          sourceDishId: undefined,
          sourceDishVersion: undefined,
          serving: "",
        })),
        nutrition: null,
      };
    setEdit({
      dates: chosen.slice().sort(),
      versions: Object.fromEntries(entries.map((d) => [d.date, d.version])),
      menu,
      different,
      readOnly: entries.some((d) => !d.editable),
      existing: entries.filter((d) => d.version > 0).map((d) => d.date),
    });
    setSlot(menu.items?.find((i) => !i.name)?.id || menu.items?.[0]?.id || "");
    setDirty(false);
    setError("");
    setTimeout(() => editorHeading.current?.focus(), 0);
  }
  function change(menu: MealMenu) {
    if (busy) return;
    setEdit((e) => (e ? { ...e, menu } : e));
    setDirty(true);
    setError("");
  }
  function assign(id: string, dish: LibraryDish, confirmed = false) {
    if (busy || edit?.readOnly) return;
    const item = edit?.menu.items?.find((i) => i.id === id),
      group = edit?.menu.composition?.find((g) => g.id === item?.groupId);
    if (
      !edit ||
      !item ||
      !dish.categoryId ||
      dish.categoryId !== group?.categoryId ||
      dish.archived
    ) {
      setError(
        t(
          "Kategori hidangan tidak sesuai slot.",
          "Dish category does not match this slot.",
        ),
      );
      return;
    }
    if (item.name && !confirmed) {
      setReplacement({ id, dish });
      return;
    }
    const items = edit.menu.items!.map((i) =>
      i.id === id ? selectLibraryDish(i, dish) : i,
    );
    change({ ...edit.menu, items, nutrition: null });
    const position = items.findIndex((i) => i.id === id);
    const next = [
      ...items.slice(position + 1),
      ...items.slice(0, position),
    ].find((i) => !i.name);
    setSlot(next?.id || id);
    if (libraryOpen) {
      libraryReturnTarget.current = document.querySelector<HTMLButtonElement>(
        `[data-slot-id="${CSS.escape(next?.id || id)}"] .menu-slot-select`,
      );
    }
    setLibraryOpen(false);
    setDragging(null);
  }
  function validation() {
    if (!edit) return [];
    return edit.menu.contentModel === "slots"
      ? slotMenuIssues(edit.menu, true)
      : [];
  }
  async function save() {
    if (!edit || !selected || busy || edit.readOnly) return;
    const issues = validation();
    if (issues.length) {
      setError(
        issues.map((issue) => localizedMessage(issue, locale)).join(". "),
      );
      setConfirmSave(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { meal: ignored, source, ...details } = edit.menu;
      await perform("menu.saveBatch", {
        catererId: s.caterer.id,
        packageId: selected.packageId,
        contentRevision: selected.revision,
        meal: activeMeal,
        dates: edit.dates.map((date) => ({
          date,
          version: edit.versions[date],
        })),
        details,
      });
      setDirty(false);
      setConfirmSave(false);
      setLeaving(false);
      setEdit(null);
      resource.reload();
      const action = deferred.current;
      deferred.current = null;
      action?.();
    } catch (e) {
      setConfirmSave(false);
      setLeaving(false);
      deferred.current = null;
      setError(
        (e as { code?: string }).code === "CONFLICT"
          ? t(
              "Menu berubah sejak dibuka. Draft Anda tetap ada; muat ulang tanggal sebelum mencoba lagi.",
              "Menus changed since opening. Your draft is retained; reload the dates before retrying.",
            )
          : t(
              "Menu belum tersimpan. Periksa kelengkapan, kategori, dan status tanggal; lalu coba lagi.",
              "Menus were not saved. Check completeness, categories and date status, then retry.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  function requestSave() {
    const issues = validation();
    if (issues.length) {
      setError(
        issues.map((issue) => localizedMessage(issue, locale)).join(". "),
      );
      return;
    }
    if (edit?.existing.length) setConfirmSave(true);
    else void save();
  }
  if (!selected)
    return (
      <div className="menu-workspace">
        <p>
          {t(
            "Buat paket untuk mulai menyusun menu.",
            "Create a package to start planning menus.",
          )}
        </p>
        <MenuLibrary dishes={s.dishes || []} categories={categories} />
      </div>
    );
  const library = (
    <MenuLibrary
      dishes={s.dishes || []}
      categories={categories}
      categoryId={categoryId}
      onPick={edit && !edit.readOnly ? (d) => assign(slot, d) : undefined}
      disabled={busy}
      onDragChange={setDragging}
    />
  );
  const fmt = (day: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(day + "T12:00:00Z"));
  return (
    <div className="menu-workspace">
      <div className="menu-context">
        <Field label={t("Paket", "Package")}>
          <Select
            value={selected.packageId + ":" + selected.revision}
            disabled={busy}
            onValueChange={(v) =>
              guard(() => {
                setSelection(v);
                setDates([]);
                setEdit(null);
              })
            }
          >
            {revisions.map((r) => (
              <SelectOption
                key={r.packageId + ":" + r.revision}
                value={r.packageId + ":" + r.revision}
              >
                {r.name}
                {revisions.filter((other) => other.packageId === r.packageId)
                  .length > 1
                  ? ` · ${t("Isi", "Contents")} ${r.revision}`
                  : ""}
              </SelectOption>
            ))}
          </Select>
        </Field>
        {selected.contents.meal === "both" && (
          <Field label={t("Waktu makan", "Meal")}>
            <Select
              value={activeMeal}
              disabled={busy}
              onValueChange={(v) =>
                guard(() => {
                  setMeal(v);
                  setDates([]);
                  setEdit(null);
                })
              }
            >
              <SelectOption value="lunch">
                {t("Makan siang", "Lunch")}
              </SelectOption>
              <SelectOption value="dinner">
                {t("Makan malam", "Dinner")}
              </SelectOption>
            </Select>
          </Field>
        )}
        <Button
          type="button"
          ref={libraryTrigger}
          className="text-button menu-library-trigger"
          onClick={() => {
            libraryReturnTarget.current = libraryTrigger.current;
            setLibraryOpen(true);
          }}
        >
          <Library size={18} />
          {t("Pustaka hidangan", "Dish library")}
        </Button>
      </div>
      <div
        className={
          "menu-columns" +
          (edit && !edit.readOnly ? " menu-columns-editor" : "")
        }
      >
        <MenuPanel mode={edit ? "editor" : "calendar"}>
          {!edit ? (
            <>
              <div className="menu-month-heading">
                <Button
                  type="button"
                  className="text-button"
                  aria-label={t("Bulan sebelumnya", "Previous month")}
                  onClick={() => {
                    setMonth(shiftMonth(month, -1));
                    setDates([]);
                  }}
                >
                  <ChevronLeft />
                </Button>
                <h2 ref={calendarHeading} tabIndex={-1}>
                  {new Intl.DateTimeFormat(
                    locale === "id" ? "id-ID" : "en-GB",
                    { month: "long", year: "numeric", timeZone: "UTC" },
                  ).format(new Date(month + "T12:00:00Z"))}
                </h2>
                <Button
                  type="button"
                  className="text-button"
                  aria-label={t("Bulan berikutnya", "Next month")}
                  onClick={() => {
                    setMonth(shiftMonth(month, 1));
                    setDates([]);
                  }}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="menu-selection-bar">
                <span>{mealLabel(activeMeal, locale)}</span>
                <Button
                  type="button"
                  className="text-button"
                  aria-pressed={multi}
                  onClick={() => {
                    setMulti(!multi);
                    setDates([]);
                  }}
                >
                  {multi
                    ? t("Selesai memilih", "Finish selection")
                    : t("Pilih beberapa tanggal", "Select multiple dates")}
                </Button>
              </div>
              <p className="menu-calendar-legend">
                <LockKeyhole size={14} aria-hidden="true" />
                {t(
                  "Hanya baca · Ketuk tanggal untuk melihat menu",
                  "Read only · Tap a date to view its menu",
                )}
              </p>
              {resource.error ? (
                <ErrorNotice message={resource.error} retry={resource.reload} />
              ) : !data ? (
                <p role="status">
                  {t("Memuat kalender…", "Loading calendar…")}
                </p>
              ) : (
                <>
                  <div
                    className="menu-month-grid"
                    aria-label={t("Tanggal menu", "Menu dates")}
                  >
                    {(locale === "id"
                      ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
                      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                    ).map((d) => (
                      <span className="menu-weekday" key={d}>
                        {d}
                      </span>
                    ))}
                    {datesBetween(weekStart(month), monthEnd(month)).map(
                      (day) => {
                        const d = data.dates.find((x) => x.date === day);
                        const dishNames =
                          d?.details?.items
                            ?.map((item) => item.name.trim())
                            .filter(Boolean) || [];
                        const menuNames = dishNames.length
                          ? dishNames
                          : d?.details?.name
                            ? [d.details.name]
                            : [];
                        return d ? (
                          <Button
                            key={day}
                            type="button"
                            className={
                              "menu-day" +
                              (d.version ? " configured" : "") +
                              (dates.includes(day) ? " selected" : "")
                            }
                            aria-pressed={
                              multi ? dates.includes(day) : undefined
                            }
                            aria-label={
                              fmt(day) +
                              " · " +
                              (d.version
                                ? menuNames.join(", ") ||
                                  t("Menu terisi", "Menu configured")
                                : t("Belum diisi", "Not set")) +
                              (!d.editable
                                ? t(" · Hanya baca", " · Read only")
                                : "")
                            }
                            disabled={multi && !d.editable}
                            onClick={() =>
                              multi
                                ? setDates((v) =>
                                    v.includes(day)
                                      ? v.filter((x) => x !== day)
                                      : [...v, day],
                                  )
                                : openDates([day])
                            }
                          >
                            <span
                              className="menu-day-heading"
                              aria-hidden="true"
                            >
                              <strong>{Number(day.slice(-2))}</strong>
                              {!d.editable && <LockKeyhole size={13} />}
                            </span>
                            {d.version ? (
                              <>
                                <span
                                  className="menu-day-dishes"
                                  title={menuNames.join(", ")}
                                >
                                  {menuNames.length ? (
                                    menuNames.slice(0, 2).map((name, index) => (
                                      <span
                                        className="menu-day-dish"
                                        key={index}
                                      >
                                        {name}
                                      </span>
                                    ))
                                  ) : (
                                    <span>
                                      {t("Menu tersimpan", "Saved menu")}
                                    </span>
                                  )}
                                  {menuNames.length > 2 && (
                                    <span className="menu-day-more">
                                      +{menuNames.length - 2}{" "}
                                      {t("hidangan", "dishes")}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className="menu-day-count"
                                  aria-hidden="true"
                                >
                                  {menuNames.length ? (
                                    <>
                                      <Utensils size={12} />
                                      {menuNames.length}
                                    </>
                                  ) : (
                                    t("Terisi", "Saved")
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="menu-day-empty">
                                {t("Belum diisi", "Not set")}
                              </span>
                            )}
                          </Button>
                        ) : (
                          <span key={day} className="menu-day-outside" />
                        );
                      },
                    )}
                  </div>
                  {multi && (
                    <div className="menu-selection-footer">
                      <span>
                        {dates.length} {t("tanggal dipilih", "dates selected")}
                      </span>
                      <Button
                        variant="primary"
                        type="button"
                        disabled={!dates.length}
                        onClick={() => openDates(dates)}
                      >
                        {t("Atur menu", "Edit menu")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={back}
              >
                <ArrowLeft size={18} />
                {t("Kembali ke kalender", "Back to calendar")}
              </Button>
              <p className="menu-package-name">{selected.name}</p>
              <h2 ref={editorHeading} tabIndex={-1}>
                {t("Menu ", "Menu for ")}
                {edit.dates.map(fmt).join(", ")}
              </h2>
              <p>
                {mealLabel(activeMeal, locale)} ·{" "}
                {t(
                  "Satu menu untuk seluruh tanggal terpilih.",
                  "One menu for every selected date.",
                )}
              </p>
              {!edit.readOnly && (
                <p className="menu-completion" role="status">
                  {edit.menu.items?.filter((i) => i.name).length || 0}/
                  {edit.menu.items?.length || 0}{" "}
                  {t("slot terisi", "slots filled")}
                </p>
              )}
              {edit.different && (
                <p role="status">
                  {t(
                    "Menu berbeda. Susun satu menu pengganti untuk seluruh tanggal terpilih.",
                    "Different menus. Build one replacement menu for every selected date.",
                  )}
                </p>
              )}
              {edit.readOnly ? (
                <>
                  <p>
                    {t(
                      "Menu tanggal ini hanya dapat dilihat.",
                      "This date's menu is read only.",
                    )}
                  </p>
                  <PackageContents
                    offer={{
                      packageType: selected.contents.packageType,
                      menus: [edit.menu],
                    }}
                  />
                </>
              ) : (
                <>
                  <MenuSlots
                    menu={edit.menu}
                    activeId={slot}
                    dragging={dragging}
                    busy={busy}
                    onSelect={(id) => {
                      setSlot(id);
                      if (!desktopLibrary.current?.getClientRects().length) {
                        libraryReturnTarget.current =
                          document.activeElement as HTMLElement;
                        setLibraryOpen(true);
                      }
                    }}
                    onDrop={(id, dishId) => {
                      const dish = s.dishes?.find((d) => d.id === dishId);
                      if (dish) assign(id, dish);
                      setDragging(null);
                    }}
                    onRemove={(id) => {
                      change({
                        ...edit.menu,
                        items: edit.menu.items!.map((i) =>
                          i.id === id
                            ? {
                                id: i.id,
                                groupId: i.groupId,
                                categoryId: i.categoryId,
                                name: "",
                                description: "",
                                image: "",
                                serving: "",
                              }
                            : i,
                        ),
                        nutrition: null,
                      });
                      setSlot(id);
                    }}
                  />
                  {!edit.menu.composition?.length && (
                    <p>
                      {t(
                        "Tambahkan komposisi paket sebelum menyusun menu.",
                        "Add the package composition before assembling a menu.",
                      )}
                    </p>
                  )}
                  <div className="menu-save-bar">
                    <span>
                      <strong>{edit.dates.map(fmt).join(", ")}</strong> ·{" "}
                      {mealLabel(activeMeal, locale)}
                      <small>
                        {validation().length
                          ? t(
                              "Lengkapi setiap tempat hidangan untuk menyimpan.",
                              "Fill every dish slot to save.",
                            )
                          : t(
                              "Semua hidangan terisi. Siap disimpan.",
                              "All dish slots filled. Ready to save.",
                            )}
                      </small>
                    </span>
                    <Button
                      variant="primary"
                      type="button"
                      disabled={
                        busy ||
                        validation().length > 0 ||
                        !edit.menu.items?.length
                      }
                      onClick={requestSave}
                    >
                      <Save size={18} />
                      {busy
                        ? t("Menyimpan…", "Saving…")
                        : t("Simpan menu", "Save menu")}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
          {error && (
            <>
              <ErrorNotice message={error} />
              <Button
                type="button"
                className="text-button"
                onClick={() =>
                  guard(() => {
                    setDirty(false);
                    setEdit(null);
                    setError("");
                    resource.reload();
                  })
                }
              >
                {t("Muat ulang tanggal", "Reload dates")}
              </Button>
            </>
          )}
        </MenuPanel>
        <aside ref={desktopLibrary} className="menu-library-desktop">
          {library}
        </aside>
      </div>
      <Dialog
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Restore after Radix removes its focus trap and scroll lock.
          requestAnimationFrame(() => {
            const target = libraryReturnTarget.current;
            (target?.isConnected
              ? target
              : libraryTrigger.current ||
                editorHeading.current ||
                calendarHeading.current
            )?.focus({ preventScroll: true });
          });
        }}
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title={t("Pustaka hidangan", "Dish library")}
        description={t(
          "Cari atau tambahkan hidangan berdasarkan kategori.",
          "Search or add dishes by category.",
        )}
        className="menu-library-dialog"
      >
        {library}
      </Dialog>
      <Dialog
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (editorHeading.current || calendarHeading.current)?.focus();
        }}
        open={leaving}
        onOpenChange={(o) => {
          if (!busy) {
            setLeaving(o);
            if (!o) deferred.current = null;
          }
        }}
        title={t("Simpan perubahan menu?", "Save menu changes?")}
        description={
          validation().length
            ? t(
                "Menu belum lengkap. Lanjutkan mengisi slot kosong atau buang perubahan untuk kembali.",
                "This menu is incomplete. Keep editing to fill the empty slots, or discard your changes to go back.",
              )
            : t(
                "Draft belum disimpan. Pilih simpan atau buang sebelum meninggalkan editor.",
                "This draft has not been saved. Save or discard before leaving the editor.",
              )
        }
      >
        <div className="menu-leave-actions">
          <Button
            variant="primary"
            disabled={busy || validation().length > 0}
            onClick={requestSave}
          >
            {t("Simpan", "Save")}
          </Button>
          <Button
            disabled={busy}
            variant="secondary"
            onClick={() => {
              setDirty(false);
              setLeaving(false);
              const action = deferred.current;
              deferred.current = null;
              action?.();
            }}
          >
            {t("Buang perubahan", "Discard changes")}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setLeaving(false);
              deferred.current = null;
            }}
          >
            {t("Lanjut mengedit", "Keep editing")}
          </Button>
        </div>
      </Dialog>
      <Dialog
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (editorHeading.current || calendarHeading.current)?.focus();
        }}
        open={confirmSave}
        onOpenChange={(o) => {
          if (!busy) setConfirmSave(o);
        }}
        title={t("Ganti menu yang tersimpan?", "Replace saved menus?")}
        description={t(
          "Menu pada tanggal berikut akan diganti:",
          "Menus on these dates will be replaced:",
        )}
      >
        <p>{edit?.existing.map(fmt).join(", ")}</p>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {t("Ganti dan simpan", "Replace and save")}
        </Button>
      </Dialog>
      <Dialog
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editorHeading.current?.focus();
        }}
        open={!!replacement}
        onOpenChange={(o) => {
          if (!o) setReplacement(null);
        }}
        title={t("Ganti hidangan pada slot ini?", "Replace this slot's dish?")}
        description={replacement?.dish.name}
      >
        <Button
          variant="primary"
          onClick={() => {
            if (replacement) assign(replacement.id, replacement.dish, true);
            setReplacement(null);
          }}
        >
          {t("Ganti hidangan", "Replace dish")}
        </Button>
      </Dialog>
    </div>
  );
}
