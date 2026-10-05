import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { applyDemoMigrations } from "../src/lib/demo-migrations";
import { localBootstrap, demoSeed, DEMO_USERS } from "../src/lib/demo-seed";
import { commandSchemas } from "../src/lib/validation";
import type { Delivery, Snapshot } from "../src/lib/types";
import {
  prepareCommandAttempt,
  commandOutcomeUnknown,
} from "../src/lib/command-attempt";
import {
  reviewBatch,
  reviewIsStale,
  remainingBatchRows,
} from "../src/components/operations-batch-model";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(localBootstrap);
  await applyDemoMigrations(db);
  await db.exec(demoSeed);
});
afterAll(async () => db?.close());

async function command(
  payload: object,
  user = DEMO_USERS.owner,
  key = crypto.randomUUID(),
  slug = "dapur-hijau",
  action = "transition",
) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    return (
      await tx.query<{ value: unknown }>(
        "select public.execute_command($1,$2,$3,$4) value",
        [slug, action, JSON.stringify(payload), key],
      )
    ).rows[0].value;
  });
}
async function snapshot() {
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
async function storedState(database = db) {
  const tables = [
    "deliveries",
    "production_versions",
    "quota_reservations",
    "quota_ledger",
    "delivery_events",
    "audit_events",
    "command_receipts",
  ];
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await database.query<{ rows: unknown }>(
            `select coalesce(jsonb_agg(value order by value::text),'[]') rows from (select to_jsonb(x) value from public.${table} x) items`,
          )
        ).rows[0].rows,
    ),
  );
}
function reviewed(s: Snapshot, d: Delivery) {
  return s.production
    .filter((p) => p.service_date === d.service_date && p.slot_id === d.slot_id)
    .sort((a, b) => b.revision - a.revision)[0];
}
async function scheduled() {
  const s = await snapshot();
  return {
    s,
    d: s.deliveries.find((d) => d.status === "scheduled" && reviewed(s, d))!,
  };
}

it("preserves and validates the optional reviewed production ID at the command boundary", () => {
  const payload = {
    id: crypto.randomUUID(),
    version: 1,
    status: "ready",
    production_id: crypto.randomUUID(),
  };
  expect(commandSchemas.transition.parse(payload)).toEqual(payload);
  expect(
    commandSchemas.transition.safeParse({
      ...payload,
      production_id: "revision 2",
    }).success,
  ).toBe(false);
});

it("blocks changed purchase details after a lost response and resolves the original receipt with one grant", async () => {
  const s = await snapshot();
  const payload = {
    customer_id: s.customers[0].id,
    package_id: s.packages[0].id,
    starts_on: s.deliveries[0].service_date,
    external_reference: "Unknown response test",
  };
  const input = { slug: s.business.slug, action: "purchase", payload };
  let minted = 0;
  const createId = () => {
    minted++;
    return crypto.randomUUID();
  };
  const initial = prepareCommandAttempt(null, input, createId).attempt;
  // The database commits, but the caller never receives this successful result.
  const committed = await command(
    payload,
    DEMO_USERS.owner,
    initial.requestId,
    input.slug,
    "purchase",
  );
  const unknown = { ...initial, unknown: true };
  const before = await storedState();
  const changed = prepareCommandAttempt(
    unknown,
    {
      ...input,
      payload: { ...payload, external_reference: "Edited after Back" },
    },
    createId,
  );
  expect(changed.blocked).toBe(true);
  expect(changed.attempt.requestId).toBe(initial.requestId);
  expect(minted).toBe(1);
  expect(await storedState()).toEqual(before);
  const replay = prepareCommandAttempt(unknown, input, createId);
  expect(replay.blocked).toBe(false);
  expect(replay.attempt.requestId).toBe(initial.requestId);
  expect(
    await command(
      replay.attempt.data.payload,
      DEMO_USERS.owner,
      replay.attempt.requestId,
      input.slug,
      "purchase",
    ),
  ).toEqual(committed);
  expect(await storedState()).toEqual(before);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from public.quota_grants g join public.purchases p on p.id=g.purchase_id where p.external_reference=$1",
        [payload.external_reference],
      )
    ).rows[0].count,
  ).toBe(1);
});

it("retains uncertainty when an original retry cannot authenticate or locate its receipt", () => {
  for (const code of [
    "SAVE_FAILED",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "IDEMPOTENCY_CONFLICT",
  ])
    expect(commandOutcomeUnknown(code, true)).toBe(true);
  expect(commandOutcomeUnknown("CONFLICT", true)).toBe(false);
  expect(commandOutcomeUnknown("INVALID_INPUT")).toBe(false);
});

it("resolves an unknown batch success with its original UUID even when the refreshed row is stale", async () => {
  const { s, d } = await scheduled();
  const [row] = reviewBatch(s, [d.id], "ready");
  const payload = {
    id: d.id,
    version: d.version,
    status: "ready",
    production_id: row.productionId,
  };
  const committed = await command(payload, DEMO_USERS.owner, row.requestId);
  const refreshed = await snapshot();
  expect(reviewIsStale(refreshed, row, "ready")).toBe(true);
  const remaining = remainingBatchRows(
    [row],
    [{ id: d.id, ok: false, code: "SAVE_FAILED", unknown: true }],
  );
  expect(remaining).toHaveLength(1);
  const before = await storedState();
  expect(
    await command(payload, DEMO_USERS.owner, remaining[0].requestId),
  ).toEqual(committed);
  expect(await storedState()).toEqual(before);
  expect(remainingBatchRows([row], [{ id: d.id, ok: true }])).toHaveLength(0);
});

it("accepts the current reviewed snapshot and replays the receipt without side effects", async () => {
  const { s, d } = await scheduled();
  const payload = {
    id: d.id,
    version: d.version,
    status: "ready",
    production_id: reviewed(s, d).id,
  };
  const key = crypto.randomUUID();
  const result = await command(payload, DEMO_USERS.admin, key);
  const after = await storedState();
  expect(await command(payload, DEMO_USERS.admin, key)).toEqual(result);
  expect(await storedState()).toEqual(after);
  expect((await snapshot()).deliveries.find((x) => x.id === d.id)?.status).toBe(
    "ready",
  );
  // Later states do not depend on a reviewed production revision.
  await command({
    id: d.id,
    version: d.version + 1,
    status: "out_for_delivery",
    production_id: crypto.randomUUID(),
  });
});

it("rejects an older reviewed revision after another delivery changes without mutating state", async () => {
  const { s, d } = await scheduled();
  const original = reviewed(s, d);
  const other = s.deliveries.find(
    (x) =>
      x.id !== d.id &&
      x.service_date === d.service_date &&
      x.slot_id === d.slot_id,
  )!;
  await command(
    {
      id: other.id,
      version: other.version,
      change: "address",
      address: { line: "Reviewed Production Street 21", city: "Jakarta" },
      reason: "Correct dispatch address",
    },
    DEMO_USERS.owner,
    undefined,
    undefined,
    "change_delivery",
  );
  const current = await snapshot();
  expect(reviewed(current, d).revision).toBe(original.revision + 1);
  expect(current.deliveries.find((x) => x.id === d.id)?.version).toBe(
    d.version,
  );
  const before = await storedState();
  await expect(
    command({
      id: d.id,
      version: d.version,
      status: "ready",
      production_id: original.id,
    }),
  ).rejects.toThrow("CONFLICT");
  expect(await storedState()).toEqual(before);
});

it("requires the delivery to appear in the latest complete frozen version", async () => {
  const { s, d } = await scheduled();
  const production = reviewed(s, d);
  await db.query(
    "update public.production_versions set entries=(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(entries) where value->>'id'<>$1) where id=$2",
    [d.id, production.id],
  );
  const before = await storedState();
  for (const review of [{ production_id: production.id }, {}]) {
    await expect(
      command({ id: d.id, version: d.version, status: "ready", ...review }),
    ).rejects.toThrow("PRODUCTION_INCOMPLETE");
    expect(await storedState()).toEqual(before);
  }
  await db.query(
    "update public.production_versions set entries=$1 where id=$2",
    [JSON.stringify(production.entries), production.id],
  );
});

it("keeps tenant and subscriber authorization ahead of production review", async () => {
  const { s, d } = await scheduled();
  const payload = {
    id: d.id,
    version: d.version,
    status: "ready",
    production_id: reviewed(s, d).id,
  };
  const before = await storedState();
  await expect(command(payload, DEMO_USERS.subscriber)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    command(payload, DEMO_USERS.admin, undefined, "rasa-rumah"),
  ).rejects.toThrow("UNAUTHORIZED");
  await expect(
    command(payload, DEMO_USERS.owner, undefined, "rasa-rumah"),
  ).rejects.toThrow("NOT_FOUND");
  const other = await db.query<{ id: string }>(
    "select id from public.production_versions where business_id<>$1 limit 1",
    [s.business.id],
  );
  await expect(
    command({ ...payload, production_id: other.rows[0].id }),
  ).rejects.toThrow("CONFLICT");
  expect(await storedState()).toEqual(before);
});

it("rolls back automatic freeze and default selection when the reviewed version mismatches", async () => {
  const { s } = await scheduled();
  const d = s.deliveries.find((x) => !reviewed(s, x) && !x.menu_id)!;
  await db.query(
    "insert into public.date_exceptions(business_id,service_date,cutoff_at) values($1,$2,now()-interval '1 hour')",
    [s.business.id, d.service_date],
  );
  const before = await storedState();
  await expect(
    command({
      id: d.id,
      version: d.version,
      status: "ready",
      production_id: crypto.randomUUID(),
    }),
  ).rejects.toThrow("CONFLICT");
  expect(await storedState()).toEqual(before);
});

it("upgrades an existing pre-ledger demo once while preserving all workflow rows and RPC permissions", async () => {
  const legacy = new PGlite();
  try {
    await legacy.exec(localBootstrap);
    await legacy.exec(
      await readFile("supabase/migrations/202609080001_core.sql", "utf8"),
    );
    await legacy.exec(demoSeed);
    const before = await storedState(legacy);
    const permissions = () =>
      legacy.query(
        "select proacl,proowner,prosecdef,proconfig from pg_proc where oid='public.execute_command(text,text,jsonb,uuid)'::regprocedure",
      );
    const acl = (await permissions()).rows;
    await applyDemoMigrations(legacy);
    expect(await storedState(legacy)).toEqual(before);
    expect((await permissions()).rows).toEqual(acl);
    await applyDemoMigrations(legacy);
    expect(await storedState(legacy)).toEqual(before);
    expect(
      (
        await legacy.query(
          "select name from catera.local_migrations order by name",
        )
      ).rows,
    ).toHaveLength(2);
    await expect(
      legacy.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          DEMO_USERS.owner,
        ]);
        const d = (
          await tx.query<{ id: string; version: number }>(
            "select id,version from public.deliveries where business_id=(select id from public.businesses where slug='dapur-hijau') and status='scheduled' and cutoff_at<now() limit 1",
          )
        ).rows[0];
        return tx.query("select public.execute_command($1,$2,$3,$4)", [
          "dapur-hijau",
          "transition",
          JSON.stringify({
            ...d,
            status: "ready",
            production_id: crypto.randomUUID(),
          }),
          crypto.randomUUID(),
        ]);
      }),
    ).rejects.toThrow("CONFLICT");
    expect(await storedState(legacy)).toEqual(before);
  } finally {
    await legacy.close();
  }
});
