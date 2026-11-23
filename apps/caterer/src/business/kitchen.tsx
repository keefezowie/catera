import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, fontFor, FormError, Text, useColors } from "@catera/mobile-ui";
import { pushScreen } from "../nav";
import { useFormRun } from "../useFormRun";

type T = (id: string, en: string) => string;

/** Customers see a kitchen's packages only once Catera has approved the kitchen (`catalog` reads `c.status = 'approved'`). */
export const kitchenLive = (status: string | undefined) => status === "approved";

/** `seller.submit` moves a kitchen to review from these two states only. */
export const canAskReview = (status: string | undefined) => status === "draft" || status === "corrections";

/** A package's word in Dapur: "tayang" only when customers can really see it, so a live package in an unapproved kitchen never claims it. */
export function packageState(offerStatus: string, kitchenStatus: string | undefined, t: T) {
  if (offerStatus === "suspended") return t("dijeda", "paused");
  if (offerStatus !== "published") return t("draf", "draft");
  return kitchenLive(kitchenStatus) ? t("tayang", "live") : t("belum tampil", "not shown yet");
}

/** The reviewer's note, set apart inside a card. */
export function ReviewNote({ note }: { note: string }) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <View testID="review-note" style={{ backgroundColor: c.surface, borderRadius: nativeLayout.radius.thumb, borderCurve: "continuous", padding: nativeLayout.space.md, gap: 4 }}>
      <Text variant="meta" style={{ fontFamily: fontFor("700") }}>
        {t("Catatan tim Catera", "Note from the Catera team")}
      </Text>
      <Text selectable>{note}</Text>
    </View>
  );
}

/** Asks Catera to review the kitchen; the command bumps the data revision, so every read of the kitchen refreshes. */
export function useAskReview(onSent?: () => void) {
  const { actor, t, locale, command } = useMobile();
  const form = useFormRun(locale, t("Belum bisa dikirim. Coba lagi.", "Couldn't send it. Try again."));
  const ask = () =>
    form.run(async () => {
      await command("seller.submit", { catererId: actor?.catererId ?? "" });
      onSent?.();
    });
  return { ...form, ask };
}

function StepItem({ done, active, label, detail }: { done: boolean; active?: boolean; label: string; detail?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons
        name={done ? "checkmark-circle" : active ? "ellipse" : "ellipse-outline"}
        size={18}
        color={done || active ? c.forest : c.muted}
        accessible={false}
        importantForAccessibility="no"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant={active ? "bodyStrong" : "meta"} style={{ color: done || active ? c.charcoal : c.muted }}>
          {label}
        </Text>
        {detail ? <Text variant="meta">{detail}</Text> : null}
      </View>
    </View>
  );
}

/**
 * The top of Usaha until the kitchen is approved: a clear 4-step go-live checklist plus the one next action for its status.
 * An approved kitchen draws nothing.
 */
export function KitchenStatusCard({
  status,
  reviewNote,
  packages,
  paymentsActive = false,
}: {
  status: string | undefined;
  reviewNote?: string | null;
  packages: number;
  paymentsActive?: boolean;
}) {
  const { t } = useMobile();
  const review = useAskReview();
  if (kitchenLive(status)) return null;
  const note = reviewNote?.trim() ? <ReviewNote note={reviewNote.trim()} /> : null;
  const failure = review.failure ? <FormError message={review.failure.message} failureKey={review.failure.key} /> : null;

  const checklist = (
    <View testID="kitchen-checklist" style={{ gap: 6, paddingVertical: 4 }}>
      <StepItem done label={t("1. Buka dapur", "1. Open kitchen")} />
      <StepItem
        done={packages > 0}
        active={packages === 0}
        label={t("2. Buat paket pertama", "2. Create your first package")}
      />
      <StepItem
        done={false}
        active={packages > 0 && (status === "draft" || status === "corrections" || status === "submitted")}
        label={t("3. Verifikasi tim Catera", "3. Catera team review")}
        detail={
          status === "submitted"
            ? t("Sedang diperiksa", "Under review")
            : status === "corrections"
              ? t("Perlu perbaikan", "Needs changes")
              : undefined
        }
      />
      <StepItem
        done={paymentsActive}
        label={t("4. Aktifkan pembayaran", "4. Turn on payments")}
        detail={t("Setelah dapur disetujui", "After your kitchen is approved")}
      />
    </View>
  );

  if (status === "submitted")
    return (
      <Card testID="kitchen-status">
        <Text variant="section">{t("Sedang ditinjau tim Catera", "The Catera team is reviewing it")}</Text>
        <Text>
          {t(
            "Paketmu tampil untuk pelanggan setelah disetujui. Sambil menunggu, kamu bisa terus menyiapkan menu.",
            "Your packages show to customers once approved. You can keep preparing menus meanwhile.",
          )}
        </Text>
        {checklist}
      </Card>
    );
  if (status === "suspended")
    return (
      <Card testID="kitchen-status" tone="attention">
        <Text variant="section">{t("Dapurmu sedang dinonaktifkan", "Your kitchen is suspended")}</Text>
        <Text>{t("Untuk sementara pelanggan tidak bisa melihat atau memesan paketmu.", "For now customers can't see or order your packages.")}</Text>
        {note}
        <Text variant="meta">{t("Hubungi tim Catera untuk mengaktifkannya lagi.", "Contact the Catera team to turn it back on.")}</Text>
      </Card>
    );
  if (status === "corrections")
    return (
      <Card testID="kitchen-status" tone="attention">
        <Text variant="section">{t("Ada yang perlu diperbaiki", "Something needs fixing")}</Text>
        <Text>{t("Pelanggan belum bisa melihat dapurmu. Perbaiki dulu, lalu kirim lagi untuk diperiksa.", "Customers can't see your kitchen yet. Fix it, then send it for review again.")}</Text>
        {note}
        {checklist}
        <Button label={t("Kirim lagi untuk diperiksa", "Send for review again")} busy={review.busy} onPress={() => void review.ask()} />
        {failure}
      </Card>
    );
  // Draft, and any status this app does not know yet: customers cannot see the kitchen.
  return (
    <Card testID="kitchen-status" tone="attention">
      <Text variant="section">{t("Pelanggan belum bisa melihat dapurmu", "Customers can't see your kitchen yet")}</Text>
      {checklist}
      {packages ? (
        <>
          <Text>
            {t(
              "Tim Catera memeriksa profil dan paketmu dulu. Setelah disetujui, paketmu tampil untuk pelanggan.",
              "The Catera team checks your profile and packages first. Once approved, your packages show to customers.",
            )}
          </Text>
          <Button label={t("Minta diperiksa", "Ask for a review")} busy={review.busy} onPress={() => void review.ask()} />
          {failure}
        </>
      ) : (
        <>
          <Text>{t("Buat paket pertamamu, lalu minta tim Catera memeriksanya.", "Create your first package, then ask the Catera team to review it.")}</Text>
          <Button label={t("Buat paket pertama", "Create your first package")} onPress={() => pushScreen("/paket/baru")} />
        </>
      )}
    </Card>
  );
}
