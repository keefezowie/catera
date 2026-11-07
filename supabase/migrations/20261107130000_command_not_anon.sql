-- The address pin wrapper left catera_v1_command callable by anon (2026-11-07). Supabase's default privileges grant new
-- public functions to anon directly, so revoking from public alone does not remove it. Commands are for signed-in people.
revoke execute on function public.catera_v1_command(text,jsonb,uuid) from anon;
