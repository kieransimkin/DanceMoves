import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'lib/build-manifest.json'),'utf8'));
if(manifest.version!==pkg.version)throw new Error('Stale library build; run npm run build');
// npm publishes all of lib/. Checking only recorded hashes would allow a song
// recording copied there after the build to slip into an otherwise valid package.
const expected=new Set();
for(const item of manifest.files){
 if(typeof item.path!=='string'||!item.path||item.path.includes('\\')||path.posix.isAbsolute(item.path)||item.path.split('/').some(part=>!part||part==='.'||part==='..')||item.path==='build-manifest.json')throw new Error('Invalid generated artifact path');
 if(expected.has(item.path))throw new Error('Duplicate generated artifact: '+item.path);
 expected.add(item.path);
}
function inventory(directory,prefix=''){
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const name=prefix+entry.name,absolute=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw new Error('Symlink in generated artifacts: '+name);
  if(entry.isDirectory())return inventory(absolute,name+'/');
  if(!entry.isFile())throw new Error('Unsupported generated artifact: '+name);
  return [name];
 });
}
const actual=new Set(inventory(path.join(root,'lib')).filter(name=>name!=='build-manifest.json'));
for(const name of actual)if(!expected.has(name))throw new Error('Unlisted generated artifact: '+name+'; song data belongs to its page, not lib/');
for(const name of expected)if(!actual.has(name))throw new Error('Missing generated artifact: '+name);
for(const item of manifest.files){const data=fs.readFileSync(path.join(root,'lib',item.path));if(data.length!==item.bytes || createHash('sha256').update(data).digest('hex')!==item.sha256)throw new Error('Changed generated artifact: '+item.path);}
for(const entry of ['index.mjs','index.cjs','react.mjs','react.cjs','server.mjs','server.cjs','dancemoves.min.js','wordpress.js','index.d.ts','react.d.ts','server.d.ts'])if(!fs.existsSync(path.join(root,'lib',entry)))throw new Error('Missing library export '+entry);
console.log('Shared-library build identity verified');
