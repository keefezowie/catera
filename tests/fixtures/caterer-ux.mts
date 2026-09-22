import { createDemoDatabase } from "../../packages/backend/src/database";
import { CATERER_IDS } from "../../packages/backend/src/seed";
import { localDay, addDays, offerSchema } from "@catera/domain";
import { mkdir, writeFile } from "node:fs/promises";
if (
  process.env.CATERA_V1_DEMO !== "true" ||
  !process.env.CATERA_DEMO_DATA_DIR?.endsWith("caterer-ux-test")
)
  throw Error("Isolated synthetic storage required");
const db = await createDemoDatabase();
try {
  if (
    (await db.query("select 1 from v1.packages where slug='ux-p1'")).rows.length
  )
    throw Error("Fixture already exists; preserve it");
  const today = localDay(),
    date = addDays(today, -2);
  const base = (
    await db.query<{ offer: any }>(
      "select v1.offer(p) offer from v1.packages p where caterer_id=$1 order by id limit 1",
      [CATERER_IDS[0]],
    )
  ).rows[0].offer;
  const packages: string[] = [],
    users: string[] = [];
  for (const [i, meal] of ["both", "lunch", "dinner"].entries()) {
    const id = crypto.randomUUID();
    packages.push(id);
    const offer = {
      ...base,
      id,
      name: `UX P${i + 1}`,
      meal,
      menuSelectionMode: "caterer",
      days: 1,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 500])),
      menus: (meal === "both" ? ["lunch", "dinner"] : [meal]).map((m) => ({
        ...base.menus[0],
        meal: m,
      })),
    };
    offerSchema.parse(offer);
    await db.query(
      "insert into v1.packages(id,caterer_id,slug,offer,status) values($1,$2,$3,$4,'published')",
      [id, CATERER_IDS[0], `ux-p${i + 1}`, JSON.stringify(offer)],
    );
  }
  for (let i = 1; i <= 105; i++) {
    const id = crypto.randomUUID();
    users.push(id);
    await db.query("insert into v1.profiles(id,name) values($1,$2)", [
      id,
      `UX U${i} · Pelanggan sintetis`,
    ]);
  }
  const ids: Record<string, string> = {};
  async function row(
    name: string,
    u: number,
    p: number,
    portions: number,
    day: string,
    statuses: Record<string, string>,
    destination: string,
    trial = false,
    cancelled = false,
  ) {
    const sub = crypto.randomUUID(),
      id = crypto.randomUUID();
    ids[name] = id;
    await db.query(
      "insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,$2,id,jsonb_build_object('offer',v1.offer(p),'trial',$5::boolean),$3,$4,$4 from v1.packages p where id=$6",
      [sub, users[u - 1], portions, day, trial, packages[p - 1]],
    );
    await db.query(
      "insert into v1.delivery_days(id,subscription_id,service_date,address,status) values($1,$2,$3,$4,$5)",
      [
        id,
        sub,
        day,
        JSON.stringify({
          label: destination,
          line: `Jalan Sintetis ${destination}`,
          area: "Kelapa Gading",
          city: "Jakarta",
          instructions: "Isolated UX fixture",
        }),
        cancelled
          ? "cancelled"
          : Object.values(statuses).every((s) => s === "delivered")
            ? "delivered"
            : ["issue", "out_for_delivery", "preparing"].find((s) =>
                Object.values(statuses).includes(s),
              ) || "scheduled",
      ],
    );
    for (const [meal, status] of Object.entries(statuses))
      await db.query(
        "insert into v1.fulfillments(day_id,meal,status) values($1,$2,$3)",
        [id, meal, status],
      );
    await db.query(
      "insert into v1.capacity(package_id,service_date,slots) values($1,$2,500) on conflict do nothing",
      [packages[p - 1], day],
    );
  }
  await row(
    "A",
    1,
    1,
    3,
    date,
    { lunch: "scheduled", dinner: "scheduled" },
    "X",
  );
  await row("B", 2, 2, 2, date, { lunch: "preparing" }, "Y");
  await row("C", 1, 2, 1, date, { lunch: "delivered" }, "X", true);
  await row("D", 3, 3, 4, date, { dinner: "scheduled" }, "Z");
  await row(
    "E",
    4,
    1,
    2,
    date,
    { lunch: "cancelled", dinner: "cancelled" },
    "Q",
    false,
    true,
  );
  await row(
    "F",
    5,
    1,
    2,
    date,
    { lunch: "issue", dinner: "out_for_delivery" },
    "W",
  );
  await row(
    "dinner",
    1,
    3,
    4,
    addDays(today, -3),
    { dinner: "scheduled" },
    "X",
  );
  for (let i = 1; i <= 100; i++)
    await row(
      `scale${i}`,
      i,
      1,
      1,
      addDays(today, -4),
      { lunch: "scheduled", dinner: "issue" },
      `Long address ${i} Blok Sintetis Gedung Pengantaran Lantai 10`,
    );
  await db.query(
    "insert into v1.support_cases(user_id,caterer_id,subject,description) values($1,$2,'UX permintaan pelanggan','Synthetic support request')",
    [users[0], CATERER_IDS[0]],
  );
  await mkdir("output/playwright/caterer-ux", { recursive: true });
  await writeFile(
    "output/playwright/caterer-ux/fixture.json",
    JSON.stringify(
      {
        today,
        date,
        dinnerDate: addDays(today, -3),
        scaleDate: addDays(today, -4),
        emptyDate: addDays(today, -20),
        packages,
        users,
        ids,
      },
      null,
      2,
    ),
  );
  console.log(
    "Isolated mixed, dinner-only, empty and 100-order fixtures created",
  );
} finally {
  await db.close();
}
