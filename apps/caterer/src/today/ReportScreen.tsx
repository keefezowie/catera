import { useState } from "react";
import { Linking, View } from "react-native";
import {
  addDays,
  errorLabel,
  jakartaDay,
  mealLabel,
  shortDate,
  whatsappUrl,
  type DeliveryIssue,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, Screen, Text } from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";

/** The server needs at least this much text for a reply or a resolution note. */
const MIN_BODY = 5;
/** What "Tandai selesai" sends when nothing is typed. Always Indonesian: the customer reads it, whatever the caterer's language. */
const RESOLVE_NOTE = "Masalah ini sudah kami tangani.";

/** Plain status words, the same ones the customer sees on their report. */
export function reportStatus(status: string, t: (id: string, en: string) => string): string {
  switch (status) {
    case "responded":
      return t("Dibalas", "Replied");
    case "escalated":
      return t("Ditinjau Catera", "Catera is reviewing");
    case "resolved":
      return t("Selesai", "Done");
    default:
      return t("Terkirim", "Sent");
  }
}

/** "Kamis 8 Okt 12.40" in Jakarta time. */
const sentAt = (iso: string, locale: "id" | "en") => `${shortDate(jakartaDay(new Date(iso)), locale)} ${jakartaClock(iso)}`;

const eventLabels: Record<string, [string, string]> = {
  "deliveryIssue.respond": ["Balasan", "Reply"],
  "deliveryIssue.resolve": ["Ditandai selesai", "Marked done"],
  "deliveryIssue.escalate": ["Pelanggan minta Catera meninjau", "The customer asked Catera to review"],
  "support.resolve": ["Keputusan Catera", "Catera's decision"],
};

/** One customer's delivery report: what they said, and the caterer's reply or "done". */
export function ReportScreen({ id }: { id: string }) {
  const { runtime, actor, t } = useMobile();
  const catererId = actor?.catererId ?? "";
  const issues = useData(`issue:${catererId}:${id}`, () =>
    runtime.api.request<DeliveryIssue[]>(`delivery-issues?${new URLSearchParams({ id: catererId, issue: id })}`),
  );
  if (!issues.data)
    return (
      <Screen>
        {issues.error ? (
          <>
            <Text style={{ color: colors.danger }}>{issues.error}</Text>
            <Button label={t("Coba lagi", "Try again")} onPress={() => void issues.reload()} />
          </>
        ) : (
          <Text variant="caption">{t("Memuat…", "Loading…")}</Text>
        )}
      </Screen>
    );
  const issue = issues.data.find((i) => i.id === id);
  if (!issue)
    return (
      <Screen>
        <Text>{t("Laporan ini tidak ditemukan.", "This report was not found.")}</Text>
      </Screen>
    );
  // No key on the version: a reload after a refused action keeps the typed reply and the message.
  return <Report issue={issue} reload={issues.reload} />;
}

function Report({ issue: i, reload }: { issue: DeliveryIssue; reload: () => Promise<void> }) {
  const { t, locale, command } = useMobile();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Catera has taken over (or it is closed): the caterer can no longer change it here.
  const open = !i.case_id && (i.status === "open" || i.status === "responded");
  const replies = (i.events ?? []).filter((e) => eventLabels[e.action]);
  const reply = text.trim();

  // The customer may ask Catera to review an unanswered report from 12.00 Jakarta the day after it was sent.
  const sentDay = jakartaDay(new Date(i.created_at));
  const reviewFrom = new Date(`${addDays(sentDay, 1)}T12:00:00+07:00`);
  const hint =
    i.status !== "open" || i.case_id
      ? ""
      : new Date() >= reviewFrom
        ? t("Pelanggan sudah bisa meminta Catera meninjau. Balas sekarang.", "The customer can now ask Catera to review. Reply now.")
        : sentDay === jakartaDay(new Date())
          ? t("Balas sebelum besok 12.00, sebelum pelanggan bisa meminta Catera meninjau.", "Reply before tomorrow 12.00, before the customer can ask Catera to review.")
          : t("Balas sebelum hari ini 12.00, sebelum pelanggan bisa meminta Catera meninjau.", "Reply before today 12.00, before the customer can ask Catera to review.");

  // 1 to 4 characters: too short to send, and not empty enough to mean "use the standard note".
  const tooShort = reply.length > 0 && reply.length < MIN_BODY;

  async function act(action: "deliveryIssue.respond" | "deliveryIssue.resolve") {
    const body = action === "deliveryIssue.resolve" && !reply ? RESOLVE_NOTE : reply;
    if (busy || body.length < MIN_BODY) return;
    setBusy(true);
    setError("");
    try {
      // The new version comes back with the reload that every command triggers.
      await command(action, { id: i.id, version: i.version, body });
      setText("");
    } catch (e) {
      setError(
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Belum terkirim. Coba lagi.", "Not sent. Try again."),
      );
      // A refused action usually means the report changed (a reply elsewhere, or the customer asked
      // Catera): fetch it again so the next tap sends the current version.
      void reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="title">{i.customerName || t("Pelanggan", "Customer")}</Text>
        <Text style={{ fontWeight: "800" }}>{`${shortDate(i.service_date, locale)} · ${mealLabel(i.meal, locale)}`}</Text>
        <Text variant="caption">{i.package_name}</Text>
      </View>
      <Card tone={open ? "attention" : "surface"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="heading" style={{ flex: 1 }}>
            {i.subject}
          </Text>
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.sage }}>
            <Text variant="label" style={{ color: colors.forest }}>
              {reportStatus(i.status, t)}
            </Text>
          </View>
        </View>
        {i.description ? <Text>{i.description}</Text> : null}
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {`${t("Dikirim", "Sent")} ${sentAt(i.created_at, locale)}`}
        </Text>
      </Card>
      {replies.map((e) => (
        <Card key={e.id}>
          <Text variant="label">{t(...eventLabels[e.action])}</Text>
          <Text>{e.body}</Text>
          <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
            {sentAt(e.created_at, locale)}
          </Text>
        </Card>
      ))}
      {open ? (
        <>
          {hint ? <Text variant="caption">{hint}</Text> : null}
          <Field
            label={t("Balasan untuk pelanggan", "Reply to the customer")}
            multiline
            value={text}
            onChangeText={setText}
            maxLength={2000}
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
          />
          {tooShort ? (
            <Text variant="caption" style={{ color: colors.sunriseInk }}>
              {t("Tulis minimal 5 karakter.", "Write at least 5 characters.")}
            </Text>
          ) : null}
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <Button
            label={t("Balas", "Reply")}
            disabled={busy || reply.length < MIN_BODY}
            onPress={() => void act("deliveryIssue.respond")}
          />
          <Button
            variant="secondary"
            label={t("Tandai selesai", "Mark as done")}
            disabled={busy || tooShort}
            onPress={() => void act("deliveryIssue.resolve")}
          />
          {!reply ? (
            <Text variant="caption">{`${t("Pelanggan akan menerima", "The customer will receive")}: “${RESOLVE_NOTE}”`}</Text>
          ) : null}
        </>
      ) : (
        <Text variant="caption">
          {i.status === "resolved"
            ? t("Laporan ini sudah selesai.", "This report is done.")
            : t("Catera sedang meninjau laporan ini.", "Catera is reviewing this report.")}
        </Text>
      )}
      {/* After a refused action the report may have closed meanwhile: the reason still shows. */}
      {error && !open ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {i.customerPhone ? (
        <Button
          variant="secondary"
          label={t("Chat WhatsApp", "WhatsApp chat")}
          onPress={() => void Linking.openURL(whatsappUrl("", i.customerPhone!))}
        />
      ) : null}
    </Screen>
  );
}
