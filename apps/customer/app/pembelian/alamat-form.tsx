import { AddressForm } from "../../src/account/AddressForm";
import { flowSheet } from "../../src/flowSheet";

/** The address form over a purchase; opened cold, it gives way to the tab's form over Alamat. */
export default flowSheet(AddressForm, "/alamat-form");
