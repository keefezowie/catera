import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U } from "../packages/backend/src/seed";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const cmd = (action: string, payload: unknown, user: string | null = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const tokensOf = async (user: string) =>
  (await db.query<{ token: string }>("select token from v1.devices where user_id=$1 order by token", [user])).rows.map(
    (r) => r.token,
  );
const tokenOwner = async (token: string) =>
  (await db.query<{ user_id: string }>("select user_id from v1.devices where token=$1", [token])).rows[0]?.user_id;

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => {
  await db.close();
});

it("removes the caller's own token", async () => {
  await cmd("device.register", { token: "ExponentPushToken[own-1]" });
  await cmd("device.register", { token: "ExponentPushToken[own-2]" });
  await expect(cmd("device.unregister", { token: "ExponentPushToken[own-1]" })).resolves.toEqual({ removed: 1 });
  expect(await tokensOf(U.customer)).toEqual(["ExponentPushToken[own-2]"]);
});

it("leaves another user's token in place", async () => {
  await cmd("device.register", { token: "ExponentPushToken[owner-phone]" }, U.owner);
  await expect(cmd("device.unregister", { token: "ExponentPushToken[owner-phone]" })).resolves.toEqual({ removed: 0 });
  expect(await tokenOwner("ExponentPushToken[owner-phone]")).toBe(U.owner);
});

it("repeating it returns removed 0", async () => {
  await cmd("device.register", { token: "ExponentPushToken[repeat]" });
  await expect(cmd("device.unregister", { token: "ExponentPushToken[repeat]" })).resolves.toEqual({ removed: 1 });
  await expect(cmd("device.unregister", { token: "ExponentPushToken[repeat]" })).resolves.toEqual({ removed: 0 });
  await expect(cmd("device.unregister", { token: "ExponentPushToken[never-registered]" })).resolves.toEqual({
    removed: 0,
  });
});

it("rejects extra keys and empty tokens", async () => {
  await cmd("device.register", { token: "ExponentPushToken[strict]" });
  for (const payload of [
    { token: "ExponentPushToken[strict]", userId: U.owner },
    { token: "" },
    {},
    { token: 7 },
    { token: null },
    { token: ["ExponentPushToken[strict]"] },
    [],
    JSON.stringify("ExponentPushToken[strict]"), // a JSON string, not an object
    null,
  ])
    await expect(cmd("device.unregister", payload), JSON.stringify(payload)).rejects.toThrow("INVALID_INPUT");
  expect(await tokenOwner("ExponentPushToken[strict]")).toBe(U.customer);
});

it("signed out is UNAUTHORIZED", async () => {
  await cmd("device.register", { token: "ExponentPushToken[signed-out]" });
  await expect(cmd("device.unregister", { token: "ExponentPushToken[signed-out]" }, null)).rejects.toThrow(
    "UNAUTHORIZED",
  );
  expect(await tokenOwner("ExponentPushToken[signed-out]")).toBe(U.customer);
});

it("other commands still reach the base", async () => {
  await cmd("device.register", { token: "ExponentPushToken[round-trip]" });
  expect(await tokenOwner("ExponentPushToken[round-trip]")).toBe(U.customer);
  await cmd("device.register", { token: "ExponentPushToken[round-trip]" }, U.owner);
  expect(await tokenOwner("ExponentPushToken[round-trip]")).toBe(U.owner);
  await expect(cmd("device.unregister", { token: "ExponentPushToken[round-trip]" }, U.owner)).resolves.toEqual({
    removed: 1,
  });
  await expect(cmd("no.such.action", {})).rejects.toThrow();
});
