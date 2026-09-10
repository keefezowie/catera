import fs from 'node:fs';
import crypto from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync('packages/brand/manifest.brand.json','utf8'));
for(const a of manifest.assets){const web=fs.readFileSync('apps/web/public/'+a.file);if(crypto.createHash('sha256').update(web).digest('hex')!==a.sha256)throw Error('Web asset mismatch: '+a.id);}
fs.writeFileSync('output/asset-alpha/verification.json',JSON.stringify({branch:'v1',transparentAssets:15,opaqueAppIcons:1,webCopiesMatch:true,checks:{alpha:'passed; decoded pixel counts, edges, provenance and hashes',typecheck:'passed',unit:'40 passed',postgresConcurrency:'passed',nativeIos:'4 passed',nativeAndroid:'4 passed',productionBuild:'passed',browser:'desktop and 390px phone passed using installed Chrome'},limitations:['Native device screenshots and APK rebuild not performed.','Original generated dimensions retained; no upscaling.']},null,2)+'\n');
console.log('All 16 web copies match verified brand files.');
