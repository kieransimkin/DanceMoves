#!/usr/bin/env python3
"""Create the minified web distribution from the already tested library build."""
from pathlib import Path
import json,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[1]
def main():
    pkg=json.loads((ROOT/'package.json').read_text());version=pkg['version'];lib=ROOT/'lib'
    homepage=pkg.get('homepage','')
    files=[lib/'dancemoves.min.js',lib/'dancemoves.css',lib/'build-manifest.json',ROOT/'LICENSE']+sorted((lib/'assets').glob('*'))
    if any(not p.is_file() for p in files):raise SystemExit('Run npm run build:library first')
    manifest=json.loads((lib/'build-manifest.json').read_text('utf-8'))
    if manifest.get('version')!=version:raise SystemExit('Stale library version; rebuild')
    inventory={item['path']:item for item in manifest['files']}
    for p in files:
        if p.is_symlink():raise SystemExit('Symlinks are not accepted in web staging')
        if p.parent==ROOT or p.name=='build-manifest.json':continue
        name=p.relative_to(lib).as_posix();item=inventory.get(name);data=p.read_bytes()
        if not item or item['bytes']!=len(data) or item['sha256']!=hashlib.sha256(data).hexdigest():raise SystemExit('Changed web artifact: '+name)
    dist=ROOT/'dist';dist.mkdir(exist_ok=True);output=dist/f'DanceMoves-browser-{version}.zip'
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in files:
            name=p.relative_to(lib).as_posix() if p.is_relative_to(lib) else p.name
            info=zipfile.ZipInfo(f'dancemoves-{version}/'+name,(2020,1,1,0,0,0));info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
    manifest={'schema':'dancemoves-web/v1','version':version,'homepage':homepage,'zip':output.name,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
      'files':[{'path':p.relative_to(lib).as_posix() if p.is_relative_to(lib) else p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
    (dist/f'DanceMoves-browser-{version}-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n');print(output)
if __name__=='__main__':main()
