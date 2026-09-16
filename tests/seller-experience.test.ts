import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import {
  destinationKey,
  operationalGroups,
  scheduleSummary,
  type SellerDelivery,
} from "@catera/domain";
let db: PGlite;
const cmd = (
  action: string,
  payload: object,
  actor: string = U.owner,
  key = crypto.randomUUID(),
) => localRpc<any>(db, actor, "catera_v1_command", [action, payload, key]);
const read = (resource: string, params: object = {}, actor: string = U.owner) =>
  localRpc<any>(db, actor, "catera_v1_read", [resource, params]);
const sys = (action: string, payload: object) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());
const bank = {
  catererId: K[0],
  bank: "Synthetic Bank",
  holder: "Synthetic Holder",
  accountNumber: "12345678901",
  recipientType: "INDIVIDUAL",
};
it("keeps submitted banks inactive, masks reads and receipts, restricts review, and retains the active bank during replacement", async () => {
  await expect(cmd("payoutDestination.submit", bank, U.staff)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    cmd("payoutDestination.submit", { ...bank, catererId: K[1] }),
  ).rejects.toThrow("FORBIDDEN");
  const key = crypto.randomUUID(),
    first = await cmd("payoutDestination.submit", bank, U.owner, key);
  expect(await cmd("payoutDestination.submit", bank, U.owner, key)).toEqual(
    first,
  );
  expect(JSON.stringify(first)).not.toContain(bank.accountNumber);
  expect((await read("payout-setup", { id: K[0] })).active).toBeNull();
  await expect(
    read("payout-destination-detail", { id: first.id }),
  ).rejects.toThrow("FORBIDDEN");
  expect(
    (
      await read(
        "payout-destination-detail",
        { id: first.id },
        U.platform_admin,
      )
    ).accountNumber,
  ).toBe(bank.accountNumber);
  await expect(
    cmd("payoutDestination.review", {
      id: first.id,
      version: first.version,
      decision: "approved",
      routingCode: "SYNTHETI",
      givenName: "Synthetic",
      surname: "Owner",
      reason: "Synthetic verified bank",
    }),
  ).rejects.toThrow("FORBIDDEN");
  await cmd(
    "payoutDestination.review",
    {
      id: first.id,
      version: first.version,
      decision: "approved",
      routingCode: "SYNTHETI",
      givenName: "Synthetic",
      surname: "Owner",
      reason: "Synthetic verified bank",
    },
    U.platform_admin,
  );
  expect(
    (await sys("payout.destination", { catererId: K[0] })).recipient
      .account_details.account_number,
  ).toBe(bank.accountNumber);
  const replacement = await cmd("payoutDestination.submit", {
    ...bank,
    accountNumber: "99999999999",
  });
  const state = await read("payout-setup", { id: K[0] });
  expect(state.active.id).toBe(first.id);
  expect(state.latest.id).toBe(replacement.id);
  expect(state.dispatchEnabled).toBe(false);
  await cmd(
    "payoutDestination.review",
    {
      id: replacement.id,
      version: replacement.version,
      decision: "rejected",
      reason: "Synthetic rejected replacement",
    },
    U.platform_admin,
  );
  expect((await read("payout-setup", { id: K[0] })).active.id).toBe(first.id);
  const audit = await db.query<{ details: any }>(
    "select details from v1.audit where action like 'payoutDestination.%'",
  );
  expect(JSON.stringify(audit.rows)).not.toContain(bank.accountNumber);
  await expect(
    localRpc(db, U.customer, "catera_v1_system", [
      "payout.destination",
      { catererId: K[0] },
    ]),
  ).rejects.toThrow("FORBIDDEN");
});
it("creates a conversation only for a linked tenant customer, reuses it and makes retry idempotent", async () => {
  const customer = crypto.randomUUID();
  await db.query(
    "insert into v1.customer_records(id,caterer_id,user_id,name,origin) values($1,$2,$3,'Synthetic contact','seller')",
    [customer, K[0], U.customer],
  );
  const payload = {
      catererId: K[0],
      customerRecordId: customer,
      body: "Synthetic menu update",
    },
    key = crypto.randomUUID();
  const result = await cmd("message.send", payload, U.staff, key);
  expect(await cmd("message.send", payload, U.staff, key)).toEqual(result);
  expect(
    await cmd("message.send", { ...payload, body: "Second message" }),
  ).toEqual(result);
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.messages where conversation_id=$1 and body='Synthetic menu update'",
        [result.id],
      )
    ).rows[0].n,
  ).toBe(1);
  await expect(
    cmd("message.send", { ...payload, catererId: K[1] }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(cmd("message.send", payload, U.customer)).rejects.toThrow(
    "FORBIDDEN",
  );
  const unlinked = await cmd("customer.save", {
    catererId: K[0],
    name: "Unlinked synthetic",
    phone: "+6281234567890",
    address: {
      line: "Synthetic road",
      area: "Kelapa Gading",
      city: "Jakarta",
      instructions: "",
    },
  });
  await expect(
    cmd("message.send", { ...payload, customerRecordId: unlinked.id }),
  ).rejects.toThrow("CUSTOMER_NOT_LINKED");
  const page = await read(
    "message-customers",
    { id: K[0], search: "Unlinked", offset: 0 },
    U.staff,
  );
  expect(page.items[0].user_id).toBeNull();
});
it("records account deletion intent without creating disputes, holding funds, or deleting users", async () => {
  const before = (await db.query("select count(*) from v1.support_cases")).rows;
  const result = await cmd("accountRequest.create", {
    catererId: K[0],
    kind: "deletion",
    body: "Synthetic deletion request",
  });
  expect((await read("account-requests"))[0].id).toBe(result.id);
  expect(await read("account-requests", {}, U.customer)).toEqual([]);
  await expect(
    cmd("accountRequest.resolve", {
      id: result.id,
      resolution: "Synthetic reviewed request",
    }),
  ).rejects.toThrow("FORBIDDEN");
  await cmd(
    "accountRequest.resolve",
    { id: result.id, resolution: "Synthetic reviewed request" },
    U.platform_admin,
  );
  expect((await read("account-requests"))[0].status).toBe("resolved");
  expect(
    (await db.query("select count(*) from v1.support_cases")).rows,
  ).toEqual(before);
  expect(
    (await db.query("select id from v1.profiles where id=$1", [U.owner])).rows,
  ).toHaveLength(1);
});
it("groups resolved menus and areas without losing row identities and includes cancelled filters", () => {
  const base = {
    id: "a",
    portions: 2,
    status: "scheduled",
    customer: { id: "c", name: "C" },
    address: { line: " Road ", area: " North ", city: "City" },
    meals: [{ meal: "lunch", status: "scheduled" }],
    offer: {
      id: "p",
      name: "Package",
      menus: [{ meal: "lunch", items: [{ name: "Chicken", serving: "100g" }] }],
    },
  } as SellerDelivery;
  const other = {
    ...base,
    id: "b",
    offer: {
      ...base.offer,
      menus: [
        {
          ...base.offer.menus[0],
          items: [{ ...base.offer.menus[0].items![0], name: "Fish" }],
        },
      ],
    },
  };
  const elsewhere = {
    ...base,
    id: "c",
    address: { ...base.address, area: "South" },
  };
  expect(
    operationalGroups([base, other, elsewhere], "lunch", "package"),
  ).toHaveLength(2);
  expect(
    operationalGroups([base, other, elsewhere], "lunch", "area"),
  ).toHaveLength(3);
  expect(
    operationalGroups([base, other, elsewhere], "lunch", "flat")[0].rows.map(
      (d) => d.id,
    ),
  ).toEqual(["a", "b", "c"]);
  expect(destinationKey(base.address)).toBe(
    destinationKey({ ...base.address, line: "road", area: "north" }),
  );
  expect(destinationKey(base.address)).not.toBe(
    destinationKey({ ...base.address, city: "Other" }),
  );
  const cancelled = {
    ...base,
    status: "cancelled",
    meals: [{ meal: "lunch", status: "cancelled" }],
  };
  expect(scheduleSummary([cancelled], "lunch").orders).toBe(0);
  expect(scheduleSummary([cancelled], "lunch", true)).toEqual({
    orders: 1,
    portions: 2,
    customers: 1,
    destinations: 1,
  });
});
