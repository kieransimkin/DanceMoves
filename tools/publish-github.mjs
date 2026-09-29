/** Create/update only the release for the existing tag; do not clobber assets. */
import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),tag=`v${pkg.version}`,repo=process.env.GITHUB_REPOSITORY;
if(repo!=='kieransimkin/DanceMoves')throw new Error('Release publishing is restricted to kieransimkin/DanceMoves');
const token=process.env.GH_TOKEN;if(!token)throw new Error('GH_TOKEN missing');
const endpoint=`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
function gh(args){const r=spawnSync('gh',args,{stdio:'inherit'});if(r.status!==0)throw new Error('GitHub release command failed; inspect existing assets before retrying');}
let response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(30000)});
if(response.status===404){gh(['release','create',tag,'--repo',repo,'--verify-tag','--draft','--title',`DanceMoves ${pkg.version}`,'--notes',`Shared JavaScript, React/Next.js and WordPress build. Install the attached WordPress ZIP, not Source code. See the tagged documentation for usage and npm publishing.\n\nAll attachment digests are in SHA256SUMS.txt.`]);response=await fetch(endpoint,{headers});}
if(!response.ok)throw new Error(`Could not inspect release (${response.status})`);
const release=await response.json();
for(const name of fs.readdirSync('release-output').filter(n=>n!=='build-package-lock.json').sort()){
 const file='release-output/'+name,bytes=fs.readFileSync(file),expected='sha256:'+createHash('sha256').update(bytes).digest('hex');
 const existing=release.assets.find(a=>a.name===name);
 if(existing){let actual=existing.digest;if(!actual){const r=await fetch(existing.url,{headers:{...headers,Accept:'application/octet-stream'}});if(!r.ok)throw new Error('Cannot verify existing asset '+name);actual='sha256:'+createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');}if(actual!==expected)throw new Error('Existing GitHub asset differs: '+name+'; use a new release version.');console.log('Keeping identical asset '+name);}
 else gh(['release','upload',tag,file,'--repo',repo]);
}
const prerelease=pkg.version.includes('-');
gh(['release','edit',tag,'--repo',repo,'--draft=false',`--prerelease=${prerelease}`,prerelease?'--latest=false':'--latest']);
