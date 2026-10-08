import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { areaOptions, menuSummary, perMealPrice, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, FONT, Screen, Sheet, Text } from "@catera/mobile-ui";
import { FilterChip } from "./FilterChip";
import { PackageCard, RoundButton } from "./PackageCard";
import { type CatalogOffer } from "./format";
import { useSaved } from "./saved";

const AREA_KEY = "catera.area";
const BUDGET = 30000;

/** Jelajah: choose an area, narrow with four chips, then browse packages as photos. */
export function Jelajah() {
  const [area, setArea] = useState<string | null>(null);
  useEffect(() => {
    // The legacy provider reads the same key, so the choice carries over both ways.
    void SecureStore.getItemAsync(AREA_KEY)
      .then((value) => setArea(value || ""))
      .catch(() => setArea(""));
  }, []);
  if (area === null)
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={colors.forest} />
      </Screen>
    );
  return (
    <Browse
      area={area}
      onArea={(value) => {
        setArea(value);
        void SecureStore.setItemAsync(AREA_KEY, value).catch(() => {});
      }}
    />
  );
}

function Browse({ area, onArea }: { area: string; onArea: (value: string) => void }) {
  const { runtime, t, locale } = useMobile();
  const saved = useSaved("/jelajah");
  const [search, setSearch] = useState("");
  const [lunch, setLunch] = useState(false);
  const [dinner, setDinner] = useState(false);
  const [budget, setBudget] = useState(false);
  const [trial, setTrial] = useState(false);
  const [picking, setPicking] = useState(false);

  // The area goes to the server too, but the list is narrowed here by each package's own areas.
  // Chips and search filter what it returned, so toggling one never refetches or blanks the list.
  const query = new URLSearchParams({ limit: "100", ...(area ? { area } : {}) }).toString();
  const catalog = useData<{ items: Offer[] }>(`jelajah:${query}`, () => runtime.api.catalog("?" + query));

  // Siang and Malam together mean no meal filter.
  const meal = lunch !== dinner ? (lunch ? "lunch" : "dinner") : "";
  const needle = search.trim().toLowerCase();
  const all = catalog.data?.items;
  // Only packages that deliver to the chosen area; "Semua area" (no area) shows everything.
  const inArea = useMemo(
    () => ((all ?? []) as CatalogOffer[]).filter((o) => !area || (o.areas ?? []).includes(area)),
    [all, area],
  );
  const items = useMemo(
    () =>
      inArea.filter(
        (o) =>
          (!meal || o.meal === meal || o.meal === "both") &&
          (!budget || perMealPrice(o) <= BUDGET) &&
          (!trial || !!o.trialPrice) &&
          (!needle ||
            [o.name, o.caterer, ...o.tags, ...o.menus.map((m) => menuSummary(m, locale))]
              .join(" ")
              .toLowerCase()
              .includes(needle)),
      ),
    [inArea, meal, budget, trial, needle, locale],
  );
  const filtered = !!(needle || meal || budget || trial);
  const clear = () => {
    setSearch("");
    setLunch(false);
    setDinner(false);
    setBudget(false);
    setTrial(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Pilih area pengantaran", "Choose delivery area")}
          accessibilityValue={{ text: area || t("Belum dipilih", "Not chosen") }}
          onPress={() => setPicking(true)}
          style={styles.area}
        >
          <Ionicons name="location-outline" size={20} color={colors.forest} />
          <Text variant="label" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
            {area || t("Pilih area", "Choose area")}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
        <RoundButton icon="heart-outline" label={t("Paket disimpan", "Saved packages")} onPress={() => router.push("/disimpan" as never)} />
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          accessibilityLabel={t("Cari paket", "Search packages")}
          value={search}
          onChangeText={setSearch}
          placeholder={t("Cari ayam bakar, nabati, Bu Rini…", "Search grilled chicken, plant-based, Bu Rini…")}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.input}
        />
      </View>

      <View style={styles.chips}>
        <FilterChip label={t("Siang", "Lunch")} selected={lunch} onPress={() => setLunch(!lunch)} />
        <FilterChip label={t("Malam", "Dinner")} selected={dinner} onPress={() => setDinner(!dinner)} />
        <FilterChip label={t("Di bawah Rp30.000", "Under Rp30,000")} selected={budget} onPress={() => setBudget(!budget)} />
        <FilterChip label={t("Bisa coba 1 hari", "One-day trial")} selected={trial} onPress={() => setTrial(!trial)} />
      </View>

      {saved.error ? <Text style={{ color: colors.danger }}>{saved.error}</Text> : null}

      {catalog.loading && !catalog.data ? (
        <ActivityIndicator color={colors.forest} />
      ) : catalog.error && !catalog.data ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.danger }}>{catalog.error}</Text>
          <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void catalog.reload()} />
        </View>
      ) : area && inArea.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">
            {t(`Belum ada katering yang antar ke ${area}.`, `No caterer delivers to ${area} yet.`)}
          </Text>
          <Button variant="secondary" label={t("Lihat semua area", "See all areas")} onPress={() => onArea("")} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">{t("Belum ada paket yang cocok.", "No matching packages yet.")}</Text>
          <Text style={{ color: colors.muted }}>
            {t("Coba kata kunci atau pilihan lain.", "Try another keyword or choice.")}
          </Text>
          {filtered ? <Button variant="secondary" label={t("Hapus pilihan", "Clear choices")} onPress={clear} /> : null}
        </View>
      ) : (
        items.map((o) => (
          <PackageCard
            key={o.id}
            offer={o}
            saved={saved.isSaved(o.id)}
            onOpen={() => router.push(`/paket/${encodeURIComponent(o.id)}` as never)}
            onToggleSaved={() => void saved.toggle(o.id)}
          />
        ))
      )}

      <Sheet visible={picking} onClose={() => setPicking(false)} title={t("Area pengantaran", "Delivery area")}>
        {["", ...areaOptions].map((value) => (
          <Pressable
            key={value || "all"}
            accessibilityRole="button"
            accessibilityState={{ selected: value === area }}
            onPress={() => {
              onArea(value);
              setPicking(false);
            }}
            style={styles.option}
          >
            <Text style={{ flex: 1, fontWeight: value === area ? "800" : "400" }}>
              {value || t("Semua area", "All areas")}
            </Text>
            {value === area ? <Ionicons name="checkmark" size={20} color={colors.forest} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  area: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CFD3C6",
    backgroundColor: colors.surface,
  },
  input: { flex: 1, minHeight: 48, fontFamily: FONT, fontSize: 15, color: colors.charcoal },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
});
