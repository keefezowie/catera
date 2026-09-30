import { describe, expect, it } from "vitest";
import {
  compareCustomerActions,
  customerActionPresentation,
  groupCustomerActions,
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
  it.each([
    ["selection_due", "customer"],
    ["choose_method", "customer"],
    ["awaiting_payment", "customer"],
    ["responded", "customer"],
    ["checking_payment", "system"],
    ["open", "caterer"],
    ["escalated", "catera"],
    ["payment_exception", "catera"],
  ] as const)("assigns %s to %s independently of urgency", (status, actor) => {
    for (const locale of ["id", "en"] as const)
      expect(
        customerActionPresentation(item({ id: status, status }), locale)
          .nextActor,
      ).toBe(actor);
  });

  it("does not describe pending verification as received payment", () => {
    for (const locale of ["id", "en"] as const) {
      const presentation = customerActionPresentation(
        item({ id: "checking", status: "checking_payment" }),
        locale,
      );
      expect(presentation.tone).toBe("informative");
      expect(presentation.title).not.toMatch(/received|diterima/i);
    }
  });
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

describe("Home action groups", () => {
  const today = "2026-09-29";
  const menu = (id: string, dueAt?: string) =>
    item({
      id,
      status: "selection_due",
      kind: "menu_choice_due",
      dueAt,
    });

  it("separates customer work, status updates and booking reviews in feed order", () => {
    const values = [
      item({ id: "exception", status: "payment_exception", priority: 0 }),
      item({ id: "escalated", status: "escalated", priority: 0 }),
      item({ id: "method", status: "choose_method" }),
      item({ id: "payment", status: "awaiting_payment" }),
      item({ id: "checking", status: "checking_payment" }),
      item({ id: "response", status: "responded", kind: "delivery_issue" }),
      item({ id: "open", status: "open", kind: "delivery_issue" }),
      menu("later", "2026-10-02T08:00:00+07:00"),
      menu("near", "2026-09-30T08:00:00+07:00"),
    ];
    const groups = groupCustomerActions(values, today);
    expect(
      Object.fromEntries(
        Object.entries(groups).map(([key, entries]) => [
          key,
          entries.map(({ id }) => id),
        ]),
      ),
    ).toEqual({
      review: ["exception"],
      urgent: ["method", "payment", "response", "near"],
      updates: ["escalated", "checking", "open"],
      later: ["later"],
    });
    expect(groups.urgent[0]).toBe(values[2]);
    expect(values[0].id).toBe("exception");
  });

  it("counts zero customer tasks when every item is waiting or under review", () => {
    const groups = groupCustomerActions(
      ["checking_payment", "open", "escalated", "payment_exception"].map(
        (status) =>
          item({ id: status, status: status as CustomerActionItem["status"] }),
      ),
      today,
    );
    expect(groups.urgent).toEqual([]);
    expect(groups.later).toEqual([]);
    expect(groups.updates).toHaveLength(3);
    expect(groups.review).toHaveLength(1);
  });

  it("keeps today's, tomorrow's and missing deadlines immediate using Jakarta dates", () => {
    const groups = groupCustomerActions(
      [
        menu("missing"),
        menu("today", "2026-09-29T01:00:00Z"),
        menu("tomorrow", "2026-09-30T16:59:59Z"),
        menu("future", "2026-09-30T17:00:00Z"),
      ],
      today,
    );
    expect(groups.urgent.map(({ id }) => id)).toEqual([
      "missing",
      "today",
      "tomorrow",
    ]);
    expect(groups.later.map(({ id }) => id)).toEqual(["future"]);
    expect(groupCustomerActions([], today)).toEqual({
      review: [],
      urgent: [],
      updates: [],
      later: [],
    });
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
