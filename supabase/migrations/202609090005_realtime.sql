-- A minimal customer-specific change signal. It contains no addresses or message bodies.
create table if not exists public.catera_v1_events (
 id uuid primary key,
 user_id uuid not null,
 topic text not null,
 created_at timestamptz not null default now()
);
alter table public.catera_v1_events enable row level security;
revoke all on public.catera_v1_events from public, anon, authenticated;
grant select on public.catera_v1_events to authenticated;
drop policy if exists own_events on public.catera_v1_events;
create policy own_events on public.catera_v1_events for select to authenticated using(user_id=(select auth.uid()));
create or replace function v1.emit_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.catera_v1_events(id,user_id,topic) values(new.id,new.user_id,new.kind);
 return new;
end $$;
revoke all on function v1.emit_event() from public,anon,authenticated;
drop trigger if exists v1_notification_event on v1.notifications;
create trigger v1_notification_event after insert on v1.notifications for each row execute function v1.emit_event();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='catera_v1_events') then
   alter publication supabase_realtime add table public.catera_v1_events;
 end if;
end $$;
