import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { localBootstrap, demoSeed, DEMO_USERS } from "../src/lib/demo-seed";
import type { Snapshot } from "../src/lib/types";
let db: PGlite;
const query = async <T>(sql: string, args: unknown[] = []) =>
  db.query<T>(sql, args);
async function command(
  action: string,
  payload: unknown,
  user = DEMO_USERS.owner,
  key = crypto.randomUUID(),
) {
  if (
    [
      "save_settings",
      "save_slot",
      "save_exception",
      "publish_menu",
      "invite",
      "set_role",
    ].includes(action)
  )
    payload = {
      ...(payload as object),
      policy_version: (await snap()).business.version,
    };
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    return (
      await tx.query<{ value: { id: string; applied: number } }>(
        "select public.execute_command($1,$2,$3,$4) value",
        ["dapur-hijau", action, JSON.stringify(payload), key],
      )
    ).rows[0].value;
  });
}
async function snap() {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      DEMO_USERS.owner,
    ]);
    return (
      await tx.query<{ value: Snapshot }>(
        "select public.workspace_snapshot('dapur-hijau') value",
      )
    ).rows[0].value;
  });
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(localBootstrap);
  await db.exec(
    await readFile("supabase/migrations/202609080001_core.sql", "utf8"),
  );
  await db.exec(demoSeed);
});
afterAll(async () => db?.close());
function future(s: Snapshot, add = 4) {
  const d = new Date(s.now);
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
it("validates null versions in direct database RPCs", async () => {
  const s = await snap(),
    d = s.deliveries[0];
  await expect(
    command("change_delivery", {
      id: d.id,
      version: null,
      change: "skip",
      reason: "test",
    }),
  ).rejects.toThrow("CONFLICT");
});
it("fails an entire schedule batch when quota runs out", async () => {
  let s = await snap();
  const c = await command("save_customer", {
    name: "Atomic schedule test",
    email: "",
    phone: "",
    address: { line: "Test Street 15", city: "Jakarta" },
  });
  const p = await command("save_package", {
    name: "One delivery",
    deliveries: 1,
    validity_days: null,
  });
  await command("purchase", {
    customer_id: c.id,
    package_id: p.id,
    starts_on: future(s),
  });
  const date = future(s),
    weekday = new Date(date).getUTCDay();
  await expect(
    command("generate_schedule", {
      customer_id: c.id,
      starts_on: date,
      ends_on: date,
      weekdays: [weekday],
      slot_ids: s.slots.map((x) => x.id),
    }),
  ).rejects.toThrow("INSUFFICIENT_QUOTA");
  s = await snap();
  expect(s.deliveries.filter((d) => d.customer_id === c.id)).toHaveLength(0);
  expect(s.grants.find((g) => g.customer_id === c.id)?.reserved).toBe(0);
});
it("skips release quota and regenerating never recreates the tombstone", async () => {
  let s = await snap(),
    d = s.deliveries.find(
      (d) =>
        d.cutoff_at > s.now &&
        d.customer_id ===
          s.customers.find((c) => c.user_id === DEMO_USERS.subscriber)!.id,
    )!;
  await command(
    "change_delivery",
    { id: d.id, version: d.version, change: "skip" },
    DEMO_USERS.subscriber,
  );
  s = await snap();
  expect(s.deliveries.find((x) => x.id === d.id)?.status).toBe("cancelled");
  const count = s.deliveries.length;
  await command("generate_schedule", {
    customer_id: d.customer_id,
    starts_on: d.service_date,
    ends_on: d.service_date,
    weekdays: [new Date(d.service_date).getUTCDay()],
    slot_ids: [d.slot_id],
  });
  expect((await snap()).deliveries.length).toBe(count);
});
it("reschedules atomically and preserves the grant reservation", async () => {
  let s = await snap(),
    d = s.deliveries.find(
      (d) => d.cutoff_at > s.now && d.status === "scheduled",
    )!,
    target = future(s, 5);
  const before = s.grants.find((g) => g.id === d.grant_id)!;
  await command("change_delivery", {
    id: d.id,
    version: d.version,
    change: "reschedule",
    service_date: target,
    slot_id: d.slot_id,
  });
  s = await snap();
  const moved = s.deliveries.find((x) => x.id === d.id)!;
  expect(moved.service_date).toBe(target);
  expect(moved.grant_id).toBe(d.grant_id);
  expect(s.grants.find((g) => g.id === d.grant_id)?.reserved).toBe(
    before.reserved,
  );
  await expect(
    command("change_delivery", {
      id: d.id,
      version: moved.version,
      change: "reschedule",
      service_date: future(s, 100),
      slot_id: d.slot_id,
    }),
  ).rejects.toThrow("PACKAGE_EXPIRED");
  expect(
    (await snap()).deliveries.find((x) => x.id === d.id)?.service_date,
  ).toBe(target);
});
it("keeps failed deliveries reserved until explicit resolution", async () => {
  let s = await snap(),
    d = s.deliveries.find(
      (d) => d.cutoff_at < s.now && d.status === "scheduled",
    )!;
  for (const status of ["ready", "out_for_delivery", "failed"]) {
    await command("transition", {
      id: d.id,
      version: d.version,
      status,
      reason: "Synthetic failed attempt",
    });
    d = (await snap()).deliveries.find((x) => x.id === d.id)!;
  }
  expect(
    (await snap()).ledger.filter((l) => l.delivery_id === d.id),
  ).toHaveLength(0);
  await command("change_delivery", {
    id: d.id,
    version: d.version,
    change: "skip",
    reason: "Cancel failed attempt",
  });
  expect(
    (
      await query(
        "select * from public.quota_reservations where delivery_id=$1",
        [d.id],
      )
    ).rows,
  ).toHaveLength(0);
});
it("creates immutable revisions for post-cutoff address changes", async () => {
  let s = await snap(),
    d = s.deliveries.find(
      (d) => d.cutoff_at < s.now && d.status === "scheduled",
    )!;
  const versions = s.production.filter(
      (p) => p.service_date === d.service_date && p.slot_id === d.slot_id,
    ),
    last = versions.sort((a, b) => b.revision - a.revision)[0];
  await command("change_delivery", {
    id: d.id,
    version: d.version,
    change: "address",
    address: { line: "Revision Test Road 4", city: "Jakarta" },
    reason: "Correct dispatch address",
  });
  s = await snap();
  expect(s.production.find((p) => p.id === last.id)?.entries).toEqual(
    last.entries,
  );
  const fresh = s.production
    .filter((p) => p.service_date === d.service_date && p.slot_id === d.slot_id)
    .sort((a, b) => b.revision - a.revision)[0];
  expect(fresh.revision).toBe(last.revision + 1);
  expect(fresh.changes.some((c) => c.id === d.id)).toBe(true);
});
it("preserves purchased terms when a package definition changes", async () => {
  const s = await snap(),
    p = s.packages[0],
    purchase = s.purchases.find((x) => x.terms.id === p.id) || s.purchases[0],
    before = purchase.terms;
  await command("save_package", {
    id: p.id,
    version: p.version,
    name: "Updated package",
    deliveries: 99,
    validity_days: 60,
  });
  expect(
    (await snap()).purchases.find((x) => x.id === purchase.id)?.terms,
  ).toEqual(before);
});
it("only accepts invitations for the authenticated verified email", async () => {
  const s = await snap(),
    c = s.customers.find((c) => !c.user_id)!;
  await command("invite", {
    email: "invited@demo.catera.test",
    role: "subscriber",
    customer_id: c.id,
  });
  const uid = crypto.randomUUID();
  await query("insert into auth.users(id,email) values($1,$2)", [
    uid,
    "invited@demo.catera.test",
  ]);
  await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    await tx.query("select public.list_workspaces()");
  });
  expect((await snap()).customers.find((x) => x.id === c.id)?.user_id).toBe(
    uid,
  );
  await command("set_role", { user_id: uid, role: "revoked" });
  await expect(
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid,
      ]);
      await tx.query("select public.workspace_snapshot('dapur-hijau')");
    }),
  ).rejects.toThrow("UNAUTHORIZED");
});
it("prevents subscribers from invoking cron and integrity functions", async () => {
  await expect(
    db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select public.run_due_freezes()");
    }),
  ).rejects.toThrow("permission denied");
});
it("has identical translation keys in both languages", async () => {
  const id = JSON.parse(await readFile("messages/id.json", "utf8")),
    en = JSON.parse(await readFile("messages/en.json", "utf8"));
  expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  expect(Object.keys(id.error).sort()).toEqual(Object.keys(en.error).sort());
});
it("revises reviewed future recurrence without rewriting retained or skipped deliveries", async () => {
  let s = await snap();
  const customer = await command("save_customer", {
    name: "Recurrence test",
    email: "",
    phone: "",
    address: { line: "Test Schedule Street 8", city: "Jakarta" },
  });
  await command("purchase", {
    customer_id: customer.id,
    package_id: s.packages.find((p) => p.deliveries > 10)!.id,
    starts_on: future(s),
  });
  const input = {
    customer_id: customer.id,
    starts_on: future(s),
    ends_on: future(s, 6),
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    slot_ids: [s.slots[0].id],
  };
  await command("generate_schedule", input);
  s = await snap();
  const pattern = s.patterns.find((p) => p.customer_id === customer.id)!,
    original = s.deliveries.filter((d) => d.pattern_id === pattern.id);
  const keep = original[0];
  await command("revise_schedule", {
    ...input,
    id: pattern.id,
    version: pattern.version,
    ends_on: future(s, 5),
    slot_ids: s.slots.map((x) => x.id),
  });
  s = await snap();
  expect(s.deliveries.find((d) => d.id === keep.id)).toEqual(keep);
  expect(
    s.deliveries.filter(
      (d) => d.pattern_id === pattern.id && d.status === "scheduled",
    ),
  ).toHaveLength(4);
  expect(
    s.deliveries.filter(
      (d) => d.pattern_id === pattern.id && d.status === "cancelled",
    ),
  ).toHaveLength(1);
  expect(s.grants.find((g) => g.customer_id === customer.id)?.reserved).toBe(4);
  await expect(
    command("revise_schedule", {
      ...input,
      id: pattern.id,
      version: pattern.version,
    }),
  ).rejects.toThrow("CONFLICT");
  await command("revise_schedule", {
    ...input,
    id: pattern.id,
    version: pattern.version + 1,
  });
  s = await snap();
  expect(
    s.deliveries.filter(
      (d) => d.pattern_id === pattern.id && d.status === "scheduled",
    ),
  ).toHaveLength(2);
  const locked = s.deliveries.find((d) => d.id === keep.id)!;
  await query(
    "update public.deliveries set cutoff_at=clock_timestamp()-interval '1 second' where id=$1",
    [locked.id],
  );
  await expect(
    command("revise_schedule", {
      ...input,
      id: pattern.id,
      version: pattern.version + 2,
      slot_ids: [s.slots[1].id],
    }),
  ).rejects.toThrow("CUTOFF_REACHED");
  expect(
    (await snap()).patterns.find((p) => p.id === pattern.id)?.version,
  ).toBe(pattern.version + 2);
});
it("blocks incomplete production and records the delayed cutoff baseline before a correction", async () => {
  let s = await snap();
  const customer = await command("save_customer", {
    name: "Missing default test",
    email: "",
    phone: "",
    address: { line: "Production Street 19", city: "Jakarta" },
  });
  const date = future(s, 8),
    slot = s.slots[0].id;
  await command("purchase", {
    customer_id: customer.id,
    package_id: s.packages.find((p) => p.deliveries > 10)!.id,
    starts_on: date,
  });
  await command("generate_schedule", {
    customer_id: customer.id,
    starts_on: date,
    ends_on: date,
    weekdays: [new Date(date).getUTCDay()],
    slot_ids: [slot],
  });
  // Isolated fixture setup simulates an overdue job and a missing published default.
  await query(
    "delete from public.menu_offerings where business_id=$1 and service_date=$2 and slot_id=$3",
    [s.business.id, date, slot],
  );
  await query(
    "insert into public.date_exceptions values($1,$2,clock_timestamp()-interval '1 second',false)",
    [s.business.id, date],
  );
  await query(
    "update public.deliveries set cutoff_at=catera.cutoff_for(business_id,service_date) where customer_id=$1",
    [customer.id],
  );
  let d = (await snap()).deliveries.find((d) => d.customer_id === customer.id)!;
  await command("change_delivery", {
    id: d.id,
    version: d.version,
    change: "address",
    address: { line: "Corrected Dispatch Street 20", city: "Jakarta" },
    reason: "Late address correction",
  });
  s = await snap();
  const versions = s.production
    .filter((v) => v.service_date === date && v.slot_id === slot)
    .sort((a, b) => a.revision - b.revision);
  expect(versions).toHaveLength(2);
  expect(versions[0].entries[0].address.line).toBe("Production Street 19");
  expect(versions[0].incomplete).toBe(1);
  d = s.deliveries.find((x) => x.id === d.id)!;
  await expect(
    command("transition", { id: d.id, version: d.version, status: "ready" }),
  ).rejects.toThrow("PRODUCTION_INCOMPLETE");
  await command("publish_menu", {
    service_date: date,
    slot_id: slot,
    menu_ids: [s.menus[0].id],
    default_menu_id: s.menus[0].id,
    reason: "Resolve missing default",
  });
  s = await snap();
  d = s.deliveries.find((x) => x.id === d.id)!;
  expect(d.selection_source).toBe("default");
  expect(
    s.production.find((v) => v.service_date === date && v.slot_id === slot)
      ?.incomplete,
  ).toBe(0);
  await command("transition", {
    id: d.id,
    version: d.version,
    status: "ready",
  });
});
it("enforces business timezone and explicit date exceptions", async () => {
  const s = await snap(),
    date = future(s, 10);
  const defaultCutoff = (
    await query<{ cutoff: string }>(
      "select catera.cutoff_for($1,$2)::text cutoff",
      [s.business.id, date],
    )
  ).rows[0].cutoff;
  const dayBefore = new Date(date + "T14:00:00Z");
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  expect(new Date(defaultCutoff).toISOString()).toBe(dayBefore.toISOString());
  const exception = date + "T01:00:00Z";
  await command("save_exception", {
    service_date: date,
    cutoff_local: date + "T08:00",
    closed: false,
  });
  expect(
    new Date(
      (
        await query<{ cutoff: string }>(
          "select catera.cutoff_for($1,$2)::text cutoff",
          [s.business.id, date],
        )
      ).rows[0].cutoff,
    ).toISOString(),
  ).toBe(new Date(exception).toISOString());
  await command("save_exception", {
    service_date: future(s, 11),
    cutoff_at: "",
    closed: true,
  });
  const c = await command("save_customer", {
    name: "Closed date test",
    email: "",
    phone: "",
    address: { line: "Closed Date Street 18", city: "Jakarta" },
  });
  await command("generate_schedule", {
    customer_id: c.id,
    starts_on: future(s, 11),
    ends_on: future(s, 11),
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    slot_ids: [s.slots[0].id],
  });
  expect(
    (await snap()).deliveries.filter((d) => d.customer_id === c.id),
  ).toHaveLength(0);
});
it("allows late completion against an expired grant but prevents a new booking", async () => {
  let s = await snap(),
    d = s.deliveries.find(
      (d) => d.status === "scheduled" && d.cutoff_at < s.now,
    )!;
  await query(
    "update public.deliveries set service_date=$2::date-1,cutoff_at=catera.cutoff_for(business_id,$2::date-1) where id=$1",
    [d.id, s.now.slice(0, 10)],
  );
  await query(
    "update public.quota_grants set expires_on=$2::date-1 where id=$1",
    [d.grant_id, s.now.slice(0, 10)],
  );
  for (const status of ["ready", "out_for_delivery"]) {
    await command("transition", { id: d.id, version: d.version, status });
    d = (await snap()).deliveries.find((x) => x.id === d.id)!;
  }
  s = await snap();
  expect(s.grants.find((g) => g.id === d.grant_id)?.available).toBe(0);
  // Existing valid reservations remain the authority for recording late fulfillment.
  await command("transition", {
    id: d.id,
    version: d.version,
    status: "delivered",
  });
  expect((await snap()).deliveries.find((x) => x.id === d.id)?.status).toBe(
    "delivered",
  );
  await expect(
    command("generate_schedule", {
      customer_id: d.customer_id,
      starts_on: future(s, 12),
      ends_on: future(s, 12),
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      slot_ids: [d.slot_id],
    }),
  ).rejects.toThrow("INSUFFICIENT_QUOTA");
});
it("rejects a stale business policy version in a direct RPC", async () => {
  const s = await snap(),
    payload = {
      name: s.business.name,
      timezone: s.business.timezone,
      cutoff: s.business.cutoff,
      policy_version: s.business.version,
    };
  await command("save_settings", payload);
  await expect(
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        DEMO_USERS.owner,
      ]);
      await tx.query("select public.execute_command($1,$2,$3,$4)", [
        "dapur-hijau",
        "save_settings",
        JSON.stringify({ ...payload, name: "Stale overwrite" }),
        crypto.randomUUID(),
      ]);
    }),
  ).rejects.toThrow("CONFLICT");
  expect((await snap()).business.name).toBe(s.business.name);
});
it("applies row-level isolation to direct authenticated SELECT queries", async () => {
  const counts = await db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      DEMO_USERS.subscriber,
    ]);
    return (
      await tx.query<{ n: number }>(
        "select count(*)::int n from public.customers",
      )
    ).rows[0].n;
  });
  expect(counts).toBe(2); // One linked customer in each of two independent businesses.
  await expect(
    db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("select public.workspace_snapshot('dapur-hijau')");
    }),
  ).rejects.toThrow("permission denied");
});
it("restores a local database backup with ledger, reservations and production intact", async () => {
  const before = await snap(),
    backup = await db.dumpDataDir();
  const restored = new PGlite({ loadDataDir: backup });
  try {
    await restored.waitReady;
    const after = await restored.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        DEMO_USERS.owner,
      ]);
      return (
        await tx.query<{ value: Snapshot }>(
          "select public.workspace_snapshot('dapur-hijau') value",
        )
      ).rows[0].value;
    });
    expect(after.deliveries).toEqual(before.deliveries);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.grants).toEqual(before.grants);
    expect(after.production).toEqual(before.production);
    expect(
      (
        await restored.query<{ issues: unknown[] }>(
          "select public.check_integrity() issues",
        )
      ).rows[0].issues,
    ).toEqual([]);
  } finally {
    await restored.close();
  }
});
