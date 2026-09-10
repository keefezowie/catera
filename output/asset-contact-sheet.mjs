import sharp from 'sharp';
import fs from 'node:fs';
const names=fs.readdirSync('packages/brand/assets').filter(x=>x.endsWith('.png'));
for(const [label,color] of [['forest','#163D2E'],['pink','#EAADCB'],['white','#ffffff']]) {
const cells=await Promise.all(names.map(async(n,i)=>({input:await sharp('packages/brand/assets/'+n).resize(280,220,{fit:'contain',background:color}).flatten({background:color}).extend({bottom:30,background:'#ffffff'}).composite([{input:Buffer.from(`<svg width="280" height="30"><text x="10" y="20" font-size="16">${n}</text></svg>`),top:220,left:0}]).png().toBuffer(),top:Math.floor(i/4)*250,left:i%4*280})));
await sharp({create:{width:1120,height:1000,channels:3,background:color}}).composite(cells).png().toFile(`output/asset-alpha/after-${label}.png`);
}
