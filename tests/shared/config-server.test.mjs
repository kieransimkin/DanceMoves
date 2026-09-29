import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {validatePageConfig,fromWordPressMeta,createMemoryPageStore} from '../../src/config.mjs';
import {validateTimingFile,normalizeDownloadPath,createDownloadService,createCaptureHandler,createMemoryRateLimiter,validateMotionCapture} from '../../src/server.mjs';
for(const bpm of [20,90,145,400])test(`BPM ${bpm}`,()=>assert.equal(validatePageConfig({bpm}).bpm,bpm));
for(const bpm of [19,401,NaN,Infinity,'145',true])test(`Invalid BPM ${String(bpm)}`,()=>assert.throws(()=>validatePageConfig({bpm})));
test('fallback, URL safety and effects',()=>{assert.equal(validatePageConfig().bpm,120);assert.equal(validatePageConfig().bpmSource,'fallback');assert.throws(()=>validatePageConfig({lyricTimingUrl:'javascript:alert(1)'}));assert.throws(()=>validatePageConfig({effect:'not-real'}));});
test('WordPress attachment mapping and hidden duration',async()=>{const seen=[];const v=await fromWordPressMeta({_dance_moves_bpm:'145',_dance_moves_lyric_timing_id:12,_dance_moves_cue_timing_id:13,_dance_moves_lyric_popups_enabled:'1',_dance_moves_master_duration_ms:273604.558},id=>{seen.push(id);return `/uploads/${id}.lrc`;});assert.equal(v.bpm,145);assert.equal(v.lyricPopupsEnabled,true);assert.deepEqual(seen,[12,13]);assert.equal(v.masterDurationMilliseconds,273604.558);});
test('bounded revisions, optimistic concurrency and restore',()=>{const store=createMemoryPageStore({maxPages:1,maxRevisions:2});store.save('a',{bpm:100});store.save('a',{bpm:145},{expectedRevision:1});assert.throws(()=>store.save('a',{bpm:120},{expectedRevision:1}));assert.equal(store.restore('a',1).config.bpm,100);assert.equal(store.revisions('a').length,2);assert.throws(()=>store.save('b',{}));const copy=store.read('a');copy.config.bpm=300;assert.equal(store.read('a').config.bpm,100);});
test('canonical timestamp clears, BOM and CRLF',()=>{assert.equal(validateTimingFile('\ufeff[00:01.20]Hello\r\n[00:02.30]\r\n',{kind:'lyric',filename:'song.lrc'}).timestamps,2);});
for(const input of ['[00:02]a\n[00:01]b','no timing','[00:01]\u0000','[00:01]\uFFFD',new Uint8Array([255])])test('reject malformed timing '+String(input),()=>assert.throws(()=>validateTimingFile(input)));
test('timing sizes/extensions',()=>{assert.throws(()=>validateTimingFile('[00:01]a',{filename:'a.mp3'}));assert.throws(()=>validateTimingFile('[00:01]a',{maxBytes:2}));});
for(const input of ['../a.mp3','/etc/a.mp3','https://x/a.mp3','a/../b.mp3','a%2f..%2fb.mp3','a\u0000.mp3','a.txt'])test('unsafe download '+input,()=>assert.equal(normalizeDownloadPath(input),''));
test('signed download GET/HEAD, signature, methods and traversal',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'dm-http-'));
 try{await writeFile(path.join(dir,'Arcadians.mp3'),Buffer.from([1,2,3,4]));const svc=createDownloadService({rootDirectory:dir,secret:'a'.repeat(32),origin:'http://localhost:3000'});const url=svc.sign('Arcadians.mp3');
 const get=await svc.handle(new Request(url));assert.equal(get.status,200);assert.deepEqual([...new Uint8Array(await get.arrayBuffer())],[1,2,3,4]);assert.match(get.headers.get('content-disposition'),/^attachment/);
 const head=await svc.handle(new Request(url,{method:'HEAD'}));assert.equal(head.headers.get('content-length'),'4');assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await svc.handle(new Request(url.replace(/signature=./,'signature=Z')))).status,404);
 assert.equal((await svc.handle(new Request(url,{method:'POST'}))).status,405);assert.throws(()=>svc.sign('../outside.mp3'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('symlink outside media root rejected',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'dm-link-'));
 try{await mkdir(path.join(dir,'media'));await writeFile(path.join(dir,'secret.mp3'),'private');try{await symlink(path.join(dir,'secret.mp3'),path.join(dir,'media/link.mp3'));}catch(e){if(e.code==='EPERM'){t.skip('Host denies symlink creation');return;}throw e;}
 const svc=createDownloadService({rootDirectory:path.join(dir,'media'),secret:'x'.repeat(32),origin:'http://localhost'});assert.equal((await svc.handle(new Request(svc.sign('link.mp3')))).status,404);
 }finally{await rm(dir,{recursive:true,force:true});}
});
const capture={schema:'ks-epk-motion-recording/v1',samples:[{milliseconds:0,beta:1,gamma:2,alpha:null}]};
const request=(body=capture,headers={},method='POST')=>new Request('http://localhost/api/capture',{method,headers:{'Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
test('capture authentication, origin, rate limiting and persistence',async()=>{
 let saves=0;const handler=createCaptureHandler({allowedOrigin:'http://localhost',authorize:r=>r.headers.get('authorization')==='yes',rateLimit:()=>true,store:async data=>{saves++;assert.equal(data.samples.length,1);return {captureId:7,storedPrivately:true};}});
 assert.equal((await handler(request())).status,403);
 assert.equal((await handler(request(capture,{authorization:'yes',origin:'https://other.test'}))).status,403);
 const good=await handler(request(capture,{authorization:'yes'}));assert.equal(good.status,200);assert.equal((await good.json()).storedPrivately,true);assert.equal(saves,1);
 assert.equal((await handler(request({}, {authorization:'yes'}))).status,400);
 assert.equal((await handler(request(capture,{},'GET'))).status,405);
});
test('capture byte limit counts actual stream without Content-Length',async()=>{
 let stores=0;const handler=createCaptureHandler({allowedOrigin:'http://localhost',authorize:()=>true,rateLimit:()=>true,maxBytes:32,store:async()=>{stores++;return {captureId:1,storedPrivately:true};}});
 const res=await handler(request({...capture,junk:'x'.repeat(500)}));assert.equal(res.status,413);assert.equal(stores,0);
});
test('capture requires private durable confirmation and no embedded auth token',async()=>{
 assert.throws(()=>createCaptureHandler({}));const handler=createCaptureHandler({allowedOrigin:'http://localhost',authorize:()=>true,rateLimit:()=>true,store:async()=>({captureId:1,storedPrivately:false})});assert.equal((await handler(request())).status,500);
 assert.throws(()=>validateMotionCapture({...capture,samples:Array(501).fill(capture.samples[0])}));assert.throws(()=>validateMotionCapture({...capture,samples:[{milliseconds:0,beta:Infinity,gamma:2}]}));
});
test('rate limiter is bounded and expires counters',()=>{let now=0;const r=createMemoryRateLimiter({limit:2,windowMilliseconds:10,maxKeys:1,now:()=>now});assert.equal(r.consume('a'),true);assert.equal(r.consume('a'),true);assert.equal(r.consume('a'),false);assert.equal(r.consume('b'),false);now=11;assert.equal(r.consume('b'),true);});
