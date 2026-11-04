-- Platform admin authority needs a second factor (security audit 2026-11-04, M3).
--   An admin can approve payouts, reconcile refunds, review payout destinations and resolve cases. Until now a
--   password alone was enough. v1.is_admin is the one place every admin check goes through (41 call sites), so the
--   rule lives here: when the database asks whether the signed-in caller is an admin, the answer is yes only for a
--   session that passed TOTP (Supabase Auth puts aal = 'aal2' in the JWT after mfa.verify).
--   * Checks about someone else (u is not the caller, for example the service-role jobs, where auth.uid() is null)
--     keep reading the role alone, so scheduled jobs and system actions are unchanged.
--   * The local demo database (catera.demo, set only by the demo backend's own connection) keeps password-free
--     synthetic admins; hosted projects never set it.
--   The profile's role is unchanged, so the actor read still says platform_admin and the web app can send an admin
--   to the verification step instead of a page of FORBIDDEN reads. Owners and staff are not affected.

create function v1.session_aal2() returns boolean language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')='aal2'
  or coalesce(current_setting('catera.demo',true),'')='true'
$$;
-- It only reads the caller's own JWT claims; signed-in callers keep it so is_admin also works in invoker context.
revoke all on function v1.session_aal2() from public,anon;
grant execute on function v1.session_aal2() to authenticated;

create or replace function v1.is_admin(u uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from v1.profiles where id=u and role='platform_admin')
  and (u is distinct from auth.uid() or v1.session_aal2())
$$;
