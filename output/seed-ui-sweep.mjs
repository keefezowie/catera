const base = 'http://127.0.0.1:3117';
let cookie = '';
async function request(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'content-type':'application/json', cookie, origin:base }, body: body ? JSON.stringify(body) : undefined });
  if (response.headers.get('set-cookie')) cookie = response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result.data;
}
await request('/api/v1/auth/demo', {role:'customer'});
const customer = await request('/api/v1/customer');
await request('/api/v1/commands', {action:'support.create',requestId:crypto.randomUUID(),payload:{subscriptionId:customer.subscriptions[0].id,subject:'Synthetic UI badge verification',description:'Synthetic support case for the isolated local UI sweep.'}});
await request('/api/v1/auth/demo', {role:'owner'});
const actor=(await request('/api/v1/me')).actor;
const offer=(await request('/api/v1/catalog?limit=100')).items.find(o=>o.catererId===actor.catererId);
const draft=await request('/api/v1/commands', {action:'package.save',requestId:crypto.randomUUID(),payload:{catererId:actor.catererId,slug:'ui-sweep-'+crypto.randomUUID(),offer:{...offer,name:'Sintetis UI sweep preview',status:'draft'}}});
console.log(JSON.stringify({draftId:draft.id,caseCreated:true}));
