/** npm version lifecycle: update only current identities, never historical evidence. */
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
function update(relative,replace){const file=path.join(root,relative);const before=fs.readFileSync(file,'utf8'),after=replace(before);fs.writeFileSync(file,after);}
update('kieran-epk-device-orientation.php',s=>s.replace(/^(\s*\*\s*Version:\s*)\S+/m,'$1'+version).replace(/(define\('DANCE_MOVES_VERSION',\s*')[^']+('\))/,`$1${version}$2`));
update('tests/epk-motion-lab-4f8c8d11-6a28-4c7c-a2d9-31c56d49d73b.html',s=>s.replace(/(\?ver=)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g,'$1'+version));
update('examples/wordpress/features.json',s=>{const data=JSON.parse(s);data.pluginVersion=version;return JSON.stringify(data,null,2)+'\n';});
update('examples/wordpress/shared/model.cjs',s=>s.replace(/version:\s*['"]\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?['"]/,`version: '${version}'`));
console.log(`Synchronized current WordPress/demo identities to ${version}; commit these files and package-lock.json before tagging.`);
