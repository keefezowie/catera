"use client";
import { useState } from "react";
import { Repeat2, ArrowUpRight } from "lucide-react";
import {
  durationOptions,
  purchasePricing,
  currency,
  type Offer,
  type DurationOption,
} from "@catera/domain";
import { useApp } from "./context";
import { ActionForm, Dialog, Field } from "./ui";
import { Button, Checkbox } from "./form-controls";
import { NumericInput } from "./numeric-input";
import { useDiscardChanges } from "./journey-state";
export function PackageDurationEditor({ offer }: { offer: Offer }) {
  const { t, locale, perform } = useApp();
  const [options, setOptions] = useState<DurationOption[]>(
    durationOptions({ ...offer, multiCycleAvailable: true }),
  );
  const [revision, setRevision] = useState(
    offer.durationPricing?.revision ?? 0,
  );
  const [portions, setPortions] = useState(1);
  const [open, setOpen] = useState(false);
  const [committed, setCommitted] = useState(JSON.stringify(options));
  const [savedSession, setSavedSession] = useState<{
    revision: number;
    options: DurationOption[];
  } | null>(null);
  const dirty = open && JSON.stringify(options) !== committed;
  const guard = useDiscardChanges(dirty, () => setOpen(false));
  return (
    <>
      <Button
        className="duration-editor-trigger"
        variant="secondary"
        aria-haspopup="dialog"
        onClick={() => {
          const latest =
            savedSession &&
            savedSession.revision > (offer.durationPricing?.revision ?? 0)
              ? savedSession
              : {
                  revision: offer.durationPricing?.revision ?? 0,
                  options: durationOptions({
                    ...offer,
                    multiCycleAvailable: true,
                  }),
                };
          const saved = latest.options;
          setOptions(saved);
          setCommitted(JSON.stringify(saved));
          setRevision(latest.revision);
          setPortions(1);
          setOpen(true);
        }}
      >
        <Repeat2 size={18} aria-hidden="true" />{" "}
        {t("Durasi & diskon paket", "Duration options & savings")}
        <ArrowUpRight size={18} aria-hidden="true" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) guard.close();
        }}
        title={t("Durasi & diskon paket", "Duration options & savings")}
        description={offer.name}
        className="duration-dialog"
      >
        <div className="duration-editor">
          {dirty && (
            <p role="status" className="notice">
              {t("Perubahan belum disimpan", "Unsaved changes")}
            </p>
          )}
          {open && revision < (offer.durationPricing?.revision ?? 0) && (
            <p role="alert" className="notice">
              {t(
                "Harga telah diperbarui. Draf Anda tetap tersimpan di editor; salin perubahan sebelum membuang draf dan membuka versi terbaru.",
                "Pricing has changed. Your draft is retained in this editor; copy your changes before discarding and opening the latest version.",
              )}
            </p>
          )}
          <ActionForm
            submit={t("Simpan pilihan durasi", "Save duration options")}
            onSubmit={async () => {
              const saved = await perform<{ revision: number }>(
                "package.durationPricing.save",
                {
                  packageId: offer.id,
                  catererId: offer.catererId,
                  revision,
                  options,
                },
              );
              setRevision(saved.revision);
              setSavedSession({ revision: saved.revision, options });
              setOpen(false);
            }}
          >
            <p>
              1 {t("periode", "cycle")} = {offer.days}{" "}
              {t(
                "hari pengantaran. Kedua diskon ditanggung katerer; diskon durasi dihitung setelah diskon porsi.",
                "delivery days. Both discounts are seller-funded; multi-cycle savings apply after the portion discount.",
              )}
            </p>
            <div className="duration-example">
              <Field label={t("Contoh jumlah porsi", "Example portions")}>
                <NumericInput
                  min={1}
                  max={100}
                  value={portions}
                  onValueChange={setPortions}
                />
              </Field>
            </div>
            {[1, 2, 3, 4, 5, 6].map((cycles) => {
              const current = options.find((o) => o.cycles === cycles);
              let preview: ReturnType<typeof purchasePricing> | null = null;
              try {
                preview = current
                  ? purchasePricing(
                      {
                        ...offer,
                        multiCycleAvailable: true,
                        durationPricing: { revision, options },
                      },
                      portions,
                      cycles,
                    )
                  : null;
              } catch {
                /* An oversized example must not prevent saving valid options. */
              }
              return (
                <div className="duration-option" key={cycles}>
                  <label className="checkbox">
                    <Checkbox
                      checked={!!current}
                      disabled={cycles === 1}
                      onChange={(e) =>
                        setOptions(
                          e.target.checked
                            ? [...options, { cycles, discountPercent: 0 }].sort(
                                (a, b) => a.cycles - b.cycles,
                              )
                            : options.filter((o) => o.cycles !== cycles),
                        )
                      }
                    />
                    <span>
                      <span>
                        {cycles} {t("periode", "cycles")}
                      </span>
                      <small>
                        {cycles * offer.days}{" "}
                        {t("hari pengantaran", "delivery days")}
                      </small>
                    </span>
                  </label>
                  {current && (
                    <>
                      <Field
                        label={`${t("Diskon", "Discount")} · ${cycles} ${t("periode (%)", "cycles (%)")}`}
                      >
                        <NumericInput
                          min={0}
                          max={90}
                          step={0.01}
                          value={current.discountPercent}
                          disabled={cycles === 1}
                          onValueChange={(discountPercent) =>
                            setOptions(
                              options.map((o) =>
                                o.cycles === cycles
                                  ? { ...o, discountPercent }
                                  : o,
                              ),
                            )
                          }
                        />
                      </Field>
                      <output>
                        <small>{t("Total paket", "Package total")}</small>
                        <span>
                          {preview ? currency(preview.packageNet, locale) : "—"}
                        </span>
                      </output>
                    </>
                  )}
                </div>
              );
            })}
            <p className="small muted">
              {t(
                "Jadwal lengkap harus tersedia dalam 366 hari ke depan. Perubahan hanya berlaku untuk pembelian baru.",
                "The complete schedule must fit within the next 366 days. Changes apply only to new purchases.",
              )}
            </p>
          </ActionForm>
        </div>
      </Dialog>
      {guard.confirmation}
    </>
  );
}
export function DurationOptionsFields({
  days,
  options,
  onChange,
}: {
  days: number;
  options: DurationOption[];
  onChange: (options: DurationOption[]) => void;
}) {
  const { t } = useApp();
  return (
    <fieldset>
      <legend>
        {t("Durasi & diskon paket", "Duration options & savings")}
      </legend>
      <p>
        1 {t("periode", "cycle")} = {days}{" "}
        {t(
          "hari pengantaran. Diskon durasi ditanggung katerer dan dihitung setelah diskon porsi.",
          "delivery days. Multi-cycle discounts are seller-funded and apply after portion discounts.",
        )}
      </p>
      {[1, 2, 3, 4, 5, 6].map((cycles) => {
        const option = options.find((o) => o.cycles === cycles);
        return (
          <div className="duration-option" key={cycles}>
            <label className="checkbox">
              <Checkbox
                disabled={cycles === 1}
                checked={!!option}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...options, { cycles, discountPercent: 0 }].sort(
                          (a, b) => a.cycles - b.cycles,
                        )
                      : options.filter((o) => o.cycles !== cycles),
                  )
                }
              />
              {cycles} {t("periode", "cycles")} · {cycles * days}{" "}
              {t("hari", "days")}
            </label>
            {option && (
              <Field
                label={`${t("Diskon", "Discount")} ${cycles} ${t("periode (%)", "cycles (%)")}`}
              >
                <NumericInput
                  min={0}
                  max={90}
                  step={0.01}
                  disabled={cycles === 1}
                  value={option.discountPercent}
                  onValueChange={(discountPercent) =>
                    onChange(
                      options.map((o) =>
                        o.cycles === cycles ? { ...o, discountPercent } : o,
                      ),
                    )
                  }
                />
              </Field>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
