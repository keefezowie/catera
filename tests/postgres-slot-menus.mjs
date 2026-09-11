import assert from "node:assert/strict";
import {
  DEMO_ACTORS,
  CATERER_IDS,
  PACKAGE_IDS,
} from "../packages/backend/src/seed.ts";
import { localDay, addDays } from "@catera/domain";
export async function verifySlotMenuConcurrency(pool, cmd, evidence) {
  const base = (
    await pool.query("select offer from v1.packages where id=$1", [
      PACKAGE_IDS[0],
    ])
  ).rows[0].offer;
  const template = {
    contentModel: "slots",
    meal: "lunch",
    name: "",
    description: "",
    image: "",
    composition: [{ id: "main", categoryId: "main", name: "Lauk", slots: 1 }],
    items: [],
    nutrition: null,
  };
  const p = await cmd(
    "package.save",
    {
      catererId: CATERER_IDS[0],
      slug: "concurrent-slot-menu",
      offer: {
        ...base,
        status: "published",
        packageType: "nasi_box",
        meal: "lunch",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        capacity: Object.fromEntries(
          [0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100]),
        ),
        menus: [template],
      },
    },
    DEMO_ACTORS.owner,
  );
  const month = addDays(localDay(), 120).slice(0, 7),
    dates = ["10", "11"].map((d) => ({ date: month + "-" + d, version: 0 }));
  const details = {
    ...template,
    items: [
      {
        id: "main:0",
        groupId: "main",
        categoryId: "main",
        name: "Synthetic chicken",
        description: "",
        image: "",
        serving: "1",
      },
    ],
  };
  const payload = {
    catererId: CATERER_IDS[0],
    packageId: p.id,
    contentRevision: 1,
    meal: "lunch",
    dates,
    details,
  };
  const race = await Promise.allSettled([
    cmd("menu.saveBatch", payload, DEMO_ACTORS.owner),
    cmd("menu.saveBatch", payload, DEMO_ACTORS.owner),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    race.find((r) => r.status === "rejected").reason.message,
    /CONFLICT/,
  );
  let rows = (
    await pool.query("select version from v1.menus where package_id=$1", [p.id])
  ).rows;
  assert.equal(rows.length, 2);
  assert(rows.every((r) => r.version === 1));
  await assert.rejects(
    cmd(
      "menu.saveBatch",
      { ...payload, dates: [{ ...dates[0], version: 1 }, dates[1]] },
      DEMO_ACTORS.owner,
    ),
    /CONFLICT/,
  );
  rows = (
    await pool.query("select version from v1.menus where package_id=$1", [p.id])
  ).rows;
  assert(rows.every((r) => r.version === 1));
  const request = crypto.randomUUID(),
    retry = { ...payload, dates: dates.map((d) => ({ ...d, version: 1 })) };
  await cmd("menu.saveBatch", retry, DEMO_ACTORS.owner, request);
  await cmd("menu.saveBatch", retry, DEMO_ACTORS.owner, request);
  assert(
    (
      await pool.query("select version from v1.menus where package_id=$1", [
        p.id,
      ])
    ).rows.every((r) => r.version === 2),
  );
  evidence.push(
    "Slot menu batches: concurrent writers accept exactly one complete batch, a later-date conflict rolls back earlier dates, and idempotent retry does not increment versions twice.",
  );
}
