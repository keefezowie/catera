-- Read-only action feeds for the customer home and the seller exception queue.
-- Existing commands, reservations, payment state machines and entitlements remain
-- in the previous RPC chain.

create function v1.customer_actions(u uuid,max_items int default 20)
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
    when c.payment_mode='direct' and o.id is null then 'choose_method'
    when c.payment_mode='direct' and o.result ? 'instructions' then 'awaiting_payment'
    when c.payment_mode='direct' then 'checking_payment'
    when c.payment_url is not null then 'awaiting_payment'
    else 'checking_payment'
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
 )
 select jsonb_build_object(
  'total',(select count(*) from actions),
  'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',id,'kind',kind,'status',status,'priority',priority,
   'dueAt',due_at,'serviceDate',service_date,'meal',meal,
   'packageName',package_name,'catererName',caterer_name,'href',href
  )) order by priority,sort_at,id) from ranked),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create function v1.beta_attention_page(
 cid uuid,
 requested_scope text default 'all',
 requested_date date default null,
 requested_meal text default null,
 cursor_priority int default null,
 cursor_at timestamptz default null,
 cursor_id text default null,
 max_items int default 20
) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb; timezone_name text;
begin
 if not v1.is_staff(auth.uid(),cid) then raise exception 'FORBIDDEN'; end if;
 if requested_scope not in('selected','future','all')
  or (requested_scope='selected' and requested_date is null)
  or requested_meal is not null and requested_meal not in('lunch','dinner')
  or max_items not between 1 and 100
  or ((cursor_priority is null) <> (cursor_at is null))
  or ((cursor_priority is null) <> (cursor_id is null))
 then raise exception 'INVALID_INPUT'; end if;
 select c.timezone into timezone_name from v1.caterers c where c.id=cid;
 if timezone_name is null then raise exception 'NOT_FOUND'; end if;

 with items as materialized (
  select
   'issue-'||i.id as id,'delivery_issue'::text as kind,1 as priority,
   i.created_at as at_time,i.subject as context,
   '/seller/support?issue='||i.id as href,
   d.service_date,i.meal,s.snapshot->'offer'->>'name' as package_name,
   '/seller/support?issue='||i.id as destination,
   d.id as delivery_id
  from v1.delivery_issues i
  join v1.delivery_days d on d.id=i.day_id
  join v1.subscriptions s on s.id=d.subscription_id
  where i.caterer_id=cid and i.status in('open','responded')
  union all
  select
   'case-'||sc.id,'support',1,sc.created_at,sc.subject,
   '/seller/support?case='||sc.id,
   d.service_date,null::text,
   coalesce(s.snapshot->'offer'->>'name',ch.quote->'offer'->>'name'),
   '/seller/support?case='||sc.id,d.id
  from v1.support_cases sc
  left join v1.delivery_days d on d.id=sc.delivery_id
  left join v1.subscriptions s on s.id=coalesce(sc.subscription_id,d.subscription_id)
  left join v1.checkouts ch on ch.id=sc.checkout_id
  where sc.caterer_id=cid and sc.status='open'
  union all
  select
   'delivery-'||d.id||'-'||f.meal,'delivery',0,
   d.service_date::timestamp at time zone (s.snapshot->'offer'->>'timezone'),
   d.service_date||' · '||f.meal||' · '||(s.snapshot->'offer'->>'name'),
   '/seller?date='||d.service_date||'&meal='||f.meal||'&delivery='||d.id,
   d.service_date,f.meal,s.snapshot->'offer'->>'name',
   '/seller?date='||d.service_date||'&meal='||f.meal||'&delivery='||d.id,d.id
  from v1.fulfillments f
  join v1.delivery_days d on d.id=f.day_id
  join v1.subscriptions s on s.id=d.subscription_id
  join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and s.status='active'
   and d.status<>'cancelled' and f.status='issue'
  union all
  select
   'choice-'||d.id||'-'||f.meal,
   case when statement_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)
    then 'choice_fallback' else 'choice_deadline' end,
   2,v1.cutoff(s.snapshot->'offer',d.service_date),
   d.service_date||' · '||f.meal||' · '||(s.snapshot->'offer'->>'name'),
   '/seller/schedule?date='||d.service_date||'&package='||p.id||'&delivery='||d.id||'&meal='||f.meal,
   d.service_date,f.meal,s.snapshot->'offer'->>'name',
   '/seller/schedule?date='||d.service_date||'&package='||p.id||'&delivery='||d.id||'&meal='||f.meal,d.id
  from v1.delivery_days d
  join v1.subscriptions s on s.id=d.subscription_id
  join v1.packages p on p.id=s.package_id
  join v1.fulfillments f on f.day_id=d.id
  where p.caterer_id=cid and s.status='active'
   and d.status not in('cancelled','delivered')
   and f.status not in('cancelled','delivered')
   and s.snapshot->'offer'->>'menuSelectionMode'='customer'
   and statement_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)-interval '24 hours'
   and not exists(
    select 1 from v1.customer_menus cm
    where cm.day_id=d.id and cm.meal=f.meal and cm.details is not null
   )
   and not exists(
    select 1 from v1.choice_fallback_actions fa
    where fa.day_id=d.id and fa.meal=f.meal and fa.service_date=d.service_date
   )
  union all
  select
   'payment-'||ch.id,'payment',1,ch.created_at,
   ch.quote->'offer'->>'name','/seller/support?case='||sc.id,
   null::date,null::text,ch.quote->'offer'->>'name',
   '/seller/support?case='||sc.id,null::uuid
  from v1.checkouts ch
  join v1.packages p on p.id=ch.package_id
  join lateral(
   select id from v1.support_cases
   where checkout_id=ch.id and status<>'resolved'
   order by created_at,id limit 1
  ) sc on true
  where p.caterer_id=cid and ch.state='payment_exception'
  union all
  select
   'production-'||pr.id,'production_changed',1,pr.created_at,
   pr.service_date::text,
   '/seller/schedule?date='||pr.service_date||'&production=1',
   pr.service_date,null::text,null::text,
   '/seller/schedule?date='||pr.service_date||'&production=1',null::uuid
  from (
   select distinct on(service_date) * from v1.production
   where caterer_id=cid order by service_date,revision desc
  ) pr
  where exists(
   select 1 from v1.delivery_days d
   join v1.subscriptions s on s.id=d.subscription_id
   join v1.packages p on p.id=s.package_id
   where p.caterer_id=cid and d.service_date=pr.service_date
    and d.status not in('delivered','cancelled')
  )
  and v1.beta_production_signature(pr.entries) is distinct from
   v1.beta_production_signature(coalesce((
    select jsonb_agg(v1.delivery(d)) from v1.delivery_days d
    join v1.subscriptions s on s.id=d.subscription_id
    join v1.packages p on p.id=s.package_id
    where p.caterer_id=cid and d.service_date=pr.service_date and d.status<>'cancelled'
   ),'[]'::jsonb))
 ), filtered as materialized (
  select * from items
  where (
   requested_scope='all'
   or requested_scope='selected' and service_date=requested_date
   or requested_scope='future' and service_date>=coalesce(requested_date,(statement_timestamp() at time zone timezone_name)::date)
  )
  and (requested_meal is null or meal=requested_meal)
 ), page as materialized (
  select * from filtered
  where cursor_priority is null
   or priority>cursor_priority
   or priority=cursor_priority and at_time>cursor_at
   or priority=cursor_priority and at_time=cursor_at and id>cursor_id
  order by priority,at_time,id
  limit max_items+1
 ), visible as (
  select * from page order by priority,at_time,id limit max_items
 ), has_more as (
  select count(*)>max_items as value from page
 )
 select jsonb_build_object(
  'timezone',timezone_name,
  'total',(select count(*) from filtered),
  'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',id,'kind',kind,'priority',priority,'at_time',at_time,
   'context',context,'href',href,'serviceDate',service_date,'meal',meal,
   'packageName',package_name,'destination',destination,'deliveryId',delivery_id
  )) order by priority,at_time,id) from visible),'[]'::jsonb),
  'nextCursor',case when (select value from has_more) then (
   select jsonb_build_object('priority',priority,'at',at_time,'id',id)
   from visible order by priority desc,at_time desc,id desc limit 1
  ) else null end
 ) into result;
 return result;
end $$;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_uiux_base;
revoke all on function public.catera_v1_read_uiux_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if resource='customer-actions' then
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  return v1.customer_actions(u,coalesce((params->>'limit')::int,20));
 elsif resource='seller-attention' then
  return v1.beta_attention_page(
   nullif(params->>'id','')::uuid,
   coalesce(nullif(params->>'scope',''),'all'),
   nullif(params->>'date','')::date,
   nullif(params->>'meal',''),
   nullif(params->>'cursorPriority','')::int,
   nullif(params->>'cursorAt','')::timestamptz,
   nullif(params->>'cursorId',''),
   coalesce((params->>'limit')::int,20)
  );
 end if;
 return public.catera_v1_read_uiux_base(resource,params);
end $$;

revoke all on function v1.customer_actions(uuid,int),v1.beta_attention_page(uuid,text,date,text,int,timestamptz,text,int) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
