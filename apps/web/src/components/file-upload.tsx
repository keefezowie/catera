"use client";

import { useId, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { useApp } from "./context";
import { FileInput } from "./form-controls";

/** Single-file picker. The caller owns upload, validation, and error handling. */
export function FileUpload({
  label,
  accept,
  hint,
  actionLabel,
  disabled = false,
  busy = false,
  onSelect,
}: {
  label: string;
  accept?: string;
  hint?: string;
  actionLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  onSelect: (file: File) => void | Promise<void>;
}) {
  const id = useId();
  const { t } = useApp();
  const [filename, setFilename] = useState("");
  return (
    <div className="field">
      <label htmlFor={id} className="file-upload-label">
        {label}
      </label>
      <div
        className="file-upload"
        aria-busy={busy}
        data-disabled={disabled || busy}
      >
        <FileInput
          id={id}
          accept={accept}
          disabled={disabled || busy}
          aria-describedby={`${id}-status${hint ? ` ${id}-hint` : ""}`}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            setFilename(file.name);
            void onSelect(file);
          }}
        />
        <span className="file-upload-action" aria-hidden="true">
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Upload size={18} />
          )}
          {busy
            ? t("Mengunggah…", "Uploading…")
            : actionLabel || t("Pilih file", "Choose file")}
        </span>
        <span
          className="file-upload-name"
          id={`${id}-status`}
          role="status"
          title={filename}
        >
          {filename || t("Belum ada file dipilih", "No file selected")}
        </span>
      </div>
      {hint && (
        <small className="field-hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}
