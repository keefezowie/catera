import { Image, View } from "react-native";
import { router } from "expo-router";
import { currency, type SellerOffer } from "@catera/domain";
import { plural, useMobile } from "@catera/mobile-core";
import { Button, Card, Screen, Text } from "@catera/mobile-ui";
import { photoUri } from "../photo";

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/**
 * A package customers can already buy keeps its terms fixed, so it is shown read-only.
 * Changes go into a new package copied from this one.
 */
export function PackageDetail({ offer }: { offer: SellerOffer }) {
  const { runtime, t, locale } = useMobile();
  const groups = offer.menus[0]?.composition ?? [];
  const capacity = offer.weekdays.length ? offer.capacity[String(offer.weekdays[0])] : undefined;
  return (
    <Screen nativeTitle={offer.name}>
      {offer.image ? <Image source={{ uri: photoUri(offer.image, runtime.apiBase) }} style={{ height: 168, borderRadius: 14 }} /> : null}
      <Text>{offer.description}</Text>
      <Card>
        <Text variant="label">{`${offer.price === null ? "–" : currency(offer.price, locale)} ${t("per porsi", "per portion")}`}</Text>
        <Text variant="caption">{groups.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ")}</Text>
        <Text variant="caption">{offer.weekdays.map((d) => dayNames[d]).join(", ")}</Text>
        {capacity !== undefined ? <Text variant="caption">{t(`Kapasitas ${capacity} porsi per hari`, `Capacity ${plural(capacity, "portion")} a day`)}</Text> : null}
      </Card>
      <View style={{ gap: 8 }}>
        <Text variant="caption">
          {t(
            "Paket yang sudah tayang tidak bisa diubah supaya pelanggan tetap mendapat yang mereka beli. Untuk mengubah harga, isi atau kapasitas, buat paket baru dari paket ini.",
            "A live package can't change, so customers keep what they bought. To change price, contents or capacity, make a new package from this one.",
          )}
        </Text>
        <Button label={t("Salin jadi paket baru", "Copy into a new package")} onPress={() => router.push(`/paket/baru?from=${offer.id}`)} />
      </View>
    </Screen>
  );
}
