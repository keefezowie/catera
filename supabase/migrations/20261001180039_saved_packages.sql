-- Personal discovery state. Saving never reserves capacity or freezes an offer.
create table v1.saved_packages (
 user_id uuid not null references v1.profiles(id) on delete cascade,
 package_id uuid not null references v1.packages(id),
 saved_at timestamptz not null default clock_timestamp(),
 summary jsonb not null,
 primary key(user_id,package_id)
);
create index saved_packages_recent on v1.saved_packages(user_id,saved_at desc,package_id desc);
alter table v1.saved_packages enable row level security;
revoke all on v1.saved_packages from public,anon,authenticated;

-- Preserve the existing command's qualified receipt lookup when renaming it.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_saved_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_saved_base('),
   'catera_v1_command.request_id','catera_v1_command_saved_base.request_id');
end $$;
revoke all on function public.catera_v1_command_saved_base(text,jsonb,uuid) from public,anon,authenticated;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); pid uuid; desired boolean; p v1.packages; c v1.caterers;
 old v1.receipts; fingerprint text:=md5(action||payload::text); result jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action is distinct from 'savedPackage.set' then
  return public.catera_v1_command_saved_base(action,payload,request_id);
 end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object'
  or not(payload ?& array['packageId','saved']) or (payload - array['packageId','saved'])<>'{}'::jsonb
  or jsonb_typeof(payload->'packageId') is distinct from 'string'
  or jsonb_typeof(payload->'saved') is distinct from 'boolean' then raise exception 'INVALID_INPUT';end if;
 begin pid:=(payload->>'packageId')::uuid;exception when invalid_text_representation then raise exception 'INVALID_INPUT';end;
 desired:=(payload->>'saved')::boolean;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts r where r.actor_id=u and r.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 if desired then
  select * into p from v1.packages where id=pid for share;
  if not found or p.status<>'published' then raise exception 'NOT_AVAILABLE';end if;
  select * into c from v1.caterers where id=p.caterer_id for share;
  if c.status<>'approved' then raise exception 'NOT_AVAILABLE';end if;
  insert into v1.saved_packages(user_id,package_id,summary) values(u,pid,
   jsonb_build_object('name',p.offer->>'name','image',p.offer->>'image','slug',p.slug,'caterer',c.name))
   on conflict(user_id,package_id) do nothing;
 else
  -- A suspended or archived item can always be removed by its owner.
  delete from v1.saved_packages where user_id=u and package_id=pid;
 end if;
 result:=jsonb_build_object('packageId',pid,'saved',desired);
 insert into v1.audit(actor_id,action,details) values(u,action,result||jsonb_build_object('requestId',request_id));
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,fingerprint,result);
 insert into public.catera_v1_events(id,user_id,topic) values(gen_random_uuid(),u,'savedPackage.changed');
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_saved_base;
revoke all on function public.catera_v1_read_saved_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n integer; cur jsonb; at timestamptz; ident uuid; items jsonb; next_cursor text;
begin
 if resource='offer' then
  return jsonb_build_object('offer',(select v1.offer(p) from v1.packages p join v1.caterers c on c.id=p.caterer_id
    where (p.id::text=params->>'id' or p.slug=params->>'id') and p.status='published' and c.status='approved'));
 end if;
 if resource is distinct from 'saved-packages' then return public.catera_v1_read_saved_base(resource,params);end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 -- No caller-supplied owner, id or filter is accepted on this private read.
 if jsonb_typeof(params) is distinct from 'object' or (params - array['limit','cursor'])<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
 begin
  n:=coalesce((params->>'limit')::integer,50);
  if params->>'cursor' is not null then
   cur:=(params->>'cursor')::jsonb;
   if jsonb_typeof(cur) is distinct from 'object' or not(cur ?& array['at','id'])
    or (cur - array['at','id'])<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
   at:=(cur->>'at')::timestamptz;ident:=(cur->>'id')::uuid;
   if at is null or ident is null then raise exception 'INVALID_INPUT';end if;
  end if;
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'INVALID_INPUT';end;
 if n not between 1 and 100 then raise exception 'INVALID_INPUT';end if;
 with page as (
  select s.*, case when p.status='published' and c.status='approved' then v1.offer(p) else null end offer
  from v1.saved_packages s join v1.packages p on p.id=s.package_id join v1.caterers c on c.id=p.caterer_id
  where s.user_id=u and (at is null or (s.saved_at,s.package_id)<(at,ident))
  order by s.saved_at desc,s.package_id desc limit n
 ) select coalesce(jsonb_agg(jsonb_build_object('packageId',package_id,'savedAt',saved_at,'summary',summary,'offer',offer)
   order by saved_at desc,package_id desc),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)=n then
  cur:=items->(n-1);
  if exists(select 1 from v1.saved_packages s where s.user_id=u
    and (s.saved_at,s.package_id)<((cur->>'savedAt')::timestamptz,(cur->>'packageId')::uuid)) then
   next_cursor:=jsonb_build_object('at',cur->>'savedAt','id',cur->>'packageId')::text;
  end if;
 end if;
 return jsonb_build_object('items',items,'nextCursor',next_cursor,'packageIds',
  coalesce((select jsonb_agg(package_id order by saved_at desc,package_id desc) from v1.saved_packages where user_id=u),'[]'::jsonb));
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
