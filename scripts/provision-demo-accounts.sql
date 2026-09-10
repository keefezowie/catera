-- Explicit, one-time V1 demo account provisioning. Never run against the pilot.
-- Run only on Catera V1 (ygzfdqrljunngfrdygzt). Output includes passwords;
-- save it privately, never in a migration, repository, or application bundle.
-- One statement keeps Auth identities, profiles, memberships and audit atomic.
with credentials as materialized (
  select gen_random_uuid() as id, role, name, email,
    encode(extensions.gen_random_bytes(24),'hex') as password
  from (values
    ('customer','Demo Pelanggan','demo.customer@catera.example'),
    ('owner','Demo Pemilik','demo.owner@catera.example'),
    ('staff','Demo Staf','demo.staff@catera.example'),
    ('platform_admin','Demo Admin','demo.admin@catera.example')
  ) as roles(role,name,email)
), auth_accounts as (
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    confirmation_token,recovery_token,email_change_token_new,email_change,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',email,
    extensions.crypt(password,extensions.gen_salt('bf',12)),now(),'','','','',
    '{"provider":"email","providers":["email"],"catera_demo":true}'::jsonb,
    jsonb_build_object('name',name),false,now(),now() from credentials
  returning id,email
), identities as (
  insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
  select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
  from auth_accounts returning user_id
), profiles as (
  insert into v1.profiles(id,name,role)
  select c.id,c.name,c.role from credentials c join identities i on i.user_id=c.id
  returning id,role
), caterer as (
  insert into v1.caterers(slug,name,description,areas,status)
  values ('catera-demo-workspace','Demo Dapur Catera','Ruang kerja sintetis untuk pengujian peran. Tidak menerima pesanan.',array['Jakarta Selatan'],'draft')
  returning id
), memberships as (
  insert into v1.staff(caterer_id,user_id,role)
  select c.id,p.id,p.role from caterer c cross join profiles p where p.role in ('owner','staff')
  returning user_id
), audit as (
  insert into v1.audit(actor_id,action,details)
  select p.id,'demo.account.provisioned',jsonb_build_object('role',p.role,'synthetic',true,
    'catererId',(select id from caterer),'memberships',(select count(*) from memberships))
  from profiles p returning actor_id
)
select jsonb_agg(jsonb_build_object('id',c.id,'role',c.role,'name',c.name,'email',c.email,'password',c.password)) as credentials
from credentials c join audit a on a.actor_id=c.id;
