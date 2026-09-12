begin;

-- Uploads use the signed-in owner token after the API has validated the file's
-- bytes. Keep direct Storage writes limited to a new UUID path in that owner's
-- caterer folder; replacement and deletion remain unavailable to clients.
create or replace function v1.can_upload_food(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and exists (
      select 1
      from v1.staff
      where user_id = (select auth.uid())
        and role = 'owner'
        and caterer_id::text = split_part(object_name, '/', 1)
    );
$$;

revoke all on function v1.can_upload_food(text) from public, anon;
grant usage on schema v1 to authenticated;
grant execute on function v1.can_upload_food(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Catera owners upload food photos" on storage.objects';
    execute $policy$
      create policy "Catera owners upload food photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'catera-v1-food'
        and v1.can_upload_food(name)
      )
    $policy$;
  end if;
end
$$;

commit;
