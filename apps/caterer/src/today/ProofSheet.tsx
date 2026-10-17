import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { errorLabel, kitchenSession, type KitchenMeal, type Stop } from "@catera/domain";
import { useData, useMobile, plural } from "@catera/mobile-core";
import {
  Button,
  FormError,
  fontFor,
  Skeleton,
  SkeletonGroup,
  Text,
  useBusy,
  useColors,
  useToast,
} from "@catera/mobile-ui";
import { Frame, takeParkedDay } from "./ExceptionSheet";
import { shrinkProof, uploadProof } from "./proof";
import { selectedFor } from "./selection";
import { ReadError } from "../ReadError";

/** The route for the proof-photo sheet: `/sampai?meal=…&date=…&ids=a,b,c`. */
export const proofHref = (ids: string[], meal: KitchenMeal, date: string) =>
  `/sampai?meal=${meal}&date=${date}&ids=${ids.map(encodeURIComponent).join(",")}`;

/** One stop's photo: where it is on the phone (already shrunk) and, once sent, the path the server gave it. */
type Photo = { uri: string; path: string | null };

/** The stop row when it is a tile: its name, the photo or its absence marked, and its own camera button. */
function Tile({
  stop,
  photo,
  taking,
  failed,
  onTake,
}: {
  stop: Stop;
  photo: Photo | undefined;
  taking: boolean;
  failed: boolean;
  onTake: () => void;
}) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <View
      testID={`proof-tile-${stop.deliveryId}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: c.sage,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photo ? (
          <Image
            testID={`proof-photo-${stop.deliveryId}`}
            source={{ uri: photo.uri }}
            contentFit="cover"
            style={{ width: 64, height: 64 }}
            accessibilityLabel={`${t("Foto bukti", "Proof photo")}: ${stop.name}`}
          />
        ) : (
          <Ionicons name="camera-outline" size={26} color={c.muted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontFor("800") }}>{stop.name}</Text>
        <Text variant="caption">{t(`${stop.portions} porsi · ${stop.packageName}`, `${plural(stop.portions, "portion")} · ${stop.packageName}`)}</Text>
        {/* A missing photo is a to-do on the tile, in words: bold charcoal, never a danger caption. */}
        <Text testID={`proof-state-${stop.deliveryId}`} variant="caption" style={{ color: c.charcoal, fontFamily: fontFor("700") }}>
          {failed
            ? t("Foto belum terkirim", "Photo not sent")
            : photo
              ? t("Foto siap", "Photo ready")
              : t("Belum ada foto", "No photo yet")}
        </Text>
      </View>
      <Button
        variant="secondary"
        label={photo ? t("Ganti foto", "Retake") : t("Ambil foto", "Take photo")}
        accessibilityLabel={`${photo ? t("Ganti foto", "Retake the photo") : t("Ambil foto", "Take a photo")}: ${stop.name}`}
        busy={taking}
        onPress={onTake}
      />
    </View>
  );
}

/**
 * "Sampai (n)" (spec 5.9): a tile per selected stop, each with its own camera button, filled in any order. The button
 * waits, with the reason beside it, until every tile has a photo; it shows `busy` while the photos are sent and
 * `delivery.arrive` runs. A photo that did not send keeps the other photos (and the ones already sent are not sent
 * again); `FormError` at the button says which and offers "Coba lagi".
 */
export function ProofSheet({ ids, meal, date }: { ids: string[]; meal: KitchenMeal; date: string }) {
  const { runtime, actor, t, locale, command } = useMobile();
  const toast = useToast();
  const catererId = actor?.catererId ?? "";
  const key = `${catererId}:${date}`;
  const [seed] = useState(() => takeParkedDay(key));
  const day = useData(`stop-sheet:${key}`, () => runtime.api.sellerOperations(catererId, date));
  const ops = day.data ?? seed;
  const session = ops ? kitchenSession(ops, meal, new Date()) : null;
  // Only stops that are on their way can be marked Sampai; one another phone just marked drops out of the grid.
  const stops = session ? selectedFor(session.stops, new Set(ids), "arrive") : [];

  const [photos, setPhotos] = useState<Record<string, Photo>>({});
  const [taking, setTaking] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const closed = useRef(false);
  const fail = (message: string) => setFailure((f) => ({ message, key: (f?.key ?? 0) + 1 }));

  useEffect(() => {
    if (!saved || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({
      message: t(`${stops.length} pengantaran ditandai sampai`, `${stops.length} deliveries marked as arrived`),
      tone: "success",
    });
  }, [saved, stops.length, toast, t]);

  // The camera is one at a time; a ref, because a second tap can land before the first one's state has rendered.
  const cameraOpen = useRef(false);
  async function take(stop: Stop) {
    if (cameraOpen.current) return;
    cameraOpen.current = true;
    setTaking(stop.deliveryId);
    setFailure(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        fail(
          t(
            "Kamera belum diizinkan. Izinkan kamera untuk Catera Dapur di pengaturan HP, lalu ambil fotonya.",
            "The camera is not allowed. Allow it for Catera Dapur in the phone's settings, then take the photo.",
          ),
        );
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = shot.canceled ? null : shot.assets?.[0];
      if (!asset) return;
      const small = await shrinkProof(asset);
      // A new photo replaces the old one and has not been sent yet.
      setPhotos((p) => ({ ...p, [stop.deliveryId]: { uri: small.uri, path: null } }));
      setFailedIds((f) => f.filter((id) => id !== stop.deliveryId));
    } catch {
      fail(t("Foto belum bisa diambil. Coba lagi.", "The photo could not be taken. Try again."));
    } finally {
      cameraOpen.current = false;
      setTaking(null);
    }
  }

  const missing = stops.filter((s) => !photos[s.deliveryId]);
  const ready = stops.length > 0 && missing.length === 0;
  const label = t(`Sampai (${stops.length})`, `Arrived (${stops.length})`);

  const [busy, send] = useBusy(async () => {
    if (!ready) return;
    setFailure(null);
    setFailedIds([]);
    const paths: Record<string, string> = {};
    const notSent: Stop[] = [];
    for (const stop of stops) {
      const photo = photos[stop.deliveryId]!;
      if (photo.path) {
        paths[stop.deliveryId] = photo.path;
        continue;
      }
      try {
        const path = await uploadProof(runtime, photo.uri, stop.deliveryId, meal);
        paths[stop.deliveryId] = path;
        // Kept, so a retry sends only the photos that did not go.
        setPhotos((p) => ({ ...p, [stop.deliveryId]: { ...photo, path } }));
      } catch {
        notSent.push(stop);
      }
    }
    if (notSent.length) {
      setFailedIds(notSent.map((s) => s.deliveryId));
      fail(
        notSent.length === 1
          ? t(`Foto ${notSent[0].name} belum terkirim. Foto lain tetap tersimpan.`, `The photo for ${notSent[0].name} was not sent. The other photos are kept.`)
          : t(`${notSent.length} foto belum terkirim. Foto lain tetap tersimpan.`, `${notSent.length} photos were not sent. The other photos are kept.`),
      );
      return;
    }
    try {
      await command("delivery.arrive", {
        catererId,
        date,
        meal,
        fulfillmentIds: stops.map((s) => s.deliveryId),
        photos: paths,
      });
      setSaved(true);
    } catch (e) {
      fail(
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Belum bisa menandai sampai. Coba lagi.", "Could not mark them as arrived. Try again."),
      );
    }
  });

  const title = t("Foto bukti sampai", "Proof of arrival");
  if (!ops)
    return (
      <Frame title={title}>
        {day.error ? (
          <ReadError message={day.error} onRetry={() => void day.reload()} />
        ) : (
          <SkeletonGroup label={t("Memuat pengantaran", "Loading the deliveries")}>
            <View style={{ gap: 8 }}>
              <Skeleton height={88} radius={12} />
              <Skeleton height={88} radius={12} />
            </View>
          </SkeletonGroup>
        )}
      </Frame>
    );
  if (!stops.length)
    return (
      <Frame title={title}>
        <Text selectable>
          {t("Tidak ada pengantaran yang tinggal ditandai sampai.", "No deliveries are left to mark as arrived.")}
        </Text>
      </Frame>
    );
  return (
    <Frame
      title={title}
      context={t(
        "Foto tiap alamat, urutan bebas. Pelanggan melihatnya saat diminta konfirmasi.",
        "A photo per address, in any order. Customers see it when asked to confirm.",
      )}
    >
      <View style={{ gap: 8 }}>
        {stops.map((stop) => (
          <Tile
            key={stop.deliveryId}
            stop={stop}
            photo={photos[stop.deliveryId]}
            taking={taking === stop.deliveryId}
            failed={failedIds.includes(stop.deliveryId)}
            onTake={() => void take(stop)}
          />
        ))}
      </View>
      {failure ? <FormError message={failure.message} failureKey={failure.key} retry={ready ? () => void send() : undefined} /> : null}
      <Button
        label={label}
        disabled={!ready}
        busy={busy}
        accessibilityHint={
          ready ? undefined : t(`Ambil foto untuk ${missing.length} alamat lagi.`, `Take ${missing.length} more photos first.`)
        }
        onPress={() => void send()}
      />
      {!ready ? (
        <Text testID="proof-reason" variant="caption">
          {t(`Ambil foto untuk ${missing.length} alamat lagi.`, `Take ${missing.length} more ${missing.length === 1 ? "photo" : "photos"} first.`)}
        </Text>
      ) : null}
    </Frame>
  );
}
