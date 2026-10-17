import { useCallback } from "react";
import { addressInUse, addressReplaceLine, addressUseLine, errorLabel, type Address, type AddressReplaceResult } from "@catera/domain";
import { plural, useMobile } from "@catera/mobile-core";
import { useActionSheet, useConfirm, useToast } from "@catera/mobile-ui";
import { goToTab, pushSheet } from "../nav";

/** The action sheet's key for "Tambah alamat baru"; address ids are UUIDs, so it never matches one. */
const NEW_ADDRESS = "baru";

/**
 * Deleting an address from Alamat (G13). The server says what still uses it (`address-use`):
 * - nothing: one confirm, then `address.delete` and the toast "Alamat dihapus";
 * - upcoming days: the in-use sheet ("Alamat ini masih dipakai untuk {n} pengantaran, {tanggal} sampai {tanggal}.") with
 *   "Pindahkan ke alamat lain", then the other addresses to pick from, then `address.replace`. When every day moved the
 *   server archives the old address too; otherwise a sheet says how many stayed, until when and which kitchen;
 * - only a payment still open: an error toast, since nothing can be moved yet.
 * `newAddressHref` is the form sheet for a new address in the list's context. A failed read or command ends in an
 * error toast whose "Coba lagi" runs `retry`.
 */
export function useAddressRemoval(newAddressHref: string) {
  const { runtime, command, t, locale } = useMobile();
  const confirm = useConfirm();
  const ask = useActionSheet();
  const toast = useToast();

  return useCallback(
    async (address: Address, addresses: Address[], retry: () => void) => {
      const deleted = () => toast.show({ message: t("Alamat dihapus", "Address deleted"), tone: "success" });
      try {
        const use = await runtime.api.addressUse(address.id);
        if (!addressInUse(use)) {
          const ok = await confirm({
            title: t("Hapus alamat ini?", "Delete this address?"),
            message: t(
              `${address.label} tidak muncul lagi di daftar alamat. Pesanan yang sudah dibayar tetap memakai alamat ini.`,
              `${address.label} leaves your address list. Orders you already paid for keep using it.`,
            ),
            confirmLabel: t("Hapus", "Delete"),
            cancelLabel: t("Batal", "Cancel"),
            tone: "danger",
            icon: "trash",
          });
          if (!ok) return;
          await command("address.delete", { addressId: address.id });
          deleted();
          return;
        }
        if (!use.count) {
          toast.show({ message: addressUseLine(use, locale), tone: "error" });
          return;
        }
        const move = await confirm({
          title: t("Alamat masih dipakai", "Address still in use"),
          message: addressUseLine(use, locale),
          confirmLabel: t("Pindahkan ke alamat lain", "Move to another address"),
          cancelLabel: t("Batal", "Cancel"),
        });
        if (!move) return;
        const choice = await ask({
          title: t("Pindahkan ke alamat mana?", "Move to which address?"),
          context: { title: address.label, lines: [address.line] },
          items: [
            ...addresses
              .filter((a) => a.id !== address.id)
              .map((a) => ({ key: a.id, label: `${a.label}, ${a.area}`, icon: "location-outline" })),
            { key: NEW_ADDRESS, label: t("Tambah alamat baru", "Add a new address"), icon: "add-outline" },
          ],
          closeLabel: t("Tutup", "Close"),
        });
        if (!choice) return;
        if (choice === NEW_ADDRESS) {
          pushSheet(newAddressHref);
          return;
        }
        const result = await command<AddressReplaceResult>("address.replace", { fromAddressId: address.id, toAddressId: choice });
        if (result.deleted) {
          deleted();
          return;
        }
        const left =
          addressReplaceLine(result, locale) ||
          addressUseLine({ ...use, count: 0, pendingCheckouts: result.pendingCheckouts }, locale);
        const schedule = await confirm({
          title: result.moved
            ? t(`${result.moved} pengantaran dipindahkan`, `${plural(result.moved, "delivery", "deliveries")} moved`)
            : t("Belum ada pengantaran yang dipindahkan", "No deliveries moved"),
          message: `${left} ${t(
            "Alamat lama tetap tersimpan sampai pengantaran itu selesai.",
            "The old address stays until those deliveries are done.",
          )}`,
          confirmLabel: t("Lihat jadwal", "See schedule"),
          cancelLabel: t("Tutup", "Close"),
        });
        if (schedule) goToTab("jadwal");
      } catch (e) {
        const code = (e as { code?: string }).code || (e as Error).message;
        toast.show({
          message: errorLabel(code, locale) || t("Alamat belum terhapus.", "The address was not deleted."),
          tone: "error", action: { label: t("Coba lagi", "Try again"), onPress: retry },
        });
      }
    },
    [runtime, command, t, locale, confirm, ask, toast, newAddressHref],
  );
}
