import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type ClaimPreview } from "@catera/domain";

let db: PGlite;
const cmd = (action: string, payload: object, user: string = U.owner) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
// The preview is read by anyone holding the link: signed out unless a user is named.
const preview = (token: string, user: string | null = null) =>
  localRpc<ClaimPreview>(db, user, "catera_v1_read", ["claim-preview", { token }]);
const q = async <T = any>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;

let address: any;
let seq = 0;
// An imported prepaid customer with an invitation link: returns the record id and the raw token.
async function invited(phone: string, extra: object = {}) {
  const rows = [{
    customer: { name: "Synthetic Preview " + ++seq, phone, address },
    packageId: P[2],
    portions: 1,
    startDate: addDays(localDay(), 10),
    remainingDays: 3,
    externalReference: "synthetic-preview-" + seq,
    ...extra,
  }];
  const staged = await cmd("import.preview", { catererId: K[0], rows });
  const committed = await cmd("import.commit", { catererId: K[0], id: staged.id });
  const customerRecordId = committed.subscriptions[0].customerRecordId as string;
  const invite = await cmd("customer.invite", { catererId: K[0], customerRecordId });
  return { customerRecordId, token: invite.path.split("/").at(-1) as string };
}

beforeAll(async () => {
  db = await createDemoDatabase(true);
  address = (await q("select line,area,city,instructions from v1.addresses limit 1"))[0];
});
afterAll(async () => db?.close());

it("returns exactly the seven preview fields", async () => {
  const { customerRecordId, token } = await invited("+6281234560001");
  const result = await preview(token);
  expect(Object.keys(result).sort()).toEqual([
    "addressLabel",
    "catererName",
    "maskedPhone",
    "nextDate",
    "nextWindow",
    "packageName",
    "remainingDays",
  ]);
  const text = JSON.stringify(result);
  expect(text).not.toContain(customerRecordId);
  expect(text).not.toContain("+6281234560001");
  expect(text).not.toContain(address.line);
  const [{ name }] = await q("select name from v1.caterers where id=$1", [K[0]]);
  expect(result.catererName).toBe(name);
  expect(result.packageName).toBe(
    (await q("select offer->>'name' n from v1.packages where id=$1", [P[2]]))[0].n,
  );
  expect(result.remainingDays).toBe(3);
  const [{ next }] = await q(
    "select min(d.service_date)::text next from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.customer_record_id=$1 and d.status<>'cancelled'",
    [customerRecordId],
  );
  expect(result.nextDate).toBe(next);
  expect(result.nextWindow).toBe("11.00–13.00");
  // The address line is cut to 24 characters when it has no label.
  expect(result.addressLabel).toBe(address.line.slice(0, 24));
});

it("is available to signed-in users as well as anonymous visitors", async () => {
  const { token } = await invited("+6281234560002");
  expect(await preview(token, U.customer)).toEqual(await preview(token, null));
});

it("uses the address label when there is one", async () => {
  const { customerRecordId, token } = await invited("+6281234560003");
  await db.query(
    "update v1.customer_records set address=address||'{\"label\":\"Rumah Ibu\"}'::jsonb where id=$1",
    [customerRecordId],
  );
  expect((await preview(token)).addressLabel).toBe("Rumah Ibu");
});

it("masks the phone", async () => {
  const { token } = await invited("+6281234560008");
  expect((await preview(token)).maskedPhone).toBe("0812-•••-0008");
  const other = await invited("+62857123456789");
  expect((await preview(other.token)).maskedPhone).toBe("0857-•••-6789");
});

it("has no next delivery once every day is cancelled", async () => {
  const { customerRecordId, token } = await invited("+6281234560004");
  await db.query(
    "update v1.delivery_days set status='cancelled' where subscription_id in (select id from v1.subscriptions where customer_record_id=$1)",
    [customerRecordId],
  );
  const result = await preview(token);
  expect(result.remainingDays).toBe(0);
  expect(result.nextDate).toBeNull();
  expect(result.nextWindow).toBeNull();
  expect(result.packageName).not.toBe("");
});

it("unknown, used and expired tokens are all the same NOT_FOUND", async () => {
  const used = await invited("+6281234560005");
  await db.query("update v1.customer_claims set used_at=now() where customer_record_id=$1", [
    used.customerRecordId,
  ]);
  const expired = await invited("+6281234560006");
  await db.query(
    "update v1.customer_claims set expires_at=now()-interval '1 second' where customer_record_id=$1",
    [expired.customerRecordId],
  );
  const failures: string[] = [];
  for (const token of ["f".repeat(64), used.token, expired.token]) {
    try {
      await preview(token);
      failures.push("resolved");
    } catch (e) {
      failures.push((e as Error).message);
    }
  }
  expect(failures).toEqual(["NOT_FOUND", "NOT_FOUND", "NOT_FOUND"]);
});

it("a re-issued invitation retires the previous link", async () => {
  const first = await invited("+6281234560007");
  const second = await cmd("customer.invite", {
    catererId: K[0],
    customerRecordId: first.customerRecordId,
  });
  await expect(preview(first.token)).rejects.toThrow("NOT_FOUND");
  expect((await preview(second.path.split("/").at(-1))).maskedPhone).toBe("0812-•••-0007");
});

it("rejects a malformed token as invalid input", async () => {
  await expect(preview("short")).rejects.toThrow("INVALID_INPUT");
  await expect(
    localRpc(db, null, "catera_v1_read", ["claim-preview", { token: "f".repeat(64), id: "x" }]),
  ).rejects.toThrow("INVALID_INPUT");
});
