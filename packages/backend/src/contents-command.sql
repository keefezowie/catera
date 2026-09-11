  elsif action='menu.save' then
   select * into p from v1.packages where id=(a->>'packageId')::uuid and caterer_id=cid for update;if not found then raise exception 'FORBIDDEN';end if;
   rev:=coalesce((a->>'contentRevision')::int,0);
   select contents into o from v1.content_revisions where package_id=p.id and revision=rev;if not found then raise exception 'INVALID_INPUT';end if;
   if a->>'meal' not in('lunch','dinner') or (o->>'meal'<>'both' and a->>'meal'<>o->>'meal') then raise exception 'INVALID_INPUT';end if;
   rowdata:=a->'details'||jsonb_build_object('meal',a->>'meal');
   if coalesce(o->>'packageType','')<>'' then
    if not v1.valid_contents(jsonb_build_object('packageType',o->'packageType','meal',a->>'meal','menus',jsonb_build_array(rowdata)),true) then raise exception 'INVALID_INPUT';end if;
    if (select x->'composition' from jsonb_array_elements(o->'menus') x where x->>'meal'=a->>'meal') is distinct from rowdata->'composition' then raise exception 'COMPOSITION_CHANGED';end if;
    if o->>'packageType'='ala_carte' and jsonb_array_length(rowdata->'items')<>(select jsonb_array_length(x->'items') from jsonb_array_elements(o->'menus') x where x->>'meal'=a->>'meal') then raise exception 'COMPOSITION_CHANGED';end if;
    rowdata:=rowdata||jsonb_build_object('name',v1.contents_summary(rowdata));
   else
    if jsonb_typeof(rowdata->'name') is distinct from 'string' or length(trim(rowdata->>'name')) not between 1 and 1500 then raise exception 'INVALID_INPUT';end if;
    if rowdata ? 'items' or rowdata ? 'nutrition' or rowdata ? 'composition' then raise exception 'CLASSIFY_PACKAGE';end if;
   end if;
   target:=(a->>'date')::date;
   if target < (clock_timestamp() at time zone (select timezone from v1.caterers where id=cid))::date then raise exception 'CUTOFF';end if;
   if exists(select 1 from v1.delivery_days day join v1.subscriptions sub on sub.id=day.subscription_id join v1.fulfillments f on f.day_id=day.id where sub.package_id=p.id and coalesce((sub.snapshot->'offer'->>'contentRevision')::int,0)=rev and day.service_date=target and f.meal=a->>'meal' and f.status='delivered') then raise exception 'CUTOFF';end if;
   select version into qty from v1.menus where package_id=p.id and content_revision=rev and service_date=target and meal=a->>'meal';
   if coalesce(qty,0)<>coalesce((a->>'version')::int,0) then raise exception 'CONFLICT';end if;
   insert into v1.menus(package_id,content_revision,service_date,meal,details,version) values(p.id,rev,target,a->>'meal',rowdata,1)
    on conflict(package_id,content_revision,service_date,meal) do update set details=excluded.details,version=v1.menus.version+1;
   perform v1.notify(sub.user_id,'menu','Menu pengantaran Anda diperbarui.','/calendar') from v1.subscriptions sub join v1.delivery_days day on day.subscription_id=sub.id where sub.package_id=p.id and coalesce((sub.snapshot->'offer'->>'contentRevision')::int,0)=rev and day.service_date=target and day.status not in('delivered','cancelled');
