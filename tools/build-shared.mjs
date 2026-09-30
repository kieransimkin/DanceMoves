import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import * as esbuild from 'esbuild-wasm';
import {buildModules,ROOT} from './build-modules.mjs';
const requested=process.argv.indexOf('--target');const target=requested<0?'all':process.argv[requested+1];
if (!['all','library','wordpress'].includes(target)) throw new Error('target must be all, library or wordpress');
process.chdir(ROOT);
const native=spawnSync(process.execPath,['tools/verify-rudiments.cjs'],{stdio:'inherit'});
if (native.status!==0) throw new Error('Pinned DanceRudiments verification failed');
const modules=buildModules();
const lib=path.join(ROOT,'lib');fs.rmSync(lib,{recursive:true,force:true});fs.mkdirSync(path.join(lib,'assets'),{recursive:true});
const options={bundle:true,target:'es2022',logLevel:'warning',legalComments:'eof',absWorkingDir:ROOT};
for (const name of ['index','react','server']) for (const format of ['esm','cjs']) {
  await esbuild.build({...options,entryPoints:[path.join(modules,`${name}.mjs`)],outfile:path.join(lib,`${name}.${format==='esm'?'mjs':'cjs'}`),
    format,platform:name==='server'?'node':'browser',external:['react'],
    banner:name==='react'?{js:'"use client";'}:undefined,
    plugins:name==='react'?[{name:'shared-runtime',setup(build){build.onResolve({filter:/^\.\/index\.mjs$/},()=>({path:format==='esm'?'./index.mjs':'./index.cjs',external:true}));}}]:[]});
}
for (const [entry,out,globalName] of [['index','dancemoves.min.js','DanceMovesLibrary'],['wordpress','wordpress.js',undefined]]) {
  await esbuild.build({...options,entryPoints:[path.join(modules,`${entry}.mjs`)],outfile:path.join(lib,out),format:'iife',platform:'browser',minify:true,globalName});
}
await esbuild.build({...options,entryPoints:['assets/dance-moves-admin.js'],outfile:path.join(lib,'admin.min.js'),format:'iife',platform:'browser',minify:true});
const cssFiles=['dance-moves-core.css','ks-epk-device-orientation.css','clay-stars-effects.css','clay-stars-rudiments.css','paper-dreams-flight.css'];
fs.mkdirSync(path.join(lib,'styles'),{recursive:true});
for(const file of cssFiles) await esbuild.build({entryPoints:['assets/'+file],outfile:path.join(lib,'styles',file),minify:true,logLevel:'warning'});
fs.writeFileSync(path.join(lib,'dancemoves.css'),cssFiles.map(file=>fs.readFileSync(path.join(lib,'styles',file),'utf8')).join('\n'));
fs.copyFileSync('assets/paper-dreams-plane-atlas.png',path.join(lib,'assets/paper-dreams-plane-atlas.png'));
fs.copyFileSync('assets/vendor/dancerudiments/LICENSE',path.join(lib,'assets/DanceRudiments-LICENSE'));
fs.copyFileSync('assets/vendor/dancerudiments/build-manifest.json',path.join(lib,'assets/DanceRudiments-build-manifest.json'));
for(const file of ['index.d.ts','react.d.ts','server.d.ts']) fs.copyFileSync(path.join(ROOT,'types',file),path.join(lib,file));
fs.copyFileSync('RUDIMENTS-API.d.ts',path.join(lib,'rudiments.d.ts'));
const packageInfo=JSON.parse(fs.readFileSync('package.json','utf8'));
function inventory(directory,prefix='') {
 return fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
   const rel=prefix+e.name,abs=path.join(directory,e.name);
   return e.isDirectory()?inventory(abs,rel+'/'):[{path:rel,bytes:fs.statSync(abs).size,sha256:createHash('sha256').update(fs.readFileSync(abs)).digest('hex')}];
 });
}
fs.writeFileSync(path.join(lib,'build-manifest.json'),JSON.stringify({schema:'dancemoves-library-build/v1',name:packageInfo.name,version:packageInfo.version,homepage:packageInfo.homepage,files:inventory(lib)},null,2)+'\n');
if (target!=='library') {
  const wp=path.join(ROOT,'.build/wordpress');fs.rmSync(wp,{recursive:true,force:true});fs.mkdirSync(path.join(wp,'lib/assets'),{recursive:true});
  fs.mkdirSync(path.join(wp,'lib/styles'),{recursive:true});
  for(const file of ['kieran-epk-device-orientation.php','dance-moves-rudiments.php','LICENSE']) fs.copyFileSync(file,path.join(wp,file));
  // Exactly the library build: no raw assets/ sources or second engine in WordPress.
  for (const file of ['wordpress.js','admin.min.js']) fs.copyFileSync(path.join(lib,file),path.join(wp,'lib',file));
  for(const file of cssFiles) fs.copyFileSync(path.join(lib,'styles',file),path.join(wp,'lib/styles',file));
  for(const file of ['paper-dreams-plane-atlas.png','DanceRudiments-LICENSE','DanceRudiments-build-manifest.json']) fs.copyFileSync(path.join(lib,'assets',file),path.join(wp,'lib/assets',file));
  fs.mkdirSync(path.join(wp,'docs'),{recursive:true});
  for(const file of fs.readdirSync('docs').filter(name=>name.endsWith('.md'))) fs.copyFileSync(path.join('docs',file),path.join(wp,'docs',file));
  fs.copyFileSync('RUDIMENTS-API.md',path.join(wp,'RUDIMENTS-API.md'));
  fs.writeFileSync(path.join(wp,'README.md'),`# DanceMoves ${packageInfo.version} for WordPress\n\nHomepage: ${packageInfo.homepage}\n\n[WordPress setup and all six Page metadata fields](docs/wordpress-shared-runtime.md)\n\nThis archive imports the shared DanceMoves JavaScript library.\nSource, JavaScript/React/Next.js packages and release artifacts: https://github.com/kieransimkin/DanceMoves\n`);
  fs.writeFileSync(path.join(wp,'library-manifest.json'),JSON.stringify({schema:'dancemoves-wordpress-library/v1',name:packageInfo.name,version:packageInfo.version,homepage:packageInfo.homepage,frontend:inventory(path.join(wp,'lib'))},null,2)+'\n');
}
console.log(`Built ${packageInfo.name}@${packageInfo.version}: ESM, CommonJS, React, Node, minified browser${target!=='library'?' and WordPress adapter':''}`);
