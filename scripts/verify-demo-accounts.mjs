// Reads private credentials from an ignored file; never logs passwords/tokens.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const setup=JSON.parse(await fs.readFile('.data/demo-accounts.json','utf8'));
assert.equal(setup.project,'ygzfdqrljunngfrdygzt');
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key,'Publishable key required');
const evidence=[];
const jakartaDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
for(const account of setup.accounts) {
  const client=createClient(setup.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.auth.signInWithPassword({email:account.email,password:account.password});
  assert.ifError(error);
  const actor=await client.rpc('catera_v1_read',{resource:'actor',params:{}});
  assert.ifError(actor.error); assert.equal(actor.data.role,account.role);
  const admin=await client.rpc('catera_v1_read',{resource:'admin',params:{}});
  assert.equal(!admin.error,account.role==='platform_admin');
  if(account.role==='owner'||account.role==='staff') {
    const seller=await client.rpc('catera_v1_read',{resource:'seller',params:{id:actor.data.catererId,date:jakartaDay}});
    assert.ifError(seller.error);
    assert.equal(seller.data.caterer.status,'approved');
    assert.ok(seller.data.offers.length>=3,'seller demo must include packages');
    assert.ok(seller.data.deliveries.length>=4,'seller today must include operational deliveries');
    assert.ok(seller.data.cases.length>=3,'seller demo must include support workflow states');
    if(account.role==='owner') {
      assert.ok(seller.data.transactions.length>=1,'owner must see transactions');
      assert.ok(seller.data.payouts.length>=1,'owner must see payouts');
    } else {
      assert.deepEqual(seller.data.transactions,[]);
      assert.deepEqual(seller.data.payouts,[]);
      assert.deepEqual(seller.data.staff,[]);
    }
  }
  if(account.role==='customer') {
    const customer=await client.rpc('catera_v1_read',{resource:'customer',params:{from:'2026-01-01',to:'2027-12-31',calendarMeta:'true'}});
    assert.ifError(customer.error);
    assert.ok(customer.data.subscriptions.some((item)=>item.status==='active'));
    assert.ok(customer.data.subscriptions.some((item)=>item.status==='completed'));
    assert.ok(customer.data.deliveries.some((item)=>item.status==='delivered'));
    assert.ok(customer.data.deliveries.some((item)=>item.status!=='delivered'));
    assert.ok(customer.data.calendarMeta.nextDeliveryDate);
  }
  if(account.role==='platform_admin') {
    assert.ok(admin.data.caterers.some((item)=>item.status==='submitted'));
    assert.ok(admin.data.cases.length>=4);
    assert.ok(admin.data.transactions.length>=11);
    assert.ok(admin.data.payouts.length>=1);
    assert.ok(admin.data.refunds.length>=1);
    assert.ok(admin.data.reviews.length>=2);
  }
  await client.auth.signOut({scope:'local'});
  assert.equal((await client.auth.getSession()).data.session,null);
  evidence.push({role:account.role,signIn:true,roleVerified:true,adminBoundaryVerified:true,signOut:true});
  console.log(account.role+': sign-in, role permissions and sign-out verified');
}
await fs.mkdir('output/fixes-verification',{recursive:true});
await fs.writeFile('output/fixes-verification/supabase-auth.json',JSON.stringify(evidence,null,2)+'\n');
