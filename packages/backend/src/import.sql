create or replace function v1.import_quote(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare p v1.packages; o jsonb; ad v1.addresses; pol v1.policies; qty int:=(a->>'portions')::int; trial boolean:=coalesce((a->>'trial')::boolean,false); dates jsonb:='[]'; d date:=(a->>'startDate')::date; needed int; counter int:=0; sub int; dis int; pct numeric:=0; promo int:=0; fee int; src text; sellerfee int;
begin
 select * into p from v1.packages where id=(a->>'packageId')::uuid; if not found then raise exception 'NOT_FOUND';end if; o:=v1.offer(p);
 if p.status<>'published' or o->>'sellerStatus'<>'approved' then raise exception 'NOT_AVAILABLE';end if;
 select * into ad from v1.addresses where id=(a->>'addressId')::uuid and user_id=u; if not found then raise exception 'FORBIDDEN';end if;
 if not (o->'areas' ? ad.area) then raise exception 'COVERAGE';end if;
 if d is null or needed<1 or qty is null or qty not between 1 and 100 then raise exception 'INVALID_INPUT';end if;
 if trial and (o->>'trialPrice' is null or (o->>'trialMax' is not null and qty>(o->>'trialMax')::int)) then raise exception 'INVALID_INPUT';end if;
 if trial and exists(select 1 from v1.checkouts x join v1.packages k on k.id=x.package_id where x.user_id=u and k.caterer_id=p.caterer_id and (x.quote->>'trial')::boolean and (x.state in('paid','refunded','partially_refunded','payment_exception') or (x.state='pending' and x.expires_at>clock_timestamp()))) then raise exception 'TRIAL_USED';end if;
 if (a->>'remainingDays')::int not between 1 and (o->>'days')::int or a->>'remainingDays' is null or coalesce(length(a->>'externalReference'),0)<3 then raise exception 'INVALID_INPUT';end if;needed:=(a->>'remainingDays')::int;
 while jsonb_array_length(dates)<needed and counter<730 loop
  if o->'weekdays' @> to_jsonb(extract(dow from d)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=d and closed) then
   if v1.cutoff(o,d)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if v1.slots(p.id,d)-v1.demand(p.id,d)<qty then raise exception 'CAPACITY';end if;
   dates:=dates||to_jsonb(d::text);
  end if;d:=d+1;counter:=counter+1;
 end loop;
 if jsonb_array_length(dates)<>needed then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from v1.subscriptions s where s.user_id=u and s.package_id=p.id and s.status='active' and s.starts_on<=(dates->>-1)::date and s.ends_on>=(dates->>0)::date) or exists(select 1 from v1.checkouts c where c.user_id=u and c.package_id=p.id and c.state='pending' and c.expires_at>clock_timestamp() and (c.quote->'dates'->>0)::date<=(dates->>-1)::date and (c.quote->'dates'->>-1)::date>=(dates->>0)::date) then raise exception 'OVERLAP';end if;
 select * into pol from v1.policies where id; if not found or not pol.approved or (pol.synthetic and coalesce(current_setting('catera.demo',true),'false')<>'true') then raise exception 'NOT_CONFIGURED';end if;
 sub:=case when trial then (o->>'trialPrice')::int*qty else (o->>'price')::int*qty*needed end;
 if not trial then select coalesce(max((t->>'percent')::numeric),0) into pct from jsonb_array_elements(o->'tiers') t where (t->>'min')::int<=qty;end if;
 dis:=round(sub*pct/100);select round((sub-dis)*percent/100.0)::int into promo from v1.promotions where code=upper(a->>'promo') and active;promo:=coalesce(promo,0);
 select source into src from v1.relationships where user_id=u and caterer_id=p.caterer_id;
 if src is null then src:=case when exists(select 1 from v1.invites where code=a->>'invite' and caterer_id=p.caterer_id and role='customer' and (used_by is null or used_by=u)) then 'invited' else 'marketplace' end;end if;
 src:='legacy';fee:=0;sellerfee:=round((sub-dis)*case when src='marketplace' then pol.marketplace_percent else pol.invited_percent end/100);
 return jsonb_build_object('packageId',p.id,'portions',qty,'trial',trial,'dates',dates,'subtotal',sub,'discount',dis,'discountPercent',pct,'promotion',promo,'serviceFee',fee,'total',sub-dis-promo+fee,'perDay',round((sub-dis)/qty/needed),'sellerFee',0,'externalReference',a->>'externalReference','purchaseKind','legacy_import','source',src,'offer',o,'address',to_jsonb(ad)-'user_id');
end $$;
