import pg from "pg";
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
// tsx supplies the workspace's TypeScript package exports to Node.
import {
  localBootstrap,
  seedSQL,
  PACKAGE_IDS,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";
let embedded, pool;
let evidence = [];
async function cmd(action, payload, user, id = crypto.randomUUID()) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)",
      [user],
    );
    const r = await c.query("select public.catera_v1_command($1,$2,$3) value", [
      action,
      payload,
      id,
    ]);
    await c.query("commit");
    return r.rows[0].value;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
try {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    await mkdir(".data/tests", { recursive: true });
    const dir = await mkdtemp(path.resolve(".data/tests/postgres-v1-"));
    embedded = new EmbeddedPostgres({
      databaseDir: dir,
      user: "postgres",
      password: "local-synthetic-test",
      port: 55439,
      persistent: true,
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: () => {},
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase("catera_test");
    url =
      "postgresql://postgres:local-synthetic-test@127.0.0.1:55439/catera_test";
  }
  if (new URL(url).pathname !== "/catera_test")
    throw Error("Use an empty disposable database named catera_test");
  pool = new pg.Pool({ connectionString: url, max: 8 });
  if (
    (
      await pool.query(
        "select exists(select 1 from pg_namespace where nspname='v1') yes",
      )
    ).rows[0].yes
  )
    throw Error("Existing data is never reset by this test");
  await pool.query(localBootstrap);
  for (const file of [
    "202609090001_marketplace.sql",
    "202609090002_services.sql",
    "202609090003_hardening.sql",
    "202609090004_storage.sql",
    "202609090005_realtime.sql",
  ])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  await pool.query(seedSQL());
  const users = Array.from({ length: 5 }, () => crypto.randomUUID());
  const addresses = [];
  for (const user of users) {
    await pool.query(
      "insert into v1.profiles(id,name) values($1,'Synthetic concurrent customer')",
      [user],
    );
    const a = await cmd(
      "address.save",
      {
        label: "Test",
        line: "Jl. Sintetis No. 1",
        area: "Jakarta Selatan",
        city: "Jakarta",
        instructions: "",
      },
      user,
    );
    addresses.push(a.id);
  }
  const packageId = PACKAGE_IDS[3],
    date = addDays(localDay(), 200);
  await pool.query(
    'update v1.packages set offer=jsonb_set(offer,\'{capacity}\',\'{"1":3,"2":3,"3":3,"4":3,"5":3}\') where id=$1',
    [packageId],
  );
  const attempt = (i) =>
    cmd(
      "checkout.create",
      {
        packageId,
        addressId: addresses[i],
        portions: 1,
        startDate: date,
        trial: false,
        promo: "",
      },
      users[i],
    );
  const purchases = await Promise.allSettled(users.map((_, i) => attempt(i)));
  assert.equal(purchases.filter((r) => r.status === "fulfilled").length, 3);
  assert(
    purchases
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason.message.includes("CAPACITY")),
  );
  const demand = await pool.query(
    "select max(n) n from(select service_date,sum(portions)::int n from v1.reservations where package_id=$1 group by service_date)x",
    [packageId],
  );
  assert.equal(demand.rows[0].n, 3);
  evidence.push(
    "Five simultaneous purchases: exactly three committed at capacity three; complete schedules reserved.",
  );
  const winner = purchases.findIndex((r) => r.status === "fulfilled");
  const checkout = purchases[winner].value;
  const same = await Promise.all(
    Array.from({ length: 5 }, () =>
      cmd("checkout.demo_pay", { id: checkout.id }, users[winner]),
    ),
  );
  assert.equal(new Set(same.map((x) => x.subscriptionId)).size, 1);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.allocations where checkout_id=$1",
        [checkout.id],
      )
    ).rows[0].n,
    1,
  );
  evidence.push(
    "Five simultaneous payment confirmations: one subscription and one allocation.",
  );
  const deliver = (
    await pool.query(
      "select *,service_date::text service_day from v1.delivery_days where subscription_id=$1 order by service_date",
      [same[0].subscriptionId],
    )
  ).rows[0];
  const to = addDays(deliver.service_day, 14);
  await pool.query("insert into v1.capacity values($1,$2,0,false)", [
    packageId,
    to,
  ]);
  const result = await Promise.allSettled([
    cmd(
      "delivery.reschedule",
      { id: deliver.id, version: deliver.version, date: to },
      users[winner],
    ),
  ]);
  assert.equal(result[0].status, "rejected");
  assert.match(result[0].reason.message, /CAPACITY/);
  assert.equal(
    (
      await pool.query(
        "select service_date::text d from v1.delivery_days where id=$1",
        [deliver.id],
      )
    ).rows[0].d,
    deliver.service_day,
  );
  evidence.push(
    "A full replacement date rejects rescheduling without changing the original booking.",
  );
  const secondWinner = purchases.findIndex((r, i) => i !== winner && r.status === "fulfilled");
  const secondSubscription = await cmd("checkout.demo_pay", { id: purchases[secondWinner].value.id }, users[secondWinner]);
  const secondDay = (await pool.query("select *,service_date::text service_day from v1.delivery_days where subscription_id=$1 order by service_date", [secondSubscription.subscriptionId])).rows[0];
  await pool.query("update v1.capacity set slots=1 where package_id=$1 and service_date=$2", [packageId, to]);
  const contenders = [{ day: deliver, user: users[winner], checkoutId: checkout.id }, { day: secondDay, user: users[secondWinner], checkoutId: purchases[secondWinner].value.id }];
  const moves = await Promise.allSettled(contenders.map(({day, user}) => cmd("delivery.reschedule", {id:day.id, version:day.version, date:to}, user)));
  assert.equal(moves.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(moves.filter(r => r.status === "rejected").length, 1);
  const rejected = moves.findIndex(r => r.status === "rejected");
  assert.match(moves[rejected].reason.message, /CAPACITY/);
  const loser = contenders[rejected];
  assert.equal((await pool.query("select service_date::text service_day from v1.delivery_days where id=$1", [loser.day.id])).rows[0].service_day, loser.day.service_day);
  assert.equal((await pool.query("select portions from v1.reservations where checkout_id=$1 and service_date=$2 and state='confirmed'", [loser.checkoutId, loser.day.service_day])).rows[0].portions, 1);
  assert.equal((await pool.query("select sum(portions)::int n from v1.reservations where package_id=$1 and service_date=$2 and state='confirmed'", [packageId, to])).rows[0].n, 1);
  evidence.push("Two eligible customers race for one replacement slot: exactly one succeeds; the other retains the original confirmed reservation.");
  const scoped = await pool.connect();
  try {
    await scoped.query("begin");
    await scoped.query("set local role authenticated");
    await scoped.query("select set_config('request.jwt.claim.sub',$1,true)", [users[winner]]);
    const rows = (await scoped.query("select user_id from public.catera_v1_events")).rows;
    assert(rows.length > 0);
    assert(rows.every(row => row.user_id === users[winner]));
    await assert.rejects(scoped.query("insert into public.catera_v1_events(id,user_id,topic) values(gen_random_uuid(),$1,'forged')", [users[winner]]), /permission denied/);
    await scoped.query("rollback");
  } finally { scoped.release(); }
  evidence.push("Realtime signals enforce customer-specific SELECT access and reject direct authenticated writes.");
  await mkdir("output/verification", { recursive: true });
  await writeFile(
    "output/verification/postgres.json",
    JSON.stringify({ at: new Date().toISOString(), passed: evidence }, null, 2),
  );
  console.log(evidence.join("\n"));
} finally {
  await pool?.end();
  await embedded?.stop();
}
