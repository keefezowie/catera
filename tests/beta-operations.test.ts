import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U, CATERER_IDS as K, PACKAGE_IDS as P, ADDRESS_ID as A } from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";
let db: PGlite, day: string;
const cmd = (action: string, payload: any, actor: string = U.customer, key = crypto.randomUUID()) => localRpc<any>(db, actor, "catera_v1_command", [action, payload, key]);
const read = (resource: string, params: any = {}, actor: string = U.customer) => localRpc<any>(db, actor, "catera_v1_read", [resource, params]);
const payload = () => ({ deliveryId: day, meal: "lunch", subject: "Meal packaging", body: "Synthetic packaging issue" });
beforeAll(async () => {
 db = await createDemoDatabase(true);
 day = (await db.query<any>("select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=$1 and s.user_id=$2 order by d.service_date limit 1", [K[0],U.customer])).rows[0].id;
});
afterAll(async () => db?.close());
it("onboards a fresh authenticated caterer through public commands and publishes after admin verification",async()=>{
 const owner=crypto.randomUUID();
 // Auth provisioning fixture only; all business setup below uses public commands.
 await db.query("insert into v1.profiles(id,name) values($1,'Synthetic new caterer owner')",[owner]);
 const seller=await cmd("seller.create",{name:"Synthetic New Kitchen",slug:"beta-new-kitchen",description:"Synthetic catering business for beta verification",areas:["Jakarta Selatan"]},owner);
 let state=await read("seller",{id:seller.id},owner);
 await cmd("seller.save",{catererId:seller.id,version:state.caterer.version,name:state.caterer.name,description:state.caterer.description,areas:["Jakarta Selatan"],cutoff:"16:00"},owner);
 const base=(await read("catalog")).items.find((o:any)=>o.id===P[0]);
 const offer={...base,name:"Synthetic First Package",status:"draft",menus:[{meal:"lunch",name:"",description:"",image:"",contentModel:"slots",composition:[{id:"main",categoryId:"main",name:"Lauk",slots:1}],items:[],nutrition:null}]};
 const pack=await cmd("package.save",{catererId:seller.id,slug:"beta-first-package",offer},owner);
 await cmd("seller.submit",{catererId:seller.id},owner);
 state=await read("seller",{id:seller.id},owner);
 expect(state.caterer.cutoff).toMatch(/^16:00/);
 expect(state.caterer.status).toBe("submitted");
 await expect(cmd("admin.verify",{id:seller.id,version:state.caterer.version,status:"approved",reason:"Owner cannot self approve"},owner)).rejects.toThrow("FORBIDDEN");
 await cmd("admin.verify",{id:seller.id,version:state.caterer.version,status:"approved",reason:"Synthetic platform verification completed"},U.platform_admin);
 const saved=state.offers.find((o:any)=>o.id===pack.id);
 await cmd("package.save",{catererId:seller.id,id:pack.id,version:saved.version,offer:{...saved,status:"published"}},owner);
 expect((await read("catalog")).items.some((o:any)=>o.id===pack.id)).toBe(true);
});
const money = async () => (await db.query<any>("select (select jsonb_agg(a order by a.id) from v1.allocations a) allocations,(select jsonb_agg(r order by r.checkout_id,r.service_date) from v1.reservations r) reservations,(select jsonb_agg(s order by s.id) from v1.subscriptions s) subscriptions")).rows[0];
let issue: any;
it("opens a purchased meal issue without financial or reservation effects; deduplicates retries", async () => {
 const before=await money(), key=crypto.randomUUID();
 issue=await cmd("deliveryIssue.create",payload(),U.customer,key);
 expect(await cmd("deliveryIssue.create",payload(),U.customer,key)).toEqual(issue);
 expect(await money()).toEqual(before);
 await expect(cmd("deliveryIssue.create",payload())).rejects.toThrow("CONFLICT");
 expect((await read("delivery-issues"))[0].events).toHaveLength(1);
 expect((await read("seller-attention",{id:K[0]},U.owner)).items.some((x:any)=>x.id==="issue-"+issue.id)).toBe(true);
});
it("rejects foreign actors, nonexistent meals, and private direct reads", async () => {
 await expect(cmd("deliveryIssue.create",payload(),U.owner)).rejects.toThrow("FORBIDDEN");
 await expect(cmd("deliveryIssue.create",{...payload(),meal:"breakfast"})).rejects.toThrow("INVALID_INPUT");
 await expect(read("delivery-issues",{id:K[1]},U.owner)).rejects.toThrow("FORBIDDEN");
 await expect(read("seller-attention",{id:K[0]},U.customer)).rejects.toThrow("FORBIDDEN");
 await db.exec("set role authenticated");
 try { await expect(db.query("select * from v1.delivery_issue_events")).rejects.toThrow("permission denied"); }
 finally { await db.exec("reset role"); }
});
it("retains response history, requires fresh versions and resolves without money effects", async () => {
 const before=await money();
 await expect(cmd("deliveryIssue.resolve",{id:issue.id,version:1,body:"Customer cannot self resolve"})).rejects.toThrow("FORBIDDEN");
 await cmd("deliveryIssue.respond",{id:issue.id,version:1,body:"Replacement packaging arranged"},U.staff);
 await expect(cmd("deliveryIssue.resolve",{id:issue.id,version:1,body:"Stale resolution rejected"},U.owner)).rejects.toThrow("CONFLICT");
 await cmd("deliveryIssue.resolve",{id:issue.id,version:2,body:"Replacement received by customer"},U.owner);
 expect(await money()).toEqual(before);
 expect((await read("delivery-issues"))[0].events).toHaveLength(3);
 expect((await read("seller-attention",{id:K[0]},U.owner)).items.some((x:any)=>x.id==="issue-"+issue.id)).toBe(false);
});
it("allows customer escalation after seller resolution and creates one audited support case", async () => {
 const key=crypto.randomUUID(), data={id:issue.id,version:3,body:"Issue remains unresolved, platform review requested"};
 const result=await cmd("deliveryIssue.escalate",data,U.customer,key);
 expect(await cmd("deliveryIssue.escalate",data,U.customer,key)).toEqual(result);
 expect(result.caseId).toBeTruthy();
 expect((await db.query<any>("select status,delivery_id from v1.support_cases where id=$1",[result.caseId])).rows[0]).toEqual({status:"escalated",delivery_id:day});
 await expect(cmd("support.resolve",{id:result.caseId,amount:0,reason:"Seller cannot authorize"},U.owner)).rejects.toThrow("FORBIDDEN");
 expect((await read("delivery-issues"))[0].events).toHaveLength(4);
 await cmd("support.resolve",{id:result.caseId,amount:0,reason:"Admin reviewed operational resolution"},U.platform_admin);
 const updated=(await read("delivery-issues"))[0];
 expect(updated.status).toBe("resolved");
 expect(updated.events.at(-1).action).toBe("support.resolve");
 await expect(cmd("deliveryIssue.escalate",{id:issue.id,version:updated.version,body:"Duplicate financial case prevented"})).rejects.toThrow("CONFLICT");
});
it("flags stale production snapshots and clears the item after a new revision", async()=>{
 const date=(await db.query<any>("select service_date::text dt from v1.delivery_days where id=$1",[day])).rows[0].dt;
 await cmd("production.freeze",{catererId:K[0],date},U.owner);
 const attention=()=>read("seller-attention",{id:K[0]},U.owner);
 expect((await attention()).items.some((i:any)=>i.kind==="production_changed")).toBe(false);
 await db.query("update v1.delivery_days set address=jsonb_set(address,'{instructions}','\"Synthetic new delivery instruction\"'),version=version+1 where id=$1",[day]);
 expect((await attention()).items.some((i:any)=>i.kind==="production_changed")).toBe(true);
 await cmd("production.freeze",{catererId:K[0],date},U.owner);
 expect((await attention()).items.some((i:any)=>i.kind==="production_changed")).toBe(false);
});
it("notifies payment recovery states once with checkout-specific links and skips legacy imports",async()=>{
 const c=await cmd("checkout.create",{packageId:P[2],addressId:A,portions:1,startDate:addDays(localDay(),90),trial:false});
 const notices=async()=>(await db.query<any>("select body,href from v1.notifications where kind='payment' and href=$1",["/payment/"+c.id])).rows;
 expect(await notices()).toHaveLength(1);
 const pendingPush=(await db.query<any>("select id from v1.outbox where kind='push' and payload->>'checkoutId'=$1 and payload->>'expectedState'='pending'",[c.id])).rows[0].id;
 const eligible=(id:string)=>localRpc(db,null,"catera_v1_system",["notification.eligible",{id}],true);
 expect(await eligible(pendingPush)).toBe(true);
 await db.query("update v1.checkouts set state='failed' where id=$1",[c.id]);
 expect(await eligible(pendingPush)).toBe(false);
 await db.query("update v1.checkouts set state='failed' where id=$1",[c.id]);
 expect(await notices()).toHaveLength(2);
 await db.query("update v1.checkouts set state='expired' where id=$1",[c.id]);
 await db.query("update v1.checkouts set state='payment_exception' where id=$1",[c.id]);
 expect(await notices()).toHaveLength(4);
 const n=(await db.query<any>("select count(*)::int n from v1.notifications where kind='payment'")).rows[0].n;
 const preview=await cmd("import.preview",{catererId:K[0],rows:[{customerId:U.customer,addressId:A,packageId:P[2],portions:1,remainingDays:1,startDate:addDays(localDay(),140),externalReference:"beta-legacy"}]},U.owner);
 await cmd("import.commit",{catererId:K[0],id:preview.id},U.owner);
 expect((await db.query<any>("select count(*)::int n from v1.notifications where kind='payment'")).rows[0].n).toBe(n);
});
it("suppresses renewal reminders during pending renewal and resumes with a direct renewal link",async()=>{
 const s=(await db.query<any>("select * from v1.subscriptions where user_id=$1 and package_id=$2 and not legacy limit 1",[U.customer,P[0]])).rows[0];
 await db.query("update v1.delivery_days set status='delivered' where subscription_id=$1",[s.id]);
 await db.query("delete from v1.outbox where dedupe=$1",["renew-"+s.id]);
 await db.query("delete from v1.notifications where kind='renewal' and user_id=$1",[U.customer]);
 const pending=(await db.query<any>("insert into v1.checkouts(user_id,package_id,address_id,quote,state,expires_at) select user_id,package_id,address_id,quote||jsonb_build_object('renewedFrom',$2::text),'pending',now()+interval '10 minutes' from v1.checkouts where id=$1 returning id",[s.checkout_id,s.id])).rows[0].id;
 const maintain=()=>localRpc(db,null,"catera_v1_system",["maintenance",{}],true);
 await maintain();
 expect((await db.query("select 1 from v1.outbox where dedupe=$1",["renew-"+s.id])).rows).toHaveLength(0);
 await db.query("update v1.checkouts set state='failed' where id=$1",[pending]);
 await maintain();await maintain();
 expect((await db.query("select 1 from v1.notifications where kind='renewal' and href=$1",["/renew/"+s.id])).rows).toHaveLength(1);
});
it("rejects escalation of an accountless customer's support case by an unrelated account",async()=>{
 const cr=(await db.query<any>("insert into v1.customer_records(caterer_id,name,phone,address,origin) values($1,'Synthetic private guest','+6281234099999','{}','seller') returning id",[K[0]])).rows[0].id;
 const sc=(await db.query<any>("insert into v1.support_cases(user_id,customer_record_id,caterer_id,subject,description) values(null,$1,$2,'Private guest case','Synthetic private support') returning id",[cr,K[0]])).rows[0].id;
 await expect(cmd("support.escalate",{id:sc})).rejects.toThrow("FORBIDDEN");
 await cmd("support.escalate",{id:sc},U.owner);
});
