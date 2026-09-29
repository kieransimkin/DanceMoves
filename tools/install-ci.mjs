/** CI permits a first pull-request bootstrap, but never an unlocked release. */
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const locked=fs.existsSync('package-lock.json');
if(process.env.REQUIRE_LOCK==='1'&&!locked)throw new Error('Run npm install --ignore-scripts and commit package-lock.json BEFORE tagging a release.');
const npm=process.platform==='win32'?'npm.cmd':'npm';
if(!locked)console.warn('BOOTSTRAP: no lockfile yet. This PR run is not a reproducible release build; commit the generated lockfile.');
const result=spawnSync(npm,[locked?'ci':'install','--ignore-scripts','--no-audit','--no-fund'],{stdio:'inherit',shell:process.platform==='win32'});
process.exitCode=result.status??1;
