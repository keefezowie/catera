create schema if not exists catera;
create table public.businesses (
 id uuid primary key default gen_random_uuid(), slug text unique not null check(slug ~ '^[a-z0-9-]+$'),
 name text not null, timezone text not null default 'Asia/Jakarta', cutoff time not null default '21:00', version integer not null default 1,
 created_at timestamptz not null default now()
);
create table public.memberships (
 business_id uuid not null references public.businesses, user_id uuid not null references auth.users,
 role text not null check(role in ('owner','admin','subscriber')), primary key(business_id,user_id)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses,
 email text not null, role text not null check(role in ('owner','admin','subscriber')), customer_id uuid,
 accepted_at timestamptz, created_at timestamptz not null default now(), unique(business_id,email)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses,
 user_id uuid references auth.users, name text not null check(length(name)>0), email text not null default '',
 phone text not null default '', address jsonb not null default '{}', version integer not null default 1,
 created_at timestamptz not null default now(), unique(business_id,id), unique(business_id,user_id)
);
alter table public.invitations add foreign key(business_id,customer_id) references public.customers(business_id,id);
create table public.delivery_slots (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses,
 name text not null, start_time time not null, active boolean not null default true, unique(business_id,id)
);
create table public.date_exceptions (
 business_id uuid not null references public.businesses, service_date date not null, cutoff_at timestamptz,
 closed boolean not null default false, primary key(business_id,service_date)
);
create table public.packages (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses,
 name text not null, deliveries integer not null check(deliveries>0), validity_days integer check(validity_days>0),
 active boolean not null default true, version integer not null default 1, unique(business_id,id)
);
create table public.purchases (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, customer_id uuid not null,
 package_id uuid not null, terms jsonb not null, external_reference text not null default '', starts_on date not null,
 created_at timestamptz not null default now(), unique(business_id,id), unique(business_id,id,customer_id),
 foreign key(business_id,customer_id) references public.customers(business_id,id),
 foreign key(business_id,package_id) references public.packages(business_id,id)
);
create table public.quota_grants (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, customer_id uuid not null,
 purchase_id uuid not null unique, starts_on date not null, expires_on date, created_at timestamptz not null default now(),
 unique(business_id,id), unique(business_id,id,customer_id),
 foreign key(business_id,purchase_id,customer_id) references public.purchases(business_id,id,customer_id),
 foreign key(business_id,customer_id) references public.customers(business_id,id)
);
create table public.menus (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses,
 name text not null, description text not null default '', active boolean not null default true,
 version integer not null default 1, unique(business_id,id)
);
create table public.menu_offerings (
 business_id uuid not null, service_date date not null, slot_id uuid not null, menu_id uuid not null,
 is_default boolean not null default false, primary key(business_id,service_date,slot_id,menu_id),
 foreign key(business_id,slot_id) references public.delivery_slots(business_id,id),
 foreign key(business_id,menu_id) references public.menus(business_id,id)
);
create unique index one_default on public.menu_offerings(business_id,service_date,slot_id) where is_default;
create table public.schedule_patterns (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, customer_id uuid not null,
 starts_on date not null, ends_on date not null check(ends_on>=starts_on), weekdays integer[] not null,
 slots uuid[] not null, version integer not null default 1, created_at timestamptz not null default now(), unique(business_id,id), unique(business_id,id,customer_id),
 foreign key(business_id,customer_id) references public.customers(business_id,id)
);
create table public.deliveries (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, customer_id uuid not null,
 grant_id uuid not null, pattern_id uuid, service_date date not null, slot_id uuid not null,
 menu_id uuid, menu_name text, selection_source text, address jsonb not null, cutoff_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','ready','out_for_delivery','delivered','failed','cancelled')),
 version integer not null default 1, delivered_at timestamptz, created_at timestamptz not null default now(),
 unique(business_id,id), unique(business_id,id,grant_id),
 foreign key(business_id,grant_id,customer_id) references public.quota_grants(business_id,id,customer_id),
 foreign key(business_id,customer_id) references public.customers(business_id,id),
 foreign key(business_id,slot_id) references public.delivery_slots(business_id,id),
 foreign key(business_id,menu_id) references public.menus(business_id,id),
 foreign key(business_id,pattern_id,customer_id) references public.schedule_patterns(business_id,id,customer_id)
);
create unique index active_occurrence on public.deliveries(business_id,customer_id,service_date,slot_id) where status<>'cancelled';
create index deliveries_date on public.deliveries(business_id,service_date,slot_id);
create index deliveries_customer on public.deliveries(business_id,customer_id,service_date);
create table public.quota_reservations (
 business_id uuid not null, delivery_id uuid primary key, grant_id uuid not null,
 foreign key(business_id,delivery_id,grant_id) references public.deliveries(business_id,id,grant_id),
 foreign key(business_id,grant_id) references public.quota_grants(business_id,id)
);
create table public.quota_ledger (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, grant_id uuid not null,
 delivery_id uuid, amount integer not null check(amount<>0), kind text not null check(kind in ('grant','consume','reversal','adjustment')),
 reverses_id uuid unique, reason text, actor_id uuid references auth.users,
 created_at timestamptz not null default now(), unique(business_id,id),
 foreign key(business_id,grant_id) references public.quota_grants(business_id,id),
 foreign key(business_id,delivery_id,grant_id) references public.deliveries(business_id,id,grant_id),
 foreign key(business_id,reverses_id) references public.quota_ledger(business_id,id)
);
create index ledger_grant on public.quota_ledger(grant_id);
create table public.delivery_events (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, delivery_id uuid not null,
 kind text not null, details jsonb not null default '{}', actor_id uuid references auth.users,
 created_at timestamptz not null default now(),
 foreign key(business_id,delivery_id) references public.deliveries(business_id,id)
);
create table public.production_versions (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, service_date date not null, slot_id uuid not null,
 revision integer not null, entries jsonb not null, changes jsonb not null default '[]', incomplete integer not null,
 reason text not null, actor_id uuid references auth.users, created_at timestamptz not null default now(),
 unique(business_id,service_date,slot_id,revision),
 foreign key(business_id,slot_id) references public.delivery_slots(business_id,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses,
 actor_id uuid references auth.users, action text not null, entity_id uuid, details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create table public.command_receipts (
 business_id uuid not null references public.businesses, actor_id uuid not null references auth.users,
 request_id uuid not null, action text not null, payload jsonb not null, result jsonb not null,
 primary key(business_id,actor_id,request_id)
);
create table public.health_checks (
 id uuid primary key default gen_random_uuid(), checked_at timestamptz not null default now(), discrepancies jsonb not null
);

create function catera.clock() returns timestamptz language sql volatile as $$ select clock_timestamp() $$;
create function catera.role_for(b uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.memberships where business_id=b and user_id=auth.uid()
$$;
create function catera.is_staff(b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(catera.role_for(b) in ('owner','admin'),false)
$$;
create function catera.owns_customer(b uuid,c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.customers where business_id=b and id=c and user_id=auth.uid())
$$;
create function catera.cutoff_for(b uuid,d date) returns timestamptz language sql stable set search_path='' as $$
 select coalesce((select cutoff_at from public.date_exceptions where business_id=b and service_date=d),
 ((d-1)+cutoff) at time zone timezone) from public.businesses where id=b
$$;
create function catera.grant_balance(g uuid) returns integer language sql stable set search_path='' as $$
 select coalesce(sum(amount),0)::integer from public.quota_ledger where grant_id=g
$$;
create function catera.grant_available(g uuid) returns integer language sql stable set search_path='' as $$
 select catera.grant_balance(g)-(select count(*)::integer from public.quota_reservations where grant_id=g)
$$;
create function catera.assert_address(a jsonb) returns void language plpgsql as $$
begin
 if coalesce(length(trim(a->>'line')),0)<5 or coalesce(length(trim(a->>'city')),0)<2 then
 raise exception 'INVALID_ADDRESS'; end if;
end $$;

create function catera.production_snapshot(b uuid,d date,s uuid,why text) returns uuid
language plpgsql security definer set search_path='' as $$
declare rows jsonb; prev jsonb; diff jsonb; rev integer; ident uuid; missing integer;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'customer_id',x.customer_id,'customer',c.name,
 'menu_id',x.menu_id,'menu',x.menu_name,'address',x.address) order by x.id),'[]'::jsonb),
 count(*) filter(where x.menu_id is null)
 into rows,missing from public.deliveries x join public.customers c on c.id=x.customer_id
 where x.business_id=b and x.service_date=d and x.slot_id=s and x.status<>'cancelled';
 select revision,entries into rev,prev from public.production_versions
 where business_id=b and service_date=d and slot_id=s order by revision desc limit 1;
 if prev=rows then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',coalesce(a.value->>'id',z.value->>'id'),'before',a.value,'after',z.value)),'[]')
 into diff from jsonb_array_elements(coalesce(prev,'[]')) a
 full join jsonb_array_elements(rows) z on a.value->>'id'=z.value->>'id' where a.value is distinct from z.value;
 insert into public.production_versions(business_id,service_date,slot_id,revision,entries,changes,incomplete,reason,actor_id)
 values(b,d,s,coalesce(rev,0)+1,rows,diff,missing,why,auth.uid()) returning id into ident;
 return ident;
end $$;

create function catera.ensure_freeze(b uuid,d date,s uuid) returns void
language plpgsql security definer set search_path='' as $$
declare x record; default_id uuid; default_name text;
begin
 if catera.clock()<catera.cutoff_for(b,d) or exists(select 1 from public.production_versions where business_id=b and service_date=d and slot_id=s) then return; end if;
 select o.menu_id,m.name into default_id,default_name from public.menu_offerings o join public.menus m on m.id=o.menu_id
 where o.business_id=b and o.service_date=d and o.slot_id=s and o.is_default;
 if default_id is not null then
 for x in update public.deliveries set menu_id=default_id,menu_name=default_name,selection_source='default',version=version+1
 where business_id=b and service_date=d and slot_id=s and menu_id is null and status='scheduled' returning id loop
 insert into public.delivery_events(business_id,delivery_id,kind,details)
 values(b,x.id,'default_selected',jsonb_build_object('menu',default_name)); end loop;
 end if;
 perform catera.production_snapshot(b,d,s,'cutoff');
end $$;

create function public.list_workspaces() returns jsonb language plpgsql security definer set search_path='' as $$
declare mail text; i record;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 for i in select * from public.invitations where email=mail and accepted_at is null for update loop
 insert into public.memberships(business_id,user_id,role) values(i.business_id,auth.uid(),i.role) on conflict do nothing;
 if i.customer_id is not null then update public.customers set user_id=auth.uid() where id=i.customer_id and user_id is null; end if;
 update public.invitations set accepted_at=catera.clock() where id=i.id;
 end loop;
 return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'slug',b.slug,'name',b.name,'role',m.role))
 from public.businesses b join public.memberships m on m.business_id=b.id where m.user_id=auth.uid()),'[]');
end $$;

create function public.workspace_snapshot(business_slug text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid; r text; c uuid; result jsonb; local_day date;
begin
 select id,(catera.clock() at time zone timezone)::date into b,local_day from public.businesses where slug=business_slug;
 r:=catera.role_for(b);
 if r is null then raise exception 'UNAUTHORIZED'; end if;
 select id into c from public.customers where business_id=b and user_id=auth.uid();
 result:=jsonb_build_object('business',(select to_jsonb(x) from public.businesses x where id=b),'role',r,'customer_id',c,'now',catera.clock(),
 'customers',coalesce((select jsonb_agg(to_jsonb(x) order by name) from public.customers x where business_id=b and (r<>'subscriber' or id=c)),'[]'),
 'slots',coalesce((select jsonb_agg(to_jsonb(x) order by start_time) from public.delivery_slots x where business_id=b),'[]'),
 'packages',coalesce((select jsonb_agg(to_jsonb(x)) from public.packages x where business_id=b),'[]'),
 'menus',coalesce((select jsonb_agg(to_jsonb(x) order by name) from public.menus x where business_id=b),'[]'),
 'offerings',coalesce((select jsonb_agg(to_jsonb(x)) from public.menu_offerings x where business_id=b),'[]'),
 'deliveries',coalesce((select jsonb_agg(to_jsonb(x) order by service_date,slot_id,created_at) from public.deliveries x where business_id=b and (r<>'subscriber' or customer_id=c)),'[]'),
 'purchases',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.purchases x where business_id=b and (r<>'subscriber' or customer_id=c)),'[]'),
 'grants',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('remaining',catera.grant_balance(id),
 'reserved',(select count(*) from public.quota_reservations where grant_id=x.id),
 'available',case when local_day>=starts_on and (expires_on is null or local_day<=expires_on) then catera.grant_available(id) else 0 end))
 from public.quota_grants x where business_id=b and (r<>'subscriber' or customer_id=c)),'[]'),
 'ledger',coalesce((select jsonb_agg(to_jsonb(x)-'actor_id' order by x.created_at desc) from public.quota_ledger x
 join public.quota_grants g on g.id=x.grant_id where x.business_id=b and (r<>'subscriber' or g.customer_id=c)),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(x)-'actor_id' order by x.created_at desc) from public.delivery_events x
 join public.deliveries d on d.id=x.delivery_id where x.business_id=b and (r<>'subscriber' or d.customer_id=c)),'[]'),
 'patterns',coalesce((select jsonb_agg(to_jsonb(x)) from public.schedule_patterns x where business_id=b and (r<>'subscriber' or customer_id=c)),'[]'),
 'production',case when r='subscriber' then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x) order by service_date desc,revision desc) from public.production_versions x where business_id=b),'[]') end,
 'exceptions',coalesce((select jsonb_agg(to_jsonb(x)) from public.date_exceptions x where business_id=b),'[]'),
 'invitations',case when r='owner' then coalesce((select jsonb_agg(to_jsonb(x)) from public.invitations x where business_id=b),'[]') else '[]'::jsonb end,
 'memberships',case when r='owner' then coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'email',u.email)) from public.memberships m join auth.users u on u.id=m.user_id where m.business_id=b),'[]') else '[]'::jsonb end);
 return result;
end $$;

create function public.execute_command(business_slug text, action text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b uuid; r text; ident uuid; target uuid; cust uuid; pkg public.packages; item public.deliveries;
 old_item public.deliveries; rec record; grantrow record; day date; slot uuid; menu uuid; pname text; pid uuid;
 cutoff timestamptz; reason text; state text; quantity integer; date_to date; receipt public.command_receipts;
 result jsonb; old jsonb; delivery_address jsonb; applied integer:=0; ledger_id uuid; already boolean; inputs jsonb:=payload;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 select id into b from public.businesses where slug=business_slug for update;
 r:=catera.role_for(b);
 if r is null then raise exception 'UNAUTHORIZED'; end if;
 select * into receipt from public.command_receipts cr where cr.business_id=b and cr.actor_id=auth.uid() and cr.request_id=execute_command.request_id;
 if found then
 if receipt.action<>action or receipt.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return receipt.result; end if;
 if r='subscriber' and action not in ('change_delivery','profile') then raise exception 'FORBIDDEN'; end if;
 if action in ('save_settings','save_slot','save_exception','invite','set_role','adjust_quota','reverse_delivery') and r<>'owner' then raise exception 'FORBIDDEN'; end if;
 if action in ('save_settings','save_slot','save_exception','publish_menu','invite','set_role') and
 (payload->>'policy_version')::integer is distinct from (select version from public.businesses where id=b) then raise exception 'CONFLICT'; end if;
 ident:=nullif(payload->>'id','')::uuid; reason:=nullif(trim(payload->>'reason'),'');
 if action='save_customer' then
 perform catera.assert_address(payload->'address');
 if ident is null then
 insert into public.customers(business_id,name,email,phone,address) values(b,trim(payload->>'name'),lower(trim(payload->>'email')),payload->>'phone',payload->'address') returning id into ident;
 else
 select to_jsonb(x) into old from public.customers x where business_id=b and id=ident;
 update public.customers set name=trim(payload->>'name'),email=lower(trim(payload->>'email')),phone=payload->>'phone',address=payload->'address',version=version+1
 where business_id=b and id=ident and version=(payload->>'version')::integer;
 if not found then raise exception 'CONFLICT'; end if;
 end if;
 elsif action='profile' then
 perform catera.assert_address(payload->'address');
 select to_jsonb(x) into old from public.customers x where business_id=b and user_id=auth.uid();
 update public.customers set phone=payload->>'phone',address=payload->'address',version=version+1
 where business_id=b and user_id=auth.uid() and version=(payload->>'version')::integer returning id into ident;
 if not found then raise exception 'CONFLICT'; end if;
 elsif action='save_package' then
 if ident is null then insert into public.packages(business_id,name,deliveries,validity_days)
 values(b,payload->>'name',(payload->>'deliveries')::integer,nullif(payload->>'validity_days','')::integer) returning id into ident;
 else
 select to_jsonb(x) into old from public.packages x where business_id=b and id=ident;
 update public.packages set name=payload->>'name',deliveries=(payload->>'deliveries')::integer,
 validity_days=nullif(payload->>'validity_days','')::integer,active=coalesce((payload->>'active')::boolean,true),version=version+1
 where business_id=b and id=ident and version=(payload->>'version')::integer;
 if not found then raise exception 'CONFLICT'; end if; end if;
 elsif action='purchase' then
 cust:=(payload->>'customer_id')::uuid;
 if not exists(select 1 from public.customers where business_id=b and id=cust) then raise exception 'NOT_FOUND'; end if;
 select * into pkg from public.packages where business_id=b and id=(payload->>'package_id')::uuid and active;
 if not found then raise exception 'NOT_FOUND'; end if;
 day:=(payload->>'starts_on')::date;
 insert into public.purchases(business_id,customer_id,package_id,terms,external_reference,starts_on)
 values(b,cust,pkg.id,to_jsonb(pkg),coalesce(payload->>'external_reference',''),day) returning id into ident;
 insert into public.quota_grants(business_id,customer_id,purchase_id,starts_on,expires_on)
 values(b,cust,ident,day,case when pkg.validity_days is null then null else day+pkg.validity_days-1 end) returning id into target;
 insert into public.quota_ledger(business_id,grant_id,amount,kind,actor_id) values(b,target,pkg.deliveries,'grant',auth.uid());
 elsif action='save_menu' then
 if ident is null then insert into public.menus(business_id,name,description) values(b,payload->>'name',coalesce(payload->>'description','')) returning id into ident;
 else
 select to_jsonb(x) into old from public.menus x where business_id=b and id=ident;
 update public.menus set name=payload->>'name',description=coalesce(payload->>'description',''),active=coalesce((payload->>'active')::boolean,true),version=version+1
 where business_id=b and id=ident and version=(payload->>'version')::integer;
 if not found then raise exception 'CONFLICT'; end if; end if;
 elsif action='publish_menu' then
 day:=(payload->>'service_date')::date; slot:=(payload->>'slot_id')::uuid;
 perform catera.ensure_freeze(b,day,slot);
 if catera.clock()>=catera.cutoff_for(b,day) and reason is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
 menu:=(payload->>'default_menu_id')::uuid;
 if not (payload->'menu_ids' @> jsonb_build_array(menu::text)) then raise exception 'DEFAULT_REQUIRED'; end if;
 if exists(select 1 from public.deliveries d where d.business_id=b and d.service_date=day and d.slot_id=slot and d.status<>'cancelled' and d.menu_id is not null and not(payload->'menu_ids' @> jsonb_build_array(d.menu_id::text))) then raise exception 'MENU_IN_USE'; end if;
 delete from public.menu_offerings where business_id=b and service_date=day and slot_id=slot;
 for rec in select value::uuid as id from jsonb_array_elements_text(payload->'menu_ids') loop
 if not exists(select 1 from public.menus where business_id=b and id=rec.id and active) then raise exception 'NOT_FOUND'; end if;
 insert into public.menu_offerings values(b,day,slot,rec.id,rec.id=menu); end loop;
 if exists(select 1 from public.production_versions where business_id=b and service_date=day and slot_id=slot) then
 for rec in update public.deliveries set menu_id=menu,menu_name=(select name from public.menus where id=menu),selection_source='default',version=version+1
 where business_id=b and service_date=day and slot_id=slot and menu_id is null and status='scheduled' returning id loop
 insert into public.delivery_events(business_id,delivery_id,kind,details,actor_id) values(b,rec.id,'default_selected',jsonb_build_object('reason',reason),auth.uid()); end loop;
 perform catera.production_snapshot(b,day,slot,reason); end if;
 elsif action in ('generate_schedule','revise_schedule') then
 cust:=(payload->>'customer_id')::uuid; day:=(payload->>'starts_on')::date; date_to:=(payload->>'ends_on')::date;
 if day is null or date_to is null or date_to<day or jsonb_array_length(payload->'weekdays')=0 or jsonb_array_length(payload->'slot_ids')=0 then raise exception 'INVALID_SCHEDULE'; end if;
 if not exists(select 1 from public.customers where business_id=b and id=cust) then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from jsonb_array_elements_text(payload->'slot_ids') x where not exists(select 1 from public.delivery_slots where business_id=b and id=x.value::uuid and active)) then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from jsonb_array_elements_text(payload->'weekdays') x where x.value::integer not between 0 and 6) then raise exception 'INVALID_SCHEDULE'; end if;
 select address into delivery_address from public.customers where id=cust;
 perform catera.assert_address(delivery_address);
 if action='revise_schedule' then
 select to_jsonb(x) into old from public.schedule_patterns x where business_id=b and id=ident and customer_id=cust;
 if old is null then raise exception 'NOT_FOUND'; end if;
 if (old->>'version')::integer is distinct from (payload->>'version')::integer then raise exception 'CONFLICT'; end if;
 pid:=ident;
 for item in select * from public.deliveries where business_id=b and pattern_id=pid and service_date>=day and status not in ('cancelled','delivered') loop
 if item.service_date>date_to or not(payload->'weekdays' @> jsonb_build_array(extract(dow from item.service_date)::integer)) or not(payload->'slot_ids' @> jsonb_build_array(item.slot_id::text)) then
 if catera.clock()>=item.cutoff_at then raise exception 'CUTOFF_REACHED'; end if;
 update public.deliveries set status='cancelled',version=version+1 where id=item.id;
 delete from public.quota_reservations where delivery_id=item.id;
 insert into public.delivery_events(business_id,delivery_id,kind,details,actor_id) values(b,item.id,'skip',jsonb_build_object('reason','schedule_revision'),auth.uid());
 end if; end loop;
 update public.schedule_patterns set starts_on=day,ends_on=date_to,version=version+1,
 weekdays=array(select value::integer from jsonb_array_elements_text(payload->'weekdays')),
 slots=array(select value::uuid from jsonb_array_elements_text(payload->'slot_ids')) where id=pid;
 else
 insert into public.schedule_patterns(business_id,customer_id,starts_on,ends_on,weekdays,slots)
 values(b,cust,day,date_to,array(select value::integer from jsonb_array_elements_text(payload->'weekdays')),
 array(select value::uuid from jsonb_array_elements_text(payload->'slot_ids'))) returning id into pid;
 end if;
 while day<=date_to loop
 if payload->'weekdays' @> jsonb_build_array(extract(dow from day)::integer)
 and not exists(select 1 from public.date_exceptions where business_id=b and service_date=day and closed) then
 for slot in select value::uuid from jsonb_array_elements_text(payload->'slot_ids') loop
 if not exists(select 1 from public.delivery_slots where business_id=b and id=slot and active) then raise exception 'NOT_FOUND'; end if;
 -- Keep cancelled occurrences as tombstones so regeneration never recreates a skip.
 if not exists(select 1 from public.deliveries where business_id=b and customer_id=cust and service_date=day and slot_id=slot) then
 cutoff:=catera.cutoff_for(b,day);
 if catera.clock()>=cutoff then raise exception 'CUTOFF_REACHED'; end if;
 target:=null;
 select id into target from public.quota_grants where business_id=b and customer_id=cust and starts_on<=day
 and (expires_on is null or expires_on>=day) and catera.grant_available(id)>0 order by expires_on nulls last,created_at,id limit 1;
 if target is null then raise exception 'INSUFFICIENT_QUOTA'; end if;
 insert into public.deliveries(business_id,customer_id,grant_id,pattern_id,service_date,slot_id,address,cutoff_at)
 values(b,cust,target,pid,day,slot,delivery_address,cutoff) returning id into ident;
 insert into public.quota_reservations values(b,ident,target);
 insert into public.delivery_events(business_id,delivery_id,kind,actor_id) values(b,ident,'scheduled',auth.uid());
 applied:=applied+1;
 end if; end loop; end if; day:=day+1; end loop;
 elsif action in ('change_delivery','transition','reverse_delivery') then
 select * into item from public.deliveries where business_id=b and id=ident for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if r='subscriber' and not catera.owns_customer(b,item.customer_id) then raise exception 'FORBIDDEN'; end if;
 -- Repeat delivery confirmation remains idempotent even with a fresh request key.
 if action='transition' and payload->>'status'='delivered' and item.status='delivered' then
 result:=jsonb_build_object('id',ident,'unchanged',true);
 else
 old_item:=item; old:=to_jsonb(item);
 if item.version is distinct from (payload->>'version')::integer then raise exception 'CONFLICT'; end if;
 perform catera.ensure_freeze(b,item.service_date,item.slot_id);
 select * into item from public.deliveries where id=ident;
 old:=to_jsonb(item);
 if action='change_delivery' then
 if item.status in ('delivered','cancelled') then raise exception 'INVALID_TRANSITION'; end if;
 if catera.clock()>=item.cutoff_at then
 if r='subscriber' then raise exception 'CUTOFF_REACHED'; end if;
 if reason is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if; end if;
 if payload->>'change'='skip' then
 update public.deliveries set status='cancelled',version=version+1 where id=ident;
 delete from public.quota_reservations where delivery_id=ident;
 elsif payload->>'change'='address' then
 perform catera.assert_address(payload->'address');
 update public.deliveries set address=payload->'address',version=version+1 where id=ident;
 elsif payload->>'change'='menu' then
 menu:=(payload->>'menu_id')::uuid;
 if not exists(select 1 from public.menu_offerings where business_id=b and service_date=item.service_date and slot_id=item.slot_id and menu_id=menu) then raise exception 'MENU_UNAVAILABLE'; end if;
 update public.deliveries set menu_id=menu,menu_name=(select name from public.menus where id=menu),selection_source='selected',version=version+1 where id=ident;
 elsif payload->>'change'='reschedule' then
 day:=(payload->>'service_date')::date; slot:=(payload->>'slot_id')::uuid;
 if day is null or slot is null then raise exception 'INVALID_SCHEDULE'; end if;
 cutoff:=catera.cutoff_for(b,day);
 if catera.clock()>=cutoff then raise exception 'CUTOFF_REACHED'; end if;
 if not exists(select 1 from public.delivery_slots where business_id=b and id=slot and active) or exists(select 1 from public.date_exceptions where business_id=b and service_date=day and closed) then raise exception 'DATE_UNAVAILABLE'; end if;
 if not exists(select 1 from public.quota_grants where id=item.grant_id and starts_on<=day and (expires_on is null or expires_on>=day)) then raise exception 'PACKAGE_EXPIRED'; end if;
 if not exists(select 1 from public.menu_offerings where business_id=b and service_date=day and slot_id=slot) then raise exception 'MENU_UNAVAILABLE'; end if;
 perform catera.ensure_freeze(b,day,slot);
 menu:=item.menu_id;
 if not exists(select 1 from public.menu_offerings where business_id=b and service_date=day and slot_id=slot and menu_id=menu) then menu:=null; end if;
 update public.deliveries set service_date=day,slot_id=slot,cutoff_at=cutoff,menu_id=menu,
 menu_name=(select name from public.menus where id=menu),selection_source=case when menu is null then null else selection_source end,
 status='scheduled',version=version+1 where id=ident;
 else raise exception 'INVALID_COMMAND'; end if;
 insert into public.delivery_events(business_id,delivery_id,kind,details,actor_id)
 values(b,ident,payload->>'change',jsonb_build_object('reason',reason,'before',old,'after',(select to_jsonb(x) from public.deliveries x where id=ident)),auth.uid());
 if exists(select 1 from public.production_versions where business_id=b and service_date=item.service_date and slot_id=item.slot_id) then
 perform catera.production_snapshot(b,item.service_date,item.slot_id,coalesce(reason,payload->>'change')); end if;
 elsif action='transition' then
 state:=payload->>'status';
 if not ((item.status='scheduled' and state='ready') or (item.status='ready' and state='out_for_delivery')
 or (item.status='out_for_delivery' and state in ('delivered','failed')) or (item.status='failed' and state='out_for_delivery')) then raise exception 'INVALID_TRANSITION'; end if;
 if state='ready' and (item.menu_id is null or not exists(select 1 from public.production_versions where business_id=b and service_date=item.service_date and slot_id=item.slot_id)
 or (select incomplete from public.production_versions where business_id=b and service_date=item.service_date and slot_id=item.slot_id order by revision desc limit 1)>0) then raise exception 'PRODUCTION_INCOMPLETE'; end if;
 if state='failed' and reason is null then raise exception 'REASON_REQUIRED'; end if;
 if state='delivered' then
 delete from public.quota_reservations where delivery_id=ident;
 if not found then raise exception 'RESERVATION_MISSING'; end if;
 insert into public.quota_ledger(business_id,grant_id,delivery_id,amount,kind,actor_id) values(b,item.grant_id,ident,-1,'consume',auth.uid());
 end if;
 update public.deliveries set status=state,version=version+1,delivered_at=case when state='delivered' then catera.clock() else null end where id=ident;
 insert into public.delivery_events(business_id,delivery_id,kind,details,actor_id) values(b,ident,state,jsonb_build_object('reason',reason),auth.uid());
 elsif action='reverse_delivery' then
 if item.status<>'delivered' then raise exception 'INVALID_TRANSITION'; end if;
 if reason is null then raise exception 'REASON_REQUIRED'; end if;
 select l.id into ledger_id from public.quota_ledger l where delivery_id=ident and kind='consume'
 and not exists(select 1 from public.quota_ledger z where z.reverses_id=l.id) order by created_at desc limit 1;
 if ledger_id is null then raise exception 'NOT_FOUND'; end if;
 insert into public.quota_ledger(business_id,grant_id,delivery_id,amount,kind,reverses_id,reason,actor_id)
 values(b,item.grant_id,ident,1,'reversal',ledger_id,reason,auth.uid());
 insert into public.quota_reservations values(b,ident,item.grant_id);
 update public.deliveries set status='out_for_delivery',delivered_at=null,version=version+1 where id=ident;
 insert into public.delivery_events(business_id,delivery_id,kind,details,actor_id) values(b,ident,'reversal',jsonb_build_object('reason',reason),auth.uid());
 end if; end if;
 elsif action='adjust_quota' then
 target:=(payload->>'grant_id')::uuid; quantity:=(payload->>'amount')::integer;
 if reason is null then raise exception 'REASON_REQUIRED'; end if;
 if not exists(select 1 from public.quota_grants where business_id=b and id=target) then raise exception 'NOT_FOUND'; end if;
 if quantity=0 or catera.grant_available(target)+quantity<0 then raise exception 'INSUFFICIENT_QUOTA'; end if;
 insert into public.quota_ledger(business_id,grant_id,amount,kind,reason,actor_id) values(b,target,quantity,'adjustment',reason,auth.uid()) returning id into ident;
 elsif action='save_settings' then
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=payload->>'timezone') then raise exception 'INVALID_TIMEZONE'; end if;
 select to_jsonb(x) into old from public.businesses x where id=b;
 -- Capture due snapshots before changing future policy.
 for rec in select distinct service_date,slot_id from public.deliveries where business_id=b and cutoff_at<=catera.clock() loop perform catera.ensure_freeze(b,rec.service_date,rec.slot_id); end loop;
 update public.businesses set name=payload->>'name',timezone=payload->>'timezone',cutoff=(payload->>'cutoff')::time where id=b;
 if exists(select 1 from public.deliveries where business_id=b and cutoff_at>catera.clock() and catera.cutoff_for(b,service_date)<=catera.clock()) then raise exception 'POLICY_WOULD_LOCK'; end if;
 update public.deliveries set cutoff_at=catera.cutoff_for(b,service_date),version=version+1 where business_id=b and cutoff_at>catera.clock();
 elsif action='save_slot' then
 if ident is null then insert into public.delivery_slots(business_id,name,start_time) values(b,payload->>'name',(payload->>'start_time')::time) returning id into ident;
 else
 if exists(select 1 from public.deliveries where business_id=b and slot_id=ident and status not in ('cancelled','delivered')) then raise exception 'SLOT_IN_USE'; end if;
 update public.delivery_slots set name=payload->>'name',start_time=(payload->>'start_time')::time,active=coalesce((payload->>'active')::boolean,true) where business_id=b and id=ident;
 if not found then raise exception 'NOT_FOUND'; end if; end if;
 elsif action='save_exception' then
 day:=(payload->>'service_date')::date;
 if catera.clock()>=catera.cutoff_for(b,day) then raise exception 'CUTOFF_REACHED'; end if;
 if coalesce((payload->>'closed')::boolean,false) and exists(select 1 from public.deliveries where business_id=b and service_date=day and status<>'cancelled') then raise exception 'DATE_IN_USE'; end if;
 cutoff:=coalesce(nullif(payload->>'cutoff_local','')::timestamp at time zone (select timezone from public.businesses where id=b),nullif(payload->>'cutoff_at','')::timestamptz);
 if cutoff is not null and cutoff<=catera.clock() then raise exception 'POLICY_WOULD_LOCK'; end if;
 insert into public.date_exceptions values(b,day,cutoff,coalesce((payload->>'closed')::boolean,false))
 on conflict(business_id,service_date) do update set cutoff_at=excluded.cutoff_at,closed=excluded.closed;
 update public.deliveries set cutoff_at=catera.cutoff_for(b,day),version=version+1 where business_id=b and service_date=day and cutoff_at>catera.clock();
 elsif action='invite' then
 if payload->>'role' not in ('admin','subscriber') then raise exception 'FORBIDDEN'; end if;
 cust:=nullif(payload->>'customer_id','')::uuid;
 if payload->>'role'='subscriber' and not exists(select 1 from public.customers where business_id=b and id=cust and user_id is null) then raise exception 'NOT_FOUND'; end if;
 insert into public.invitations(business_id,email,role,customer_id)
 values(b,lower(trim(payload->>'email')),payload->>'role',cust) returning id into ident;
 elsif action='set_role' then
 target:=(payload->>'user_id')::uuid;
 if target=auth.uid() then raise exception 'FORBIDDEN'; end if;
 if payload->>'role'='revoked' then
 delete from public.memberships where business_id=b and user_id=target and role<>'owner';
 update public.customers set user_id=null where business_id=b and user_id=target;
 else
 if payload->>'role' not in ('admin','subscriber') then raise exception 'FORBIDDEN'; end if;
 update public.memberships set role=payload->>'role' where business_id=b and user_id=target and role<>'owner'; end if;
 elsif action='freeze' then
 day:=(payload->>'service_date')::date; slot:=(payload->>'slot_id')::uuid;
 if catera.clock()<catera.cutoff_for(b,day) then raise exception 'CUTOFF_NOT_REACHED'; end if;
 perform catera.ensure_freeze(b,day,slot);
 else raise exception 'INVALID_COMMAND'; end if;
 if action in ('save_settings','save_slot','save_exception','publish_menu','invite','set_role') then update public.businesses set version=version+1 where id=b; end if;
 result:=coalesce(result,jsonb_build_object('id',ident,'applied',applied));
 if action in ('change_delivery','transition','reverse_delivery') then
 select customer_id into cust from public.deliveries where id=ident;
 result:=result||jsonb_build_object('record',(select to_jsonb(x) from public.deliveries x where id=ident));
 elsif action in ('generate_schedule','revise_schedule') then
 result:=result||jsonb_build_object('pattern',(select to_jsonb(x) from public.schedule_patterns x where id=pid));
 elsif action='purchase' then
 result:=result||jsonb_build_object('record',(select to_jsonb(x) from public.purchases x where id=ident));
 elsif action='adjust_quota' then select customer_id into cust from public.quota_grants where id=target;
 end if;
 if cust is not null then result:=result||jsonb_build_object('quota',(select jsonb_build_object(
 'remaining',coalesce(sum(catera.grant_balance(g.id)),0),
 'reserved',coalesce(sum((select count(*) from public.quota_reservations where grant_id=g.id)),0),
 'available',coalesce(sum(case when (catera.clock() at time zone (select timezone from public.businesses where id=b))::date>=starts_on and (expires_on is null or (catera.clock() at time zone (select timezone from public.businesses where id=b))::date<=expires_on) then catera.grant_available(g.id) else 0 end),0))
 from public.quota_grants g where business_id=b and customer_id=cust)); end if;
 insert into public.audit_events(business_id,actor_id,action,entity_id,details)
 values(b,auth.uid(),action,ident,jsonb_build_object('request_id',request_id,'before',old,'input',inputs,'result',result));
 insert into public.command_receipts values(b,auth.uid(),request_id,action,payload,result);
 return result;
end $$;

create function public.run_due_freezes() returns integer language plpgsql security definer set search_path='' as $$
declare biz record; row record; count integer:=0;
begin
 for biz in select id from public.businesses order by id for update loop
 for row in select distinct service_date,slot_id from public.deliveries d where business_id=biz.id and cutoff_at<=catera.clock()
 and not exists(select 1 from public.production_versions p where p.business_id=biz.id and p.service_date=d.service_date and p.slot_id=d.slot_id) loop
 perform catera.ensure_freeze(biz.id,row.service_date,row.slot_id); count:=count+1; end loop; end loop;
 return count;
end $$;
create function public.check_integrity() returns jsonb language plpgsql security definer set search_path='' as $$
declare issues jsonb;
begin
 select coalesce(jsonb_agg(x),'[]') into issues from (
 select 'negative_available' as issue,id as entity_id from public.quota_grants where catera.grant_available(id)<0
 union all
 select 'reservation_mismatch',d.id from public.deliveries d where
 (d.status not in ('cancelled','delivered')) <> exists(select 1 from public.quota_reservations r where r.delivery_id=d.id and r.grant_id=d.grant_id)
 union all
 select 'deduction_mismatch',d.id from public.deliveries d where
 (case when d.status='delivered' then -1 else 0 end) <> coalesce((select sum(amount) from public.quota_ledger l where l.delivery_id=d.id and kind in ('consume','reversal')),0)
 ) x;
 insert into public.health_checks(discrepancies) values(issues); return issues;
end $$;

-- Defense in depth: app users receive SELECT policies and narrowly granted RPCs, never direct mutation privileges.
do $$ declare tab text; begin
 for tab in select tablename from pg_tables where schemaname='public' and tablename in
 ('businesses','memberships','invitations','customers','delivery_slots','date_exceptions','packages','purchases','quota_grants','menus','menu_offerings','schedule_patterns','deliveries','quota_reservations','quota_ledger','delivery_events','production_versions','audit_events','command_receipts','health_checks') loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon, authenticated',tab);
 end loop;
end $$;
create policy business_read on public.businesses for select to authenticated using(catera.role_for(id) is not null);
create policy customer_read on public.customers for select to authenticated using(catera.is_staff(business_id) or (user_id=auth.uid() and catera.role_for(business_id)='subscriber'));
create policy delivery_read on public.deliveries for select to authenticated using(catera.is_staff(business_id) or (catera.owns_customer(business_id,customer_id) and catera.role_for(business_id)='subscriber'));
grant select on public.businesses,public.customers,public.deliveries to authenticated;
revoke all on all functions in schema catera from public,anon,authenticated;
grant usage on schema catera to authenticated;
grant execute on function catera.role_for(uuid),catera.is_staff(uuid),catera.owns_customer(uuid,uuid) to authenticated;
revoke execute on function public.list_workspaces(),public.workspace_snapshot(text),public.execute_command(text,text,jsonb,uuid),public.run_due_freezes(),public.check_integrity() from public,anon,authenticated;
grant execute on function public.list_workspaces(),public.workspace_snapshot(text),public.execute_command(text,text,jsonb,uuid) to authenticated;
grant execute on function public.run_due_freezes(),public.check_integrity() to service_role;
grant select on public.invitations to service_role;
