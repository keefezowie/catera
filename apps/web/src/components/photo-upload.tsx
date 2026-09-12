"use client";
import { useEffect, useRef, useState } from "react";
import { FileUpload } from "./file-upload";
import { useApp } from "./context";
import { Button } from "./form-controls";
import { Dialog } from "./ui";
import { Expand, Trash2, Check } from "lucide-react";

/** Keeps storage addresses internal and commits only successful uploads. */
export function PhotoUpload({
  label,
  value,
  onChange,
  onBusyChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState(false);
  const alive = useRef(true),
    abort = useRef<AbortController | null>(null);
  const callbacks = useRef({ onChange, onBusyChange });
  callbacks.current = { onChange, onBusyChange };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
      if (abort.current) callbacks.current.onBusyChange?.(false);
    };
  }, []);
  return (
    <div className="photo-upload">
      <div className="photo-upload-controls">
        {value && (
          <Button
            type="button"
            className="photo-thumbnail"
            aria-label={t("Lihat foto: ", "Preview photo: ") + label}
            onClick={() => setPreview(true)}
          >
            <img src={value} alt="" />
            <Expand size={18} aria-hidden="true" />
          </Button>
        )}
        <FileUpload
          compact
          label={label}
          actionLabel={
            value
              ? t("Ganti foto", "Replace photo")
              : t("Pilih file", "Choose file")
          }
          hint={t(
            "PNG, JPG atau WebP · maksimal 8 MB",
            "PNG, JPG or WebP · up to 8 MB",
          )}
          accept="image/png,image/jpeg,image/webp"
          busy={busy}
          onSelect={async (file) => {
            setError("");
            setSuccess(false);
            if (
              !file.size ||
              file.size > 8 * 1024 * 1024 ||
              !["image/png", "image/jpeg", "image/webp"].includes(file.type)
            ) {
              setError(
                t(
                  "Pilih PNG, JPG atau WebP berukuran maksimal 8 MB.",
                  "Choose a PNG, JPG or WebP up to 8 MB.",
                ),
              );
              return;
            }
            setBusy(true);
            callbacks.current.onBusyChange?.(true);
            const controller = new AbortController();
            abort.current = controller;
            try {
              const body = new FormData();
              body.set("file", file);
              const response = await fetch("/api/uploads", {
                method: "POST",
                body,
                signal: controller.signal,
              });
              if (!response.ok) throw Error("UPLOAD_FAILED");
              const result = await response.json();
              if (typeof result.data?.url !== "string")
                throw Error("UPLOAD_FAILED");
              if (alive.current) {
                callbacks.current.onChange(result.data.url);
                setSuccess(true);
              }
            } catch {
              if (alive.current)
                setError(
                  t(
                    "Foto belum berhasil diunggah. Pilih file untuk mencoba lagi.",
                    "Upload failed. Choose a file to retry.",
                  ),
                );
            } finally {
              abort.current = null;
              if (alive.current) {
                setBusy(false);
                callbacks.current.onBusyChange?.(false);
              }
            }
          }}
        />
      </div>
      {value && (
        <div className="photo-actions">
          <Button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              onChange("");
              setSuccess(false);
              setError("");
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
            {t("Hapus foto", "Remove photo")}
          </Button>
        </div>
      )}
      {(success || busy) && (
        <p role="status" className="save-status">
          {!busy && <Check size={17} aria-hidden="true" />}
          {busy
            ? t("Mengunggah foto…", "Uploading photo…")
            : t("Foto berhasil diunggah", "Photo uploaded successfully")}
        </p>
      )}
      {error && (
        <p role="alert" className="error-notice">
          {error}
        </p>
      )}
      <Dialog
        open={preview && !!value}
        onOpenChange={setPreview}
        title={label}
        description={t("Pratinjau foto lengkap.", "Full photo preview.")}
        className="photo-preview-dialog"
      >
        <img src={value} alt={label} />
      </Dialog>
    </div>
  );
}
