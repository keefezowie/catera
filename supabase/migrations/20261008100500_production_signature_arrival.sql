-- Arrival facts (departure, confirmation, reaction, open report) change after a
-- production snapshot is frozen and are not production changes. Keep them out of
-- the signature compared by latestProduction.changed and production_changed.
-- Meal status stays in the signature, as before.
create or replace function v1.beta_production_signature(entries jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(
  case when jsonb_typeof(x->'meals')='array' then jsonb_set(x-'canChange','{meals}',
   coalesce((select jsonb_agg(m-'departed_at'-'confirmed_at'-'reaction'-'issue' order by o) from jsonb_array_elements(x->'meals') with ordinality t(m,o)),'[]'))
  else x-'canChange' end
  order by x->>'id'),'[]') from jsonb_array_elements(entries)x
$$;
revoke all on all functions in schema v1 from public,anon,authenticated;
