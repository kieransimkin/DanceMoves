/** Idempotent publication of the exact tested tarball; never overwrite a version. */
import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const files=fs.readdirSync('release-output').filter(n=>n.endsWith('.tgz'));
if(files.length!==1)throw new Error('Expected exactly one tested npm tarball');
// An explicit local path prevents npm from interpreting owner/repo shorthand.
const file='./release-output/'+files[0],bytes=fs.readFileSync(file),integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');
const endpoint='https://registry.npmjs.org/'+encodeURIComponent(pkg.name)+'/'+encodeURIComponent(pkg.version);
async function lookup(){const result=await fetch(endpoint,{signal:AbortSignal.timeout(30000)});if(result.status===404)return null;if(!result.ok)throw new Error(`Registry lookup failed (${result.status}); not treating this as an absent package`);return result.json();}
const existing=await lookup();
if(existing){if(existing.dist?.integrity!==integrity)throw new Error('This npm version already exists with DIFFERENT bytes. Use a new version; never overwrite.');console.log('Identical npm version already published; safe no-op.');}
else{
 const npm=process.platform==='win32'?'npm.cmd':'npm';
 const result=spawnSync(npm,['publish',file,'--access','public','--provenance','--ignore-scripts','--tag',pkg.version.includes('-')?'next':'latest'],{stdio:'inherit',shell:process.platform==='win32'});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`npm publication failed (exit ${result.status}); inspect npm's error above before changing credentials.`);
 let published;for(let i=0;i<6;i++){published=await lookup();if(published)break;await new Promise(r=>setTimeout(r,2000));}
 if(published?.dist?.integrity!==integrity)throw new Error('Published npm integrity could not be confirmed; inspect before retrying.');
 console.log(`Published ${pkg.name}@${pkg.version} (${integrity})`);
}
