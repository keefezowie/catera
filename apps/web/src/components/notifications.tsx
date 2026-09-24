"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { type CustomerState } from "@catera/domain";
import { api, useApp, useResource, useWorkspaceDraft } from "./context";
import { Heading, ErrorNotice, RefreshNotice, Loading, Empty } from "./ui";
import { Button } from "./form-controls";
import { useJourneyQuery } from "./journey-state";

export function Notifications({ seller = false }: { seller?: boolean }) {
  const { t, locale, perform } = useApp();
  const { query } = useJourneyQuery();
  const state = useResource<CustomerState>("notifications", () =>
    api.customer(),
  );
  const [failed, setFailed] = useWorkspaceDraft<string[]>(
    "notification-read-failures",
    [],
  );
  const [pending, setPending] = useState<string[]>([]);
  const back = query.get("from") || "";
  const returnTo =
    /^\/seller(?:\/|\?|$)/.test(back) && !back.includes("\\")
      ? back
      : "/seller";
  async function markRead(id: string) {
    if (pending.includes(id)) return;
    setPending((value) => [...value, id]);
    try {
      await perform("notification.read", { id });
      setFailed((previous) => previous.filter((item) => item !== id));
    } catch {
      setFailed((previous) => [...new Set([...previous, id])]);
    } finally {
      setPending((value) => value.filter((item) => item !== id));
    }
  }
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  return (
    <div className={seller ? "notifications-page" : "content narrow-wide"}>
      <Heading title={t("Kabar untukmu", "Updates for you")} />
      {seller && (
        <Link className="button secondary" href={returnTo}>
          {t("Kembali ke operasional", "Return to operations")}
        </Link>
      )}
      <RefreshNotice error={state.error} reload={state.reload} />
      {state.data.notifications.map((n) => (
        <div
          className={"notification " + (!n.read_at ? "unread" : "")}
          key={n.id}
        >
          <Bell size={19} aria-hidden="true" />
          <div>
            <Link
              onClick={() => {
                if (!n.read_at) void markRead(n.id);
              }}
              href={
                n.href.startsWith("/") &&
                !n.href.startsWith("//") &&
                !n.href.includes("\\")
                  ? n.href
                  : seller
                    ? "/seller"
                    : "/home"
              }
            >
              <strong>{n.body}</strong>
              <small>
                {new Date(n.created_at).toLocaleString(
                  locale === "id" ? "id-ID" : "en-GB",
                )}
              </small>
            </Link>
            {!n.read_at && (
              <Button
                variant="secondary"
                disabled={pending.includes(n.id)}
                onClick={() => void markRead(n.id)}
              >
                {t("Tandai dibaca", "Mark as read")}
              </Button>
            )}
            {failed.includes(n.id) && (
              <ErrorNotice
                message={t(
                  "Status baca belum tersimpan. Coba lagi; tautan tetap dapat dibuka.",
                  "Read status was not saved. Try again; the task link remains available.",
                )}
                retry={() => void markRead(n.id)}
              />
            )}
          </div>
        </div>
      ))}
      {!state.data.notifications.length && (
        <Empty title={t("Belum ada kabar baru", "No new updates yet")} />
      )}
    </div>
  );
}
