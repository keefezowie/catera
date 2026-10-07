-- Customers confirm that a meal arrived and react to it (Plan 3a, customer app rebuild).
--   delivery.confirm {deliveryId, meal, reaction?} -> {status:'delivered', confirmedAt}
--   delivery.react   {deliveryId, meal, reaction}  -> {reaction}
-- Confirming marks the meal delivered through the same day derivation as
-- v1.auto_deliver; the earning is recognised by the existing delivery-day trigger.
-- Lock order is delivery_days row, then the fulfillment row.

-- A meal's delivery window on a service date, in Asia/Jakarta. The offer stores it as
-- "HH.MM–HH.MM"; a missing or unreadable window falls back to 11.00–13.00 (lunch)
-- and 17.00–19.00 (dinner).
create function v1.window_bounds(offer jsonb, meal text, day date) returns tstzrange
language plpgsql stable set search_path='' as $$
declare m text[]; sh int; sm int; eh int; em int; s timestamptz; e timestamptz;
begin
 m:=regexp_match(coalesce(offer->'windows'->>meal,''),'^\s*(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})\s*$');
 if m is not null then sh:=m[1]::int; sm:=m[2]::int; eh:=m[3]::int; em:=m[4]::int; end if;
 if m is null or sh>23 or eh>23 or sm>59 or em>59 then
  if meal='dinner' then sh:=17; eh:=19; else sh:=11; eh:=13; end if;
  sm:=0; em:=0;
 end if;
 s:=(day::timestamp+make_interval(hours=>sh,mins=>sm)) at time zone 'Asia/Jakarta';
 e:=(day::timestamp+make_interval(hours=>eh,mins=>em)) at time zone 'Asia/Jakarta';
 -- Inclusive bounds keep a zero-length window a range with a real start.
 return tstzrange(s,greatest(s,e),'[]');
end $$;
revoke all on function v1.window_bounds(jsonb,text,date) from public, anon, authenticated;

-- Preserve the existing command's qualified receipt lookup when renaming it.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_confirm_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_confirm_base('),
   'catera_v1_command.request_id','catera_v1_command_confirm_base.request_id');
end $$;
revoke all on function public.catera_v1_command_confirm_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); did uuid; m text; rx text; d v1.delivery_days; s v1.subscriptions; f v1.fulfillments;
 old v1.receipts; fingerprint text:=md5(action||payload::text); result jsonb; nextstatus text;
 today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action not in ('delivery.confirm','delivery.react') then
  return public.catera_v1_command_confirm_base(action,payload,request_id);
 end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object'
  or not(payload ?& array['deliveryId','meal']) or (payload - array['deliveryId','meal','reaction'])<>'{}'::jsonb
  or jsonb_typeof(payload->'deliveryId') is distinct from 'string'
  or jsonb_typeof(payload->'meal') is distinct from 'string' or payload->>'meal' not in ('lunch','dinner')
  or (payload ? 'reaction' and (jsonb_typeof(payload->'reaction') is distinct from 'string' or payload->>'reaction' not in ('enak','biasa','kurang')))
  or (action='delivery.react' and not payload ? 'reaction') then raise exception 'INVALID_INPUT';end if;
 begin did:=(payload->>'deliveryId')::uuid;exception when invalid_text_representation then raise exception 'INVALID_INPUT';end;
 m:=payload->>'meal'; rx:=payload->>'reaction';
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts r where r.actor_id=u and r.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;

 select * into d from v1.delivery_days where id=did for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into s from v1.subscriptions where id=d.subscription_id;
 if s.user_id is distinct from u then raise exception 'FORBIDDEN';end if;
 select * into f from v1.fulfillments where day_id=d.id and meal=m for update;
 if not found then raise exception 'NOT_FOUND';end if;

 if action='delivery.react' then
  -- Only a delivered meal, and only for 48 hours after it was confirmed. A meal delivered
  -- without a confirmation time counts from the end of its service day.
  if f.status<>'delivered' or coalesce(f.confirmed_at,(d.service_date+1)::timestamp at time zone 'Asia/Jakarta')+interval '48 hours'<=now()
   then raise exception 'NOT_ALLOWED';end if;
  insert into v1.delivery_reactions(day_id,meal,user_id,reaction) values(d.id,m,u,rx)
   on conflict(day_id,meal) do update set reaction=excluded.reaction;
  result:=jsonb_build_object('reaction',rx);
 else
  if d.status='cancelled' or f.status='cancelled' then raise exception 'NOT_AVAILABLE';end if;
  if d.service_date not in (today,today-1) then raise exception 'NOT_ALLOWED';end if;
  if exists(select 1 from v1.delivery_issues i where i.day_id=d.id and i.meal=m and i.status in ('open','responded','escalated'))
   then raise exception 'NOT_ALLOWED';end if;
  if f.status<>'delivered' then
   -- On the way, or the kitchen has not marked a departure but the window has started.
   if not (f.status='out_for_delivery'
    or (f.status in ('scheduled','preparing') and now()>=lower(v1.window_bounds(s.snapshot->'offer',m,d.service_date))))
    then raise exception 'NOT_ALLOWED';end if;
   update v1.fulfillments set status='delivered',confirmed_at=now(),confirmed_by='customer' where day_id=d.id and meal=m
    returning * into f;
   -- Same derivation as v1.auto_deliver, plus the in-between states the caterer's status command uses.
   if not exists(select 1 from v1.fulfillments where day_id=d.id and status not in ('delivered','cancelled')) then nextstatus:='delivered';
   elsif exists(select 1 from v1.fulfillments where day_id=d.id and status='issue') then nextstatus:='issue';
   elsif exists(select 1 from v1.fulfillments where day_id=d.id and status='out_for_delivery') then nextstatus:='out_for_delivery';
   elsif exists(select 1 from v1.fulfillments where day_id=d.id and status='preparing') then nextstatus:='preparing';
   else nextstatus:='scheduled';end if;
   if nextstatus is distinct from d.status then
    update v1.delivery_days set status=nextstatus,version=version+1 where id=d.id;
   end if;
   if nextstatus='delivered' and not exists(select 1 from v1.delivery_days where subscription_id=s.id and status not in ('delivered','cancelled')) then
    update v1.subscriptions set status='completed' where id=s.id and status<>'completed';
   end if;
  end if;
  if rx is not null then
   insert into v1.delivery_reactions(day_id,meal,user_id,reaction) values(d.id,m,u,rx)
    on conflict(day_id,meal) do update set reaction=excluded.reaction;
  end if;
  -- The "has it arrived?" reminder is pointless once the customer has answered.
  delete from v1.outbox where dedupe='arrive:'||d.id||':'||m and processed_at is null;
  result:=jsonb_build_object('status','delivered','confirmedAt',f.confirmed_at);
 end if;
 insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('deliveryId',d.id,'meal',m,'reaction',rx,'requestId',request_id));
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,fingerprint,result);
 insert into public.catera_v1_events(id,user_id,topic) values(gen_random_uuid(),u,'delivery.changed');
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;
