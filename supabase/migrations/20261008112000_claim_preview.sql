-- Claim preview (Plan 3a, customer app rebuild).
--   claim-preview {token} -> catererName, packageName, remainingDays, nextDate, nextWindow, addressLabel, maskedPhone
-- A caterer sends a customer a WhatsApp link /claim/<token>. Before asking for a sign-in the
-- web page and the app show what is being claimed. The read is public (anon and signed-in),
-- so it runs here as security definer, reveals only those seven fields and treats unknown,
-- used and expired tokens as one and the same NOT_FOUND. It never writes and never consumes
-- the link: claiming stays with pilot.claim.

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_claim_preview_base;
revoke all on function public.catera_v1_read_claim_preview_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare tok text; link v1.customer_claims; cr v1.customer_records; c v1.caterers; sub v1.subscriptions;
 today date:=(clock_timestamp() at time zone 'Asia/Jakarta')::date; next_day date; next_meal text;
 remaining int:=0; digits text; masked text;
begin
 if resource is distinct from 'claim-preview' then return public.catera_v1_read_claim_preview_base(resource,params);end if;
 -- Only a token is accepted; no id, owner or filter.
 if jsonb_typeof(params) is distinct from 'object' or (params - 'token')<>'{}'::jsonb
  or jsonb_typeof(params->'token') is distinct from 'string'
  or length(params->>'token') not between 20 and 200 then raise exception 'INVALID_INPUT';end if;
 tok:=params->>'token';
 -- One lookup decides unknown, used and expired alike: they share this single NOT_FOUND.
 select * into link from v1.customer_claims k
  where k.token_hash=encode(sha256(convert_to(tok,'UTF8')),'hex') and k.used_at is null and k.expires_at>clock_timestamp();
 if not found then raise exception 'NOT_FOUND';end if;
 select * into cr from v1.customer_records where id=link.customer_record_id;
 select * into c from v1.caterers where id=cr.caterer_id;
 -- The subscription being claimed: an active one with the soonest delivery first.
 select * into sub from v1.subscriptions s where s.customer_record_id=cr.id
  order by (s.status='active') desc,
   (select min(d.service_date) from v1.delivery_days d where d.subscription_id=s.id and d.status<>'cancelled' and d.service_date>=today) nulls last,
   s.starts_on desc,s.id limit 1;
 if found then
  select count(*)::int into remaining from v1.delivery_days d where d.subscription_id=sub.id and d.status not in('delivered','cancelled');
  select min(d.service_date) into next_day from v1.delivery_days d where d.subscription_id=sub.id and d.status<>'cancelled' and d.service_date>=today;
  if next_day is not null then
   select f.meal into next_meal from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
    where d.subscription_id=sub.id and d.service_date=next_day and f.status<>'cancelled' order by (f.meal='lunch') desc limit 1;
  end if;
 end if;
 digits:=regexp_replace(regexp_replace(coalesce(cr.phone,''),'^\+62','0'),'\D','','g');
 masked:=case when length(digits)<8 then '•••' else substr(digits,1,4)||'-•••-'||right(digits,4) end;
 return jsonb_build_object(
  'catererName',c.name,
  'packageName',coalesce(sub.snapshot->'offer'->>'name',''),
  'remainingDays',remaining,
  'nextDate',next_day,
  'nextWindow',case when next_meal is null then null else sub.snapshot->'offer'->'windows'->>next_meal end,
  'addressLabel',coalesce(nullif(trim(cr.address->>'label'),''),left(coalesce(cr.address->>'line',''),24)),
  'maskedPhone',masked);
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
