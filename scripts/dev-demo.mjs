import {spawn} from 'node:child_process';
import './sync-assets.mjs';
console.log('Catera V1: explicit synthetic local demo. Storage: .data/v1. The hosted pilot is not connected.');
const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev:web'],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,CATERA_V1_DEMO:'true'}});child.on('exit',code=>process.exit(code??0));
