import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'lib/build-manifest.json'),'utf8'));
if(manifest.version!==pkg.version)throw new Error('Stale library build; run npm run build');
for(const item of manifest.files){const data=fs.readFileSync(path.join(root,'lib',item.path));if(data.length!==item.bytes || createHash('sha256').update(data).digest('hex')!==item.sha256)throw new Error('Changed generated artifact: '+item.path);}
for(const entry of ['index.mjs','index.cjs','react.mjs','react.cjs','server.mjs','server.cjs','dancemoves.min.js','wordpress.js','index.d.ts','react.d.ts','server.d.ts'])if(!fs.existsSync(path.join(root,'lib',entry)))throw new Error('Missing library export '+entry);
console.log('Shared-library build identity verified');
