import assert from "node:assert/strict";
import { DEMO_ACTORS as U, CATERER_IDS as K, PACKAGE_IDS as P, ADDRESS_ID } from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";

export async function verifyPackageLifecycle(pool, cmd, evidence) {
  const offer = (await pool.query("select offer from v1.packages where id=$1", [P[0]])).rows[0].offer;
  const create = async () => cmd("package.save", { catererId: K[0], slug: crypto.randomUUID(), offer: { ...offer, status: "published", days: 1 } }, U.owner);
  const payload = (id, version = 1) => ({ catererId: K[0], id, version });
  const input = id => ({ packageId: id, addressId: ADDRESS_ID, portions: 1, startDate: addDays(localDay(), 90), trial: false });
  const p = await create();
  // Hold the package row so suspension commits before a waiting checkout.
  const lock = await pool.connect();
  try {
    await lock.query("begin");
    await lock.query("select set_config('request.jwt.claim.sub',$1,true)", [U.owner]);
    await lock.query("select public.catera_v1_command('package.suspend',$1,$2)", [payload(p.id), crypto.randomUUID()]);
    const buying = cmd("checkout.create", input(p.id), U.customer);
    const rejected = assert.rejects(buying, /NOT_AVAILABLE/);
    await lock.query("commit");
    await rejected;
  } finally { await lock.query("rollback"); lock.release(); }
  assert.equal((await pool.query("select count(*)::int n from v1.checkouts where package_id=$1", [p.id])).rows[0].n, 0);
  const archives = await Promise.allSettled([1, 2].map(() => cmd("package.archive", payload(p.id, 2), U.owner)));
  assert.equal(archives.filter(r => r.status === "fulfilled").length, 1);
  assert.match(archives.find(r => r.status === "rejected").reason.message, /CONFLICT/);

  // A pending payment may either activate first and block archive, or arrive
  // after archive and enter support. Neither ordering loses an obligation.
  const q = await create();
  const checkout = await cmd("checkout.create", input(q.id), U.customer);
  await cmd("package.suspend", payload(q.id), U.owner);
  await pool.query("update v1.checkouts set expires_at=now()-interval '1 minute' where id=$1", [checkout.id]);
  const race = await Promise.allSettled([
    cmd("package.archive", payload(q.id, 2), U.owner),
    cmd("checkout.demo_pay", { id: checkout.id }, U.customer),
  ]);
  assert.equal(race[1].status, "fulfilled");
  const stored = (await pool.query("select p.status,c.state,c.subscription_id from v1.packages p join v1.checkouts c on c.package_id=p.id where c.id=$1", [checkout.id])).rows[0];
  if (stored.status === "retired") {
    assert.equal(stored.state, "payment_exception");
    assert.equal(stored.subscription_id, null);
  } else {
    assert.equal(stored.status, "suspended");
    assert.ok(stored.subscription_id);
    assert.equal(race[0].status, "rejected");
    assert.match(race[0].reason.message, /PACKAGE_HAS_DELIVERIES/);
  }
  const privileges = (await pool.query("select has_function_privilege('authenticated','public.catera_v1_command_lifecycle_base(text,jsonb,uuid)','execute') as bypass, has_function_privilege('anon','public.catera_v1_command(text,jsonb,uuid)','execute') as anonymous")).rows[0];
  assert.deepEqual(privileges, { bypass: false, anonymous: false });
  evidence.push("Package suspension serializes with checkout; concurrent archive accepts one version; archive/payment races preserve deliveries or create a payment exception; legacy RPC bypass is denied.");
}
