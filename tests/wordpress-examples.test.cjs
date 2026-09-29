'use strict';
// Static example coverage and configuration contracts; NOT browser/WordPress runtime proof.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const crypto=require('node:crypto');const cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'examples/wordpress');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const manifest=JSON.parse(read('features.json')),coverage=JSON.parse(read('coverage.json')),media=JSON.parse(read('media/manifest.json'));
const {config,KEYS,validBpm}=require(path.join(dir,'shared/model.cjs'));
let checks=0;function check(fn){fn();checks++;}
check(()=>assert.equal(manifest.pluginVersion,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version));
check(()=>assert.equal(manifest.pluginCommit,coverage.baseline));
check(()=>assert.equal(manifest.features.length,23));
check(()=>assert.equal(new Set(manifest.features.map(f=>f.id)).size,23));
check(()=>assert.deepEqual(coverage.metadataKeys,KEYS));
const sources=new Map();
for(const f of manifest.features){
 check(()=>assert.deepEqual(Object.keys(f.meta).sort(),[...KEYS].sort(),f.id+' metadata must enumerate all keys'));
 check(()=>assert.equal(f.meta._dance_moves_bpm,145));
 check(()=>assert.equal(f.meta._dance_moves_master_duration_ms,273604.558));
 check(()=>assert.match(read(f.page),new RegExp(`data-demo="${f.id}"`)));
 const source=read(f.code);sources.set(f.id,source);
 check(()=>assert.match(source,/export (?:async )?function mount\(ctx\)/));
 check(()=>assert.equal(cp.spawnSync(process.execPath,['--check',path.join(dir,f.code)],{encoding:'utf8'}).status,0));
 check(()=>assert.equal(coverage.features.filter(c=>c.id===f.id).length,1));
 check(()=>assert(coverage.features.find(c=>c.id===f.id).acceptance.length>=3));
 const boot=config(f,f.meta);
 check(()=>assert.equal(boot.bpmSource,'explicit'));
 check(()=>assert.equal(boot.lyricPopupsEnabled,f.id==='lyrics'));
 check(()=>assert.equal(boot.effect,f.id==='planes'?'paper-planes':''));
}
for(const c of coverage.apiExamples){check(()=>assert(sources.get(c.feature).replace(/\?\./g,'.').includes(c.token),`${c.api}: missing demonstration in ${c.feature}`));}
for(const x of [20,145,400])check(()=>assert(validBpm(x)));
for(const x of ['',null,0,19,401,NaN,Infinity])check(()=>assert(!validBpm(x)));
check(()=>assert.equal(config(manifest.features[0],{...manifest.features[0].meta,_dance_moves_bpm:''}).bpmSource,'fallback'));
check(()=>assert.equal(config(manifest.features[0],{...manifest.features[0].meta,_dance_moves_bpm:''}).bpm,120));
check(()=>assert.equal(media.sourceCommit,'77c3c0c8115830a5fd26cd56bd59500c26f3ba86'));
const lyric=fs.readFileSync(path.join(dir,'media/canonical-lyric-timing.lrc'));
check(()=>assert.equal(crypto.createHash('sha256').update(lyric).digest('hex'),media.canonicalLrc.sha256));
check(()=>assert.equal(lyric.length,2542));
check(()=>assert.equal((lyric.toString().match(/\[\d{2}:\d{2}\.\d{2}\]/g)||[]).length,96));
check(()=>assert.equal(lyric.toString().split(/\r\n/).filter(s=>/^\[\d[^\]]*\]$/.test(s)).length,48));
const sections=JSON.parse(read('media/sections.json'));
check(()=>assert.equal(sections.length,10));
check(()=>assert.equal(sections[4].time,104.01));check(()=>assert.equal(sections.at(-1).end,273.604558));
for(let i=0;i<sections.length;i++){check(()=>assert(sections[i].end>sections[i].time));if(i)check(()=>assert.equal(sections[i-1].end,sections[i].time));}
const boot=read('shared/boot.mjs');
for(const adapter of coverage.orientationAdapters)check(()=>assert(boot.includes(adapter)));
check(()=>assert.equal(coverage.orientationAdapters.length,9));
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/vendor/dancerudiments/dancerudiments-native.js'),'utf8'),context);
check(()=>assert.deepEqual(Array.from(context.window.danceMovesRudimentsNative.catalogue,x=>x.name).sort(),[...coverage.rudiments].sort()));
check(()=>assert.equal(coverage.rudiments.length,15));
check(()=>assert(boot.includes("import('/lib/index.mjs')") && boot.includes('createDanceMoves')));
check(()=>assert(!boot.includes('autoplay=')));
check(()=>assert(!sources.get('capture').includes('/wp-json/')));
check(()=>assert(!/token\s*[:=]\s*['"][a-f0-9]{32,}/i.test([...sources.values()].join('\n')+boot)));
check(()=>assert(read('.gitattributes').includes('canonical-lyric-timing.lrc binary')));
for(const file of ['shared/boot.mjs','shared/model.cjs','wordpress/arcadians-example.js'])check(()=>assert.equal(cp.spawnSync(process.execPath,['--check',path.join(dir,file)],{encoding:'utf8'}).status,0));
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
for(const f of manifest.features)check(()=>assert(readme.includes(`examples/wordpress/${f.page}`),f.id+' missing README recipe link'));
check(()=>assert(readme.includes('RELEASING.md')));
check(()=>assert(!/current.*main.*2\.4\.0/i.test(readme.slice(0,1200))));
console.log(JSON.stringify({status:'PASS',scope:'static coverage and metadata/media contracts only',checks,featurePages:23,apiExampleReferences:coverage.apiExamples.length,rudiments:15,orientationAdapters:9},null,2));
