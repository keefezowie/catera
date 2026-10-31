import { View } from "react-native";
import { jakartaClock } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, Text } from "@catera/mobile-ui";
import { router } from "expo-router";
import { customerLink } from "../links";

type Pending = { href: string; until: string | null };

/**
 * This package's own checkout that is still to pay, if any: the action read names unpaid checkouts but not their
 * package, so each one (there are rarely more than one) is read for its quote. Any failed read gives none, so the page
 * never blocks a purchase on a guess.
 */
export function usePendingPurchase(packageId: string): Pending | null {
  const { runtime, actor } = useMobile();
  const actorId = actor?.id;
  const read = useData<Pending | null>(`paket-pending:${packageId}:${actorId ?? ""}`, async () => {
    if (!actorId) return null;
    const feed = await runtime.api.customerActions(20);
    const now = Date.now();
    for (const item of feed.items) {
      if (item.kind !== "payment_action" || !["choose_method", "awaiting_payment"].includes(item.status)) continue;
      if (!item.dueAt || Date.parse(item.dueAt) <= now) continue;
      const checkout = await runtime.api.checkout(item.id.replace(/^payment-/, ""));
      if (checkout?.quote?.packageId === packageId) return { href: item.href, until: jakartaClock(item.dueAt) };
    }
    return null;
  });
  return read.error ? null : (read.data ?? null);
}

/** "Pembayaran paket ini belum selesai": the way back to Bayar instead of buying the same package twice. */
export function PendingPurchaseCard({ pending }: { pending: Pending }) {
  const { t } = useMobile();
  return (
    <Card tone="attention" testID="paket-pending" style={{ gap: 12 }}>
      <View accessibilityRole="summary" style={{ gap: 4 }}>
        <Text variant="rowTitle">{t("Pembayaran paket ini belum selesai", "This package's payment isn't finished")}</Text>
        <Text variant="meta">
          {[
            t("Jadwalnya masih kami tahan. Lanjutkan saja, tidak perlu beli lagi.", "We're still holding the schedule. Just continue; no need to buy again."),
            pending.until ? t(`Bayar sebelum ${pending.until}.`, `Pay before ${pending.until}.`) : "",
          ]
            .filter(Boolean)
            .join(" ")}
        </Text>
      </View>
      {/* Bayar is a modal over the whole app, so it opens over the package page from any tab. */}
      <Button label={t("Lanjutkan bayar", "Continue paying")} onPress={() => router.push(customerLink(pending.href) as never)} />
    </Card>
  );
}
