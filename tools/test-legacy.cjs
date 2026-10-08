/* The original engine contracts remain release gates. Only dependency/build folders are excluded. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const ignored=new Set(['.git','node_modules','lib','.build','.next','dist','__pycache__']);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>ignored.has(e.name)?[]:e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit',cwd:root});if(result.error)throw result.error;if(result.status!==0)throw new Error(`Validation failed (${result.status}): ${command} ${args.join(' ')}`);}
run(process.execPath,['tools/check-shared-release.mjs']);
run(process.execPath,['tools/prepare-test-harnesses.cjs']);
const all=files(root).filter(p=>!p.split(path.sep).join('/').includes('/tests/fixtures/failing/'));
for(const p of all){if(p.endsWith('.php'))run('php',['-l',p]);else if(/\.(?:js|cjs|mjs)$/.test(p))run(process.execPath,['--check',p]);}
for(const name of fs.readdirSync('tests').filter(n=>n.endsWith('.test.cjs')).sort())run(process.execPath,['tests/'+name]);
for(const name of ['validate-clay-transform.php','validate-clay-legacy-collision.php','validate-epk-download-paths.php','rudiments-wordpress.php','wordpress-examples-configure.test.php','shared/wordpress-enqueue.php'])run('php',['tests/'+name]);
run('python',['-X','utf8','tools/validate-effect-harness.py','tests/harness/plugin-core','--mode','scaffold']);
for(const name of ['clay-stars','california-screamin','a-whole-new-christmas'])run('python',['-X','utf8','tools/validate-effect-harness.py',`tests/harness/${name}`,'--mode','scaffold','--manifest-file',`tests/harness/${name}/${name}.json`,'--shared-root','tests/harness/plugin-core','--candidate-file',`qa/${name}-unit-candidate.html`]);
for(const name of ['test-harness-candidate-selection.py','test-wordpress-examples.py','shared/test_package_outputs.py'])run('python',['-X','utf8','tests/'+name]);
for(const p of all.filter(p=>/\.(?:php|js|cjs|mjs|css|md|html|json|tsv|ps1|lrc)$/.test(p))){const data=fs.readFileSync(p);const text=new TextDecoder('utf-8',{fatal:true}).decode(data);if(text.includes('\0')||text.includes('\ufffd'))throw new Error('Invalid text encoding: '+p);}
console.log('Original DanceMoves engine, PHP, fixture, harness and encoding gates passed. Browser/device checks are separate.');
