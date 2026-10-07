-- Customer arrival facts (Plan 3a, customer app rebuild).
-- A delivery's meals now say when the kitchen set off, when the customer (or the
-- auto-delivery rule, or the caterer) confirmed it arrived, the customer's
-- reaction, and the newest open report. Later commands write these columns; this
-- migration only adds the schema and the read shape.
alter table v1.fulfillments
 add column departed_at timestamptz,
 add column confirmed_at timestamptz,
 add column confirmed_by text check (confirmed_by in ('customer','auto','caterer'));

create table v1.delivery_reactions (
 day_id uuid not null, meal text not null,
 user_id uuid not null references v1.profiles,
 reaction text not null check (reaction in ('enak','biasa','kurang')),
 created_at timestamptz not null default now(),
 primary key (day_id, meal),
 foreign key (day_id, meal) references v1.fulfillments(day_id, meal)
);
alter table v1.delivery_reactions enable row level security;
revoke all on v1.delivery_reactions from public, anon, authenticated;

-- Same wrapper as 20260914160856_paid_seller_pilot.sql; only the per-meal objects
-- in "meals" change (the later "||" key replaces the base's).
create or replace function v1.delivery(d v1.delivery_days) returns jsonb language sql stable set search_path='' as $$
 select v1.delivery_pilot_base(d)||jsonb_build_object('meals',(select jsonb_agg(jsonb_build_object(
 'meal',f.meal,'status',f.status,'departed_at',f.departed_at,'confirmed_at',f.confirmed_at,
 'reaction',(select r.reaction from v1.delivery_reactions r where r.day_id=f.day_id and r.meal=f.meal),
 'issue',(select jsonb_build_object('id',i.id,'status',i.status) from v1.delivery_issues i
  where i.day_id=f.day_id and i.meal=f.meal and i.status in ('open','responded','escalated')
  order by i.created_at desc, i.id desc limit 1)
 ) order by f.meal desc) from v1.fulfillments f where f.day_id=d.id))
 ||case when v1.is_staff(auth.uid(),(s.snapshot->'offer'->>'catererId')::uuid) then jsonb_build_object('customer',jsonb_build_object(
 'id',coalesce(s.user_id,s.customer_record_id),'name',coalesce(cr.name,p.name)), 'customerRecordId',s.customer_record_id) else '{}'::jsonb end
 from v1.subscriptions s left join v1.customer_records cr on cr.id=s.customer_record_id left join v1.profiles p on p.id=s.user_id where s.id=d.subscription_id
$$;
revoke all on all functions in schema v1 from public,anon,authenticated;
