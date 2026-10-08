import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { defaultDishCategories, errorLabel, type SellerOffer } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Chip, colors, Field, Screen, Segmented, Stepper, Text } from "@catera/mobile-ui";
import { emptyPackage, formFromOffer, packageIssues, quickOffer, type PackageForm } from "./package";
import { photoUri } from "../photo";
import { uploadPhoto } from "./upload";

const days: [number, string][] = [[1, "Sen"], [2, "Sel"], [3, "Rab"], [4, "Kam"], [5, "Jum"], [6, "Sab"], [0, "Min"]];

/** One screen for a new package: what it is, what's in a portion, price, days and how many per day. `from` prefills a copy. */
export function PackageEditor({ from }: { from?: SellerOffer }) {
  const { runtime, actor, demo, t, locale, command } = useMobile();
  const catererId = actor?.catererId ?? "";
  const [form, setForm] = useState<PackageForm>(() => (from ? formFromOffer(from) : emptyPackage));
  const [shown, setShown] = useState<ReturnType<typeof packageIssues>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof PackageForm>(key: K, value: PackageForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const failed = (e: unknown) =>
    errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum tersimpan. Coba lagi.", "Not saved. Try again.");

  async function pickPhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (picked.canceled || !picked.assets?.[0]) return;
    setUploading(true);
    setError("");
    try {
      set("image", await uploadPhoto(runtime, picked.assets[0], demo));
    } catch (e) {
      setError(failed(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const issues = packageIssues(form);
    setShown(issues);
    if (Object.keys(issues).length) return;
    setBusy(true);
    setError("");
    try {
      await command("package.save", {
        catererId,
        slug: `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paket"}-${Date.now().toString(36).slice(-6)}`,
        offer: quickOffer(form),
      });
      router.back();
    } catch (e) {
      setError(failed(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button label={t("Simpan paket", "Save package")} disabled={busy || uploading} onPress={() => void save()} />}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Pilih foto paket", "Choose package photo")}
        onPress={() => void pickPhoto()}
        style={{ height: 168, borderRadius: 14, overflow: "hidden", backgroundColor: colors.sage, alignItems: "center", justifyContent: "center", borderWidth: shown.image ? 1 : 0, borderColor: colors.danger }}
      >
        {form.image ? (
          <Image source={{ uri: photoUri(form.image, runtime.apiBase) }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text variant="label" style={{ color: colors.forest }}>
            {uploading ? t("Mengunggah…", "Uploading…") : t("+ Foto paket", "+ Package photo")}
          </Text>
        )}
      </Pressable>
      {shown.image ? <Text variant="caption" style={{ color: colors.danger }}>{shown.image}</Text> : null}
      <Field label={t("Nama paket", "Package name")} value={form.name} onChangeText={(v) => set("name", v)} error={shown.name} placeholder="Makan Siang Rumahan" />
      <Field label={t("Ceritakan paketnya", "Describe it")} value={form.description} onChangeText={(v) => set("description", v)} error={shown.description} multiline />
      <Text variant="label">{t("Isi satu porsi", "In one portion")}</Text>
      {defaultDishCategories.map((c) => (
        <Stepper key={c.id} label={locale === "id" ? c.name : c.nameEn ?? c.name} decreaseLabel={t(`Kurangi ${c.name}`, `Decrease ${c.nameEn ?? c.name}`)} increaseLabel={t(`Tambah ${c.name}`, `Increase ${c.nameEn ?? c.name}`)} value={form.counts[c.id] ?? 0} onChange={(n) => set("counts", { ...form.counts, [c.id]: n })} max={10} />
      ))}
      {shown.counts ? <Text variant="caption" style={{ color: colors.danger }}>{shown.counts}</Text> : null}
      <Field label={t("Harga per porsi (Rp)", "Price per portion (Rp)")} value={form.price} onChangeText={(v) => set("price", v.replace(/\D/g, ""))} error={shown.price} keyboardType="number-pad" placeholder="28000" />
      <Text variant="label">{t("Waktu makan", "Meal")}</Text>
      <Segmented
        value={form.meal}
        onChange={(v) => set("meal", v)}
        options={[
          { value: "lunch", label: t("Siang", "Lunch") },
          { value: "dinner", label: t("Malam", "Dinner") },
          { value: "both", label: t("Keduanya", "Both") },
        ]}
      />
      <Text variant="label">{t("Hari antar", "Delivery days")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {days.map(([d, label]) => (
          <Chip
            key={d}
            label={label}
            selected={form.weekdays.includes(d)}
            onPress={() => set("weekdays", form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d])}
          />
        ))}
      </View>
      {shown.weekdays ? <Text variant="caption" style={{ color: colors.danger }}>{shown.weekdays}</Text> : null}
      <Field
        label={t("Kapasitas per hari (porsi)", "Daily capacity (portions)")}
        hint={t("Berapa porsi paling banyak yang sanggup Anda masak per hari.", "The most portions you can cook in a day.")}
        value={form.capacity}
        onChangeText={(v) => set("capacity", v.replace(/\D/g, ""))}
        error={shown.capacity}
        keyboardType="number-pad"
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}
