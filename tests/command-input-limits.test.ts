import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U } from "../packages/backend/src/seed";

// Security audit 2026-11-04, M4: the RPC itself holds the API's text limits, since clients can call it directly.
let db: PGlite;
const cmd = (actor: string, action: string, payload: unknown) =>
  localRpc<any>(db, actor, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );
const address = {
  label: "Rumah",
  line: "Jalan Kenanga 12",
  area: "Kebayoran Baru",
  city: "Jakarta Selatan",
  instructions: "Titip satpam",
};

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("refuses addresses the API would refuse, including a missing label", async () => {
  for (const bad of [
    { ...address, label: "x".repeat(41) },
    { ...address, label: null },
    { ...address, label: 7 },
    { ...address, line: "Jl 1" },
    { ...address, line: "x".repeat(241) },
    { ...address, area: "" },
    { ...address, city: "x".repeat(101) },
    { ...address, instructions: "x".repeat(401) },
  ])
    expect(await failure(cmd(U.customer, "address.save", bad))).toContain("INVALID_INPUT");
  // At the limits, and with no instructions at all, the save goes through.
  expect(
    await failure(
      cmd(U.customer, "address.save", {
        ...address,
        label: "x".repeat(40),
        line: "x".repeat(240),
        instructions: "x".repeat(400),
      }),
    ),
  ).toBe("");
  const { instructions: _omit, ...withoutInstructions } = address;
  expect(await failure(cmd(U.customer, "address.save", withoutInstructions))).toBe("");
});

it("refuses over-long review, reply and help text before anything is stored", async () => {
  expect(
    await failure(
      cmd(U.customer, "review.save", { subscriptionId: crypto.randomUUID(), rating: 5, body: "x".repeat(2001) }),
    ),
  ).toContain("INVALID_INPUT");
  expect(
    await failure(cmd(U.owner, "review.reply", { id: crypto.randomUUID(), reply: "x".repeat(2001) })),
  ).toContain("INVALID_INPUT");
  for (const bad of [
    { subject: "", description: "Tidak sampai" },
    { subject: "x".repeat(201), description: "Tidak sampai" },
    { subject: "Pengantaran", description: "x".repeat(4001) },
    { subject: "Pengantaran" },
  ])
    expect(
      await failure(cmd(U.customer, "support.create", { subscriptionId: crypto.randomUUID(), ...bad })),
    ).toContain("INVALID_INPUT");
  // Within the limits the base command still decides (an unknown subscription is not this customer's).
  expect(
    await failure(cmd(U.customer, "support.create", { subscriptionId: crypto.randomUUID(), subject: "Pengantaran", description: "Tidak sampai" })),
  ).not.toContain("INVALID_INPUT");
});

it("keeps sign-in forgiving: profile.ensure trims and cuts a long name to 100 characters", async () => {
  const id = "00000000-0000-4000-8000-00000000b001";
  await cmd(id, "profile.ensure", { name: "  " + "N".repeat(150) + "  " });
  const { rows } = await db.query<{ name: string }>("select name from v1.profiles where id=$1", [id]);
  expect(rows[0].name).toBe("N".repeat(100));
});
