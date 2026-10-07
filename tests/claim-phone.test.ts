import { expect, it } from "vitest";
import { localCustomerPhone, phoneMatchesMask } from "@catera/domain";

it("matches a number to the claim preview's mask by its first and last four local digits", () => {
  expect(phoneMatchesMask("+6281234500001", "0812-•••-0001")).toBe(true);
  expect(phoneMatchesMask("+628123999990001", "0812-•••-0001")).toBe(true);
  expect(phoneMatchesMask("+6281299990000", "0812-•••-0001")).toBe(false);
  expect(phoneMatchesMask("+6285734500001", "0812-•••-0001")).toBe(false);
  // Too short to mask: nothing to compare, the claim itself still checks the number.
  expect(phoneMatchesMask("+6281234500001", "•••")).toBe(true);
});

it("writes an E.164 number the local way", () => {
  expect(localCustomerPhone("+6281234500001")).toBe("0812-3450-0001");
});
