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
    ["/seller/schedule?date=not-a-date", "/"],
    ["//evil.example/seller", "/"],
    ["https://evil.example", "/"],
    ["/account", "/"],
  ])("maps %s to %s", (href, route) => {
    expect(dapurLink(href)).toBe(route);
  });
});
