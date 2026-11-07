-- Audit hardening (2026-11-07). Function bodies were checked against the hosted project before writing: the three
-- bodies patched in place below hash the same there and in a repo-ordered database, whatever order the read layers
-- were applied in.
--   A. The seller read no longer shows a kitchen people who only opened a checkout.
--   B. delivery.status takes "issue" straight from any open stage, so Gagal diantar is one transaction and one push.
--   C. The public reviews read names its columns and stops at 100.
--   D. Indexes for hot paths. Names match the ones hosted already has, so those are no-ops there.
--   E. The conversations read finds a person's kitchens through v1.staff, with a limit.
--   F. Failed provider webhooks back off and stop at 50 attempts, and each reconcile gives a stopped one more try. They
--      stay in the inbox and health counts them.
--   G. RLS on the two v1 tables that lacked it.
--   H. The import assistant has daily ceilings, one for kitchens not yet approved and one for approved kitchens, and a
--      lower limit for kitchens not yet approved.
--   I. Maintenance prunes realtime events, one-off outbox jobs and checked push tickets.

-- Replaces one exact piece of a function body, or fails the migration if the piece is not there.
create function v1.audit_hardening_patch(fn regprocedure,anchor text,replacement text) returns void
language plpgsql set search_path='' as $f$
declare d text:=pg_get_functiondef(fn::oid);
begin
 if position(anchor in d)=0 then raise exception 'HARDENING_ANCHOR_MISSING %',fn;end if;
 execute replace(d,anchor,replacement);
end $f$;

-- A. Same class as 20261104100000. v1.relationships gains a row when a checkout is opened, so `customers` goes by
-- v1.kitchen_customer. A checkout without a subscription loses the street address, and one from a person who is not
-- this kitchen's customer also loses who they are. The sale itself (package, totals, state) still shows.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_hardening_base;
revoke all on function public.catera_v1_read_hardening_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cid uuid;
begin
 result:=public.catera_v1_read_hardening_base(resource,params);
 if resource='seller' and jsonb_typeof(result->'caterer')='object' then
  -- The base read has already checked that the caller is this kitchen's staff, so the id is a valid kitchen.
  cid:=(params->>'id')::uuid;
  if jsonb_typeof(result->'customers')='array' then
   result:=jsonb_set(result,'{customers}',coalesce((select jsonb_agg(cu order by n)
    from jsonb_array_elements(result->'customers') with ordinality t(cu,n)
    where cu->>'id' ~ '^[0-9a-fA-F-]{36}$' and v1.kitchen_customer((cu->>'id')::uuid,cid)),'[]'::jsonb));
  end if;
  if jsonb_typeof(result->'transactions')='array' then
   result:=jsonb_set(result,'{transactions}',coalesce((select jsonb_agg(
     case when x->>'user_id' is not null and not v1.kitchen_customer((x->>'user_id')::uuid,cid)
      then y-'user_id'-'customerName'-'address_id' else y end order by n)
    from jsonb_array_elements(result->'transactions') with ordinality t(x,n),
    lateral (select case when x->>'subscription_id' is null then x #- '{quote,address}' else x end y) z),'[]'::jsonb));
  end if;
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- B. Authorization, the date check, the version check, the audit row and the day status are the branch's own, and the
-- push trigger sends only Gagal diantar because no other stage is passed through. Clients that still walk the stages
-- keep working.
select v1.audit_hardening_patch('public.catera_v1_command_legacy(text,jsonb,uuid)'::regprocedure,
 $a$(mealstatus='scheduled' and nextstatus='preparing')$a$,
 $b$(mealstatus in('scheduled','preparing') and nextstatus='issue') or (mealstatus='scheduled' and nextstatus='preparing')$b$);

-- C. Callable by anon: never the reviewer's account or subscription id.
select v1.audit_hardening_patch('public.catera_v1_read_operations_base(text,jsonb)'::regprocedure,
 $a$select jsonb_agg(to_jsonb(r)||jsonb_build_object('customer',p.name)) from v1.reviews r join v1.profiles p on p.id=r.user_id where r.package_id=(params->>'id')::uuid and not hidden)$a$,
 $b$select jsonb_agg(jsonb_build_object('id',r.id,'customer',p.name,'rating',r.rating,'food',r.food,'delivery',r.delivery,'value',r.value,'body',r.body,'reply',r.reply,'created_at',r.created_at) order by r.created_at desc,r.id) from (select x.* from v1.reviews x where x.package_id=(params->>'id')::uuid and not x.hidden order by x.created_at desc,x.id limit 100) r join v1.profiles p on p.id=r.user_id)$b$);

-- E. v1.is_staff is the same test as this subquery, run once per row. Conversations have no timestamp of their own,
-- so the limit keeps the ones with the latest messages.
select v1.audit_hardening_patch('public.catera_v1_read_operations_base(text,jsonb)'::regprocedure,
 $a$from v1.conversations c join v1.caterers k on k.id=c.caterer_id join v1.profiles p on p.id=c.customer_id where c.customer_id=u or v1.is_staff(u,c.caterer_id))$a$,
 $b$from (select x.* from v1.conversations x where x.customer_id=u or x.caterer_id in (select st.caterer_id from v1.staff st where st.user_id=u) order by (select max(m.created_at) from v1.messages m where m.conversation_id=x.id) desc nulls last,x.id limit 200) c join v1.caterers k on k.id=c.caterer_id join v1.profiles p on p.id=c.customer_id)$b$);

-- F. attempts in the SET list is the value before this claim. An event at 50 attempts is kept, counted by health below,
-- and picked up again if an operator resets its attempts. The provider saying the same thing again (reconcile, or a
-- webhook resent) also gives it one more claim, so a paid event is never abandoned while its operation is still polled.
select v1.audit_hardening_patch('public.catera_v1_system_direct_base(text,jsonb)'::regprocedure,
 $a$where processed_at is null and available_at<=clock_timestamp() order by received_at limit 20 for update skip locked), claimed as(update v1.provider_inbox x set attempts=attempts+1,available_at=clock_timestamp()+interval '1 minute'$a$,
 $b$where processed_at is null and attempts<50 and available_at<=clock_timestamp() order by available_at,received_at limit 20 for update skip locked), claimed as(update v1.provider_inbox x set attempts=attempts+1,available_at=clock_timestamp()+least(attempts+1,60)*interval '1 minute'$b$);
select v1.audit_hardening_patch('public.catera_v1_system_direct_base(text,jsonb)'::regprocedure,
 $a$if ev.fingerprint<>md5((payload->'event')::text) then raise exception 'CONFLICT';end if;return jsonb_build_object('duplicate',true);end if;$a$,
 $b$if ev.fingerprint<>md5((payload->'event')::text) then raise exception 'CONFLICT';end if;if ev.processed_at is null and ev.attempts>=50 then update v1.provider_inbox set attempts=49,available_at=clock_timestamp() where id=ev.id;end if;return jsonb_build_object('duplicate',true);end if;$b$);

drop function v1.audit_hardening_patch(regprocedure,text,text);

-- G. Both tables are already revoked from clients and reached only by functions.
alter table v1.auto_deliver_policy enable row level security;
alter table v1.import_assistant_usage enable row level security;

-- H. Any phone sign-up can open a kitchen, so the per-kitchen limit alone does not cap the bill. Throwaway kitchens share
-- a ceiling of their own, so they cannot use up an approved kitchen's day. The lock makes each ceiling exact under
-- concurrent calls and is held only for this short transaction.
create or replace function v1.import_assistant_consume(cid uuid, p_day date, p_limit integer default 20) returns integer
language plpgsql security definer set search_path='' as $$
declare used integer; approved boolean; lim integer;
begin
 perform pg_advisory_xact_lock(hashtext('import-assistant:'||p_day));
 approved:=coalesce((select c.status='approved' from v1.caterers c where c.id=cid),false);
 if (select coalesce(sum(x.calls),0) from v1.import_assistant_usage x join v1.caterers c on c.id=x.caterer_id
     where x.day=p_day and (c.status='approved')=approved)>=(case when approved then 500 else 100 end) then raise exception 'QUOTA';end if;
 lim:=case when approved then p_limit else least(p_limit,5) end;
 insert into v1.import_assistant_usage as u(caterer_id, day, calls) values (cid, p_day, 1)
 on conflict (caterer_id, day) do update set calls = u.calls + 1 where u.calls < lim
 returning calls into used;
 if used is null then raise exception 'QUOTA'; end if;
 return used;
end $$;
revoke all on function v1.import_assistant_consume(uuid,date,integer) from public, anon, authenticated;

-- I and the health count for F. Runs after the base call, which holds the service-role check and the maintenance lock.
--   * Realtime events are only ever consumed as they are inserted.
--   * The outbox doubles as the memory of what was already sent: renew-*, tomorrow-*, reminder.record and the stage keys
--     (cooking, depart, arrived, failed, arrive) are read back to decide whether to notify, and the trip count reads
--     failed:*, so those rows stay for good. Only jobs keyed by their own uuid go: nothing looks those up again.
--   * push_tickets.job_id references the outbox with no cascade, so a job an unchecked ticket still points at stays.
alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_hardening_base;
revoke all on function public.catera_v1_system_hardening_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 r:=public.catera_v1_system_hardening_base(action,payload);
 if action='maintenance' then
  delete from public.catera_v1_events e where e.created_at<clock_timestamp()-interval '7 days';
  delete from v1.push_tickets t where t.checked_at<clock_timestamp()-interval '7 days';
  delete from v1.outbox o where o.processed_at<clock_timestamp()-interval '30 days'
   and o.dedupe ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and not exists(select 1 from v1.push_tickets t where t.job_id=o.id);
 elsif action='health' and jsonb_typeof(r)='object' then
  -- 49 too: reconcile puts a stopped event back to 49 after each failed try, and health runs after reconcile.
  r:=r||jsonb_build_object('providerInboxStuck',(select count(*) from v1.provider_inbox i where i.processed_at is null and i.attempts>=49));
 end if;
 return r;
end $$;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;

-- D. Single-column names and definitions match what hosted has (no-ops there). A composite or partial index gets a name
-- of its own, so it is really built on hosted instead of being skipped by a narrower index of the conventional name.
create index if not exists settlement_entries_allocation_id_idx on v1.settlement_entries(allocation_id);
create index if not exists settlement_entries_day_id_idx on v1.settlement_entries(day_id);
create index if not exists settlement_payout_items_allocation_id_idx on v1.settlement_payout_items(allocation_id);
create index if not exists payout_items_allocation_id_idx on v1.payout_items(allocation_id);
create index if not exists support_cases_checkout_id_idx on v1.support_cases(checkout_id);
create index if not exists refunds_checkout_id_idx on v1.refunds(checkout_id);
create index if not exists allocations_caterer_id_idx on v1.allocations(caterer_id);
create index if not exists addresses_user_id_idx on v1.addresses(user_id);
create index if not exists addresses_archived_id_text_idx on v1.addresses((id::text)) where archived_at is not null;
create index if not exists checkouts_user_id_state_idx on v1.checkouts(user_id,state);
create index if not exists support_cases_user_id_idx on v1.support_cases(user_id);
create index if not exists outbox_pending_available_idx on v1.outbox(available_at,id) where processed_at is null;
create index if not exists notifications_id_text_idx on v1.notifications((id::text));
create index if not exists devices_user_id_idx on v1.devices(user_id);
create index if not exists messages_conversation_id_created_at_idx on v1.messages(conversation_id,created_at desc);
create index if not exists conversations_caterer_id_idx on v1.conversations(caterer_id);
create index if not exists packages_caterer_id_idx on v1.packages(caterer_id);
create index if not exists subscriptions_package_id_idx on v1.subscriptions(package_id);
create index if not exists checkouts_package_id_created_at_idx on v1.checkouts(package_id,created_at desc);
create index if not exists checkouts_pending_expires_at_idx on v1.checkouts(expires_at) where state='pending';
create index if not exists reviews_package_id_idx on v1.reviews(package_id);
create index if not exists support_cases_caterer_id_idx on v1.support_cases(caterer_id);
create index if not exists audit_action_created_at_idx on v1.audit(action,created_at desc);
create index if not exists fulfillments_out_arrived_at_idx on v1.fulfillments(arrived_at) where status='out_for_delivery' and arrived_at is not null;
create index if not exists fulfillments_arrived_photo_idx on v1.fulfillments(arrived_photo) where arrived_photo is not null;
create index if not exists delivery_days_open_service_date_idx on v1.delivery_days(service_date) where status in('scheduled','preparing','out_for_delivery');
create index if not exists catera_v1_events_user_id_created_at_idx on public.catera_v1_events(user_id,created_at);
