import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as C,
} from "../packages/backend/src/seed.ts";
export async function verifyJourneyReads(pool, cmd, evidence) {
  await pool.query(
    await readFile(
      "supabase/migrations/20260924150757_caterer_journey_reads.sql",
      "utf8",
    ),
  );
  const read = async (actor, resource, params) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        actor,
      ]);
      const result = await client.query(
        "select public.catera_v1_read($1,$2) value",
        [resource, params],
      );
      await client.query("rollback");
      return result.rows[0].value;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };
  await pool.query(
    "insert into v1.customer_records(caterer_id,name,origin) select $1,'Journey pagination '||lpad(i::text,3,'0'),'seller' from generate_series(1,103)i",
    [C[0]],
  );
  const first = await read(U.owner, "seller-customers", {
    id: C[0],
    search: "JOURNEY pagination",
  });
  const last = await read(U.staff, "seller-customers", {
    id: C[0],
    search: "Journey pagination",
    offset: 100,
  });
  assert.equal(first.total, 103);
  assert.equal(first.customers.length, 100);
  assert.equal(last.total, 103);
  assert.equal(last.customers.length, 3);
  await assert.rejects(
    read(U.customer, "seller-customers", { id: C[0], search: "Journey" }),
    /FORBIDDEN/,
  );
  await assert.rejects(read(U.owner, "seller", { id: C[1] }), /FORBIDDEN/);
  const date = (
    await pool.query(
      "select d.service_date::text as service_day from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=$1 and d.status<>'cancelled' order by d.service_date desc limit 1",
      [C[0]],
    )
  ).rows[0].service_day;
  const saved = await cmd(
    "production.freeze",
    { catererId: C[0], date },
    U.owner,
  );
  const production = (await read(U.staff, "seller", { id: C[0], date }))
    .latestProduction;
  assert.equal(production.id, saved.id);
  assert.equal(production.changed, false);
  assert(production.createdAt);
  assert.equal(
    (
      await pool.query(
        "select has_function_privilege('authenticated','public.catera_v1_read_journeys_base(text,jsonb)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  evidence.push(
    "Journey reads: customer search paginates matching totals across 103 tenant-scoped records; customer and cross-tenant reads fail; staff recover the latest whole-day production revision; the private base RPC cannot bypass authorization.",
  );
}
