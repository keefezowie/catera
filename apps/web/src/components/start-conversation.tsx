"use client";
import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { api, useApp, useResource, useWorkspaceDraft } from "./context";
import { useDiscardChanges } from "./journey-state";
import { Button, TextArea, TextInput } from "./form-controls";
import { ActionForm, Dialog, Field, ErrorNotice, Loading } from "./ui";
type Recipient = { id: string; name: string; user_id: string | null };
export function StartConversation({
  onStarted,
  disabled = false,
}: {
  onStarted: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useWorkspaceDraft<Record<string, string>>(
    "first-message-drafts",
    {},
  );
  const guard = useDiscardChanges(
    open && Object.values(drafts).some((value) => !!value.trim()),
    () => {
      setDrafts({});
      setOpen(false);
    },
  );
  return (
    <>
      <Button
        className="start-conversation-button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={17} />
        {t("Mulai percakapan", "Start conversation")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => (value ? setOpen(true) : guard.close())}
        title={t("Mulai percakapan", "Start conversation")}
      >
        {open && (
          <RecipientPicker
            onStarted={(id) => {
              onStarted(id);
              setOpen(false);
            }}
          />
        )}
      </Dialog>
      {guard.confirmation}
    </>
  );
}
function RecipientPicker({ onStarted }: { onStarted: (id: string) => void }) {
  const { t, actor, perform } = useApp();
  const [drafts, setDrafts] = useWorkspaceDraft<Record<string, string>>(
    "first-message-drafts",
    {},
  );
  const [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [recipient, setRecipient] = useState<Recipient | null>(null);
  const [sending, setSending] = useState(false);
  const resource = useResource<{ items: Recipient[]; total: number }>(
    `recipients:${actor!.catererId}:${search}:${offset}`,
    () =>
      api.request(
        `message-customers/${actor!.catererId}?search=${encodeURIComponent(search)}&offset=${offset}`,
      ),
  );
  return (
    <>
      <Field label={t("Cari pelanggan", "Search customers")}>
        <TextInput
          type="search"
          disabled={sending}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
      </Field>
      {resource.error && (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      )}
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data?.items.map((c) => (
          <div className="request-row" key={c.id}>
            {c.user_id ? (
              <Button
                aria-pressed={recipient?.id === c.id}
                disabled={sending}
                className="button secondary"
                onClick={() => setRecipient(c)}
              >
                {c.name}
              </Button>
            ) : (
              <>
                <strong>{c.name}</strong>
                <p>
                  {t(
                    "Belum terhubung ke akun Catera.",
                    "Not linked to a Catera account yet.",
                  )}
                </p>
                <Link href={`/seller/customers?customerRecordId=${c.id}`}>
                  {actor?.role === "owner"
                    ? t("Undang pelanggan", "Invite customer")
                    : t(
                        "Lihat pelanggan · undangan oleh pemilik",
                        "View customer · owner can invite",
                      )}
                </Link>
              </>
            )}
          </div>
        ))
      )}
      {!resource.loading && resource.data?.total === 0 && (
        <p>{t("Pelanggan tidak ditemukan.", "No matching customers.")}</p>
      )}
      <div className="action-row">
        <Button
          disabled={sending || offset === 0 || resource.loading}
          onClick={() => setOffset((v) => Math.max(0, v - 25))}
        >
          {t("Sebelumnya", "Previous")}
        </Button>
        <Button
          disabled={
            sending ||
            resource.loading ||
            offset + 25 >= (resource.data?.total || 0)
          }
          onClick={() => setOffset((v) => v + 25)}
        >
          {t("Berikutnya", "Next")}
        </Button>
      </div>
      {recipient && (
        <ActionForm
          key={recipient.id}
          onPendingChange={setSending}
          submit={t("Kirim pesan pertama", "Send first message")}
          onSubmit={async (f) => {
            const result = await perform<{ id: string }>("message.send", {
              catererId: actor!.catererId,
              customerRecordId: recipient.id,
              body: f.get("body"),
            });
            setDrafts((previous) => ({ ...previous, [recipient.id]: "" }));
            onStarted(result.id);
          }}
        >
          <h3>{recipient.name}</h3>
          <Field label={t("Pesan", "Message")}>
            <TextArea
              name="body"
              value={drafts[recipient.id] || ""}
              onChange={(event) =>
                setDrafts({ ...drafts, [recipient.id]: event.target.value })
              }
              required
              minLength={1}
              maxLength={2000}
            />
          </Field>
        </ActionForm>
      )}
    </>
  );
}
