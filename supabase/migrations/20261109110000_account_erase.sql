-- Account erase (2026-11-09): a platform admin answers an open deletion request (v1.account_requests, kind
-- 'deletion') with account.erase. One transaction, under the same per-user lock checkout.create takes:
--   refuse  ACTIVE_ORDERS while the customer has an active subscription, an unfinished checkout, a pending refund
--           or an unsettled payout on one of their orders; STAFF_ACCOUNT for kitchen staff (a kitchen is closed,
--           not erased, and needs its own process);
--   delete  push tokens and their tickets, saved packages, notifications, pending outbox jobs, command receipts;
--   blank   profile name and phone, addresses (archived), the kitchens' customer records, the address copied onto
--           delivery days, production sheets, subscription snapshots and checkout quotes; message, review, help
--           and complaint text;
--   keep    checkouts, payments, refunds, allocations, settlement and payout rows, identity-free, for tax books;
--   write   one audit row and close the request.
-- The API deletes the Supabase Auth user after this commits (docs/RUNBOOK.md section 19). A retry of a finished
-- erase answers the same result, so that step can be repeated.

-- Snapshots and quotes are frozen terms. The only change allowed is the erase's own: dropping the identity keys
-- while catera.erase_user names the row's customer. Everything else still raises IMMUTABLE_TERMS.
create function v1.erase_identity(j jsonb) returns jsonb language sql immutable set search_path='' as $$
 select j-'address'-'customerName'-'customerPhone'-'phone'-'recipient'
$$;
create or replace function v1.snapshot_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if new.portions<>old.portions then raise exception 'IMMUTABLE_TERMS';end if;
 if new.snapshot<>old.snapshot and not (current_setting('catera.erase_user',true)=old.user_id::text
   and new.snapshot=v1.erase_identity(old.snapshot)) then raise exception 'IMMUTABLE_TERMS';end if;
 return new;
end $$;
create or replace function v1.checkout_terms_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if old.quote->>'pricingVersion'='2' and (new.quote is distinct from old.quote or new.user_id is distinct from old.user_id or new.package_id<>old.package_id)
   and not (current_setting('catera.erase_user',true)=old.user_id::text and new.user_id=old.user_id
     and new.package_id=old.package_id and new.quote=v1.erase_identity(old.quote)) then
  raise exception 'IMMUTABLE_TERMS';
 end if;
 return new;
end $$;
revoke all on function v1.erase_identity(jsonb) from public,anon,authenticated;

-- Production sheets and complaint history are append-only. The erase may rewrite a sheet's entries and blank the
-- text of the erased customer's complaint history; every other update, and every delete, is still IMMUTABLE_HISTORY.
create function v1.production_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='UPDATE' and coalesce(current_setting('catera.erase_user',true),'')<>''
   and to_jsonb(new)-'entries'=to_jsonb(old)-'entries' then return new;end if;
 raise exception 'IMMUTABLE_HISTORY';
end $$;
drop trigger production_immutable on v1.production;
create trigger production_immutable before update or delete on v1.production for each row execute function v1.production_guard();
create function v1.issue_history_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='UPDATE' and new.body='[dihapus]' and to_jsonb(new)-'body'=to_jsonb(old)-'body'
   and exists(select 1 from v1.delivery_issues i where i.id=old.issue_id and i.user_id::text=current_setting('catera.erase_user',true))
 then return new;end if;
 raise exception 'IMMUTABLE_HISTORY';
end $$;
drop trigger delivery_issue_history_immutable on v1.delivery_issue_events;
create trigger delivery_issue_history_immutable before update or delete on v1.delivery_issue_events for each row execute function v1.issue_history_guard();
revoke all on function v1.production_guard(),v1.issue_history_guard() from public,anon,authenticated;

-- Renames the current entry point to its base; a body that names its own parameters with the function name is
-- re-created under the new name (as 20261030120000_caterer_contact_whatsapp.sql does).
create function v1.rename_entry_point(fn text,args text,base text) returns void language plpgsql set search_path='' as $f$
declare d text;begin
 select pg_get_functiondef(('public.'||fn||'('||args||')')::regprocedure) into d;
 execute format('alter function public.%I(%s) rename to %I',fn,args,base);
 execute replace(replace(d,'public.'||fn||'(','public.'||base||'('),fn||'.',base||'.');
end $f$;
select v1.rename_entry_point('catera_v1_command','text,jsonb,uuid','catera_v1_command_erase_base');
drop function v1.rename_entry_point(text,text,text);
revoke all on function public.catera_v1_command_erase_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare admin uuid:=auth.uid(); ticket v1.account_requests; target uuid; days uuid[]; erased_name constant text:='Pengguna terhapus';
 gone constant text:='[dihapus]'; counts jsonb;
begin
 if action is distinct from 'account.erase' then
  return public.catera_v1_command_erase_base(action,payload,request_id);
 end if;
 if admin is null or not v1.is_admin(admin) then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(payload) is distinct from 'object' or coalesce(payload->>'id','') !~ '^[0-9a-fA-F-]{36}$' then
  raise exception 'INVALID_INPUT';
 end if;
 select user_id into target from v1.account_requests where id=(payload->>'id')::uuid and kind='deletion';
 if not found then raise exception 'NOT_FOUND';end if;
 -- checkout.create, address.* and the payment paths take this lock, so no order starts mid-erase.
 perform pg_advisory_xact_lock(hashtext(target::text));
 select * into ticket from v1.account_requests where id=(payload->>'id')::uuid for update;
 if ticket.status<>'open' then
  if exists(select 1 from v1.audit au where au.action='account.erase' and au.details->>'requestId'=ticket.id::text) then
   return jsonb_build_object('id',ticket.id,'userId',target,'erased',true,'existing',true);
  end if;
  raise exception 'CONFLICT';
 end if;
 if exists(select 1 from v1.staff where user_id=target) then raise exception 'STAFF_ACCOUNT';end if;
 if exists(select 1 from v1.subscriptions where user_id=target and status='active')
  or exists(select 1 from v1.checkouts where user_id=target and (state='payment_exception' or (state='pending' and expires_at>now())))
  or exists(select 1 from v1.refunds r join v1.checkouts c on c.id=r.checkout_id
            where c.user_id=target and r.state not in('succeeded','failed','cancelled'))
  or exists(select 1 from v1.payouts po join (
              select payout_id,allocation_id from v1.payout_items union all select payout_id,allocation_id from v1.settlement_payout_items
            ) i on i.payout_id=po.id join v1.allocations al on al.id=i.allocation_id join v1.checkouts c on c.id=al.checkout_id
            where c.user_id=target and po.status not in('succeeded','failed','cancelled')) then
  raise exception 'ACTIVE_ORDERS';
 end if;

 perform set_config('catera.erase_user',target::text,true);
 select coalesce(array_agg(d.id),'{}') into days from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.user_id=target;
 select jsonb_build_object(
  'devices',(select count(*) from v1.devices where user_id=target),
  'addresses',(select count(*) from v1.addresses where user_id=target),
  'subscriptions',(select count(*) from v1.subscriptions where user_id=target),
  'checkouts',(select count(*) from v1.checkouts where user_id=target)) into counts;

 delete from v1.push_tickets where token in(select token from v1.devices where user_id=target)
  or job_id in(select o.id from v1.outbox o where o.processed_at is null and (o.payload->>'userId'=target::text or o.payload->>'customerId'=target::text));
 delete from v1.devices where user_id=target;
 delete from v1.outbox o where o.processed_at is null and (o.payload->>'userId'=target::text or o.payload->>'customerId'=target::text);
 delete from v1.saved_packages where user_id=target;
 delete from v1.notifications where user_id=target;
 delete from v1.receipts where actor_id=target;

 update v1.profiles set name=erased_name,phone=null where id=target;
 update v1.addresses set label='',line='',area='',instructions='',lat=null,lng=null,
  archived_at=coalesce(archived_at,now()),version=version+1 where user_id=target;
 update v1.customer_records set name=erased_name,phone=null,address='{}',claim_review=null,version=version+1 where user_id=target;
 update v1.subscriptions set snapshot=v1.erase_identity(snapshot) where user_id=target and snapshot<>v1.erase_identity(snapshot);
 update v1.checkouts set quote=v1.erase_identity(quote) where user_id=target and quote<>v1.erase_identity(quote);
 update v1.delivery_days set address='{}' where id=any(days) and address<>'{}';
 update v1.production p set entries=(select jsonb_agg(case when e->>'id'=any(days::text[])
   then v1.erase_identity(e)||jsonb_build_object('address','{}'::jsonb)
     ||case when jsonb_typeof(e->'customer')='object' then jsonb_build_object('customer',(e->'customer')||jsonb_build_object('name',erased_name)) else '{}'::jsonb end
   else e end order by n) from jsonb_array_elements(p.entries) with ordinality x(e,n))
  where jsonb_typeof(p.entries)='array' and exists(select 1 from jsonb_array_elements(p.entries) e where e->>'id'=any(days::text[]));
 update v1.messages m set body=gone from v1.conversations c where c.id=m.conversation_id and c.customer_id=target and m.body<>gone;
 update v1.messages set body=gone where sender_id=target and body<>gone;
 update v1.reviews set body='' where user_id=target;
 update v1.support_cases set description=gone where user_id=target;
 update v1.delivery_issues set description=gone where user_id=target;
 update v1.delivery_issue_events ev set body=gone from v1.delivery_issues i where i.id=ev.issue_id and i.user_id=target and ev.body<>gone;
 update v1.account_requests set body=gone where user_id=target;
 update v1.account_requests set status='resolved',resolution='Akun dihapus.',resolved_by=admin where id=ticket.id;

 insert into v1.audit(actor_id,action,details)
  values(admin,'account.erase',jsonb_build_object('requestId',ticket.id,'userId',target)||counts);
 return jsonb_build_object('id',ticket.id,'userId',target,'erased',true);
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
