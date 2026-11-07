import { useLocalSearchParams } from "expo-router";
import ProofRoute from "../app/(tabs)/(index,pelanggan,menu,usaha)/sampai";

jest.mock("expo-router", () => ({ useLocalSearchParams: jest.fn() }));
jest.mock("../src/today/ProofSheet", () => ({ ProofSheet: () => null }));

const UUID = "3f2b8c1e-7a4d-4e9b-8c21-5d6e7f809a1b";
const idsFrom = (ids: string | undefined) => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ meal: "lunch", date: "2026-10-08", ids });
  return ProofRoute().props.ids as string[];
};

describe("the Sampai route's ids", () => {
  it("keeps the stops' UUIDs", () => {
    expect(idsFrom(`${UUID},${UUID.toUpperCase()}`)).toEqual([UUID, UUID.toUpperCase()]);
  });

  it("a stray % does not crash the screen, and anything but a UUID is dropped", () => {
    expect(idsFrom(`100%,../x,,${UUID}`)).toEqual([UUID]);
    expect(idsFrom(undefined)).toEqual([]);
  });
});
