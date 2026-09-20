-- Hosted default privileges can grant anon EXECUTE when an RPC wrapper is
-- recreated. Commands require a signed-in actor; public catalog reads remain
-- available through catera_v1_read.
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public, anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
