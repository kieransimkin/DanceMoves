import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SPRITE_ATLASES} from '../../src/visualiser-sprite-catalogue.mjs';

const ROOT=path.resolve(import.meta.dirname,'../..');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const digest=data=>createHash('sha256').update(data).digest('hex');
const exports=['index.mjs','index.cjs','react.mjs','react.cjs','server.mjs','server.cjs',
 'dancemoves.min.js','wordpress.js','index.d.ts','react.d.ts','server.d.ts'];

function temporary(work){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dancemoves-spectrum-package-'));
 try{return work(directory);}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
function run(command,args,cwd=ROOT,options={}){
 const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024,...options});
 assert.ifError(result.error);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 return result.stdout;
}
function containsRecording(value){
 if(!value||typeof value!=='object')return false;
 if(typeof value.format==='string'&&value.format.startsWith('dancerudiments.recording'))return true;
 return Object.values(value).some(containsRecording);
}
function assertPageDataExcluded(names,source,label){
 assert.ok(names.length>0,label+' has an actual inventory');
 for(const name of names){
  assert.doesNotMatch(name,/(?:^|\/)(?:examples|tests|fixtures|recordings|songs|media)\//i,label+': page/development asset '+name);
  // Retain existing documentation screenshots and its silent browser video.
  // Runtime audio/video and song recording documents must remain page-owned.
  if(!name.startsWith('docs/'))assert.doesNotMatch(name,/\.(?:wav|mp3|flac|ogg|m4a|aac|aiff?|mp4|webm|mov)$/i,label+': media '+name);
  if(name.endsWith('.json'))assert.equal(containsRecording(readJson(typeof source==='function'?source(name):path.join(source,name))),false,label+': recording payload '+name);
 }
}

test('npm, browser and WordPress distributions contain no page recording or audio data',()=>temporary(directory=>{
 // npm's actual publish inventory also proves examples/spectrum stays outside
 // the package; --ignore-scripts prevents this inspection from rebuilding it.
 const npm=process.platform==='win32'?'npm.cmd':'npm';
 const packed=JSON.parse(run(npm,['pack','--dry-run','--json','--ignore-scripts','--offline'],ROOT,
  {shell:process.platform==='win32',env:{...process.env,npm_config_cache:path.join(directory,'npm-cache')}}));
 assert.equal(packed.length,1);
 assertPageDataExcluded(packed[0].files.map(file=>file.path),ROOT,'npm');
 assert.ok(packed[0].files.some(file=>file.path==='lib/index.mjs'));
 for(const atlas of Object.values(SPRITE_ATLASES))
  assert.ok(packed[0].files.some(file=>file.path==='lib/assets/visualiser-sprites/'+atlas.file),'npm includes '+atlas.file);

 // Package an isolated copy of the actual build. Tests never add/remove files
 // from the user's build or race another process writing release archives.
 fs.mkdirSync(path.join(directory,'tools'),{recursive:true});
 fs.mkdirSync(path.join(directory,'.build'),{recursive:true});
 fs.mkdirSync(path.join(directory,'docs'),{recursive:true});
 fs.mkdirSync(path.join(directory,'assets'),{recursive:true});
 fs.copyFileSync(path.join(ROOT,'assets/visualiser-catalogue.json'),path.join(directory,'assets/visualiser-catalogue.json'));
 fs.cpSync(path.join(ROOT,'assets/visualiser-sprites'),path.join(directory,'assets/visualiser-sprites'),{recursive:true});
 fs.cpSync(path.join(ROOT,'lib'),path.join(directory,'lib'),{recursive:true});
 fs.cpSync(path.join(ROOT,'.build/wordpress'),path.join(directory,'.build/wordpress'),{recursive:true});
 fs.cpSync(path.join(ROOT,'docs/branding'),path.join(directory,'docs/branding'),{recursive:true});
 for(const name of ['package.json','LICENSE','README.md','AGENTS.md','CONTRIBUTING.md',
  ...fs.readdirSync(ROOT).filter(name=>name.endsWith('.php')),
  'tools/package-wordpress.py','tools/package-web.py'])fs.copyFileSync(path.join(ROOT,name),path.join(directory,name));
 const python=process.platform==='win32'?'python':'python3';
 run(python,['tools/package-wordpress.py'],directory);
 run(python,['tools/package-web.py'],directory);
 const version=readJson(path.join(ROOT,'package.json')).version;
 const archives=[
  {name:`DanceMoves-wordpress-${version}.zip`,source:path.join(directory,'.build/wordpress'),label:'WordPress'},
  {name:`DanceMoves-browser-${version}.zip`,source:name=>fs.existsSync(path.join(directory,'lib',name))?path.join(directory,'lib',name):path.join(directory,name),label:'browser'}
 ];
 for(const archive of archives){
  const zipped=JSON.parse(run(python,['-c','import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))',path.join(directory,'dist',archive.name)],directory));
  const names=zipped.map(name=>name.slice(name.indexOf('/')+1));
  assertPageDataExcluded(names,archive.source,archive.label);
  const prefix=archive.label==='WordPress'?'lib/':'';
  for(const name of ['LICENSE','manifest.json',...Object.values(SPRITE_ATLASES).map(atlas=>atlas.file)])
   assert.ok(names.includes(prefix+'assets/visualiser-sprites/'+name),archive.label+' includes '+name);
 }
 fs.unlinkSync(path.join(directory,'lib/assets/visualiser-sprites/lcd.png'));
 const missing=spawnSync(python,['tools/package-web.py'],{cwd:directory,encoding:'utf8'});
 assert.ifError(missing.error);assert.notEqual(missing.status,0);
 assert.match(missing.stderr,/Web asset inventory differs/,'browser packaging cannot silently omit a required atlas');
}));

test('prepack rejects a song recording added after build without changing it',()=>temporary(directory=>{
 fs.mkdirSync(path.join(directory,'tools'),{recursive:true});
 fs.mkdirSync(path.join(directory,'lib/assets'),{recursive:true});
 fs.copyFileSync(path.join(ROOT,'tools/check-shared-build.mjs'),path.join(directory,'tools/check-shared-build.mjs'));
 fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:'synthetic-package',version:'1.0.0'}));
 const files=exports.map(name=>{
  const data=Buffer.from('// Synthetic build fixture\n');
  fs.writeFileSync(path.join(directory,'lib',name),data);
  return {path:name,bytes:data.length,sha256:digest(data)};
 });
 fs.writeFileSync(path.join(directory,'lib/build-manifest.json'),JSON.stringify({version:'1.0.0',files}));
 run(process.execPath,['tools/check-shared-build.mjs'],directory);
 const song=path.join(directory,'lib/assets/page-spectrum.json');
 const payload=JSON.stringify({format:'dancerudiments.recording',name:'synthetic_page_only',samples:[[0]]});
 fs.writeFileSync(song,payload);
 const result=spawnSync(process.execPath,['tools/check-shared-build.mjs'],{cwd:directory,encoding:'utf8'});
 assert.ifError(result.error);
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Unlisted generated artifact: assets\/page-spectrum\.json/);
 assert.equal(fs.readFileSync(song,'utf8'),payload,'validation reports the extra file without deleting page data');
}));
