import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { areaOptions, type Address } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, Screen, Text } from "@catera/mobile-ui";
import { FilterChip } from "../discover/FilterChip";
import { failureText } from "./failure";
import { SignInFirst } from "./SignInFirst";

/** Alamat: the delivery addresses (address.save adds or edits one). */
export function Addresses() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Alamat", "Addresses")} next="/alamat" />;
  return <AddressBook key={actor.id} />;
}

type Draft = { address: Address | null; label: string; line: string; area: string; city: string; instructions: string };

function AddressBook() {
  const { runtime, command, t, locale } = useMobile();
  const customer = useData("alamat:customer", () => runtime.api.customer());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function edit(address: Address | null) {
    setError("");
    setDraft({
      address,
      label: address?.label ?? t("Rumah", "Home"),
      line: address?.line ?? "",
      area: address?.area ?? "Jakarta Selatan",
      city: address?.city ?? "Jakarta",
      instructions: address?.instructions ?? "",
    });
  }

  async function save(d: Draft) {
    setBusy(true);
    setError("");
    try {
      await command("address.save", {
        ...(d.address ? { id: d.address.id, version: d.address.version } : {}),
        label: d.label,
        line: d.line,
        area: d.area,
        city: d.city,
        instructions: d.instructions,
      });
      setDraft(null);
    } catch (e) {
      setError(failureText(e, locale, t));
    } finally {
      setBusy(false);
    }
  }

  if (!customer.data)
    return customer.error ? (
      <Screen>
        <Text style={{ color: colors.danger }}>{customer.error}</Text>
        <Button label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
      </Screen>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const areas = draft && !areaOptions.includes(draft.area) ? [draft.area, ...areaOptions] : areaOptions;

  return (
    <Screen>
      <Text variant="title">{t("Makanan diantar ke mana?", "Where should meals go?")}</Text>
      {customer.data.addresses.map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{a.label}</Text>
              <Text>{a.line}</Text>
              <Text variant="caption">
                {a.area}, {a.city}
              </Text>
              {a.instructions ? <Text variant="caption">{a.instructions}</Text> : null}
            </View>
            <Button
              variant="text"
              label={t("Ubah", "Edit")}
              accessibilityLabel={t(`Ubah ${a.label}`, `Edit ${a.label}`)}
              onPress={() => edit(a)}
            />
          </View>
        </Card>
      ))}
      {!customer.data.addresses.length && !draft ? (
        <Text style={{ color: colors.muted }}>{t("Belum ada alamat.", "No addresses yet.")}</Text>
      ) : null}
      {draft ? (
        <Card>
          <Text variant="heading">{draft.address ? t("Ubah alamat", "Edit address") : t("Alamat baru", "New address")}</Text>
          <Field label={t("Label alamat", "Address label")} value={draft.label} onChangeText={(label) => set({ label })} maxLength={60} />
          <Field
            label={t("Jalan, nomor, detail", "Street, number, details")}
            value={draft.line}
            onChangeText={(line) => set({ line })}
            multiline
            maxLength={300}
          />
          <Text variant="label">{t("Area", "Area")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {areas.map((area) => (
              <FilterChip key={area} label={area} selected={draft.area === area} onPress={() => set({ area })} />
            ))}
          </View>
          <Field label={t("Kota", "City")} value={draft.city} onChangeText={(city) => set({ city })} maxLength={80} />
          <Field
            label={t("Petunjuk pengantaran", "Delivery instructions")}
            value={draft.instructions}
            onChangeText={(instructions) => set({ instructions })}
            multiline
            maxLength={300}
          />
          <Text variant="caption">
            {t(
              "Alamat pengantaran yang sudah dijadwalkan hanya berubah lewat Ubah hari di Jadwal.",
              "A delivery already scheduled changes its address only through Change day in Schedule.",
            )}
          </Text>
          {error ? (
            <Text style={{ color: colors.danger }} testID="address-error">
              {error}
            </Text>
          ) : null}
          <Button
            label={t("Simpan alamat", "Save address")}
            disabled={busy || !draft.label.trim() || draft.line.trim().length < 5 || !draft.city.trim()}
            onPress={() => void save(draft)}
          />
          <Button variant="secondary" label={t("Batal", "Cancel")} onPress={() => setDraft(null)} />
        </Card>
      ) : (
        <Button label={t("Tambah alamat", "Add address")} onPress={() => edit(null)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
});
