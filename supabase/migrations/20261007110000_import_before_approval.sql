-- Imports of existing, already-paid subscriptions (caterer simplification, Oct 7 2026).
-- Caterers can move their customers in before Catera approval, onto their own
-- published package, including customers outside the listed delivery areas.
-- Suspended caterers, unpublished packages and every duplicate/overlap/capacity/
-- cutoff check still apply, and imports still carry no money.
create or replace function v1.pilot_import_row(cid uuid,a jsonb,commit_row boolean) returns jsonb language plpgsql set search_path='' as $$
declare cr v1.customer_records;p v1.packages;o jsonb;ad jsonb;dt date;dates jsonb:='[]';qty int;needed int;counter int:=0;
 q jsonb;co uuid;sid uuid;did uuid;m text;ref text;prior v1.subscriptions;new_customer boolean:=false;begin
 if nullif(a->>'customerRecordId','') is not null then select * into cr from v1.customer_records where id=(a->>'customerRecordId')::uuid and caterer_id=cid;
  if not found then raise exception 'FORBIDDEN';end if;
 elsif nullif(a->>'customerId','') is not null then
  select * into cr from v1.customer_records where user_id=(a->>'customerId')::uuid and caterer_id=cid order by created_at,id limit 1;
  if not found then
   if not exists(select 1 from v1.relationships where user_id=(a->>'customerId')::uuid and caterer_id=cid) then raise exception 'FORBIDDEN';end if;
   cr.user_id:=(a->>'customerId')::uuid;select name into cr.name from v1.profiles where id=cr.user_id;cr.origin:='seller';new_customer:=true;
  end if;
 else
  cr.name:=trim(a->'customer'->>'name');cr.phone:=a->'customer'->>'phone';cr.address:=a->'customer'->'address';cr.origin:='seller';new_customer:=true;
  if cr.name is null or length(cr.name) not between 1 and 100 or cr.phone is null or cr.phone !~ '^\+62[0-9]{8,13}$' then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from v1.customer_records where caterer_id=cid and phone=cr.phone) then raise exception 'DUPLICATE_CUSTOMER';end if;
 end if;
 ad:=coalesce(a->'address',cr.address);
 if nullif(a->>'addressId','') is not null then select to_jsonb(x)-'user_id' into ad from v1.addresses x where id=(a->>'addressId')::uuid and user_id=cr.user_id;end if;
 if not v1.pilot_address(ad) then raise exception 'INVALID_INPUT';end if;
 select * into p from v1.packages where id=(a->>'packageId')::uuid and caterer_id=cid;
 if not found then raise exception 'FORBIDDEN';end if;o:=v1.offer(p);
 if p.status<>'published' or o->>'sellerStatus'='suspended' then raise exception 'NOT_AVAILABLE';end if;
 qty:=(a->>'portions')::int;needed:=(a->>'remainingDays')::int;dt:=(a->>'startDate')::date;ref:=trim(a->>'externalReference');
 if qty is null or qty not between 1 and 100 or needed is null or needed not between 1 and (o->>'days')::int or dt is null or ref is null or length(ref) not between 3 and 120 then raise exception 'INVALID_INPUT';end if;
 if cr.id is not null and exists(select 1 from v1.subscriptions where customer_record_id=cr.id and external_reference=ref) then raise exception 'DUPLICATE_IMPORT';end if;
 while jsonb_array_length(dates)<needed and counter<730 loop
  if o->'weekdays' @> to_jsonb(extract(dow from dt)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=dt and closed) then
   if v1.cutoff(o,dt)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if v1.slots(p.id,dt)-v1.demand(p.id,dt)<qty then raise exception 'CAPACITY';end if;dates:=dates||to_jsonb(dt::text);
  end if;dt:=dt+1;counter:=counter+1;
 end loop;
 if jsonb_array_length(dates)<>needed then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from v1.subscriptions where package_id=p.id and status='active' and (customer_record_id=cr.id or user_id=cr.user_id) and starts_on<=(dates->>-1)::date and ends_on>=(dates->>0)::date)
 or exists(select 1 from v1.checkouts where package_id=p.id and state='pending' and expires_at>clock_timestamp() and (customer_record_id=cr.id or user_id=cr.user_id) and (quote->'dates'->>0)::date<=(dates->>-1)::date and (quote->'dates'->>-1)::date>=(dates->>0)::date) then raise exception 'OVERLAP';end if;
 if nullif(a->>'renewedFrom','') is not null then
  select * into prior from v1.subscriptions where id=(a->>'renewedFrom')::uuid and customer_record_id=cr.id;
  if not found or prior.status='cancelled' or exists(select 1 from v1.subscriptions where renewed_from=prior.id and status<>'cancelled')
   or exists(select 1 from v1.checkouts where quote->>'renewedFrom'=prior.id::text and state='pending' and expires_at>clock_timestamp()) then raise exception 'CONFLICT';end if;
  if (dates->>0)::date<=prior.ends_on then raise exception 'OVERLAP';end if;
 end if;
 q:=jsonb_build_object('packageId',p.id,'portions',qty,'trial',false,'dates',dates,'subtotal',0,'discount',0,'discountPercent',0,'promotion',0,'serviceFee',0,'sellerFee',0,'total',0,'perDay',0,
  'source','legacy','purchaseKind','legacy_import','pilotSynthetic',(v1.pilot_policy(cid)).synthetic,'externalReference',ref,'externalAmount',a->'externalAmount','renewedFrom',prior.id,'offer',o,'address',ad);
 if not commit_row then return jsonb_build_object('customerName',cr.name,'customerRecordId',cr.id,'newCustomer',new_customer,'quote',q);end if;
 if a ? 'preview' and a->'preview' is distinct from q then raise exception 'PRICE_CHANGED';end if;
 if new_customer then insert into v1.customer_records(caterer_id,user_id,name,phone,address,origin) values(cid,cr.user_id,cr.name,cr.phone,ad,cr.origin) returning * into cr;end if;
 insert into v1.checkouts(user_id,customer_record_id,package_id,address_id,quote,state,expires_at)
 values(cr.user_id,cr.id,p.id,null,q,'paid',now()) returning id into co;
 insert into v1.subscriptions(checkout_id,user_id,customer_record_id,package_id,snapshot,portions,starts_on,ends_on,legacy,external_reference,renewed_from)
 values(co,cr.user_id,cr.id,p.id,q,qty,(dates->>0)::date,(dates->>-1)::date,true,ref,prior.id) returning id into sid;
 update v1.checkouts set subscription_id=sid where id=co;
 for dt in select value::date from jsonb_array_elements_text(dates) loop
  insert into v1.reservations values(co,p.id,dt,qty,'confirmed');
  insert into v1.delivery_days(subscription_id,service_date,address) values(sid,dt,ad) returning id into did;
  foreach m in array case when o->>'meal'='both' then array['lunch','dinner'] else array[o->>'meal'] end loop insert into v1.fulfillments(day_id,meal) values(did,m);end loop;
 end loop;
 if cr.user_id is not null then insert into v1.relationships values(cr.user_id,cid,'legacy') on conflict do nothing;end if;
 return jsonb_build_object('id',sid,'customerRecordId',cr.id);
end $$;
