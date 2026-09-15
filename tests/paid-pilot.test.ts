import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  parsePilotTable,
  normalizeCustomerPhone,
} from "@catera/domain";
let db: PGlite;
const cmd = (
  action: string,
  payload: any,
  user: string = U.owner,
  key = crypto.randomUUID(),
) => localRpc<any>(db, user, "catera_v1_command", [action, payload, key]);
const read = (resource: string, params: any, user: string = U.owner) =>
  localRpc<any>(db, user, "catera_v1_read", [resource, params]);
const sys = (action: string, payload: any = {}) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
const phone = "+6281234501234",
  user = crypto.randomUUID();
let address: any, guest: any, subscription: string, day: any;
const row = (extra: any = {}) => ({
  customer: { name: "Synthetic Pilot Customer", phone, address },
  packageId: P[2],
  portions: 2,
  startDate: addDays(localDay(), 10),
  remainingDays: 3,
  externalReference: "synthetic-receipt-001",
  ...extra,
});
const batch = async (rows: any[]) => {
  const p = await cmd("import.preview", { catererId: K[0], rows });
  return cmd("import.commit", { catererId: K[0], id: p.id });
};
beforeAll(async () => {
  db = await createDemoDatabase(true);
  address = (
    await db.query<any>(
      "select line,area,city,instructions from v1.addresses limit 1",
    )
  ).rows[0];
  await db.query("insert into v1.profiles(id,name) values($1,$2)", [
    user,
    "Synthetic Claim Account",
  ]);
});
afterAll(async () => db?.close());

it("parses quoted CSV and Excel paste without executing cells and enforces 100 rows", () => {
  expect(parsePilotTable('name,phone\n"A, B",081234567890')).toEqual([
    { name: "A, B", phone: "081234567890" },
  ]);
  expect(parsePilotTable("name\tphone\n=1+1\t081234567890")[0].name).toBe(
    "=1+1",
  );
  expect(normalizeCustomerPhone("0812 3450 1234")).toBe(phone);
  expect(() =>
    parsePilotTable("name\n" + Array(101).fill("A").join("\n")),
  ).toThrow("IMPORT_LIMIT");
});

it('expires invitations and rejects cutoff violations without creating obligations', async()=>{
 const p=row({customer:{name:'Expiry test',phone:'+6281234590001',address},startDate:addDays(localDay(),240),externalReference:'expiry-test'});
 const imported=await batch([p]);const record=imported.subscriptions[0];
 const invite=await cmd('customer.invite',{catererId:K[0],customerRecordId:record.customerRecordId});
 await db.query("update v1.customer_claims set expires_at=now()-interval '1 second' where customer_record_id=$1",[record.customerRecordId]);
 await expect(sys('pilot.claim',{userId:user,verifiedPhone:p.customer.phone,token:invite.path.split('/').at(-1),requestId:crypto.randomUUID()})).rejects.toThrow('CLAIM_UNAVAILABLE');
 await expect(batch([row({customer:{name:'Cutoff test',phone:'+6281234590002',address},startDate:localDay(),externalReference:'cutoff-test'})])).rejects.toThrow('CUTOFF');
 expect((await db.query('select 1 from v1.customer_records where phone=$1',['+6281234590002'])).rows).toHaveLength(0);
});
it("imports without accounts, preserves obligations and includes names in production", async () => {
  const p = await cmd("import.preview", { catererId: K[0], rows: [row()] });
  expect(p.rows[0].preview.total).toBe(0);
  expect(
    (
      await db.query("select 1 from v1.customer_records where phone=$1", [
        phone,
      ])
    ).rows,
  ).toHaveLength(0);
  const r = await cmd("import.commit", { catererId: K[0], id: p.id });
  subscription = r.subscriptions[0].id;
  guest = (await read("seller-customers", { id: K[0] })).customers.find(
    (c: any) => c.phone === phone,
  );
  expect(guest.user_id).toBeNull();
  expect(guest.subscriptions[0].remaining).toBe(3);
  expect(
    (
      await db.query(
        "select 1 from v1.payments p join v1.subscriptions s on s.checkout_id=p.checkout_id where s.id=$1",
        [subscription],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select 1 from v1.allocations a join v1.subscriptions s on s.checkout_id=a.checkout_id where s.id=$1",
        [subscription],
      )
    ).rows,
  ).toHaveLength(0);
  day = (
    await db.query<any>(
      "select * from v1.delivery_days where subscription_id=$1 order by service_date",
      [subscription],
    )
  ).rows[0];
  const seller = await read("seller", { id: K[0], date: day.service_date });
  expect(
    seller.deliveries.find((d: any) => d.id === day.id).customer.name,
  ).toBe(guest.name);
  const frozen = await cmd("production.freeze", {
    catererId: K[0],
    date: day.service_date,
  });
  const manifest = await localRpc<any>(db, U.owner, "catera_v1_manifest", [
    frozen.id,
  ]);
  expect(manifest.entries.find((d: any) => d.id === day.id).customer.name).toBe(
    guest.name,
  );
  await expect(
    cmd("import.commit", { catererId: K[0], id: p.id }),
  ).rejects.toThrow("CONFLICT");
  await expect(batch([row()])).rejects.toThrow("DUPLICATE_CUSTOMER");
});
it("rejects cross-tenant reads, writes and legacy NULL-identity authorization bypasses", async () => {
  await expect(read("seller-customers", { id: K[1] })).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    cmd("customer.invite", { catererId: K[1], customerRecordId: guest.id }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    cmd(
      "customer.save",
      { catererId: K[0], name: "x", phone, address },
      U.staff,
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    cmd(
      "delivery.address",
      {
        id: day.id,
        version: day.version,
        addressId: "00000000-0000-0000-0000-000000000001",
      },
      U.customer,
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(cmd("customer.claim", { token: "x" }, user)).rejects.toThrow();
});
it("revalidates whole imports and rejects duplicate rows or exhausted batch capacity atomically", async () => {
  const r = row({
    customer: { name: "Duplicate", phone: "+6281234501235", address },
    portions: 1,
  });
  await expect(
    cmd("import.preview", { catererId: K[0], rows: [r, r] }),
  ).rejects.toThrow("DUPLICATE_IMPORT");
  const max = (
    await db.query<any>("select v1.slots($1,$2) n", [P[2], day.service_date])
  ).rows[0].n;
  const many = Array.from({ length: 100 }, (_, i) =>
    row({
      customer: {
        name: "Capacity " + i,
        phone: "+628123460" + String(i).padStart(4, "0"),
        address,
      },
      portions: Math.min(100, max),
      externalReference: "capacity-" + i,
    }),
  );
  await expect(
    cmd("import.preview", { catererId: K[0], rows: many }),
  ).rejects.toThrow("CAPACITY");
  expect(
    (
      await db.query("select 1 from v1.customer_records where name like $1", [
        "Capacity %",
      ])
    ).rows,
  ).toHaveLength(0);
});
it("audits staff customer-requested changes and fulfills both meals before account signup", async () => {
  await cmd(
    "customer.deliveryChange",
    {
      catererId: K[0],
      id: day.id,
      version: day.version,
      address: { ...address, line: "Changed synthetic address" },
      reason: "Customer requested address",
    },
    U.staff,
  );
  expect(
    (
      await db.query<any>("select details from v1.audit where action=$1", [
        "customer.deliveryChange",
      ])
    ).rows.at(-1).details.reason,
  ).toBe("Customer requested address");
  // Move only this synthetic fixture into today to exercise time-gated fulfillment.
  await db.query(
    "update v1.delivery_days set service_date=current_date where id=$1",
    [day.id],
  );
  for (const meal of ["lunch", "dinner"])
    for (const status of ["preparing", "out_for_delivery", "delivered"]) {
      const d = (
        await db.query<any>(
          "select version from v1.delivery_days where id=$1",
          [day.id],
        )
      ).rows[0];
      await cmd(
        "delivery.status",
        { id: day.id, version: d.version, meal, status },
        U.staff,
      );
    }
  expect(
    (await read("seller-customers", { id: K[0], customerRecordId: guest.id }))
      .customers[0].subscriptions[0].remaining,
  ).toBe(2);
});
it("requires matching verified phone, consumes claims once and preserves snapshots", async () => {
  const invite = await cmd("customer.invite", {
    catererId: K[0],
    customerRecordId: guest.id,
  });
  const token = invite.path.split("/").at(-1);
  const payload = {
    userId: user,
    token,
    verifiedPhone: "+6289999999999",
    requestId: crypto.randomUUID(),
  };
  await expect(sys("pilot.claim", payload)).rejects.toThrow(
    "CLAIM_UNAVAILABLE",
  );
  await expect(
    localRpc(
      db,
      user,
      "catera_v1_system",
      ["pilot.claim", { ...payload, verifiedPhone: phone }],
      false,
    ),
  ).rejects.toThrow("FORBIDDEN");
  const before = (
    await db.query<any>("select snapshot from v1.subscriptions where id=$1", [
      subscription,
    ])
  ).rows[0].snapshot;
  payload.verifiedPhone = phone;
  expect((await sys("pilot.claim", payload)).status).toBe("claimed");
  expect((await sys("pilot.claim", payload)).status).toBe("claimed");
  await expect(
    sys("pilot.claim", { ...payload, requestId: crypto.randomUUID() }),
  ).rejects.toThrow("CLAIM_UNAVAILABLE");
  const s = (await read("customer", {}, user)).subscriptions.find(
    (s: any) => s.id === subscription,
  );
  expect(s.remaining).toBe(2);
  expect(s.snapshot).toEqual(before);
});
it("links only a paid renewal and counts actual Catera payments independently of prepaid balances", async () => {
  const context = await read("renewal-context", { id: subscription }, user);
  expect(context.address.line).toBe(address.line);
  expect(context.available).toBe(true);
  const c = await cmd(
    "checkout.create",
    {
      packageId: context.packageId,
      portions: context.portions,
      addressId: context.addressId,
      startDate: context.startDate,
      renewedFrom: subscription,
    },
    user,
  );
  const metrics = () =>
    read(
      "pilot",
      { id: K[0], from: localDay(), to: addDays(localDay(), 90) },
      U.platform_admin,
    );
  let m = (await metrics()).metrics;
  const beforeGmv = m.processedGmv;
  expect(m.renewals.catera).toBe(0);
  expect(m.renewals.unknown).toBeGreaterThan(0);
  expect(m.contribution).toBeNull();
  const event = {
    checkoutId: c.id,
    providerId: "session-" + c.id,
    paymentRequestId: "request-" + c.id,
    eventId: crypto.randomUUID(),
    status: "paid",
    amount: c.quote.total,
    currency: "IDR",
  };
  await sys("payment.attach", {
    id: c.id,
    providerId: event.providerId,
    url: "https://example.test/pay",
  });
  await sys("payment.event", event);
  expect(await sys("payment.event", event)).toEqual({ duplicate: true });
  m = (await metrics()).metrics;
  expect(m.renewals.catera).toBe(1);
  expect(m.processedGmv - beforeGmv).toBe(c.quote.total);
  expect(
    m.cohorts.some((c: any) => c.origin === "seller" && c.gmv >= event.amount),
  ).toBe(true);
  expect(m.missingCosts).toContain("processing");
});
it("snapshots approved per-seller prices and preserves accepted checkout prices across policy changes", async () => {
  const base = {
    catererId: K[0],
    model: "transaction",
    cohort: "Synthetic test",
    effectiveAt: new Date(Date.now() - 60000).toISOString(),
    serviceFee: 1234,
    marketplacePercent: 9,
    invitedPercent: 4,
    monthlyFee: 0,
    approved: true,
    synthetic: true,
    reason: "Synthetic approved test",
  };
  await expect(cmd("pilot.pricing", base)).rejects.toThrow("FORBIDDEN");
  const policy = await cmd("pilot.pricing", base, U.platform_admin);
  const ctx = await read("renewal-context", { id: subscription }, user);
  const input = {
    packageId: P[0],
    portions: 1,
    addressId: ctx.addressId,
    startDate: addDays(localDay(), 100),
  };
  const c = await cmd("checkout.create", input, user);
  expect(c.quote.serviceFee).toBe(1234);
  expect(c.quote.pricingPolicy.id).toBe(policy.id);
  const monthly = await cmd(
    "pilot.pricing",
    {
      ...base,
      model: "monthly",
      monthlyFee: 150000,
      effectiveAt: new Date(Date.now() - 1000).toISOString(),
    },
    U.platform_admin,
  );
  const q = await read(
    "quote",
    { ...input, startDate: addDays(localDay(), 150) },
    user,
  );
  expect(q.sellerFee).toBe(0);
  expect(q.pricingPolicy.id).toBe(monthly.id);
  expect((await read("checkout", { id: c.id }, user)).quote).toEqual(c.quote);
  await expect(
    db.query("update v1.pilot_pricing set service_fee=1 where id=$1", [
      policy.id,
    ]),
  ).rejects.toThrow();
  const inv = await cmd(
    "pilot.invoice",
    {
      catererId: K[0],
      pricingId: monthly.id,
      period: localDay().slice(0, 7) + "-01",
    },
    U.platform_admin,
  );
  const key = crypto.randomUUID(),
    entry = {
      catererId: K[0],
      invoiceId: inv.id,
      kind: "payment",
      amount: 150000,
      reference: "synthetic-bank-receipt",
    };
  await cmd("pilot.invoiceEntry", entry, U.platform_admin, key);
  await cmd("pilot.invoiceEntry", entry, U.platform_admin, key);
  expect(
    (await read("pilot", { id: K[0] }, U.platform_admin)).metrics
      .monthlyCollected,
  ).toBe(150000);
  await expect(
    cmd("pilot.invoiceEntry", entry, U.platform_admin),
  ).rejects.toThrow("AMOUNT_INVALID");
});
it("places overlapping claims in review and preserves every obligation", async () => {
  const p = row({
    customer: {
      name: "Conflicting customer",
      phone: "+6281234509999",
      address,
    },
    packageId: P[0],
    startDate: addDays(localDay(), 100),
    remainingDays: 1,
    portions: 1,
    externalReference: "conflict-proof",
  });
  const imported = await batch([p]);
  const id = imported.subscriptions[0].customerRecordId;
  const invite = await cmd("customer.invite", {
    catererId: K[0],
    customerRecordId: id,
  });
  const result = await sys("pilot.claim", {
    userId: user,
    verifiedPhone: p.customer.phone,
    token: invite.path.split("/").at(-1),
    requestId: crypto.randomUUID(),
  });
  expect(result.status).toBe("review");
  expect(result.reason).toBe("OVERLAP");
  expect(
    (
      await db.query<any>("select user_id from v1.subscriptions where id=$1", [
        imported.subscriptions[0].id,
      ])
    ).rows[0].user_id,
  ).toBeNull();
  expect(
    (
      await db.query(
        "select 1 from v1.delivery_days where subscription_id=$1",
        [imported.subscriptions[0].id],
      )
    ).rows,
  ).toHaveLength(1);
});
it("blocks moving a previous delivery into a pending renewal of a different package", async () => {
  const who = crypto.randomUUID();
  await db.query("insert into v1.profiles(id,name) values($1,$2)", [
    who,
    "Reschedule test",
  ]);
  const imported = await batch([
    row({
      customer: { name: "Reschedule test", phone: "+6281234507777", address },
      packageId: P[0],
      portions: 1,
      remainingDays: 1,
      startDate: addDays(localDay(), 70),
      externalReference: "reschedule-proof",
    }),
  ]);
  const s = imported.subscriptions[0],
    invite = await cmd("customer.invite", {
      catererId: K[0],
      customerRecordId: s.customerRecordId,
    });
  await sys("pilot.claim", {
    userId: who,
    verifiedPhone: "+6281234507777",
    token: invite.path.split("/").at(-1),
    requestId: crypto.randomUUID(),
  });
  const ctx = await read("renewal-context", { id: s.id, packageId: P[2] }, who);
  const c = await cmd(
    "checkout.create",
    {
      packageId: P[2],
      portions: 1,
      startDate: ctx.startDate,
      addressId: ctx.addressId,
      renewedFrom: s.id,
    },
    who,
  );
  const d = (
    await db.query<any>(
      "select * from v1.delivery_days where subscription_id=$1",
      [s.id],
    )
  ).rows[0];
  await expect(
    cmd(
      "customer.deliveryChange",
      {
        catererId: K[0],
        id: d.id,
        version: d.version,
        date: c.quote.dates[0],
        reason: "Customer moved date",
      },
      U.staff,
    ),
  ).rejects.toThrow("OVERLAP");
});
it("reports external renewals separately, enrolls for 90 days and keeps unknown costs unknown", async () => {
  const imported = await batch([
    row({
      customer: { name: "External customer", phone: "+6281234508888", address },
      remainingDays: 1,
      startDate: addDays(localDay(), 30),
      portions: 1,
      externalReference: "external-first",
    }),
  ]);
  const s = imported.subscriptions[0];
  await batch([
    row({
      customer: undefined,
      customerRecordId: s.customerRecordId,
      address,
      remainingDays: 1,
      startDate: addDays(localDay(), 40),
      portions: 1,
      externalReference: "external-next",
      renewedFrom: s.id,
    }),
  ]);
  const state = await read(
    "pilot",
    { id: K[0], from: localDay(), to: addDays(localDay(), 90) },
    U.platform_admin,
  );
  expect(state.metrics.renewals.externalReported).toBe(1);
  const monthly = state.policies.find((p: any) => p.model === "monthly");
  await cmd(
    "pilot.enroll",
    {
      catererId: K[0],
      pricingId: monthly.id,
      startDate: localDay(),
      reference: "Synthetic pilot consent",
    },
    U.platform_admin,
  );
  const after = await read("pilot", { id: K[0] }, U.platform_admin);
  expect(after.enrollment.ends_on).toBe(addDays(localDay(), 89));
  expect(
    after.metrics.sellerRetention.every(
      (r: any) => !r.mature && r.paid === null,
    ),
  ).toBe(true);
  expect(after.metrics.contribution).toBeNull();
  expect(after.metrics.onboardingCosts).toBeNull();
  for (const kind of ["processing", "payout", "incentive", "support"])
    await cmd(
      "pilot.observation",
      {
        catererId: K[0],
        date: localDay(),
        kind,
        amount: 0,
        reference: "Verified synthetic zero",
      },
      U.platform_admin,
    );
  expect(
    (await read("pilot", { id: K[0] }, U.platform_admin)).metrics.contribution,
  ).not.toBeNull();
});
it('rechecks capacity at commit and rolls back every row',async()=>{
 const rows=[1,2].map(n=>row({customer:{name:'Commit race '+n,phone:'+628123459001'+n,address},startDate:addDays(localDay(),280),portions:1,remainingDays:1,externalReference:'commit-race-'+n}));
 const preview=await cmd('import.preview',{catererId:K[0],rows});
 const date=preview.rows[0].preview.dates[0];await db.query('insert into v1.capacity(package_id,service_date,slots) values($1,$2,1) on conflict(package_id,service_date) do update set slots=1',[P[2],date]);
 await expect(cmd('import.commit',{catererId:K[0],id:preview.id})).rejects.toThrow('CAPACITY');
 expect((await db.query("select 1 from v1.customer_records where name like 'Commit race %'")).rows).toHaveLength(0);
});
it('reports unreconciled refunds as unknown and deducts only the unrecovered portion after reconciliation',async()=>{
 const s=(await db.query<any>('select id from v1.subscriptions where renewed_from=$1 and not legacy',[subscription])).rows[0];
 const support=await cmd('support.create',{subscriptionId:s.id,subject:'Synthetic refund',description:'Synthetic pilot refund verification.'},user);
 await cmd('support.resolve',{id:support.id,amount:10000,reason:'Synthetic partial refund approval',cancelRemaining:false},U.platform_admin);
 const refund=(await db.query<any>('select id from v1.refunds where case_id=$1',[support.id])).rows[0];
 await sys('refund.update',{id:refund.id,state:'succeeded',providerId:'synthetic-pilot-refund'});
 await sys('refund.update',{id:refund.id,state:'succeeded',providerId:'synthetic-pilot-refund'});
 let m=(await read('pilot',{id:K[0]},U.platform_admin)).metrics;expect(m.contribution).toBeNull();expect(m.missingCosts).toContain('refund_reconciliation');
 await localRpc(db,U.platform_admin,'catera_v1_reconcile',['refund',refund.id,{sellerDeduction:8000,reference:'synthetic-reversal',reason:'Verified synthetic refund recovery'},crypto.randomUUID()]);
 m=(await read('pilot',{id:K[0]},U.platform_admin)).metrics;expect(m.refundCosts).toBe(2000);expect(m.missingCosts).not.toContain('refund_reconciliation');
});
it('keeps synthetic revenue and cost evidence outside commercial results',async()=>{
 const current=(await read('pilot',{id:K[0]},U.platform_admin)).policies[0];
 await cmd('pilot.pricing',{catererId:K[0],model:'monthly',cohort:'Synthetic test of commercial filtering',effectiveAt:new Date(Date.now()-10).toISOString(),serviceFee:current.service_fee,marketplacePercent:current.marketplace_percent,invitedPercent:current.invited_percent,monthlyFee:current.monthly_fee,approved:true,synthetic:false,reason:'In-memory filtering test only'},U.platform_admin);
 const m=(await read('pilot',{id:K[0]},U.platform_admin)).metrics;
 expect(m.dataMode).toBe('commercial');expect(m.processedGmv).toBe(0);expect(m.monthlyCollected).toBe(0);expect(m.refundCosts).toBe(0);expect(m.contribution).toBeNull();
 expect(m.renewals.eligible).toBe(0);
});
