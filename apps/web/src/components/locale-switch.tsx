"use client";

import type { Locale } from "@catera/domain";
import { useApp } from "./context";
import { Select, SelectOption } from "./select";

export function LocaleSwitch({
  className = "locale-switch",
}: {
  className?: string;
}) {
  const { locale, setLocale, t } = useApp();

  return (
    <Select
      className={className}
      aria-label={t("Bahasa", "Language")}
      value={locale}
      displayValue={locale.toUpperCase()}
      onValueChange={(value) => setLocale(value as Locale)}
    >
      <SelectOption value="id">Bahasa Indonesia</SelectOption>
      <SelectOption value="en">English</SelectOption>
    </Select>
  );
}
