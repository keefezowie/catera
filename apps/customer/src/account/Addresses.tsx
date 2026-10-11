import { View } from "react-native";
import { router } from "expo-router";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, FadeSwap, Screen, Text, useColors } from "@catera/mobile-ui";
import { FLOW_HREF } from "../nav";
import { ListSkeleton } from "../skeletons";
import { SignInFirst } from "./SignInFirst";

/** The address list's wait: its rows, under the screen's own header. */
function AddressesLoading() {
  const { t } = useMobile();
  return (
    <Screen>
      <ListSkeleton rows={3} label={t("Memuat alamat", "Loading addresses")} />
    </Screen>
  );
}

/**
 * Alamat: the delivery addresses. Adding and editing one is a native form sheet over this list (`/alamat-form`); from
 * Beli or Bayar (`flow`) the list and its form open over the purchase instead (`/pembelian/alamat-form`), so the
 * purchase stays underneath.
 */
export function Addresses({ flow = false }: { flow?: boolean }) {
  const { actor, ready, t } = useMobile();
  if (!ready) return <AddressesLoading />;
  if (!actor) return <SignInFirst title={t("Alamat", "Addresses")} next="/alamat" />;
  return <AddressBook key={actor.id} flow={flow} />;
}

/** The form route for this list's context: the tab's own sheet, or the copy over the purchase. */
const formHref = (flow: boolean, id?: string) =>
  `${flow ? FLOW_HREF.alamatForm : "/alamat-form"}${id ? `?id=${encodeURIComponent(id)}` : ""}`;

function AddressBook({ flow }: { flow: boolean }) {
  const { runtime, t } = useMobile();
  const c = useColors();
  const customer = useData("alamat:customer", () => runtime.api.customer());

  if (!customer.data)
    return customer.error ? (
      <Screen>
        <Text selectable style={{ color: c.danger }}>
          {customer.error}
        </Text>
        <Button label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
      </Screen>
    ) : (
      <Screen>
        <FadeSwap swapKey="loading">
          <ListSkeleton rows={3} label={t("Memuat alamat", "Loading addresses")} />
        </FadeSwap>
      </Screen>
    );

  return (
    <Screen>
      {/* The book fades in from its skeleton as one block. */}
      <FadeSwap swapKey="ready" style={{ gap: 16 }}>
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
                onPress={() => router.push(formHref(flow, a.id) as never)}
              />
            </View>
          </Card>
        ))}
        {!customer.data.addresses.length ? (
          <Text style={{ color: c.muted }}>{t("Belum ada alamat.", "No addresses yet.")}</Text>
        ) : null}
        <Button label={t("Tambah alamat", "Add address")} onPress={() => router.push(formHref(flow) as never)} />
      </FadeSwap>
    </Screen>
  );
}
