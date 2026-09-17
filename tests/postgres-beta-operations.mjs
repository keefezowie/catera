import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEMO_ACTORS as U, CATERER_IDS as K } from "../packages/backend/src/seed.ts";
export async function verifyBetaOperations(pool, cmd, evidence) {
 await pool.query(await readFile("supabase/migrations/20260917131119_beta_operations.sql","utf8"));
 const d=(await pool.query("select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=$1 and s.user_id=$2 order by d.id limit 1",[K[0],U.customer])).rows[0];
 const input={deliveryId:d.id,meal:"lunch",subject:"Synthetic concurrency issue",body:"A synthetic delivery problem"};
 const key=crypto.randomUUID();
 const creates=await Promise.all([cmd("deliveryIssue.create",input,U.customer,key),cmd("deliveryIssue.create",input,U.customer,key)]);
 assert.deepEqual(creates[0],creates[1]);
 const id=creates[0].id;
 const financial=async()=>(await pool.query("select md5((select jsonb_agg(a order by a.id)::text from v1.allocations a)||coalesce((select jsonb_agg(r order by r.checkout_id,r.service_date)::text from v1.reservations r),'[]')) hash")).rows[0].hash;
 const before=await financial();
 const updates=await Promise.allSettled([cmd("deliveryIssue.resolve",{id,version:1,body:"Owner completed resolution"},U.owner),cmd("deliveryIssue.respond",{id,version:1,body:"Staff provided a response"},U.staff)]);
 assert.equal(updates.filter(x=>x.status==="fulfilled").length,1);
 assert.match(updates.find(x=>x.status==="rejected").reason.message,/CONFLICT/);
 assert.equal(await financial(),before);
 assert.equal((await pool.query("select count(*)::int n from v1.delivery_issue_events where issue_id=$1",[id])).rows[0].n,2);
 await assert.rejects(pool.query("update v1.delivery_issue_events set body='rewritten' where issue_id=$1",[id]),/IMMUTABLE_HISTORY/);
 const client=await pool.connect();
 try { await client.query("begin;set local role authenticated"); await assert.rejects(client.query("select * from v1.delivery_issues"),/permission denied/); await client.query("rollback"); }
 finally { client.release(); }
 evidence.push("Delivery issues: concurrent retries create one report; simultaneous seller actions accept one version, preserve money/reservations, retain immutable history, and deny direct authenticated reads.");
 const maintenance=async()=>{
  const client=await pool.connect();
  try {await client.query("begin;select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);select set_config('catera.demo','true',true)");await client.query("select public.catera_v1_system('maintenance','{}')");await client.query("commit");}
  catch(e){await client.query("rollback");throw e;}finally{client.release();}
 };
 await maintenance();
 const count=async()=>(await pool.query("select count(*)::int n from v1.notifications")).rows[0].n;
 const baseline=await count();
 await Promise.all([maintenance(),maintenance()]);
 assert.equal(await count(),baseline);
 evidence.push("Concurrent maintenance workers complete without duplicate reminder notifications or dedupe conflicts.");
}
