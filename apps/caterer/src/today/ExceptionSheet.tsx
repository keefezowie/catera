import { useState } from "react";
import { View } from "react-native";
import { errorLabel, type KitchenMeal, type SellerOperationsState, type Stop } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Field, fontFor, PressableScale, Sheet, Text, useColors } from "@catera/mobile-ui";
import { issueSteps } from "./exceptions";

/**
 * What customer.deliveryChange accepts for a new date: a day of the caterer's customer record that is
 * still scheduled, before its cutoff, in a package with flexible dates.
 */
export const canMoveDelivery = (d: SellerOperationsState["deliveries"][number] | undefined) =>
  !!(d?.customerRecordId ?? d?.customer.recordId) &&
  d!.status === "scheduled" &&
  d!.offer?.flexible === true &&
  new Date(d!.cutoff_at).getTime() > Date.now();

/** The meal's own status on that delivery; a meal with no row of its own counts as scheduled. */
const mealStatus = (d: SellerOperationsState["deliveries"][number] | undefined, meal: KitchenMeal) =>
  d?.meals.find((m) => m.meal === meal)?.status ?? "scheduled";

/**
 * Whether "Gagal diantar" would send anything: delivery.status walks a meal forward to "issue", so a meal that is
 * already delivered or failed has no steps and cannot be reported here.
 */
export const canReportFailed = (d: SellerOperationsState["deliveries"][number] | undefined, meal: KitchenMeal) =>
  !!d && issueSteps(mealStatus(d, meal)).length > 0;

/** The only per-stop actions: the food did not arrive, or the day moves (own customers). */
export function ExceptionSheet({
  stop,
  meal,
  ops,
  allowFailed = true,
  onClose,
}: {
  stop: Stop;
  meal: KitchenMeal;
  ops: SellerOperationsState;
  /** False for tomorrow's stops: food that hasn't been sent can't have failed. */
  allowFailed?: boolean;
  onClose: () => void;
}) {
  const { t, locale, command, actor } = useMobile();
  const c = useColors();
  const delivery = ops.deliveries.find((d) => d.id === stop.deliveryId)!;
  const canMove = canMoveDelivery(delivery);
  const canFail = allowFailed && canReportFailed(delivery, meal);
  // Null when the sheet has nothing to send; the caller shows no "…" then, so this is only a guard.
  const [kind, setKind] = useState<"failed" | "move" | null>(canFail ? "failed" : canMove ? "move" : null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nothing = t("Tidak ada yang bisa dilaporkan untuk alamat ini.", "There is nothing to report for this stop.");

  async function save() {
    const steps = issueSteps(mealStatus(delivery, meal));
    // Never close as if saved when nothing would be sent.
    if (kind === null || (kind === "failed" && !steps.length)) {
      setError(nothing);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (kind === "failed") {
        let version = delivery.version;
        for (const next of steps) {
          await command("delivery.status", { id: delivery.id, version, meal, status: next });
          version += 1;
        }
      } else
        await command("customer.deliveryChange", {
          catererId: actor?.catererId,
          id: delivery.id,
          version: delivery.version,
          date,
          reason: reason.trim(),
        });
      onClose();
    } catch (e) {
      setError(
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Belum tersimpan. Coba lagi.", "Not saved. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  const option = (value: "failed" | "move", title: string, body: string) => (
    <PressableScale
      haptic="select"
      accessibilityRole="radio"
      accessibilityState={{ checked: kind === value }}
      onPress={() => setKind(value)}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: kind === value ? 2 : 1,
        borderColor: kind === value ? c.forest : c.line,
        backgroundColor: kind === value ? c.sage : c.surface,
        gap: 2,
      }}
    >
      <Text style={{ fontFamily: fontFor("800") }}>{title}</Text>
      <Text variant="caption">{body}</Text>
    </PressableScale>
  );

  return (
    <Sheet visible onClose={onClose} title={stop.name} closeLabel={t("Tutup", "Close")}>
      <Text variant="caption">{`${stop.portions} porsi · ${stop.packageName}`}</Text>
      <View style={{ gap: 8 }}>
        {canFail && option(
          "failed",
          t("Gagal diantar", "Not delivered"),
          t(
            "Makanan tidak sampai. Hari ini tidak dihitung terkirim dan tidak dibayarkan ke Anda. Hubungi pelanggan untuk menggantinya.",
            "The food didn't arrive. This day isn't counted as delivered or paid to you. Contact the customer to make up for it.",
          ),
        )}
        {canMove
          ? option(
              "move",
              t("Pindah tanggal", "Move date"),
              t("Hari ini dipindah ke tanggal lain. Pelanggan diberi tahu.", "Move this day to another date. The customer is told."),
            )
          : null}
        {kind === null ? <Text>{nothing}</Text> : null}
      </View>
      {kind === "move" ? (
        <>
          <Field label={t("Tanggal baru (TTTT-BB-HH)", "New date (YYYY-MM-DD)")} value={date} onChangeText={setDate} />
          <Field label={t("Alasan", "Reason")} value={reason} onChangeText={setReason} />
        </>
      ) : null}
      {error ? <Text selectable style={{ color: c.danger }}>{error}</Text> : null}
      <Button
        label={t("Simpan laporan", "Save report")}
        disabled={busy || kind === null || (kind === "move" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || reason.trim().length < 5))}
        onPress={() => void save()}
      />
    </Sheet>
  );
}
