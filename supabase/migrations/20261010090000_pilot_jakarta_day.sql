-- Paid seller pilot reports and admin date checks follow the Jakarta day.
-- The pilot metrics compared payment, invoice entry and refund timestamps with date bounds that
-- Postgres casts in the session time zone (UTC), retention used the UTC current_date, and the
-- pilot read defaulted its window to the UTC month and current_date. From 00:00 to 07:00 Jakarta
-- the UTC date is still the previous day, so a payment made then fell outside a window that
-- starts on the Jakarta date, and costs recorded for the Jakarta date fell outside the default
-- window. In the same hours pilot.exit rejected today's Jakarta date as a future date, and
-- pilot.enroll and pilot.invoice compared against the UTC date and month of the pricing start.
-- Each of these now reads its days in Asia/Jakarta, as settlement reporting already does.
-- Stored timestamps and every other read and command are unchanged.

alter function v1.pilot_metrics(uuid,date,date) set timezone to 'Asia/Jakarta';

-- The pilot read keeps its window when the caller names one, and otherwise defaults to the
-- current Jakarta month up to the Jakarta today. The base read still authorizes.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_pilot_day_base;
revoke all on function public.catera_v1_read_pilot_day_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date;
begin
 if resource='pilot' and jsonb_typeof(params)='object' and (params->>'from' is null or params->>'to' is null) then
  today:=(statement_timestamp() at time zone 'Asia/Jakarta')::date;
  params:=params||jsonb_build_object('from',coalesce(params->>'from',date_trunc('month',today)::date::text),
   'to',coalesce(params->>'to',today::text));
 end if;
 return public.catera_v1_read_pilot_day_base(resource,params);
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- The pilot date commands run the unchanged base with TimeZone set to Asia/Jakarta for that call
-- only, so current_date and the date of the pricing start are Jakarta dates. The base still
-- authorizes, replays receipts and writes the audit row in the same transaction.
-- The current command body names its own receipt lookup with the function name
-- (catera_v1_command.request_id), so the base is re-created under its new name, as
-- 20261009090000_kitchen_cooking.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_pilot_day_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_pilot_day_base('),
   'catera_v1_command.request_id','catera_v1_command_pilot_day_base.request_id');
end $$;
revoke all on function public.catera_v1_command_pilot_day_base(text,jsonb,uuid) from public,anon,authenticated;

create function v1.pilot_command_in_jakarta(action text,payload jsonb,request_id uuid) returns jsonb
language sql set search_path='' set timezone to 'Asia/Jakarta' as $$
 select public.catera_v1_command_pilot_day_base(action,payload,request_id)
$$;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if action in('pilot.enroll','pilot.exit','pilot.invoice') then
  return v1.pilot_command_in_jakarta(action,payload,request_id);
 end if;
 return public.catera_v1_command_pilot_day_base(action,payload,request_id);
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;
