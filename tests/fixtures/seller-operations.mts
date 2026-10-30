// Explicit synthetic deliveries for the isolated ID 0006 browser database.
import { createDemoDatabase } from "../../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
} from "../../packages/backend/src/seed";
import { DEMO_STATE_DAY_LIKE } from "../../packages/backend/src/demo-states";
import { localDay, addDays } from "@catera/domain";
if (!process.env.CATERA_DEMO_DATA_DIR?.endsWith("seller-operations-test"))
  throw Error("Use isolated seller-operations-test storage");
const db = await createDemoDatabase();
try {
  const packages = (
    await db.query<{ id: string }>(
      "select id from v1.packages where caterer_id=$1 order by id",
      [K[0]],
    )
  ).rows;
  const existing = await db.query(
    "select id from v1.delivery_days where address->>'instructions'='Fixture ID 0006' and service_date=$1",
    [addDays(localDay(), -1)],
  );
  if (existing.rows.length) {
    await db.exec(
      "update v1.fulfillments set status='scheduled' where day_id in(select id from v1.delivery_days where address->>'instructions'='Fixture ID 0006'); update v1.delivery_days set status='scheduled',version=version+1 where address->>'instructions'='Fixture ID 0006';",
    );
    console.log("Reset only the isolated ID 0006 fixture statuses");
  }
  for (let i = 0; !existing.rows.length && i < 4; i++) {
    const date = addDays(localDay(), i === 3 ? 2 : -1),
      sub = crypto.randomUUID(),
      id = crypto.randomUUID();
    await db.query(
      "insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,$2,id,jsonb_build_object('offer',v1.offer(p)),2,$3,$3 from v1.packages p where id=$4",
      [sub, U.customer, date, packages[i % packages.length].id],
    );
    await db.query(
      "insert into v1.delivery_days(id,subscription_id,service_date,address) values($1,$2,$3,$4)",
      [
        id,
        sub,
        date,
        JSON.stringify({
          label: i % 2 ? "Kantor" : "Rumah",
          line: i % 2 ? "Jalan Sintetis Kantor 2" : "Jalan Sintetis Rumah 1",
          area: "Kelapa Gading",
          city: "Jakarta",
          instructions: "Fixture ID 0006",
        }),
      ],
    );
    await db.query(
      "insert into v1.fulfillments(day_id,meal) values($1,'lunch'),($1,'dinner')",
      [id],
    );
  }
  // A freshly seeded demo also carries the demo states (packages/backend/src/demo-states.ts), whose recently
  // completed plan delivered at Dapur Senja yesterday: a fourth row on this fixture's date. The spec counts only this
  // fixture's three, so that demo day is set aside here, as tests/fixtures/set-aside-demo-day.ts does for today's.
  const demoDays =
    "select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where d.id::text like $1 and d.service_date=$2 and p.caterer_id=$3 and d.status<>'cancelled'";
  const setAside = [DEMO_STATE_DAY_LIKE, addDays(localDay(), -1), K[0]];
  await db.query(`update v1.fulfillments set status='cancelled' where day_id in (${demoDays})`, setAside);
  await db.query(`update v1.delivery_days set status='cancelled' where id in (${demoDays})`, setAside);
  console.log("Seeded isolated seller operations browser fixtures");
} finally {
  await db.close();
}
