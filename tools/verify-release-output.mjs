import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const dir='release-output';
const text=fs.readFileSync(path.join(dir,'SHA256SUMS.txt'),'utf8');let count=0;
for(const line of text.trim().split('\n')){const match=/^([a-f0-9]{64})  ([A-Za-z0-9@_.-]+)$/.exec(line);if(!match)throw new Error('Invalid checksum line');const data=fs.readFileSync(path.join(dir,match[2]));if(createHash('sha256').update(data).digest('hex')!==match[1])throw new Error('Release artifact changed: '+match[2]);count++;}
if(count!==5)throw new Error('Expected one npm tarball and four browser/WordPress artifacts');
console.log('All five release artifact digests match the tested build.');
