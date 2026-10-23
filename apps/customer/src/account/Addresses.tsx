import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { Address } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, FadeSwap, PressableRow, ReadError, Screen, Text, useColors, useListMotion } from "@catera/mobile-ui";
import { DecorativeIcon } from "../layout";
import { FLOW_HREF, pushSheet } from "../nav";
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
 * purchase stays underneath. Deleting an address is at the bottom of its edit form.
 */
export function Addresses({ flow = false }: { flow?: boolean }) {
  const { actor, ready, t } = useMobile();
  if (!ready) return <AddressesLoading />;
  if (!actor) return <SignInFirst title={t("Alamat", "Addresses")} next="/alamat" />;
  return <AddressBook key={actor.id} flow={flow} />;
}

/** The form route for this list's context: the tab's own sheet, or the copy over the purchase. */
export const addressFormHref = (flow: boolean, id?: string) =>
  `${flow ? FLOW_HREF.alamatForm : "/alamat-form"}${id ? `?id=${encodeURIComponent(id)}` : ""}`;

function AddressBook({ flow }: { flow: boolean }) {
  const { runtime, t } = useMobile();
  const c = useColors();
  const customer = useData("alamat:customer", () => runtime.api.customer());
  // An address the customer adds enters as a row; the book's first load enters as one block (Decision A).
  const rowMotion = useListMotion(customer.data?.addresses.map((a) => a.id) ?? null);

  if (!customer.data)
    return customer.error ? (
      <Screen>
        <ReadError art message={customer.error} onRetry={() => void customer.reload()} />
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
      {/* The book fades in from its skeleton as one block. The screen title already asks where meals go. */}
      <FadeSwap swapKey="ready" style={{ gap: 16 }}>
        {customer.data.addresses.map((a) => (
          <Animated.View key={a.id} testID="address-row" {...rowMotion(a.id)}>
            <AddressRow address={a} onEdit={() => pushSheet(addressFormHref(flow, a.id) as never)} />
          </Animated.View>
        ))}
        {!customer.data.addresses.length ? (
          <Text style={{ color: c.muted }}>{t("Belum ada alamat.", "No addresses yet.")}</Text>
        ) : null}
        <Button label={t("Tambah alamat", "Add address")} onPress={() => pushSheet(addressFormHref(flow) as never)} />
      </FadeSwap>
    </Screen>
  );
}

/**
 * One address as one press target: the whole card opens its edit form, with a pencil at the end edge. A screen reader
 * hears the address ("{label}, {line}, {area}, {city}") and the hint "Ubah alamat"; the pencil is drawn for the eye only.
 */
function AddressRow({ address: a, onEdit }: { address: Address; onEdit: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={`${a.label}, ${a.line}, ${a.area}, ${a.city}`}
      accessibilityHint={t("Ubah alamat", "Edit address")}
      onPress={onEdit}
      style={{ minHeight: 48 }}
    >
      <Card testID="address-card">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{a.label}</Text>
            <Text>{a.line}</Text>
            <Text variant="caption">
              {a.area}, {a.city}
            </Text>
            {a.instructions ? <Text variant="caption">{a.instructions}</Text> : null}
          </View>
          <View testID="address-edit-icon">
            <DecorativeIcon name="pencil-outline" size={20} color={c.muted} />
          </View>
        </View>
      </Card>
    </PressableRow>
  );
}
