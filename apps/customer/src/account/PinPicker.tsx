import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { areaAtPoint, areaCenter, roundCoordinate, type GeoPoint } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Text, useColors } from "@catera/mobile-ui";
import { placeLocation, putPin, searchPlaces, type PlaceSuggestion } from "./pin";

/** Close enough to tell one building from the next. */
const NEAR = 0.004;
/** Opening view with no pin yet: the whole area. */
const WIDE = 0.06;
/** Zoomed out past this a pin could be a neighbourhood off, so it cannot be used yet. */
const TOO_WIDE = 0.02;
const PIN = { width: 40, height: 50 };
/** The pin's tip marks the map's centre, so its body sits above that point. */
const pinOffset = -PIN.height;

const numeric = (v?: string) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * `/alamat-peta?key=&lat=&lng=&area=`: the pin stays still and the map moves under it. Search and "my location" move the
 * map too, so someone who cannot drag can still place it. "Pakai titik ini" hands the point to the form that opened this
 * screen and closes; nothing is saved until that form is.
 */
export function PinPicker() {
  const params = useLocalSearchParams<{ key?: string; lat?: string; lng?: string; area?: string }>();
  const { runtime, t } = useMobile();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [start] = useState<GeoPoint & { delta: number }>(() => {
    const lat = numeric(params.lat);
    const lng = numeric(params.lng);
    return lat !== null && lng !== null ? { lat, lng, delta: NEAR } : { ...areaCenter(params.area), delta: WIDE };
  });
  const [center, setCenter] = useState<GeoPoint>({ lat: start.lat, lng: start.lng });
  const [delta, setDelta] = useState(start.delta);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  // One Google billing session per search-and-pick, renewed after each pick.
  const session = useRef(Crypto.randomUUID());

  const area = areaAtPoint(center);
  const tooWide = delta > TOO_WIDE;

  const moveTo = (point: GeoPoint) =>
    map.current?.animateToRegion({ latitude: point.lat, longitude: point.lng, latitudeDelta: NEAR, longitudeDelta: NEAR }, 300);

  const unavailable = t("Pencarian belum bisa dipakai. Geser peta atau pakai lokasimu.", "Search isn't available. Move the map or use your location.");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(runtime, q, session.current, controller.signal)
        .then((found) => {
          setSuggestions(found);
          setNote(found.length ? "" : t("Lokasi tidak ditemukan. Coba kata lain.", "Nothing found. Try other words."));
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setNote(unavailable);
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function pick(place: PlaceSuggestion) {
    Keyboard.dismiss();
    setSuggestions([]);
    setQuery(place.title);
    try {
      moveTo(await placeLocation(runtime, place.id, session.current));
      setNote("");
    } catch {
      setNote(unavailable);
    } finally {
      session.current = Crypto.randomUUID();
    }
  }

  async function locate() {
    if (locating) return;
    setLocating(true);
    setNote("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setNote(t("Izin lokasi mati. Cari alamat atau geser peta.", "Location is off. Search or move the map."));
        return;
      }
      const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      moveTo({ lat: here.coords.latitude, lng: here.coords.longitude });
    } catch {
      setNote(t("Lokasimu belum terbaca. Cari alamat atau geser peta.", "We couldn't read your location. Search or move the map."));
    } finally {
      setLocating(false);
    }
  }

  const heading = tooWide
    ? t("Perbesar peta dulu", "Zoom in first")
    : area
      ? t(`Titik ini ada di ${area}`, `This pin is in ${area}`)
      : t("Titik ini di luar area layanan", "This pin is outside our service area");
  const detail = tooWide
    ? t("Supaya titiknya tepat di pintu masuk.", "So the pin lands right at the entrance.")
    : area
      ? t("Alamat lengkapnya kamu tulis sendiri setelah ini.", "You'll write the full address next.")
      : t(
          "Katering di Catera mengantar ke Jakarta, Tangerang Selatan, dan Bandung. Geser pin ke area itu.",
          "Catera's caterers deliver to Jakarta, Tangerang Selatan and Bandung. Move the pin there.",
        );

  const raised = { boxShadow: "0 1px 4px rgba(0, 0, 0, 0.2)" };
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={map}
          testID="pin-map"
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          toolbarEnabled={false}
          showsMyLocationButton={false}
          initialRegion={{ latitude: start.lat, longitude: start.lng, latitudeDelta: start.delta, longitudeDelta: start.delta }}
          onRegionChangeComplete={(region: Region) => {
            setCenter({ lat: roundCoordinate(region.latitude), lng: roundCoordinate(region.longitude) });
            setDelta(region.latitudeDelta);
          }}
        />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "50%", marginTop: pinOffset, alignItems: "center" }}>
          <Ionicons testID="pin-marker" name="location" size={PIN.height} color={c.forest} />
        </View>
        <View style={{ position: "absolute", left: 16, right: 16, top: insets.top + 12, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Kembali", "Back")}
              onPress={() => router.back()}
              style={{ width: 48, height: 48, borderRadius: 10, borderCurve: "continuous", backgroundColor: c.surface, alignItems: "center", justifyContent: "center", ...raised }}
            >
              <Ionicons name="arrow-back" size={22} color={c.forest} />
            </Pressable>
            <View style={{ flex: 1, height: 48, borderRadius: 10, borderCurve: "continuous", backgroundColor: c.surface, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, ...raised }}>
              <Ionicons name="search" size={20} color={c.muted} />
              <TextInput
                testID="pin-search"
                accessibilityLabel={t("Cari lokasi", "Search for a place")}
                placeholder={t("Cari jalan, gedung, atau area", "Search a street, building or area")}
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCorrect={false}
                style={{ flex: 1, minWidth: 0, color: c.charcoal, fontSize: 14, padding: 0 }}
              />
            </View>
          </View>
          {suggestions.length ? (
            <View style={{ maxHeight: 240, borderRadius: 12, borderCurve: "continuous", backgroundColor: c.surface, overflow: "hidden", ...raised }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {suggestions.map((s) => (
                  <Pressable
                    key={s.id}
                    testID={`pin-suggestion-${s.id}`}
                    accessibilityRole="button"
                    onPress={() => void pick(s)}
                    style={{ minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, justifyContent: "center" }}
                  >
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {s.title}
                    </Text>
                    {s.detail ? (
                      <Text variant="meta" numberOfLines={1}>
                        {s.detail}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {note ? (
            <View style={{ padding: 12, borderRadius: 12, borderCurve: "continuous", backgroundColor: c.surface, ...raised }}>
              <Text testID="pin-note" variant="meta" accessibilityLiveRegion="polite">
                {note}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          testID="pin-locate"
          accessibilityRole="button"
          accessibilityLabel={t("Pakai lokasi saya", "Use my location")}
          onPress={() => void locate()}
          style={{ position: "absolute", right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", ...raised }}
        >
          <Ionicons name="locate" size={22} color={c.forest} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 16, gap: 12, backgroundColor: c.surface }}>
        <View accessibilityLiveRegion="polite">
          <Text testID="pin-heading" variant="bodyStrong">
            {heading}
          </Text>
          <Text variant="meta">{detail}</Text>
        </View>
        <Button
          label={t("Pakai titik ini", "Use this pin")}
          disabled={tooWide || !area}
          onPress={() => {
            putPin(params.key ?? "", center);
            router.back();
          }}
        />
      </View>
    </View>
  );
}
