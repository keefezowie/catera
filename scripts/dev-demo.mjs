import {spawn} from 'node:child_process';
import './sync-assets.mjs';
const demo = process.env.CATERA_V1_DEMO || 'false';
console.log(demo === 'true'
  ? 'Catera V1: explicit synthetic local demo. Storage: .data/v1.'
  : 'Catera V1: local Supabase mode. Set CATERA_V1_DEMO=true only for synthetic demo storage.');
const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev:web'],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,CATERA_V1_DEMO:demo}});child.on('exit',code=>process.exit(code??0));
