/** Start the real production Next build; validate server rendering and Node routes. */
import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const port=3187,base=`http://localhost:${port}`,dir=await mkdtemp(path.join(os.tmpdir(),'dancemoves-next-')),evidence='.build/browser-evidence';fs.mkdirSync(evidence,{recursive:true});
const child=spawn(process.execPath,['tools/run-next.mjs','start','-p',String(port)],{env:{...process.env,DANCEMOVES_ORIGIN:base,DANCEMOVES_DOWNLOAD_SECRET:'test-only-download-secret-not-for-production-123',DANCEMOVES_CAPTURE_KEY:'test-only-capture-secret-not-for-production-123',DANCEMOVES_CAPTURE_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);const checks=[];
try{
 let response;for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error(output);try{response=await fetch(base);if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}if(!response?.ok)throw new Error('Next server failed to start: '+output);
 const html=await response.text();assert.match(html,/Arcadians/);assert.doesNotMatch(html,/test-only-download-secret|test-only-capture-secret/);checks.push('SSR page renders without serializing secrets');
 const link=html.match(/href="([^"]*\/api\/download\?[^\"]+)"/);assert.ok(link,'server-signed download link');const url=link[1].replaceAll('&amp;','&');response=await fetch(url,{method:'HEAD'});assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);checks.push('Node signed-download route and HEAD');
 response=await fetch(base+'/api/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);checks.push('unauthenticated capture rejected');
 response=await fetch(base+'/api/capture',{method:'POST',headers:{'Content-Type':'application/json','X-DanceMoves-Demo-Key':'test-only-capture-secret-not-for-production-123'},body:JSON.stringify({schema:'ks-epk-motion-recording/v1',samples:[{milliseconds:0,beta:1,gamma:2}]})});assert.equal(response.status,200);assert.equal((await response.json()).storedPrivately,true);assert.equal(fs.readdirSync(dir).filter(n=>n.endsWith('.json')).length,1);checks.push('authenticated capture stored outside public directory');
 fs.writeFileSync(evidence+'/next.json',JSON.stringify({status:'PASS',checks},null,2));
}catch(error){fs.writeFileSync(evidence+'/next.json',JSON.stringify({status:'FAIL',checks,error:String(error)},null,2));throw error;}
finally{child.kill();await rm(dir,{recursive:true,force:true});fs.writeFileSync(evidence+'/next-server.log',output);}
