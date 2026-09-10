// Reads private credentials from an ignored file; never logs passwords/tokens.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const setup=JSON.parse(await fs.readFile('.data/demo-accounts.json','utf8'));
assert.equal(setup.project,'ygzfdqrljunngfrdygzt');
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key,'Publishable key required');
const evidence=[];
for(const account of setup.accounts) {
  const client=createClient(setup.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.auth.signInWithPassword({email:account.email,password:account.password});
  assert.ifError(error);
  const actor=await client.rpc('catera_v1_read',{resource:'actor',params:{}});
  assert.ifError(actor.error); assert.equal(actor.data.role,account.role);
  const admin=await client.rpc('catera_v1_read',{resource:'admin',params:{}});
  assert.equal(!admin.error,account.role==='platform_admin');
  if(account.role==='owner'||account.role==='staff') {
    const seller=await client.rpc('catera_v1_read',{resource:'seller',params:{id:actor.data.catererId}});
    assert.ifError(seller.error);
    assert.equal(seller.data.caterer.status,'draft');
    if(account.role==='staff') assert.deepEqual(seller.data.transactions,[]);
  }
  await client.auth.signOut({scope:'local'});
  assert.equal((await client.auth.getSession()).data.session,null);
  evidence.push({role:account.role,signIn:true,roleVerified:true,adminBoundaryVerified:true,signOut:true});
  console.log(account.role+': sign-in, role permissions and sign-out verified');
}
await fs.mkdir('output/fixes-verification',{recursive:true});
await fs.writeFile('output/fixes-verification/supabase-auth.json',JSON.stringify(evidence,null,2)+'\n');
