"use client";
import { useState } from "react";
import {
  type Dish,
  type LibraryDish,
  type SellerState,
  localDay,
  libraryDishDetailsSchema,
  selectLibraryDish,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button, Checkbox, TextInput } from "./form-controls";
import { ActionForm, Field, ErrorNotice } from "./ui";
import { Select, SelectOption } from "./select";
import { PhotoUpload } from "./photo-upload";

export function useDishLibrary() {
  const { actor } = useApp();
  return useResource<SellerState>("dish-library:" + actor?.catererId, () =>
    api.seller(actor!.catererId!, localDay()),
  );
}

export function DishFields({
  dish,
  onChange,
  library,
  onBusyChange,
  reusable = true,
  fieldPrefix = "dish",
  errors = {},
}: {
  dish: Dish;
  onChange: (patch: Partial<Dish>) => void;
  library: LibraryDish[];
  onBusyChange?: (busy: boolean) => void;
  reusable?: boolean;
  fieldPrefix?: string;
  errors?: Record<string, string>;
}) {
  const { actor, t, perform } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const source = library.find((d) => d.id === dish.sourceDishId);
  const [resetServing, setResetServing] = useState(false);
  return (
    <>
      {reusable && (
        <Field label={t("Pilih hidangan tersimpan", "Choose a saved dish")}>
          <Select
            value=""
            disabled={busy}
            onValueChange={(id) => {
              const selected = library.find((d) => d.id === id && !d.archived);
              if (selected) {
                onChange(selectLibraryDish(dish, selected));
                setSaved(false);
              }
            }}
          >
            <SelectOption value="">
              {t(
                "Tulis langsung atau pilih dari daftar",
                "Enter directly or choose from the library",
              )}
            </SelectOption>
            {library
              .filter((d) => !d.archived)
              .map((d) => (
                <SelectOption key={d.id} value={d.id}>
                  {d.name}
                  {d.serving ? ` · ${d.serving}` : ""}
                </SelectOption>
              ))}
          </Select>
        </Field>
      )}
      {source && (
        <div className="dish-source">
          <p>
            {t("Dari daftar hidangan", "From your dish library")}: {source.name}
            {source.archived ? t(" (diarsipkan)", " (archived)") : ""}.{" "}
            {t(
              "Perubahan di sini hanya untuk isi ini.",
              "Edits here affect only these contents.",
            )}
          </p>
          {!source.archived &&
            source.version > (dish.sourceDishVersion || 0) && (
              <>
                <label className="check-field">
                  <Checkbox
                    checked={resetServing}
                    onChange={(e) => setResetServing(e.target.checked)}
                  />
                  {t(
                    "Gunakan ukuran saji terbaru juga",
                    "Also use the latest serving size",
                  )}
                </label>
                <Button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    onChange(
                      selectLibraryDish(dish, source, true, resetServing),
                    )
                  }
                >
                  {t("Gunakan versi terbaru", "Use latest version")}
                </Button>
              </>
            )}
        </div>
      )}
      <div className="form-row">
        <Field
          fieldKey={fieldPrefix + ".name"}
          error={
            errors[fieldPrefix + ".name"] ||
            (!dish.name.trim() ? errors.menus : undefined)
          }
          label={t("Nama hidangan", "Dish name")}
        >
          <TextInput
            data-dish-name
            maxLength={120}
            value={dish.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field
          fieldKey={fieldPrefix + ".serving"}
          error={errors[fieldPrefix + ".serving"]}
          label={t("Ukuran saji (opsional)", "Serving size (optional)")}
        >
          <TextInput
            maxLength={100}
            placeholder="150 g / 2 potong"
            value={dish.serving}
            onChange={(e) => onChange({ serving: e.target.value })}
          />
        </Field>
      </div>
      {!dish.name.trim() && (
        <p className="field-hint">
          {t(
            "Isi nama sebelum melanjutkan.",
            "Enter a name before continuing.",
          )}
        </p>
      )}
      <Field
        fieldKey={fieldPrefix + ".description"}
        error={errors[fieldPrefix + ".description"]}
        label={t("Deskripsi (opsional)", "Description (optional)")}
      >
        <TextInput
          maxLength={600}
          value={dish.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
      <PhotoUpload
        label={t("Foto hidangan (opsional)", "Dish photo (optional)")}
        value={dish.image}
        onChange={(image) => onChange({ image })}
        onBusyChange={(value) => {
          setUploading(value);
          onBusyChange?.(value);
        }}
      />
      {reusable && !dish.sourceDishId && (
        <Button
          type="button"
          className="text-button"
          disabled={busy || uploading || !dish.name.trim()}
          onClick={async () => {
            setError("");
            setBusy(true);
            onBusyChange?.(true);
            try {
              const details = libraryDishDetailsSchema.parse(dish);
              const result = await perform<LibraryDish>("dish.save", {
                catererId: actor!.catererId,
                details,
              });
              onChange({
                sourceDishId: result.id,
                sourceDishVersion: result.version,
                sourceServing: result.serving,
              });
              setSaved(true);
            } catch {
              setError(
                t(
                  "Hidangan belum tersimpan. Periksa isian lalu coba lagi.",
                  "Dish could not be saved. Check the fields and retry.",
                ),
              );
            } finally {
              setBusy(false);
              onBusyChange?.(false);
            }
          }}
        >
          {busy
            ? t("Menyimpan…", "Saving…")
            : t("Simpan ke daftar hidangan", "Save to dish library")}
        </Button>
      )}
      {saved && (
        <p role="status">
          {t("Hidangan tersimpan di daftar", "Dish saved to library")}
        </p>
      )}
      {error && <ErrorNotice message={error} />}
    </>
  );
}

export function DishLibrary({ dishes }: { dishes: LibraryDish[] }) {
  const { t, actor, perform } = useApp();
  const [editing, setEditing] = useState<LibraryDish | null>(null),
    [creating, setCreating] = useState(false);
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel dish-library">
      <div className="section-heading">
        <div>
          <h2>{t("Daftar hidangan", "Dish library")}</h2>
          <p>
            {t(
              "Simpan hidangan favorit dapur untuk dipakai kembali. Paket diperbarui hanya saat Anda memilihnya.",
              "Save your kitchen’s dishes to reuse. Packages update only when you choose.",
            )}
          </p>
        </div>
        <Button
          type="button"
          className="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          {t("Buat hidangan", "Create dish")}
        </Button>
      </div>
      <Field label={t("Cari hidangan", "Search dishes")}>
        <TextInput
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <label className="check-field">
        <Checkbox
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        {t("Tampilkan arsip", "Show archived")}
      </label>
      {dishes
        .filter(
          (d) =>
            (archived || !d.archived) &&
            d.name.toLowerCase().includes(search.toLowerCase()),
        )
        .map((d) => (
          <div className="library-row" key={d.id}>
            {d.image && <img src={d.image} alt="" width={64} height={64} />}
            <div>
              <strong>{d.name}</strong>
              <p>
                {d.serving}
                {d.archived ? t(" · Diarsipkan", " · Archived") : ""}
              </p>
            </div>
            <Button
              type="button"
              className="text-button"
              onClick={() => {
                setEditing(d);
                setCreating(false);
              }}
            >
              {t("Edit", "Edit")}
            </Button>
            <Button
              type="button"
              className="text-button"
              onClick={async () => {
                try {
                  await perform("dish.archive", {
                    catererId: actor!.catererId,
                    id: d.id,
                    version: d.version,
                    archived: !d.archived,
                  });
                  setError("");
                } catch {
                  setError(
                    t(
                      "Daftar berubah. Muat ulang sebelum mencoba lagi.",
                      "The library changed. Reload before retrying.",
                    ),
                  );
                }
              }}
            >
              {d.archived ? t("Pulihkan", "Restore") : t("Arsipkan", "Archive")}
            </Button>
          </div>
        ))}
      {!dishes.length && (
        <p>
          {t(
            "Belum ada hidangan tersimpan. Anda juga dapat menyimpan dari editor paket.",
            "No saved dishes yet. You can also save them from the package editor.",
          )}
        </p>
      )}
      {error && <ErrorNotice message={error} />}
      {(creating || editing) && (
        <LibraryForm
          key={editing?.id || "new"}
          initial={editing}
          done={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
function LibraryForm({
  initial,
  done,
}: {
  initial: LibraryDish | null;
  done: () => void;
}) {
  const { actor, perform, t } = useApp();
  const [dish, setDish] = useState<Dish>(
    initial || { id: "new", name: "", description: "", image: "", serving: "" },
  );
  const [busy, setBusy] = useState(false);
  return (
    <ActionForm
      disabled={busy}
      submit={t("Simpan hidangan", "Save dish")}
      onSubmit={async () => {
        await perform("dish.save", {
          catererId: actor!.catererId,
          id: initial?.id,
          version: initial?.version,
          details: libraryDishDetailsSchema.parse(dish),
        });
        done();
      }}
    >
      <h3>
        {initial
          ? t("Edit hidangan", "Edit dish")
          : t("Hidangan baru", "New dish")}
      </h3>
      <DishFields
        dish={dish}
        library={[]}
        reusable={false}
        onChange={(p) => setDish((d) => ({ ...d, ...p }))}
        onBusyChange={setBusy}
      />
      <Button
        className="text-button"
        type="button"
        disabled={busy}
        onClick={done}
      >
        {t("Batal", "Cancel")}
      </Button>
    </ActionForm>
  );
}
