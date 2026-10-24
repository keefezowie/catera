-- Hosted-only (Catera V2, kdfddipnkcviberrldpk). Not a repo migration.
--
-- On hosted, the caterer_journey_reads wrapper (now public.catera_v1_read_live_address_reapply_base,
-- see 20261023_catera_v2_live_address_reapply.sql) sits above the read chain whose
-- v1.beta_attention_page already builds '&meal=' and '&delivery=' into every seller-attention href.
-- Its 'seller-attention' branch appends both again, so hosted hrefs carry them twice. The demo DB
-- applies the reads in repo order and is not affected.
--
-- This drops only that branch from the wrapper, rebuilt from its own pg_get_functiondef, so the
-- rest of the body, the owner and the grants stay as they are. Idempotent: a second run finds no
-- branch and changes nothing. It stops with ATTENTION_HREF_PATCH if the body is not in the
-- expected shape.

do $outer$
declare def text; patched text;
begin
 select pg_get_functiondef('public.catera_v1_read_live_address_reapply_base(text,jsonb)'::regprocedure) into def;
 if position('seller-attention' in def)=0 then return; end if;
 patched := regexp_replace(def, E'\n elsif resource=''seller-attention'' then.*?(\n end if;\n return result;)', E'\\1');
 if position('seller-attention' in patched)>0 or patched=def then raise exception 'ATTENTION_HREF_PATCH'; end if;
 execute patched;
end
$outer$;
