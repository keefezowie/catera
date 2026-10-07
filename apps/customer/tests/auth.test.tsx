import { nativeReturnPath } from "../src/auth";

test.each([
  "//evil.example",
  "/\\evil.example",
  "https://evil.example",
  "/login",
  "/seller",
  "/admin",
  "/messages",
  "/compare",
])("rejects unsupported return destination %s", (path) => {
  expect(nativeReturnPath(path)).toBe("/");
});

test("returns to Bantuan and to a report with its query", () => {
  expect(nativeReturnPath("/bantuan")).toBe("/bantuan");
  expect(nativeReturnPath("/masalah/d-1?meal=lunch&jenis=belum")).toBe("/masalah/d-1?meal=lunch&jenis=belum");
});

test("an old /support return lands on Bantuan", () => {
  expect(nativeReturnPath("/support")).toBe("/bantuan");
  expect(nativeReturnPath("/support?checkoutId=ck-1")).toBe("/bantuan?checkoutId=ck-1");
});

test("old account screens return to their new places", () => {
  expect(nativeReturnPath("/account")).toBe("/akun");
  expect(nativeReturnPath("/addresses")).toBe("/alamat");
  expect(nativeReturnPath("/saved")).toBe("/disimpan");
});

test("a purchase destination survives sign-in", () => {
  expect(nativeReturnPath("/checkout/package-1?portions=2")).toBe("/checkout/package-1?portions=2");
});

test("nativeReturnPath accepts the new routes and rejects others", () => {
  for (const path of [
    "/claim/abc",
    "/renew/sub-1",
    "/hari/d-1",
    "/masalah/d-1",
    "/bayar/ck-1",
    "/paket/makan-siang",
    "/beli/p-1?portions=2",
    "/pilih-menu/s-1?date=2026-11-02&meal=lunch",
    "/jadwal",
    "/jelajah",
    "/akun",
    "/bantuan",
    "/alamat",
    "/pembayaran",
    "/notifications",
    "/disimpan",
  ])
    expect(nativeReturnPath(path)).toBe(path);
  for (const path of ["/admin", "/claim", "/claim/a/b", "/renew/", "/akun/x", "/seller/today"])
    expect(nativeReturnPath(path)).toBe("/");
});
