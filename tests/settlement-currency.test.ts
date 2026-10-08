import { afterEach, describe, expect, it, vi } from "vitest";
import { settlementCurrency } from "@catera/domain";

const intl = (value: string, locale: "id" | "en") =>
  new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(BigInt(value));

describe("settlementCurrency", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    "0",
    "7",
    "999",
    "1000",
    "12345",
    "1234567",
    "250000000",
    "-1",
    "-999",
    "-1000",
    "-1234567",
    "9007199254740991",
    "9007199254740993",
    "123456789012345678901234567890",
    "-9007199254740993",
  ])("keeps the formatting of %s identical to Intl in both locales", (value) => {
    expect(settlementCurrency(value, "id")).toBe(intl(value, "id"));
    expect(settlementCurrency(value, "en")).toBe(intl(value, "en"));
  });

  it("never hands a BigInt to Intl, which Hermes rejects", () => {
    const Real = Intl.NumberFormat;
    class HermesLike extends Real {
      constructor(...args: ConstructorParameters<typeof Real>) {
        super(...args);
        const inner = new Real(...args);
        Object.defineProperty(this, "format", {
          value: (value: number | bigint) => {
            if (typeof value === "bigint") throw new TypeError("Cannot convert BigInt to number");
            return inner.format(value);
          },
        });
      }
    }
    const intlGlobal = Intl as unknown as { NumberFormat: unknown };
    intlGlobal.NumberFormat = HermesLike;
    try {
      expect(settlementCurrency("1234567", "id")).toBe("Rp 1.234.567");
      expect(settlementCurrency("-9007199254740993", "id")).toBe("-Rp 9.007.199.254.740.993");
      expect(settlementCurrency("-1500", "en")).toBe("-Rp 1.500");
    } finally {
      intlGlobal.NumberFormat = Real;
    }
  });

  it("shows zero instead of throwing on a malformed amount", () => {
    expect(settlementCurrency("", "id")).toBe("Rp 0");
    expect(settlementCurrency("abc", "id")).toBe("Rp 0");
  });
});
