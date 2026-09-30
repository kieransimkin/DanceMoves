/** Assemble the three distributables from one build without rebuilding between outputs. */
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),out='release-output';
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'&&command.endsWith('.cmd')});if(result.status!==0)throw new Error(`Failed: ${command} ${args.join(' ')}`);}
run(process.execPath,['tools/check-shared-release.mjs']);run(process.execPath,['tools/check-shared-build.mjs']);
run('python',['tools/package-wordpress.py']);run('python',['tools/package-web.py']);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
run(process.platform==='win32'?'npm.cmd':'npm',['pack','--ignore-scripts','--pack-destination',out]);
const packed=fs.readdirSync(out).filter(name=>name.endsWith('.tgz'));
if(packed.length!==1)throw new Error('Expected exactly one npm pack output');
const npmName=`DanceMoves-npm-${pkg.version}.tgz`;
fs.renameSync(path.join(out,packed[0]),path.join(out,npmName));
for(const file of [`DanceMoves-wordpress-${pkg.version}.zip`,`DanceMoves-wordpress-${pkg.version}-manifest.json`,`DanceMoves-browser-${pkg.version}.zip`,`DanceMoves-browser-${pkg.version}-manifest.json`])fs.copyFileSync(path.join('dist',file),path.join(out,file));
const inventory=fs.readdirSync(out).sort().map(name=>({name,sha256:createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')}));
const sums=`DanceMoves-${pkg.version}-SHA256SUMS.txt`;
fs.writeFileSync(path.join(out,sums),inventory.map(f=>`${f.sha256}  ${f.name}`).join('\n')+'\n');
fs.copyFileSync('package-lock.json',path.join(out,'build-package-lock.json'));
console.log(`Release outputs prepared for ${pkg.version}`);
