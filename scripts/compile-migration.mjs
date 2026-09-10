// Rebuild the local upgrade from canonical RPC definitions. No data is replaced.
import {readFile,writeFile} from 'node:fs/promises';
const helper=await readFile('packages/backend/src/validation.sql','utf8')+'\n'+await readFile('packages/backend/src/import.sql','utf8');
const core=await readFile('supabase/migrations/202609090001_marketplace.sql','utf8');
const system=await readFile('supabase/migrations/202609090002_services.sql','utf8');
const functions=[...core.matchAll(/create function [\s\S]*?\$\$;/g)].map(m=>m[0].replace('create function','create or replace function'));
const extras=await readFile('packages/backend/src/finance.sql','utf8');
await writeFile('supabase/migrations/202609090003_hardening.sql','-- Additive local upgrade and shared service functions. No demo seed.\n'+helper+'\n'+functions.join('\n')+'\n'+system.replaceAll('create function','create or replace function')+'\n'+extras+'\nrevoke all on all functions in schema v1 from public,anon,authenticated;\n');
