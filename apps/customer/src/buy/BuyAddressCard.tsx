import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { addressPoint, type Address } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { Button, Card, PressableScale, Text, cardEdge, cardEdgeWidth, themedStyles, useColors } from "@catera/mobile-ui";
import { mapsEnabled } from "../account/pin";
import { FieldRow } from "./BuyParts";

type T = (id: string, en: string) => string;

/**
 * The delivery address block at the top of Beli Step 1.
 * - With a pinned address (and maps enabled): shows a compact liteMode map preview with an inline "Sesuaikan titik"
 *   chip over the map, directly above the address details and "Ganti alamat".
 * - With an unpinned address: keeps the address row and places a calm attention prompt ("Tandai titik di peta") right
 *   beside/below it instead of a red error, keeping the price visible.
 * - With no address yet: offers "Tambah alamat" straight into the add-address form.
 */
export function BuyAddressCard({
  address,
  needsPin,
  onPickAddress,
  onAddAddress,
  onAdjustPin,
  t,
}: {
  address: Address | undefined;
  needsPin: boolean;
  onPickAddress: () => void;
  onAddAddress: () => void;
  onAdjustPin: () => void;
  t: T;
}) {
  const c = useColors();
  const styles = useStyles();
  const pin = address ? addressPoint(address) : null;
  const showMap = mapsEnabled() && !!address && !!pin;

  return (
    <View testID="buy-address-card" style={{ gap: nativeLayout.groupGap }}>
      <View style={styles.card}>
        {showMap && pin ? (
          <View testID="buy-map-preview" style={styles.mapWrap}>
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mapBox}>
              <MapView
                key={`${pin.lat},${pin.lng}`}
                provider={PROVIDER_GOOGLE}
                liteMode
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                initialRegion={{ latitude: pin.lat, longitude: pin.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 }}
                style={{ flex: 1 }}
              />
              <View style={styles.pinOverlay}>
                <Ionicons name="location" size={32} color={c.forest} />
              </View>
            </View>
            <PressableScale
              testID="buy-adjust-pin"
              accessibilityRole="button"
              accessibilityLabel={t("Sesuaikan titik di peta", "Adjust pin on the map")}
              haptic="tap"
              onPress={onAdjustPin}
              style={styles.adjustChip}
            >
              <Ionicons name="locate-outline" size={16} color={c.forest} accessible={false} importantForAccessibility="no" />
              {/* forest: action */}
              <Text variant="caption" style={{ color: c.forest }}>
                {t("Sesuaikan titik", "Adjust pin")}
              </Text>
            </PressableScale>
          </View>
        ) : null}
        <View style={styles.rowPad}>
          <FieldRow
            id="address"
            icon="location-outline"
            minHeight={nativeLayout.row.media}
            trailing={
              <Button
                variant="text"
                label={address ? t("Ganti alamat", "Change address") : t("Tambah alamat", "Add address")}
                accessibilityLabel={address ? t("Ganti alamat", "Change address") : t("Tambah alamat", "Add address")}
                onPress={address ? onPickAddress : onAddAddress}
              />
            }
          >
            <Text variant="meta">{t("Diantar ke", "Delivered to")}</Text>
            {address ? (
              <>
                <Text variant="bodyStrong">{address.label}</Text>
                <Text variant="meta">{address.line}</Text>
              </>
            ) : (
              <Text variant="bodyStrong">{t("Belum ada alamat pengantaran.", "No delivery address yet.")}</Text>
            )}
          </FieldRow>
        </View>
      </View>

      {needsPin && address ? (
        <Card tone="attention" testID="buy-pin-note" style={styles.pinNote}>
          <View style={styles.pinText}>
            <Text variant="bodyStrong">{t("Tandai titik di peta", "Mark the spot on the map")}</Text>
            <Text variant="meta">
              {t("Sekali saja, supaya kurir sampai di pintu yang benar.", "Just once, so the courier reaches the right door.")}
            </Text>
          </View>
          <Button
            variant="secondary"
            label={t("Tandai", "Mark")}
            accessibilityLabel={t("Tandai titik di peta", "Mark the spot on the map")}
            onPress={onAdjustPin}
          />
        </Card>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: {
    ...cardEdge(c),
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  mapWrap: {
    position: "relative",
    height: 112,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  mapBox: {
    flex: 1,
  },
  pinOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    marginTop: -32,
    alignItems: "center",
  },
  adjustChip: {
    position: "absolute",
    right: nativeLayout.space.sm,
    bottom: nativeLayout.space.sm,
    minHeight: 44,
    paddingHorizontal: nativeLayout.space.md,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.secondaryBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowPad: {
    paddingHorizontal: nativeLayout.cardPadding - cardEdgeWidth(c),
  },
  pinNote: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md },
  pinText: { flex: 1, minWidth: 0 },
}));
