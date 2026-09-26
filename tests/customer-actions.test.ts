import { describe, expect, it } from "vitest";
import {
  compareCustomerActions,
  customerActionPresentation,
  type CustomerActionItem,
} from "@catera/domain";
import {
  decodeAttentionCursor,
  encodeAttentionCursor,
} from "../apps/web/src/lib/attention-cursor";

const item = (
  value: Partial<CustomerActionItem> &
    Pick<CustomerActionItem, "id" | "status">,
): CustomerActionItem => ({
  kind: "payment_action",
  priority: 1,
  href: "/payment/example",
  ...value,
});

describe("customer action presentation", () => {
  it("keeps urgent payment and menu copy explicit in Indonesian and English", () => {
    const menu = item({
      id: "menu-1",
      kind: "menu_choice_due",
      status: "selection_due",
    });
    const payment = item({ id: "payment-1", status: "payment_exception" });
    expect(customerActionPresentation(menu, "id")).toMatchObject({
      title: "Pilih menu sebelum batas waktu",
      action: "Pilih menu",
      tone: "urgent",
    });
    expect(customerActionPresentation(payment, "en")).toMatchObject({
      title: "Payment received, booking needs review",
      action: "View order",
      tone: "urgent",
    });
  });

  it("orders by priority, due time, then stable id", () => {
    const values = [
      item({ id: "b", status: "open", dueAt: "2026-09-28T01:00:00Z" }),
      item({ id: "c", status: "open", priority: 0 }),
      item({ id: "a", status: "open", dueAt: "2026-09-28T01:00:00Z" }),
    ];
    expect(values.sort(compareCustomerActions).map(({ id }) => id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});

describe("seller attention cursor", () => {
  it("round trips only the stable keyset fields", () => {
    const cursor = {
      priority: 1,
      at: "2026-09-26T04:00:00.000Z",
      id: "issue-stable-id",
    };
    expect(decodeAttentionCursor(encodeAttentionCursor(cursor))).toEqual(
      cursor,
    );
    expect(() => decodeAttentionCursor("not-json")).toThrow("INVALID_INPUT");
  });
});
