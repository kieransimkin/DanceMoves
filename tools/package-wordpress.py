#!/usr/bin/env python3
"""Package the separately built WordPress adapter; no private release workspace."""
from pathlib import Path
import hashlib,json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
def digest(data):return hashlib.sha256(data).hexdigest().upper()
def main():
    pkg=json.loads((ROOT/'package.json').read_text('utf-8'))
    source=ROOT/'.build/wordpress'
    php=(source/'kieran-epk-device-orientation.php').read_text('utf-8')
    version=pkg['version']
    if not re.search(r'Version:\s*'+re.escape(version)+r'\s*\n',php):raise SystemExit('Built PHP/library versions differ; rebuild before packaging')
    if not re.search(r"define\('DANCE_MOVES_VERSION',\s*'"+re.escape(version)+r"'\)",php):raise SystemExit('Built runtime constant differs from package version')
    for name in ['kieran-epk-device-orientation.php','dance-moves-rudiments.php']:
        if (source/name).read_bytes()!=(ROOT/name).read_bytes():raise SystemExit('PHP changed after build: '+name)
    if any(p.is_symlink() for p in source.rglob('*')):raise SystemExit('Symlinks are not accepted in package staging')
    files=sorted(p for p in source.rglob('*') if p.is_file())
    expected=['lib/wordpress.js','lib/admin.min.js','dance-moves-rudiments.php','library-manifest.json']
    if any(not (source/p).is_file() for p in expected):raise SystemExit('WordPress build is incomplete')
    names=[p.relative_to(source).as_posix() for p in files]
    if any(any(part in {'node_modules','tests','examples','qa','tools','src','migration'} for part in Path(n).parts) for n in names):raise SystemExit('Development files entered the WordPress build')
    if sorted(n for n in names if n.endswith('.js'))!=['lib/admin.min.js','lib/wordpress.js']:raise SystemExit('Unexpected frontend copy in the WordPress build')
    library=json.loads((source/'library-manifest.json').read_text('utf-8'))
    if library.get('version')!=version or library.get('name')!=pkg['name']:raise SystemExit('WordPress library identity mismatch')
    actual_frontend={n.removeprefix('lib/') for n in names if n.startswith('lib/')}
    recorded_frontend={item['path'] for item in library.get('frontend',[])}
    if actual_frontend!=recorded_frontend or len(recorded_frontend)!=len(library['frontend']):raise SystemExit('WordPress frontend inventory mismatch')
    for item in library['frontend']:
        name=item['path'];data=(source/'lib'/name).read_bytes()
        if digest(data)!=item['sha256'].upper() or len(data)!=item['bytes']:raise SystemExit('WordPress frontend manifest mismatch: '+name)
        if data!=(ROOT/'lib'/name).read_bytes():raise SystemExit('WordPress frontend differs from the shared library artifact: '+name)
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    slug='kieran-epk-device-orientation';archive=dist/f'DanceMoves-wordpress-{version}.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p,n in zip(files,names):
            entry=zipfile.ZipInfo(slug+'/'+n,(2020,1,1,0,0,0));entry.external_attr=0o100644<<16;entry.compress_type=zipfile.ZIP_DEFLATED;z.writestr(entry,p.read_bytes())
    manifest={'schema':'dance-moves-package/v1','plugin_name':'DanceMoves','version':version,'homepage':pkg.get('homepage',''),'wordpress_upgrade_slug':slug,
      'zip':archive.name,'zip_bytes':archive.stat().st_size,'zip_sha256':digest(archive.read_bytes()),'entry_count':len(files),
      'root_entrypoint':slug+'/kieran-epk-device-orientation.php','root_entrypoint_present':True,'forward_slash_entries':True,
      'files':[{'path':slug+'/'+n,'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())} for p,n in zip(files,names)]}
    manifest_path=dist/f'DanceMoves-wordpress-{version}-manifest.json';manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(archive);print(manifest_path);print('SHA256='+manifest['zip_sha256'])
if __name__=='__main__':main()
