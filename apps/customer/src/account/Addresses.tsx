import { View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import type { Address } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, FadeSwap, Screen, StateArt, Text, useBusy, useColors, useListMotion } from "@catera/mobile-ui";
import { useAddressRemoval } from "./addressRemoval";
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
  // An address the customer adds enters as a row; the book's first load enters as one block (Decision A).
  const rowMotion = useListMotion(customer.data?.addresses.map((a) => a.id) ?? null);
  const remove = useAddressRemoval(formHref(flow));

  if (!customer.data)
    return customer.error ? (
      <Screen>
        <StateArt pose="bingung" />
        <Text selectable style={{ color: c.danger, textAlign: "center" }}>
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
          <Animated.View key={a.id} testID="address-row" {...rowMotion(a.id)}>
            <AddressRow
              address={a}
              onEdit={() => pushSheet(formHref(flow, a.id) as never)}
              onRemove={(retry) => remove(a, customer.data?.addresses ?? [], retry)}
            />
          </Animated.View>
        ))}
        {!customer.data.addresses.length ? (
          <Text style={{ color: c.muted }}>{t("Belum ada alamat.", "No addresses yet.")}</Text>
        ) : null}
        <Button label={t("Tambah alamat", "Add address")} onPress={() => pushSheet(formHref(flow) as never)} />
      </FadeSwap>
    </Screen>
  );
}

/**
 * One address with its two actions stacked at the end edge. Hapus stays busy from the press until the whole removal
 * settles (the in-use read, the sheets, then the delete or the move), so a second press sends nothing.
 */
function AddressRow({
  address: a,
  onEdit,
  onRemove,
}: {
  address: Address;
  onEdit: () => void;
  onRemove: (retry: () => void) => Promise<void>;
}) {
  const { t } = useMobile();
  const [busy, remove] = useBusy(onRemove);
  const press = () => void remove(press);
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{a.label}</Text>
          <Text>{a.line}</Text>
          <Text variant="caption">
            {a.area}, {a.city}
          </Text>
          {a.instructions ? <Text variant="caption">{a.instructions}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Button
            variant="text"
            label={t("Ubah", "Edit")}
            accessibilityLabel={t(`Ubah ${a.label}`, `Edit ${a.label}`)}
            onPress={onEdit}
          />
          <Button
            variant="text"
            label={t("Hapus", "Delete")}
            accessibilityLabel={t(`Hapus ${a.label}`, `Delete ${a.label}`)}
            busy={busy}
            onPress={press}
          />
        </View>
      </View>
    </Card>
  );
}
