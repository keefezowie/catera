import { readFile, writeFile, readdir } from 'node:fs/promises';
const file = (await readdir('supabase/migrations')).find(f => f.endsWith('_earned_settlement.sql'));
if (!file) throw new Error('Run supabase migration new earned_settlement first');
await writeFile('supabase/migrations/' + file, await readFile('packages/backend/src/earned-settlement.sql'));
