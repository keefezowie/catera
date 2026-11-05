-- Impor pelanggan keeps its review list as a draft, so a caterer can finish a customer when the details arrive
-- (owner ruling 2026-11-05: no expiry; the photos, files and pasted text the list was read from are never stored).
--   One list per kitchen, owners only, as Impor itself is. import.draftSave replaces the whole list and an empty list
--   removes the row. It is called on every edit, so it stays out of the command receipts. The list comes back on the
--   seller-import-options read, which has already checked that the caller owns the kitchen.
--   import.preview and import.commit stay the only way a row becomes a customer: nothing here is trusted by them.

create table v1.import_drafts(
 caterer_id uuid primary key references v1.caterers on delete cascade,
 rows jsonb not null,
 updated_by uuid references v1.profiles on delete set null,
 updated_at timestamptz not null default now()
);
alter table v1.import_drafts enable row level security;
revoke all on v1.import_drafts from public,anon,authenticated;

do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_draft_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_draft_base('),
   'catera_v1_command.request_id','catera_v1_command_draft_base.request_id');
end $$;
revoke all on function public.catera_v1_command_draft_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; list jsonb;
begin
 if action is distinct from 'import.draftSave' then
  return public.catera_v1_command_draft_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'INVALID_INPUT';end if;
 list:=payload->'rows';
 if jsonb_typeof(list) is distinct from 'array' then raise exception 'INVALID_INPUT';end if;
 if jsonb_array_length(list)>500 or octet_length(list::text)>512000 then raise exception 'INVALID_INPUT';end if;
 begin cid:=(payload->>'catererId')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
 if cid is null or not v1.is_staff(u,cid,true) then raise exception 'FORBIDDEN';end if;
 if jsonb_array_length(list)=0 then
  delete from v1.import_drafts where caterer_id=cid;
 else
  insert into v1.import_drafts(caterer_id,rows,updated_by) values(cid,list,u)
  on conflict(caterer_id) do update set rows=excluded.rows,updated_by=excluded.updated_by,updated_at=now();
 end if;
 return jsonb_build_object('saved',jsonb_array_length(list));
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_draft_base;
revoke all on function public.catera_v1_read_draft_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.catera_v1_read_draft_base(resource,params);
 if resource='seller-import-options' then
  result:=result||jsonb_build_object('draft',(select jsonb_build_object('rows',d.rows,'updatedAt',d.updated_at)
   from v1.import_drafts d where d.caterer_id=(params->>'id')::uuid));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
