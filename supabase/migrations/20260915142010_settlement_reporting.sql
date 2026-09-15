-- Read-only reporting. Existing ledger, payment commands and snapshots are unchanged.
-- Existing ledger queries have a seller/date index. Payouts and provider events
-- previously had only identity indexes, not the access paths these reads need.
create index settlement_payout_history on v1.payouts(caterer_id,created_at desc,id desc) where settlement_run_id is not null;
create index settlement_payout_event_history on v1.payout_events(payout_id,created_at,event_key);
create function v1.settlement_reporting_version() returns int language sql immutable set search_path='' as $$ select 1 $$;

create function v1.settlement_report(cid uuid, days int) returns jsonb language plpgsql stable set search_path='' as $$
declare first_day date; last_day date; result jsonb;
begin
 if days not in (7,30) or days is null then raise exception 'INVALID_INPUT';end if;
 last_day:=(statement_timestamp() at time zone 'Asia/Jakarta')::date;first_day:=last_day-days+1;
 with amounts as (
 select (created_at at time zone 'Asia/Jakarta')::date dt,
 coalesce(sum(amount) filter(where kind='earned'),0) credits,
 coalesce(sum(amount) filter(where kind in('refund_debit','recovery','debt_offset')),0) adjustments
 from v1.settlement_entries where caterer_id=cid
 and created_at>=first_day::timestamp at time zone 'Asia/Jakarta'
 and created_at<(last_day+1)::timestamp at time zone 'Asia/Jakarta'
 group by 1), series as (
 select (first_day+i)::text date,coalesce(a.credits,0) credits,coalesce(a.adjustments,0) adjustments
 from generate_series(0,days-1) i left join amounts a on a.dt=first_day+i)
 select jsonb_build_object('from',first_day,'to',last_day,'timezone','Asia/Jakarta',
 'credits',sum(credits)::text,'adjustments',sum(adjustments)::text,
 'days',jsonb_agg(jsonb_build_object('date',date,'credits',credits::text,'adjustments',adjustments::text) order by date)) into result from series;
 return result;
end $$;

-- The immutable row identity is the tie-breaker for all cursor pages.
create function v1.settlement_history(cid uuid,kind text,cur jsonb default null) returns jsonb language plpgsql stable set search_path='' as $$
declare rows jsonb; more boolean; next_cursor jsonb; ct timestamptz; ci uuid;
begin
 if kind not in('payouts','entries','holds') or kind is null then raise exception 'INVALID_INPUT';end if;
 if cur is not null then
  begin ct:=(cur->>'at')::timestamptz;ci:=(cur->>'id')::uuid;
  exception when others then raise exception 'INVALID_INPUT';end;
  if ct is null or ci is null then raise exception 'INVALID_INPUT';end if;
 end if;
 if kind='payouts' then
  select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') into rows from
  (select p.id,p.created_at,p.amount::text amount,p.status,sp.synthetic
   from v1.payouts p join v1.settlement_runs r on r.id=p.settlement_run_id join v1.settlement_policies sp on sp.id=r.policy_id
   where p.caterer_id=cid and (cur is null or (p.created_at,p.id)<(ct,ci)) order by p.created_at desc,p.id desc limit 26)x;
 elsif kind='entries' then
  select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') into rows from
  (select e.id,e.created_at,e.amount::text amount,e.kind,e.allocation_id,e.day_id,c.id checkout_id,c.quote->'offer'->>'name' package_name
   from v1.settlement_entries e left join v1.allocations a on a.id=e.allocation_id left join v1.checkouts c on c.id=a.checkout_id
   where e.caterer_id=cid and (cur is null or (e.created_at,e.id)<(ct,ci)) order by e.created_at desc,e.id desc limit 26)x;
 else
  select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') into rows from
  (select a.id,c.created_at,v1.settlement_held(a.id)::text amount,c.id checkout_id,c.quote->'offer'->>'name' package_name,
   a.held>0 allocation_hold,
   exists(select 1 from v1.refunds r where r.checkout_id=c.id and r.state<>'failed' and r.reconciliation is null) refund_review,
   coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status) order by s.id) from v1.support_cases s where s.checkout_id=c.id and s.status<>'resolved'),'[]') cases
   from v1.allocations a join v1.checkouts c on c.id=a.checkout_id
   where a.caterer_id=cid and c.quote->>'settlementModel'='delivery_earned_v1' and v1.settlement_held(a.id)>0
   and (cur is null or (c.created_at,a.id)<(ct,ci)) order by c.created_at desc,a.id desc limit 26)x;
 end if;
 more:=jsonb_array_length(rows)>25;
 if more then rows:=rows-25;next_cursor:=jsonb_build_object('at',rows->24->>'created_at','id',rows->24->>'id');end if;
 return jsonb_build_object('items',rows,'nextCursor',next_cursor);
end $$;

create function v1.settlement_payout_detail(cid uuid,pid uuid,cur jsonb default null) returns jsonb language plpgsql stable set search_path='' as $$
declare p v1.payouts; result jsonb; rows jsonb; next_cursor jsonb; ct timestamptz; ci uuid;
begin
 select * into p from v1.payouts where id=pid and caterer_id=cid and settlement_run_id is not null;
 if not found then raise exception 'NOT_FOUND';end if;
 if cur is not null then
  begin ct:=(cur->>'at')::timestamptz;ci:=(cur->>'id')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
  if ct is null or ci is null then raise exception 'INVALID_INPUT';end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') into rows from
 (select a.id,c.created_at,c.id checkout_id,c.quote->'offer'->>'name' package_name,i.amount::text amount
 from v1.settlement_payout_items i join v1.allocations a on a.id=i.allocation_id join v1.checkouts c on c.id=a.checkout_id
 where i.payout_id=pid and (cur is null or (c.created_at,a.id)<(ct,ci)) order by c.created_at desc,a.id desc limit 26)x;
 if jsonb_array_length(rows)>25 then rows:=rows-25;next_cursor:=jsonb_build_object('at',rows->24->>'created_at','id',rows->24->>'id');end if;
 return jsonb_build_object('id',p.id,'amount',p.amount::text,'status',p.status,'created_at',p.created_at,
 'reference',p.id::text,'failureCode',p.failure_code,
 'synthetic',(select sp.synthetic from v1.settlement_runs r join v1.settlement_policies sp on sp.id=r.policy_id where r.id=p.settlement_run_id),
 'events',coalesce((select jsonb_agg(jsonb_build_object('status',e.status,'recordedAt',e.created_at) order by e.created_at,e.event_key) from v1.payout_events e where e.payout_id=pid),'[]'),
 'items',rows,'nextCursor',next_cursor);
end $$;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_reporting_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid; result jsonb; cur jsonb; readiness text; pol v1.settlement_policies; n int;pid uuid;
begin
 if resource not in('seller-settlement','seller-settlement-report','seller-settlement-history','seller-settlement-payout') then return public.catera_v1_read_reporting_base(resource,params);end if;
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 begin cid:=(params->>'id')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
 if cid is null then raise exception 'INVALID_INPUT';end if;
 if not(v1.is_admin(auth.uid()) or v1.is_staff(auth.uid(),cid,true)) then raise exception 'FORBIDDEN';end if;
 begin
  if params ? 'cursor' then cur:=(params->>'cursor')::jsonb;end if;
 exception when others then raise exception 'INVALID_INPUT';end;
 if resource='seller-settlement' then
  result:=v1.settlement_state(cid);pol:=v1.settlement_policy(cid);
  readiness:=case when pol.id is null then 'not_configured' when pol.synthetic then 'synthetic' when not pol.enabled then 'seller_disabled'
   when not(select automatic_payouts from v1.purchase_features where id) then 'dispatch_disabled' else 'ready' end;
  return result||jsonb_build_object('reportingVersion',1,'payoutReadiness',readiness,'nextProcessingAt',case when readiness='ready' then result->>'nextPayoutAt' else null end);
 elsif resource='seller-settlement-report' then
  begin n:=coalesce((params->>'days')::int,30);exception when others then raise exception 'INVALID_INPUT';end;
  return v1.settlement_report(cid,n);
 elsif resource='seller-settlement-history' then return v1.settlement_history(cid,params->>'kind',cur);
 else
  begin pid:=(params->>'payoutId')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
  if pid is null then raise exception 'INVALID_INPUT';end if;
  return v1.settlement_payout_detail(cid,pid,cur);
 end if;
end $$;
revoke all on function v1.settlement_reporting_version(),v1.settlement_report(uuid,int),v1.settlement_history(uuid,text,jsonb),v1.settlement_payout_detail(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read_reporting_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
