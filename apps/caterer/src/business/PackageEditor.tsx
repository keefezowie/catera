import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { currency, defaultDishCategories, errorLabel, type SellerOffer } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout, nativePhoto, nativeThemes } from "@catera/design-tokens";
import {
  Button,
  cardEdge,
  Chip,
  Field,
  FormError,
  ListCard,
  PressableScale,
  Screen,
  Segmented,
  SectionHeader,
  Stepper,
  SuccessBeat,
  Text,
  useBusy,
  useColors,
  useToast,
  useTouchTarget,
  useUnsavedGuard,
  withAlpha,
} from "@catera/mobile-ui";
import { emptyPackage, formFromOffer, nutritionIssues, packageIssues, quickOffer, type PackageForm } from "./package";
import { NutritionFields } from "./NutritionFields";
import { PackagePhoto } from "./PackagePhoto";
import { photoUri } from "../photo";
import { uploadPhoto } from "./upload";

const days: [number, string][] = [[1, "Sen"], [2, "Sel"], [3, "Rab"], [4, "Kam"], [5, "Jum"], [6, "Sab"], [0, "Min"]];

/** One of the editor's sections: a `section` header (12 above its content) over fields 16 apart. */
function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <View testID={testID}>
      <SectionHeader title={title} />
      <View style={{ gap: nativeLayout.cardPadding }}>{children}</View>
    </View>
  );
}

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
  const target = useTouchTarget();
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
  // Counts the saves that were held back by a missing field, so the same message is announced again on a second try.
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  // The save failure sits in the footer by the button; the upload failure sits under the photo tile.
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadAttempt, setUploadAttempt] = useState(0);
  // The first publish, once saved: the beat replaces the form.
  const [published, setPublished] = useState(false);
  // A later publish: set when the save is done, so the guard is off before the screen goes back.
  const [saved, setSaved] = useState(false);
  const initial = useRef(JSON.stringify(form));
  const set = <K extends keyof PackageForm>(key: K, value: PackageForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const failed = (e: unknown, fallback: string) =>
    errorLabel((e as { code?: string }).code || (e as Error).message, locale) || fallback;

  async function pickPhoto() {
    if (uploading) return;
    setUploadError("");
    let stage: "pick" | "upload" = "pick";
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (picked.canceled || !picked.assets?.[0]) return;
      stage = "upload";
      setUploading(true);
      set("image", await uploadPhoto(runtime, picked.assets[0], demo));
    } catch (e) {
      setUploadAttempt((n) => n + 1);
      setUploadError(
        failed(
          e,
          stage === "pick"
            ? t("Foto belum bisa dipilih. Coba lagi.", "The photo could not be chosen. Try again.")
            : t("Foto belum terunggah. Coba lagi.", "The photo was not uploaded. Try again."),
        ),
      );
    } finally {
      setUploading(false);
    }
  }

  const [busy, save] = useBusy(async () => {
    const issues = packageIssues(form, t);
    setShown(issues);
    setGiziShown(nutritionIssues(form.nutrition, t));
    setAttempt((n) => n + 1);
    if (Object.keys(issues).length) return;
    // Fixed before the save: the save itself makes the package read show a published package.
    const first = firstPublish === true;
    setError("");
    try {
      await command("package.save", {
        catererId,
        slug: `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paket"}-${Date.now().toString(36).slice(-6)}`,
        offer: quickOffer(form),
      });
      if (first) setPublished(true);
      else setSaved(true);
    } catch (e) {
      setError(failed(e, t("Paket belum tersimpan. Coba lagi.", "The package was not saved. Try again.")));
    }
  });

  useUnsavedGuard(!busy && !published && !saved && JSON.stringify(form) !== initial.current, t("paket", "package"), {
    t,
    nounEn: "package",
    voice: "kamu",
  });
  const closed = useRef(false);
  useEffect(() => {
    if (!saved || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({ message: t("Paket diterbitkan", "Package published"), tone: "success" });
  }, [saved, toast, t]);

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
    <Screen
      footer={
        <View style={{ gap: nativeLayout.space.sm }}>
          {error ? <FormError message={error} failureKey={attempt} testID="form-error-save" /> : null}
          <Button label={t("Terbitkan paket", "Publish package")} busy={busy} disabled={uploading} onPress={() => void save()} />
        </View>
      }
    >
      {/* Sections sit 24 apart; each holds its `section` header 12 above its fields. */}
      <View testID="paket-sections" style={{ gap: nativeLayout.dense.sectionGap }}>
        <Section title={t("Foto", "Photo")}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={form.image ? t("Ganti foto paket", "Change package photo") : t("Pilih foto paket", "Choose package photo")}
            accessibilityState={{ busy: uploading, disabled: uploading }}
            disabled={uploading}
            onPress={() => void pickPhoto()}
          >
            <PackagePhoto uri={form.image ? photoUri(form.image, runtime.apiBase) : undefined}>
              {/* The empty tile draws its own four corners and its ground, like the photo that replaces it. */}
              <View
                testID="paket-photo-empty"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: nativeLayout.radius.card,
                    borderCurve: "continuous",
                    backgroundColor: palette.sage,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  shown.image ? { borderWidth: 1, borderColor: palette.danger } : cardEdge(palette),
                ]}
              >
                <Text variant="bodyStrong" style={{ color: palette.forest /* forest: action (inside the photo button) */ }}>
                  {uploading ? t("Mengunggah…", "Uploading…") : t("+ Foto paket", "+ Package photo")}
                </Text>
              </View>
            </PackagePhoto>
            {/* Over a photo that is already there, the wait is named on a veil the size of the photo. */}
            {uploading && form.image ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: nativeLayout.radius.card, borderCurve: "continuous", backgroundColor: withAlpha(palette.overlayInk, nativePhoto.textBlockAlpha), alignItems: "center", justifyContent: "center" },
                ]}
              >
                <Text variant="bodyStrong" style={{ color: nativeThemes.light.cream /* fixed: it sits on a photo veil, not on the theme ground */ }}>
                  {t("Mengunggah…", "Uploading…")}
                </Text>
              </View>
            ) : null}
          </PressableScale>
          {uploadError ? <FormError message={uploadError} failureKey={uploadAttempt} testID="form-error-upload" /> : null}
          {shown.image ? <FormError message={shown.image} failureKey={attempt} testID="form-error-image" /> : null}
        </Section>
        <View style={{ gap: nativeLayout.cardPadding }}>
          <Field label={t("Nama paket", "Package name")} value={form.name} onChangeText={(v) => set("name", v)} error={shown.name} placeholder="Makan Siang Rumahan" />
          <Field label={t("Ceritakan paketnya", "Describe the package")} value={form.description} onChangeText={(v) => set("description", v)} error={shown.description} multiline />
        </View>
        <Section title={t("Isi satu porsi", "What's in one portion")}>
          <View testID="paket-counts">
            <ListCard inset={0}>
              {defaultDishCategories.map((c) => (
                <Stepper key={c.id} label={locale === "id" ? c.name : c.nameEn ?? c.name} decreaseLabel={t(`Kurangi ${c.name}`, `Decrease ${c.nameEn ?? c.name}`)} increaseLabel={t(`Tambah ${c.name}`, `Increase ${c.nameEn ?? c.name}`)} value={form.counts[c.id] ?? 0} onChange={(n) => set("counts", { ...form.counts, [c.id]: n })} max={10} />
              ))}
            </ListCard>
          </View>
          {shown.counts ? <FormError message={shown.counts} failureKey={attempt} testID="form-error-counts" /> : null}
        </Section>
        <NutritionFields value={form.nutrition} onChange={(n) => set("nutrition", n)} errors={giziShown} />
        <Section title={t("Harga", "Price")}>
          <Field label={t("Harga per porsi (Rp)", "Price per portion (Rp)")} value={form.price} onChangeText={(v) => set("price", v.replace(/\D/g, ""))} error={shown.price} keyboardType="number-pad" placeholder="28000" />
        </Section>
        <Section title={t("Hari antar", "Delivery days")}>
          <View style={{ gap: nativeLayout.space.sm }}>
            <Text variant="bodyStrong">{t("Waktu makan", "Meal times")}</Text>
            <Segmented
              value={form.meal}
              onChange={(v) => set("meal", v)}
              options={[
                { value: "lunch", label: t("Siang", "Lunch") },
                { value: "dinner", label: t("Malam", "Dinner") },
                { value: "both", label: t("Keduanya", "Both") },
              ]}
            />
          </View>
          {/* The one chip row that wraps, because every day must show. Each chip sits in a frame as tall as the touch
              target, so the extended hit area is not clipped by a parent (a 34 chip's slop reaches past its own box). */}
          <View testID="paket-days" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.space.sm }}>
            {days.map(([d, label]) => (
              <View key={d} testID={`paket-day-${d}`} style={{ minHeight: target, justifyContent: "center", alignItems: "flex-start" }}>
                <Chip
                  label={label}
                  selected={form.weekdays.includes(d)}
                  onPress={() => set("weekdays", form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d])}
                />
              </View>
            ))}
          </View>
          {shown.weekdays ? <FormError message={shown.weekdays} failureKey={attempt} testID="form-error-weekdays" /> : null}
        </Section>
        <Section title={t("Kuota", "Quota")}>
          <Field
            label={t("Kapasitas per hari (porsi)", "Daily capacity (portions)")}
            hint={t("Paling banyak berapa porsi yang sanggup kamu masak dalam sehari?", "The most portions you can cook in a day.")}
            value={form.capacity}
            onChangeText={(v) => set("capacity", v.replace(/\D/g, ""))}
            error={shown.capacity}
            keyboardType="number-pad"
          />
        </Section>
      </View>
    </Screen>
  );
}
