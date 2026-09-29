#!/usr/bin/env python3
"""Copy or download hash-pinned StemLab Arcadians assets; never synthesize substitute audio."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def verify(path: Path, record: dict) -> None:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if path.stat().st_size != record['bytes'] or digest != record['sha256']:
        raise ValueError(f"Integrity mismatch for {record['name']}; refusing to use different audio/artwork")

def prepare(stemlab_root: Path | None = None) -> list[str]:
    folder = ROOT / 'examples/wordpress/media'
    manifest = json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    results = []
    for record in manifest['assets']:
        destination = folder/record['name']
        if destination.exists():
            verify(destination, record)
            results.append(f"Verified existing {record['name']}")
            continue
        with tempfile.NamedTemporaryFile(dir=folder, delete=False, suffix='.partial') as tmp:
            temporary = Path(tmp.name)
        try:
            if stemlab_root is not None:
                source = stemlab_root / record['sourcePath']
                if not source.is_file():
                    raise FileNotFoundError(f"Missing StemLab asset: {source}")
                shutil.copyfile(source, temporary)
            else:
                request = urllib.request.Request(record['url'], headers={'User-Agent':'DanceMoves-example-preparer/1'})
                with urllib.request.urlopen(request, timeout=45) as response, temporary.open('wb') as stream:
                    total = 0
                    while chunk := response.read(1024 * 1024):
                        total += len(chunk)
                        if total > record['bytes']:
                            raise ValueError('Downloaded asset is larger than its pinned manifest')
                        stream.write(chunk)
            verify(temporary, record)
            temporary.replace(destination)
            results.append(f"Prepared {record['name']} ({record['bytes']} bytes)")
        finally:
            temporary.unlink(missing_ok=True)
    return results

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stemlab-root', type=Path, help='Use a local StemLab checkout instead of downloading')
    args = parser.parse_args()
    try:
        for line in prepare(args.stemlab_root):
            print(line)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Arcadians preparation failed: {error}\nUse --stemlab-root with a checkout containing the pinned assets.\n')
    print('Ready: python tools/serve-wordpress-examples.py')

if __name__ == '__main__':
    main()
