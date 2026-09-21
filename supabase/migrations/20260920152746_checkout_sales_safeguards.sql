-- Keep configured durations editable, but expose their purchase eligibility.
create or replace function v1.offer(p v1.packages) returns jsonb language sql stable set search_path='' as $$
 select v1.offer_duration_base(p) || jsonb_build_object(
  'durationPricing',v1.duration_pricing(p.id),
  'multiCycleAvailable',coalesce((select multi_cycle from v1.purchase_features where id),false)
    or coalesce(current_setting('catera.demo',true),'false')='true')
$$;

-- Existing purchases retain unknown acceptance; never invent historical consent.
alter table v1.checkouts add column terms_accepted_at timestamptz;
alter table v1.checkouts add column terms_version text;
create function v1.accepted_terms_immutable() returns trigger language plpgsql set search_path='' as $$ begin
 if old.terms_accepted_at is not null and
  (new.terms_accepted_at is distinct from old.terms_accepted_at or new.terms_version is distinct from old.terms_version)
 then raise exception 'IMMUTABLE_TERMS';end if;
 return new;
end $$;
create trigger accepted_terms_immutable before update on v1.checkouts for each row execute function v1.accepted_terms_immutable();

-- The existing command owns reservation locks, idempotency and outbox writes.
-- Acceptance and those effects commit or roll back together.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_checkout_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_checkout_base('),'catera_v1_command.request_id','catera_v1_command_checkout_base.request_id');
end $$;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;c v1.checkouts;begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if action='checkout.create' and payload->'acceptedTerms' is distinct from 'true'::jsonb then raise exception 'TERMS_REQUIRED';end if;
 r:=public.catera_v1_command_checkout_base(action,payload,request_id);
 if action='checkout.create' then
  update v1.checkouts set terms_accepted_at=clock_timestamp(),terms_version='purchase-2026-09-20'
   where id=(r->>'id')::uuid and user_id=auth.uid() and terms_accepted_at is null;
  select * into c from v1.checkouts where id=(r->>'id')::uuid and user_id=auth.uid();
  r:=r||jsonb_build_object('terms_accepted_at',c.terms_accepted_at,'terms_version',c.terms_version);
 end if;
 return r;
end $$;
revoke all on function public.catera_v1_command_checkout_base(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
