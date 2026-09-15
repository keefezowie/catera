import { readFile, writeFile, readdir } from 'node:fs/promises';
const file = (await readdir('supabase/migrations')).find(f => f.endsWith('_multi_cycle.sql'));
if (!file) throw new Error('Run supabase migration new multi_cycle first');
await writeFile('supabase/migrations/' + file, await readFile('packages/backend/src/multi-cycle.sql'));
