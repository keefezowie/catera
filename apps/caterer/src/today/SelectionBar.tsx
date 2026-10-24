import { View } from "react-native";
import { router } from "expo-router";
import { errorLabel, type KitchenSession, type SellerOperationsState } from "@catera/domain";
import { useMobile, useTrack } from "@catera/mobile-core";
import { Button, Text, useBusy, useConfirm, useHaptic, useStackedLayout, useToast } from "@catera/mobile-ui";
import { parkDay } from "./ExceptionSheet";
import { proofHref } from "./ProofSheet";
import { selectedFor, type Selection } from "./selection";

/**
 * The bar above the tab bar while "Pilih" is on (spec 5.7): "Berangkat (n)" for the selected stops that are cooking and
 * "Sampai (n)" for the ones on their way. Each counts only the stops it can take, so a stop that has already left is
 * not part of Berangkat, and a button with nothing to do waits. Berangkat asks first (customers are told) and goes
 * through `delivery.depart` with exactly these stops; Sampai opens the proof-photo sheet. A failure is a `FormError`
 * at the bar with "Coba lagi". The caption line ("Pilih pengantaran dulu.") keeps its room once something is selected, so
 * the bar never changes height.
 */
export function SelectionBar({
  ops,
  session,
  catererId,
  date,
  selection,
  onFailed,
}: {
  ops: SellerOperationsState;
  session: KitchenSession;
  catererId: string;
  date: string;
  selection: Selection;
  onFailed: () => void;
}) {
  const { t, locale, command } = useMobile();
  const track = useTrack();
  const haptic = useHaptic();
  const confirm = useConfirm();
  const { meal } = session;
  const depart = selectedFor(session.stops, selection.selected, "depart");
  const arrive = selectedFor(session.stops, selection.selected, "arrive");
  const toast = useToast();

  // `again` is a retry from the error toast: it carries the stops that failed, and the question was answered already.
  const [busy, leave] = useBusy(async (again?: string[]) => {
    if (!again && !depart.length) return;
    const go = !!again || await confirm({
      title: t(`Berangkat dengan ${depart.length} pengantaran?`, `Head out with ${depart.length} ${depart.length === 1 ? "delivery" : "deliveries"}?`),
      message: t(
        "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
        "Customers using the Catera app get a notification when you head out.",
      ),
      cancelLabel: t("Batal", "Cancel"),
      confirmLabel: t("Berangkat", "Head out"),
      icon: "rantang",
    });
    if (!go) return;
    const ids = again ?? depart.map((s) => s.deliveryId);
    try {
      await command("delivery.depart", { catererId, date, meal, fulfillmentIds: ids });
      haptic.success();
      track("depart_tapped");
      selection.stop();
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      toast.show({
        tone: "error",
        action: { label: t("Coba lagi", "Try again"), onPress: () => void leave(ids) },
        message:
          errorLabel(code, locale) || t("Belum bisa menandai berangkat. Coba lagi.", "Could not mark them as out for delivery. Try again."),
      });
      onFailed();
    }
  });

  const openProof = () => {
    if (!arrive.length) return;
    parkDay(catererId, date, ops);
    router.push(proofHref(arrive.map((s) => s.deliveryId), meal, date) as never);
  };

  // Large text or a narrow phone: the buttons stack so "Berangkat (n)" keeps one line.
  const stacked = useStackedLayout(340);
  return (
    <View testID="selection-bar" style={{ gap: 8 }}>
      {/* The line's room is kept whether or not it has words, so the bar is one height from 0 to n selected. */}
      <View testID="selection-caption" style={{ minHeight: 18 }}>
        {selection.selected.size === 0 ? <Text variant="meta">{t("Pilih pengantaran dulu.", "Select deliveries first.")}</Text> : null}
      </View>
      <View testID="selection-actions" style={{ flexDirection: stacked ? "column" : "row", gap: 8 }}>
        <Button
          style={stacked ? undefined : { flex: 1 }}
          label={t(`Berangkat (${depart.length})`, `Head out (${depart.length})`)}
          disabled={!depart.length}
          busy={busy}
          onPress={() => void leave()}
        />
        <Button
          style={stacked ? undefined : { flex: 1 }}
          variant="secondary"
          label={t(`Sampai (${arrive.length})`, `Arrived (${arrive.length})`)}
          disabled={!arrive.length || busy}
          onPress={openProof}
        />
      </View>
    </View>
  );
}
