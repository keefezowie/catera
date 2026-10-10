import { Redirect } from "expo-router";

/** Old /addresses links open Alamat. */
export default function OldAddresses() {
  return <Redirect href={"/alamat" as never} />;
}
