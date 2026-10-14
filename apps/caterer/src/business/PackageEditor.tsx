import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { currency, defaultDishCategories, errorLabel, type SellerOffer } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  Button,
  Chip,
  Field,
  PressableScale,
  Screen,
  Segmented,
  Stepper,
  SuccessBeat,
  Text,
  useColors,
  useToast,
} from "@catera/mobile-ui";
import { emptyPackage, formFromOffer, nutritionIssues, packageIssues, quickOffer, type PackageForm } from "./package";
import { NutritionFields } from "./NutritionFields";
import { photoUri } from "../photo";
import { uploadPhoto } from "./upload";

const days: [number, string][] = [[1, "Sen"], [2, "Sel"], [3, "Rab"], [4, "Kam"], [5, "Jum"], [6, "Sab"], [0, "Min"]];

/**
 * One screen for a new package: what it is, what's in a portion, price, days and how many per day. `from` prefills a
 * copy. Saving publishes it. The caterer's first published package (`firstPublish`, from the package read) ends on the
 * success beat with confetti, "Paket diterbitkan", and Selesai goes back; every later one goes back at once with the
 * toast "Paket diterbitkan". Null (the read has not answered) is a later one.
 */
export function PackageEditor({ from, firstPublish = null }: { from?: SellerOffer; firstPublish?: boolean | null }) {
  const { runtime, actor, demo, t, locale, command } = useMobile();
  // Named palette because the dish-category rows below use `c` for a category.
  const palette = useColors();
  const catererId = actor?.catererId ?? "";
  const [form, setForm] = useState<PackageForm>(() => (from ? formFromOffer(from) : emptyPackage));
  // A copy says so once it is really here, filled in this editor: never on the tap, over a package that is still
  // loading, gone or failed to load. Once per copy (Paket baru keys the editor by the package it copies).
  const toast = useToast();
  const copied = useRef(false);
  useEffect(() => {
    if (!from || copied.current) return;
    copied.current = true;
    toast.show({ message: t("Paket disalin", "Package copied"), tone: "success" });
  }, [from, toast, t]);
  const [shown, setShown] = useState<ReturnType<typeof packageIssues>>({});
  const [giziShown, setGiziShown] = useState<ReturnType<typeof nutritionIssues>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // The first publish, once saved: the beat replaces the form.
  const [published, setPublished] = useState(false);
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
    setGiziShown(nutritionIssues(form.nutrition));
    if (Object.keys(issues).length) return;
    // Fixed before the save: the save itself makes the package read show a published package.
    const first = firstPublish === true;
    setBusy(true);
    setError("");
    try {
      await command("package.save", {
        catererId,
        slug: `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paket"}-${Date.now().toString(36).slice(-6)}`,
        offer: quickOffer(form),
      });
      if (first) {
        setPublished(true);
        return;
      }
      router.back();
      toast.show({ message: t("Paket diterbitkan", "Package published"), tone: "success" });
    } catch (e) {
      setError(failed(e));
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    const dayNames = days.filter(([d]) => form.weekdays.includes(d)).map(([, label]) => label);
    const price = form.price ? Number(form.price) : null;
    return (
      <Screen footer={<Button label={t("Selesai", "Done")} onPress={() => router.back()} />}>
        <SuccessBeat title={t("Paket diterbitkan", "Package published")} play confetti>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text variant="heading" style={{ textAlign: "center" }}>
              {form.name.trim()}
            </Text>
            <Text variant="caption" style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>
              {[price !== null ? `${currency(price, locale)} ${t("per porsi", "per portion")}` : "", dayNames.join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </SuccessBeat>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label={t("Simpan paket", "Save package")} disabled={busy || uploading} onPress={() => void save()} />}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t("Pilih foto paket", "Choose package photo")}
        onPress={() => void pickPhoto()}
        style={{ height: 168, borderRadius: 14, overflow: "hidden", backgroundColor: palette.sage, alignItems: "center", justifyContent: "center", borderWidth: shown.image ? 1 : 0, borderColor: palette.danger }}
      >
        {form.image ? (
          <Image source={{ uri: photoUri(form.image, runtime.apiBase) }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text variant="label" style={{ color: palette.forest /* forest: action (inside the photo button) */ }}>
            {uploading ? t("Mengunggah…", "Uploading…") : t("+ Foto paket", "+ Package photo")}
          </Text>
        )}
      </PressableScale>
      {shown.image ? <Text selectable variant="caption" style={{ color: palette.danger }}>{shown.image}</Text> : null}
      <Field label={t("Nama paket", "Package name")} value={form.name} onChangeText={(v) => set("name", v)} error={shown.name} placeholder="Makan Siang Rumahan" />
      <Field label={t("Ceritakan paketnya", "Describe it")} value={form.description} onChangeText={(v) => set("description", v)} error={shown.description} multiline />
      <Text variant="label">{t("Isi satu porsi", "In one portion")}</Text>
      {defaultDishCategories.map((c) => (
        <Stepper key={c.id} label={locale === "id" ? c.name : c.nameEn ?? c.name} decreaseLabel={t(`Kurangi ${c.name}`, `Decrease ${c.nameEn ?? c.name}`)} increaseLabel={t(`Tambah ${c.name}`, `Increase ${c.nameEn ?? c.name}`)} value={form.counts[c.id] ?? 0} onChange={(n) => set("counts", { ...form.counts, [c.id]: n })} max={10} />
      ))}
      {shown.counts ? <Text selectable variant="caption" style={{ color: palette.danger }}>{shown.counts}</Text> : null}
      <NutritionFields value={form.nutrition} onChange={(n) => set("nutrition", n)} errors={giziShown} />
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
      {shown.weekdays ? <Text selectable variant="caption" style={{ color: palette.danger }}>{shown.weekdays}</Text> : null}
      <Field
        label={t("Kapasitas per hari (porsi)", "Daily capacity (portions)")}
        hint={t("Berapa porsi paling banyak yang sanggup Anda masak per hari.", "The most portions you can cook in a day.")}
        value={form.capacity}
        onChangeText={(v) => set("capacity", v.replace(/\D/g, ""))}
        error={shown.capacity}
        keyboardType="number-pad"
      />
      {error ? <Text selectable style={{ color: palette.danger }}>{error}</Text> : null}
    </Screen>
  );
}
