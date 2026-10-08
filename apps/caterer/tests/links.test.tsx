import { dapurLink } from "../src/links";

describe("dapurLink", () => {
  it.each([
    ["/seller/schedule?date=2026-10-08", "/?date=2026-10-08"],
    ["/seller?date=2026-10-08", "/?date=2026-10-08"],
    ["/seller/calendar?date=2026-10-08", "/?date=2026-10-08"],
    ["/seller", "/"],
    ["/seller/customers", "/pelanggan"],
    ["/seller/menu", "/menu"],
    ["/seller/settings#payout", "/aktifkan"],
    ["/seller/settings#help", "/usaha"],
    ["/seller/support?case=c-1", "/"],
    ["/seller/support?issue=5f0c8a52-1b7e-4c11-9a3e-1d2f3a4b5c6d", "/laporan/5f0c8a52-1b7e-4c11-9a3e-1d2f3a4b5c6d"],
    ["/seller/support?issue=../uang", "/"],
    ["/seller/schedule?date=not-a-date", "/"],
    ["//evil.example/seller", "/"],
    ["https://evil.example", "/"],
    ["/account", "/"],
  ])("maps %s to %s", (href, route) => {
    expect(dapurLink(href)).toBe(route);
  });
});
