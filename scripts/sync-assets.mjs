import {mkdir,cp,access} from 'node:fs/promises';
const source=new URL('../packages/brand/assets/',import.meta.url);const target=new URL('../apps/web/public/assets/',import.meta.url);
await mkdir(target,{recursive:true});try{await access(source);await cp(source,target,{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
