// Historical migrations are frozen. Generate subsequent contents services separately.
import {readFile,writeFile} from 'node:fs/promises';
const helper=await readFile('packages/backend/src/validation.sql','utf8')+'\n'+await readFile('packages/backend/src/import.sql','utf8');
const core=await readFile('supabase/migrations/202609090001_marketplace.sql','utf8');
const system=await readFile('supabase/migrations/202609090002_services.sql','utf8');
const functions=[...core.matchAll(/create function [\s\S]*?\$\$;/g)].map(m=>m[0].replace('create function','create or replace function'));
const extras=await readFile('packages/backend/src/finance.sql','utf8');
const historical='-- Additive local upgrade and shared service functions. No demo seed.\n'+helper+'\n'+functions.join('\n')+'\n'+system.replaceAll('create function','create or replace function')+'\n'+extras+'\nrevoke all on all functions in schema v1 from public,anon,authenticated;\n';
if ((await readFile('supabase/migrations/202609090003_hardening.sql','utf8')).replaceAll('\r\n','\n') !== historical.replaceAll('\r\n','\n')) throw Error('Historical migration sources changed. Add a forward migration instead.');
await import('./compile-contents-migration.mjs');
await import('./compile-dishes-migration.mjs');
