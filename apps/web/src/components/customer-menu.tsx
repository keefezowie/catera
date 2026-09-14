"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { localDay, type CustomerState } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { MenuCalendar } from "./menu-calendar";
import { Empty, ErrorNotice, Loading } from "./ui";
export function CustomerMenu({ id }: { id: string }) {
  const { t } = useApp();
  const query = useSearchParams();
  const state = useResource<CustomerState>(
    "customer-menu-subscription:" + id,
    () => api.customer(),
  );
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  const subscription = state.data.subscriptions.find((s) => s.id === id);
  if (
    !subscription ||
    subscription.snapshot.offer.menuSelectionMode !== "customer"
  )
    return <Empty title={t("Menu tidak tersedia", "Menu unavailable")} />;
  const requestedDate = query.get("date");
  const date =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : subscription.starts_on > localDay()
        ? subscription.starts_on
        : localDay();
  return (
    <div className="content narrow-wide">
      <Link href={"/subscriptions/" + id}>
        {t("Kembali ke paket", "Back to package")}
      </Link>
      <h1>{t("Pilih menu sendiri", "Choose your menu")}</h1>
      <MenuCalendar key={id} subscription={subscription} date={date} />
    </div>
  );
}
