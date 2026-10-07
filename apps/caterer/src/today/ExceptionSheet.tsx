import { useState } from "react";
import { Pressable, View } from "react-native";
import { errorLabel, type KitchenMeal, type SellerOperationsState, type Stop } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, colors, Field, Sheet, Text } from "@catera/mobile-ui";
import { issueSteps } from "./exceptions";

/** The only per-stop actions: the food did not arrive, or the day moves (own customers). */
export function ExceptionSheet({
  stop,
  meal,
  ops,
  onClose,
}: {
  stop: Stop;
  meal: KitchenMeal;
  ops: SellerOperationsState;
  onClose: () => void;
}) {
  const { t, locale, command, actor } = useMobile();
  const delivery = ops.deliveries.find((d) => d.id === stop.deliveryId)!;
  const canMove =
    !!delivery.customer.recordId && new Date(delivery.cutoff_at).getTime() > Date.now();
  const [kind, setKind] = useState<"failed" | "move">("failed");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (kind === "failed") {
        const status = delivery.meals.find((m) => m.meal === meal)?.status ?? "scheduled";
        let version = delivery.version;
        for (const next of issueSteps(status)) {
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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: kind === value }}
      onPress={() => setKind(value)}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: kind === value ? 2 : 1,
        borderColor: kind === value ? colors.forest : colors.line,
        backgroundColor: kind === value ? colors.sage : colors.surface,
        gap: 2,
      }}
    >
      <Text style={{ fontWeight: "800" }}>{title}</Text>
      <Text variant="caption">{body}</Text>
    </Pressable>
  );

  return (
    <Sheet visible onClose={onClose} title={stop.name}>
      <Text variant="caption">{`${stop.portions} porsi · ${stop.packageName}`}</Text>
      <View style={{ gap: 8 }}>
        {option(
          "failed",
          t("Gagal diantar", "Not delivered"),
          t(
            "Makanan tidak sampai. Pelanggan dan tim Catera diberi tahu; pengembalian dana diurus Catera.",
            "The food didn't arrive. The customer and Catera are told; Catera handles refunds.",
          ),
        )}
        {canMove
          ? option(
              "move",
              t("Pindah tanggal", "Move date"),
              t("Hari ini dipindah ke tanggal lain. Pelanggan diberi tahu.", "Move this day to another date. The customer is told."),
            )
          : null}
      </View>
      {kind === "move" ? (
        <>
          <Field label={t("Tanggal baru (TTTT-BB-HH)", "New date (YYYY-MM-DD)")} value={date} onChangeText={setDate} />
          <Field label={t("Alasan", "Reason")} value={reason} onChangeText={setReason} />
        </>
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label={t("Simpan laporan", "Save report")}
        disabled={busy || (kind === "move" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || reason.trim().length < 5))}
        onPress={() => void save()}
      />
    </Sheet>
  );
}
