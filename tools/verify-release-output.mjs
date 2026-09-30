import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const dir='release-output',pkg=JSON.parse(fs.readFileSync('package.json','utf8')),version=pkg.version;
const expected=[`DanceMoves-npm-${version}.tgz`,`DanceMoves-wordpress-${version}.zip`,`DanceMoves-wordpress-${version}-manifest.json`,`DanceMoves-browser-${version}.zip`,`DanceMoves-browser-${version}-manifest.json`].sort();
const sums=`DanceMoves-${version}-SHA256SUMS.txt`,text=fs.readFileSync(path.join(dir,sums),'utf8');
const recorded=[];
for(const line of text.trim().split('\n')){const match=/^([a-f0-9]{64})  ([A-Za-z0-9@_.-]+)$/.exec(line);if(!match)throw new Error('Invalid checksum line');const data=fs.readFileSync(path.join(dir,match[2]));if(createHash('sha256').update(data).digest('hex')!==match[1])throw new Error('Release artifact changed: '+match[2]);recorded.push(match[2]);}
recorded.sort();if(JSON.stringify(recorded)!==JSON.stringify(expected))throw new Error(`Unexpected release artifact set: ${recorded.join(', ')}`);
console.log(`All five ${version} distribution artifacts match the tested build.`);
