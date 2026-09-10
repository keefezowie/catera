create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=payload;c v1.checkouts;r jsonb:='{}';rf v1.refunds;ident uuid;oldhash text;amt int;item record;
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='payment.attach' then update v1.checkouts set provider_id=a->>'providerId',payment_url=a->>'url' where id=(a->>'id')::uuid and state='pending' and provider_id is null;
 elsif action='payment.lookup' then return (select to_jsonb(ch) from v1.checkouts ch where id=(a->>'id')::uuid);
 elsif action='payment.event' then
  select * into c from v1.checkouts where id=(a->>'checkoutId')::uuid;perform pg_advisory_xact_lock(hashtext(c.user_id::text));select * into c from v1.checkouts where id=(a->>'checkoutId')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
  select payload_hash into oldhash from v1.payment_events where id=a->>'eventId';if found then if oldhash<>md5(a::text) then raise exception 'CONFLICT';end if;return jsonb_build_object('duplicate',true);end if;
  if a->>'currency' is distinct from 'IDR' or (a->>'amount')::int is distinct from (c.quote->>'total')::int or a->>'providerId' is distinct from c.provider_id then raise exception 'AMOUNT_INVALID';end if;
  insert into v1.payment_events(id,checkout_id,payload_hash) values(a->>'eventId',c.id,md5(a::text));
  if a->>'status'='paid' then
   insert into v1.payments(checkout_id,provider_id,amount,state) values(c.id,a->>'paymentRequestId',(a->>'amount')::int,'paid') on conflict(checkout_id) do update set state='paid';ident:=v1.activate(c.id);r:=jsonb_build_object('subscriptionId',ident);
  elsif c.subscription_id is null and c.state='pending' then update v1.checkouts set state=case when a->>'status'='expired' then 'expired' else 'failed' end where id=c.id;update v1.reservations set state='released' where checkout_id=c.id;end if;
 elsif action='refund.lookup' then return (select to_jsonb(f)||jsonb_build_object('payment',(select to_jsonb(p) from v1.payments p where checkout_id=f.checkout_id)) from v1.refunds f where id=(a->>'id')::uuid);
 elsif action='refund.update' then
  select * into rf from v1.refunds where id=(a->>'id')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
  if rf.state='succeeded' then return jsonb_build_object('duplicate',true);end if;
  update v1.refunds set state=a->>'state',provider_id=a->>'providerId' where id=rf.id;
  if a->>'state'='succeeded' then
   select * into c from v1.checkouts where id=rf.checkout_id for update;select coalesce(sum(amount),0) into amt from v1.refunds where checkout_id=c.id and state='succeeded';
   update v1.checkouts set state=case when amt=(c.quote->>'total')::int then 'refunded' else 'partially_refunded' end where id=c.id;
   -- Provider splits require independent reversal: keep seller funds held for reconciliation.
   insert into v1.outbox(kind,payload,dedupe) values('split.reconcile',jsonb_build_object('refundId',rf.id,'checkoutId',c.id),'reconcile-'||rf.id) on conflict do nothing;
   perform v1.notify(c.user_id,'refund','Pengembalian dana sudah diproses.','/support');
  end if;
 elsif action='payout.lookup' then return (select to_jsonb(p) from v1.payouts p where id=(a->>'id')::uuid);
 elsif action='payout.update' then update v1.payouts set status=a->>'status',provider_id=a->>'providerId' where id=(a->>'id')::uuid;
 elsif action='push.ticket' then insert into v1.push_tickets(id,token,job_id) values(a->>'id',a->>'token',(a->>'jobId')::uuid) on conflict do nothing;
 elsif action='push.receipts' then return coalesce((select jsonb_agg(to_jsonb(t)) from (select * from v1.push_tickets where checked_at is null and created_at<now()-interval '15 minutes' order by created_at limit 100)t),'[]');
 elsif action='push.checked' then update v1.push_tickets set checked_at=now() where id=a->>'id';if coalesce((a->>'remove')::boolean,false) then delete from v1.devices where token=(select token from v1.push_tickets where id=a->>'id');end if;
 elsif action='devices' then return coalesce((select jsonb_agg(token) from v1.devices where user_id=(a->>'userId')::uuid),'[]');
 elsif action='device.remove' then delete from v1.devices where token=a->>'token';
 elsif action='outbox.claim' then
  return coalesce((with jobs as(select id from v1.outbox where processed_at is null and available_at<=clock_timestamp() order by available_at for update skip locked limit 20),claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *) select jsonb_agg(to_jsonb(claimed)) from claimed),'[]');
 elsif action='outbox.complete' then update v1.outbox set processed_at=now() where id=(a->>'id')::uuid;
 elsif action='outbox.retry' then update v1.outbox set last_error=left(a->>'error',150),available_at=now()+least(attempts,60)*interval '1 minute' where id=(a->>'id')::uuid;
 elsif action='maintenance' then
  update v1.checkouts set state='expired' where state='pending' and expires_at<=clock_timestamp();update v1.reservations r set state='released' from v1.checkouts expired where expired.id=r.checkout_id and expired.state='expired' and r.state='held';
  for item in select d.id,d.service_date,s.user_id,s.id sid from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where d.service_date=current_date+1 and d.status='scheduled' loop
   if not exists(select 1 from v1.outbox where dedupe='tomorrow-'||item.id) then perform v1.notify(item.user_id,'tomorrow','Besok ada makanan untuk Anda. Periksa menu dan alamatnya.','/deliveries/'||item.id);insert into v1.outbox(kind,payload,dedupe,processed_at) values('reminder.record','{}','tomorrow-'||item.id,now());end if;
  end loop;
  for item in select s.id,s.user_id from v1.subscriptions s where s.status='active' and (select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('delivered','cancelled'))<=2 loop
   if not exists(select 1 from v1.outbox where dedupe='renew-'||item.id) then perform v1.notify(item.user_id,'renewal','Paket hampir selesai. Pilih makanan untuk hari-hari berikutnya.','/subscriptions/'||item.id);insert into v1.outbox(kind,payload,dedupe,processed_at) values('reminder.record','{}','renew-'||item.id,now());end if;
  end loop;
 elsif action='health' then return jsonb_build_object('failedJobs',(select count(*) from v1.outbox where processed_at is null and attempts>=5),'paymentExceptions',(select count(*) from v1.checkouts where state='payment_exception'),'oversold',(select count(*) from (select distinct package_id,service_date from v1.reservations where state<>'released')r where v1.demand(r.package_id,r.service_date)>v1.slots(r.package_id,r.service_date)));
 else raise exception 'INVALID_ACTION';end if;
 insert into v1.audit(action,details) values('system.'||action,jsonb_build_object('id',a->>'id','eventId',a->>'eventId'));return r;
end $$;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;

create function public.catera_v1_manifest(version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare p v1.production;begin select * into p from v1.production where id=version_id;if not found then raise exception 'NOT_FOUND';end if;if not v1.is_staff(auth.uid(),p.caterer_id) then raise exception 'FORBIDDEN';end if;return to_jsonb(p);end $$;
revoke all on function public.catera_v1_manifest(uuid) from public,anon;
grant execute on function public.catera_v1_manifest(uuid) to authenticated;
