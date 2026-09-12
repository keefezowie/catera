"use client";
import { useId, useState } from "react";
import { Plus, X, Tags } from "lucide-react";
import { Button, TextInput } from "./form-controls";
import { useApp } from "./context";

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useApp();
  const id = useId();
  const [draft, setDraft] = useState("");
  function add() {
    const tag = draft.trim();
    if (
      tag &&
      !value.some((v) => v.toLocaleLowerCase() === tag.toLocaleLowerCase())
    )
      onChange([...value.filter(Boolean), tag]);
    setDraft("");
  }
  return (
    <div className="tag-input" data-editor-field="tags">
      <label htmlFor={id}>
        <Tags size={18} aria-hidden="true" />
        {t("Label pencarian (opsional)", "Search labels (optional)")}
      </label>
      <div className="tag-chips">
        {value.filter(Boolean).map((tag, i) => (
          <span key={i}>
            {tag}
            <Button
              type="button"
              variant="icon"
              aria-label={t("Hapus label ", "Remove label ") + tag}
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </span>
        ))}
      </div>
      <div className="tag-entry">
        <TextInput
          id={id}
          value={draft}
          maxLength={40}
          placeholder={t("Contoh: Rumahan", "Example: Homestyle")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          variant="secondary"
          type="button"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Plus size={18} aria-hidden="true" />
          {t("Tambah", "Add")}
        </Button>
      </div>
      <small>
        {t(
          "Membantu pelanggan menemukan paket. Isi hidangan diatur di bawah.",
          "Helps customers find this package. Dish categories are set below.",
        )}
      </small>
    </div>
  );
}
