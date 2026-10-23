import { AddressForm } from "../../src/account/AddressForm";
import { flowSheet } from "../../src/flowSheet";

/** The form over the purchase: "Tambah alamat baru" inside its Hapus opens this copy again, not the tab's. */
function FlowAddressForm() {
  return <AddressForm flow />;
}

/** The address form over a purchase; opened cold, it gives way to the tab's form over Alamat. */
export default flowSheet(FlowAddressForm, "/alamat-form");
