-- Riwayat pembayaran tells "still to pay" from "being checked", and keeps recent expired
-- checkouts (walkthrough C-03). v1.customer_actions (20260926112150_uiux_action_reads.sql) is
-- re-created with the same signature, items and ordering, except:
--  1. A pending payment action within its hold is 'awaiting_payment' (or 'choose_method' for a
--     direct payment with no method yet) unless a payment was actually received: the provider
--     operation succeeded, or a paid notice from the provider is waiting to be processed. Only
--     then is it 'checking_payment'. Before, a hosted checkout without a payment page yet (and
--     every demo checkout) read as 'checking_payment', so Riwayat said "Jangan membayar lagi"
--     for a payment nobody had made.
--  2. A new key 'ended' (additive; 'items' and 'total' keep their meaning): the customer's
--     checkouts whose hold ended in the last 7 days without a payment, newest first, at most
--     max_items. Each has status 'expired', or 'checking_payment' when the bank may still confirm
--     it (a direct payment whose instructions were shown and whose operation has not failed or
--     expired, or any received payment), and 'payAgain' with the choices a new checkout needs.
--     A checkout is left out once a later checkout for the same package was not itself expired
--     or failed (bought or waiting again).

create or replace function v1.customer_actions(u uuid,max_items int default 20)
returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb;
begin
 if u is null or u is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
 if max_items not between 1 and 20 then raise exception 'INVALID_INPUT'; end if;
 with actions as materialized (
  select
   'menu-'||d.id||'-'||f.meal as id,
   'menu_choice_due'::text as kind,
   'selection_due'::text as status,
   1 as priority,
   v1.cutoff(s.snapshot->'offer',d.service_date) as sort_at,
   v1.cutoff(s.snapshot->'offer',d.service_date) as due_at,
   d.service_date,
   f.meal,
   s.snapshot->'offer'->>'name' as package_name,
   s.snapshot->'offer'->>'caterer' as caterer_name,
   '/subscriptions/'||s.id||'/menu?date='||d.service_date||'&meal='||f.meal as href
  from v1.delivery_days d
  join v1.subscriptions s on s.id=d.subscription_id
  join v1.fulfillments f on f.day_id=d.id
  where s.user_id=u and s.status='active'
   and d.status not in('cancelled','delivered')
   and f.status not in('cancelled','delivered')
   and s.snapshot->'offer'->>'menuSelectionMode'='customer'
   and statement_timestamp()<v1.cutoff(s.snapshot->'offer',d.service_date)
   and not exists(
    select 1 from v1.customer_menus cm
    where cm.day_id=d.id and cm.meal=f.meal and cm.details is not null
   )
  union all
  select
   'payment-'||c.id,
   'payment_action',
   case
    when c.state='payment_exception' then 'payment_exception'
    when o.state='succeeded' or exists(
     select 1 from v1.provider_inbox i where i.operation_id=o.id and i.processed_at is null and i.event->>'status'='paid'
    ) then 'checking_payment'
    when c.payment_mode='direct' and o.id is null then 'choose_method'
    else 'awaiting_payment'
   end,
   case when c.state='payment_exception' then 0 else 1 end,
   c.expires_at,
   c.expires_at,
   null::date,
   null::text,
   c.quote->'offer'->>'name',
   c.quote->'offer'->>'caterer',
   '/payment/'||c.id
  from v1.checkouts c
  left join v1.provider_operations o on o.kind='payment' and o.entity_id=c.id
  where c.user_id=u and c.state in('pending','payment_exception')
   and (c.state='payment_exception' or c.expires_at>statement_timestamp())
  union all
  select
   'issue-'||i.id,
   'delivery_issue',
   i.status,
   case when i.status='escalated' then 0 else 1 end,
   coalesce(d.service_date::timestamp at time zone (s.snapshot->'offer'->>'timezone'),i.created_at),
   null::timestamptz,
   d.service_date,
   i.meal,
   s.snapshot->'offer'->>'name',
   s.snapshot->'offer'->>'caterer',
   '/support?issue='||i.id
  from v1.delivery_issues i
  join v1.delivery_days d on d.id=i.day_id
  join v1.subscriptions s on s.id=d.subscription_id
  where i.user_id=u and i.status in('open','responded','escalated')
 ), ranked as (
  select * from actions order by priority,sort_at,id limit max_items
 ), ended as materialized (
  select
   'payment-'||c.id as id,
   case
    when o.state='succeeded' or exists(
     select 1 from v1.provider_inbox i where i.operation_id=o.id and i.processed_at is null and i.event->>'status'='paid'
    ) then 'checking_payment'
    when c.state='pending' and c.payment_mode='direct' and o.result ? 'instructions' and o.state not in('failed','expired')
     then 'checking_payment'
    else 'expired'
   end as status,
   c.expires_at,
   c.quote->'offer'->>'name' as package_name,
   c.quote->'offer'->>'caterer' as caterer_name,
   jsonb_strip_nulls(jsonb_build_object(
    'packageId',coalesce(c.quote->>'packageId',c.package_id::text),
    'renewedFrom',nullif(c.quote->>'renewedFrom',''),
    'trial',coalesce((c.quote->>'trial')::boolean,false),
    'portions',coalesce((c.quote->>'portions')::int,1),
    'cycles',coalesce((c.quote->>'cycles')::int,1),
    'addressId',coalesce(c.quote->'address'->>'id',c.address_id::text)
   )) as pay_again
  from v1.checkouts c
  left join v1.provider_operations o on o.kind='payment' and o.entity_id=c.id
  where c.user_id=u
   and c.expires_at>statement_timestamp()-interval '7 days'
   and (c.state in('expired','failed') or (c.state='pending' and c.expires_at<=statement_timestamp()))
   and not exists(
    select 1 from v1.checkouts n
    where n.user_id=u and n.package_id=c.package_id and n.created_at>c.created_at and n.state not in('expired','failed')
   )
  order by c.expires_at desc,c.id
  limit max_items
 )
 select jsonb_build_object(
  'total',(select count(*) from actions),
  'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',id,'kind',kind,'status',status,'priority',priority,
   'dueAt',due_at,'serviceDate',service_date,'meal',meal,
   'packageName',package_name,'catererName',caterer_name,'href',href
  )) order by priority,sort_at,id) from ranked),'[]'::jsonb),
  'ended',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',e.id,'kind','payment_action','status',e.status,'priority',1,
   'dueAt',e.expires_at,'packageName',e.package_name,'catererName',e.caterer_name,
   'href','/payment/'||substr(e.id,9),'payAgain',e.pay_again
  )) order by e.expires_at desc,e.id) from ended e),'[]'::jsonb)
 ) into result;
 return result;
end $$;

revoke all on function v1.customer_actions(uuid,int) from public,anon,authenticated;
