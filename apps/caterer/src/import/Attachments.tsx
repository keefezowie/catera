import { View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { fontFor, Photo, PressableRow, PressableScale, Text, useColors, useListMotion } from "@catera/mobile-ui";
import { photoHref } from "./PhotoViewer";
import type { Attachment } from "./store";

/** Thumbnail side, its corner, the remove badge and the badge's touch target, in dp (spec 9). */
const THUMB = 76;
const RADIUS = 12;
const BADGE = 28;
const TARGET = 48;
/**
 * Room above and to the right of each thumbnail. The remove target is centred on the badge, which hangs 8dp off the
 * photo's corner, so the whole 48dp target needs this much room inside the tile's own box: a touch outside a parent's
 * bounds never reaches its child on Android. The same room is the space between thumbnails.
 */
const ROOM = (TARGET - BADGE) / 2 + 8;

/**
 * A stable key per attachment for the row motion, so a removed tile is the one that leaves: a photo by its picked
 * file, a document by its name, numbered when the same one was attached twice.
 */
function motionKeys(files: Attachment[]) {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const base = f.kind === "image" ? `foto:${f.uri}` : `file:${f.name}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  });
}

/** The badge's own disc, drawn inside its 48dp target. */
function RemoveBadge() {
  const c = useColors();
  return (
    <View
      testID="remove-badge"
      style={{
        width: BADGE,
        height: BADGE,
        borderRadius: BADGE / 2,
        borderWidth: 2,
        // The canvas ring parts the badge from the photo under it.
        borderColor: c.canvas,
        backgroundColor: c.charcoal,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="close" size={14} color={c.cream} />
    </View>
  );
}

/**
 * What the caterer attached for the assistant, as they will recognise it: the photos as 76dp thumbnails that open full
 * screen, each with a remove badge, an "+ Foto" tile while fewer than `max` are attached, then each PDF or spreadsheet
 * as a row with its name. A tile the caterer adds enters and one they remove leaves (`useListMotion`); everything else
 * holds still. `locked` (while the assistant reads them) keeps them in view with no way to add or remove.
 */
export function Attachments({
  files,
  onRemove,
  onAddPhoto,
  max,
  locked = false,
}: {
  files: Attachment[];
  /** Removes `files[index]`. */
  onRemove: (index: number) => void;
  onAddPhoto: () => void;
  /** The most photos one read takes (6, the assistant's own cap). */
  max: number;
  locked?: boolean;
}) {
  const { t } = useMobile();
  const c = useColors();
  const keys = motionKeys(files);
  const motion = useListMotion(keys);
  const photos = files.flatMap((f, index) => (f.kind === "image" ? [{ file: f, index, key: keys[index] }] : []));
  const documents = files.flatMap((f, index) => (f.kind === "image" ? [] : [{ file: f, index, key: keys[index] }]));
  const n = photos.length;

  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" style={{ color: c.muted }}>
        {t(`Lampiran · ${n} dari ${max}`, `Attachments · ${n} of ${max}`)}
      </Text>
      {/* Pulled up by part of the room above each tile, so the badges sit 8dp under the label. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 - ROOM }}>
        {photos.map(({ file, index, key }, at) => {
          const i = at + 1;
          return (
            <Animated.View
              key={key}
              testID={`attachment-tile-${i}`}
              style={{ paddingTop: ROOM, paddingRight: ROOM }}
              {...motion(key)}
            >
              <PressableRow
                accessibilityRole="imagebutton"
                accessibilityLabel={t(`Foto ${i} dari ${n}`, `Photo ${i} of ${n}`)}
                accessibilityHint={t("Buka foto", "Opens the photo")}
                onPress={() => router.push(photoHref(i) as never)}
              >
                {/* On the sage ground while it decodes; a photo that cannot be decoded keeps only that ground. */}
                <Photo
                  testID={`attachment-photo-${i}`}
                  uri={file.uri}
                  style={{
                    width: THUMB,
                    height: THUMB,
                    borderRadius: RADIUS,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: c.line,
                  }}
                />
              </PressableRow>
              {locked ? null : (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t(`Hapus foto ${i}`, `Remove photo ${i}`)}
                  onPress={() => onRemove(index)}
                  style={{ position: "absolute", top: 0, right: 0, width: TARGET, height: TARGET, alignItems: "center", justifyContent: "center" }}
                >
                  <RemoveBadge />
                </PressableScale>
              )}
            </Animated.View>
          );
        })}
        {!locked && n < max ? (
          <View style={{ paddingTop: ROOM, paddingRight: ROOM }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t("Tambah foto", "Add photo")}
              onPress={onAddPhoto}
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: RADIUS,
                borderCurve: "continuous",
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: c.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={20} color={c.forest} />
              <Text variant="label">{t("Foto", "Photo")}</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      {documents.map(({ file, index, key }, at) => (
        <Animated.View
          key={key}
          testID={`attachment-file-${at + 1}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 52,
            paddingLeft: 12,
            paddingRight: locked ? 12 : 2,
            borderRadius: RADIUS,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.surface,
          }}
          {...motion(key)}
        >
          <Ionicons testID="attachment-file-icon" name="document-text-outline" size={22} color={c.forest} />
          <Text selectable style={{ flex: 1, fontFamily: fontFor("600"), paddingVertical: 8 }}>
            {file.name}
          </Text>
          {locked ? null : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t(`Hapus ${file.name}`, `Remove ${file.name}`)}
              onPress={() => onRemove(index)}
              style={{ width: TARGET, height: TARGET, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={18} color={c.muted} />
            </PressableScale>
          )}
        </Animated.View>
      ))}
    </View>
  );
}
