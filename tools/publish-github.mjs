/** Create/update only the release for the existing tag; do not clobber assets. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),tag=`v${pkg.version}`,repo=process.env.GITHUB_REPOSITORY;
if(repo!=='kieransimkin/DanceMoves')throw new Error('Release publishing is restricted to kieransimkin/DanceMoves');
const token=process.env.GH_TOKEN;if(!token)throw new Error('GH_TOKEN missing');
const api=`https://api.github.com/repos/${repo}`;
const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};

async function request(url,options={}){
 const response=await fetch(url,{...options,headers:{...headers,...(options.headers||{})},signal:AbortSignal.timeout(30000)});
 return response;
}

async function findRelease(){
 for(let page=1;page<=10;page++){
  const response=await request(`${api}/releases?per_page=100&page=${page}`);
  if(!response.ok)throw new Error(`Could not list releases (${response.status})`);
  const releases=await response.json();
  const found=releases.find(item=>item.tag_name===tag);
  if(found)return found;
  if(releases.length<100)break;
 }
 return null;
}

const tagCheck=await request(`${api}/git/ref/tags/${encodeURIComponent(tag)}`);
if(!tagCheck.ok)throw new Error(`Release tag ${tag} is not available (${tagCheck.status})`);

let release=await findRelease();
if(!release){
 const notes=`DanceMoves ${pkg.version}

Homepage: ${pkg.homepage}

| File | Use |
| --- | --- |
| DanceMoves-wordpress-${pkg.version}.zip | Install/update the WordPress plugin |
| DanceMoves-browser-${pkg.version}.zip | Minified standalone browser distribution |
| DanceMoves-npm-${pkg.version}.tgz | Exact npm package tarball published by CI |
| *-manifest.json | Per-distribution file/hash metadata |
| DanceMoves-${pkg.version}-SHA256SUMS.txt | SHA-256 checksums for all five distribution artifacts |

GitHub's automatic Source code archives are repository snapshots, not packaged distributions.`;
 const response=await request(`${api}/releases`,{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   tag_name:tag,
   name:`DanceMoves ${pkg.version}`,
   body:notes,
   draft:true,
   prerelease:pkg.version.includes('-')
  })
 });
 if(!response.ok)throw new Error(`Could not create draft release (${response.status}): ${await response.text()}`);
 release=await response.json();
}

if(!Array.isArray(release.assets))release.assets=[];
function assetLabel(name){
 if(name===`DanceMoves-wordpress-${pkg.version}.zip`)return `WordPress plugin ${pkg.version}`;
 if(name===`DanceMoves-browser-${pkg.version}.zip`)return `Browser package ${pkg.version}`;
 if(name===`DanceMoves-npm-${pkg.version}.tgz`)return `npm package ${pkg.version}`;
 if(name===`DanceMoves-${pkg.version}-SHA256SUMS.txt`)return `SHA-256 checksums ${pkg.version}`;
 if(name.includes('-wordpress-')&&name.endsWith('-manifest.json'))return `WordPress manifest ${pkg.version}`;
 if(name.includes('-browser-')&&name.endsWith('-manifest.json'))return `Browser manifest ${pkg.version}`;
 return name;
}
for(const name of fs.readdirSync('release-output').filter(n=>n!=='build-package-lock.json').sort()){
 const file='release-output/'+name,bytes=fs.readFileSync(file),expected='sha256:'+createHash('sha256').update(bytes).digest('hex');
 const existing=release.assets.find(a=>a.name===name);
 if(existing){
  let actual=existing.digest;
  if(!actual){
   const response=await request(existing.url,{headers:{Accept:'application/octet-stream'}});
   if(!response.ok)throw new Error('Cannot verify existing asset '+name);
   actual='sha256:'+createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  }
  if(actual!==expected)throw new Error('Existing GitHub asset differs: '+name+'; use a new release version.');
  console.log('Keeping identical asset '+name);
  continue;
 }
 const uploadBase=release.upload_url.replace(/\{\?name,label\}$/,'');
 const response=await request(`${uploadBase}?name=${encodeURIComponent(name)}&label=${encodeURIComponent(assetLabel(name))}`,{
  method:'POST',
  headers:{Accept:'application/vnd.github+json','Content-Type':'application/octet-stream','Content-Length':String(bytes.length)},
  body:bytes
 });
 if(!response.ok)throw new Error(`Could not upload ${name} (${response.status}): ${await response.text()}`);
 release.assets.push(await response.json());
 console.log('Uploaded '+name);
}
const prerelease=pkg.version.includes('-');
const publish=await request(`${api}/releases/${release.id}`,{
 method:'PATCH',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({draft:false,prerelease,make_latest:prerelease?'false':'true'})
});
if(!publish.ok)throw new Error(`Could not publish release (${publish.status}): ${await publish.text()}`);
console.log(`Published GitHub release ${tag} with ${release.assets.length} verified attachment(s).`);
