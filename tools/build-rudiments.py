#!/usr/bin/env python3
"""Build DanceMoves' compact browser backend from the pinned DanceRudiments API."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor' / 'dancerudiments'
OUT = ROOT / 'assets' / 'vendor' / 'dancerudiments'


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, text=True, **kwargs)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_utf8(path: Path, text: str) -> None:
    path.write_bytes(text.encode('utf-8'))


def u32(value: int) -> bytes:
    result = bytearray()
    while True:
        byte = value & 0x7f
        value >>= 7
        result.append(byte | (0x80 if value else 0))
        if not value:
            return bytes(result)


def s32(value: int) -> bytes:
    result = bytearray()
    while True:
        byte = value & 0x7f
        value >>= 7
        done = (value == 0 and not byte & 0x40) or (value == -1 and byte & 0x40)
        result.append(byte | (0 if done else 0x80))
        if done:
            return bytes(result)


def vector(entries: list[bytes]) -> bytes:
    return u32(len(entries)) + b''.join(entries)


def section(section_id: int, payload: bytes) -> bytes:
    return bytes([section_id]) + u32(len(payload)) + payload


def wasm_name(value: str) -> bytes:
    encoded = value.encode('utf-8')
    return u32(len(encoded)) + encoded


def function_body(locals_payload: bytes, instructions: bytes) -> bytes:
    body = locals_payload + instructions + b'\x0b'
    return u32(len(body)) + body


def build_wasm(catalogue: list[dict]) -> bytes:
    """Generate the tiny lookup ABI directly; no platform compiler is required."""
    periods = [row['periodPips'] for row in catalogue]
    offsets, samples = [], []
    for row in catalogue:
        offsets.append(len(samples))
        samples.extend(row['samples'])

    periods_base = 0
    offsets_base = len(periods) * 4
    samples_base = (offsets_base + len(offsets) * 4 + 7) & ~7
    data = bytearray(samples_base)
    for index, value in enumerate(periods):
        struct.pack_into('<I', data, periods_base + index * 4, value)
    for index, value in enumerate(offsets):
        struct.pack_into('<I', data, offsets_base + index * 4, value)
    for point in samples:
        data.extend(struct.pack('<ddd', *point))

    i32 = b'\x7f'
    types = vector([
        b'\x60' + vector([]) + vector([i32]),
        b'\x60' + vector([i32]) + vector([i32]),
        b'\x60' + vector([i32, i32]) + vector([i32]),
    ])
    functions = vector([u32(0), u32(0), u32(1), u32(2)])
    pages = max(1, (len(data) + 65535) // 65536)
    memory = vector([b'\x01' + u32(pages) + u32(pages)])
    exports = vector([
        wasm_name('memory') + b'\x02' + u32(0),
        wasm_name('dr_abi') + b'\x00' + u32(0),
        wasm_name('dr_count') + b'\x00' + u32(1),
        wasm_name('dr_period') + b'\x00' + u32(2),
        wasm_name('dr_sample') + b'\x00' + u32(3),
    ])

    no_locals = vector([])
    abi = function_body(no_locals, b'\x41' + s32(2))
    count = function_body(no_locals, b'\x41' + s32(len(catalogue)))
    period = function_body(no_locals, b''.join([
        b'\x20\x00', b'\x41' + s32(len(catalogue)), b'\x49',
        b'\x04\x7f',
        b'\x20\x00', b'\x41' + s32(4), b'\x6c',
        b'\x28' + u32(2) + u32(periods_base),
        b'\x05', b'\x41\x00', b'\x0b',
    ]))
    two_i32_locals = vector([u32(2) + i32])
    sample = function_body(two_i32_locals, b''.join([
        b'\x20\x00', b'\x10\x02', b'\x21\x02',
        b'\x20\x02', b'\x45', b'\x04\x7f', b'\x41\x00', b'\x05',
        b'\x20\x01', b'\x20\x02', b'\x6f', b'\x21\x03',
        b'\x20\x03', b'\x41\x00', b'\x48', b'\x04\x40',
        b'\x20\x03', b'\x20\x02', b'\x6a', b'\x21\x03', b'\x0b',
        b'\x20\x00', b'\x41' + s32(4), b'\x6c',
        b'\x28' + u32(2) + u32(offsets_base),
        b'\x20\x03', b'\x6a', b'\x41' + s32(24), b'\x6c',
        b'\x41' + s32(samples_base), b'\x6a', b'\x0b',
    ]))
    code = vector([abi, count, period, sample])
    data_section = vector([b'\x00\x41\x00\x0b' + u32(len(data)) + bytes(data)])
    return b'\x00asm\x01\x00\x00\x00' + section(1, types) + section(3, functions) + \
        section(5, memory) + section(7, exports) + section(10, code) + section(11, data_section)


def package_lock(pin: dict) -> bytes:
    lock = json.loads((ROOT / 'package-lock.json').read_text('utf-8'))
    package_name = pin['package']
    locked = lock['packages']['node_modules/' + package_name]
    if locked.get('version') != pin['version'] or locked.get('integrity') != pin['integrity']:
        raise SystemExit('DanceRudiments package-lock provenance does not match UPSTREAM.json')

    package_root = ROOT / 'node_modules' / package_name
    installed = json.loads((package_root / 'package.json').read_text('utf-8'))
    if installed.get('name') != package_name or installed.get('version') != pin['version']:
        raise SystemExit('Installed DanceRudiments package does not match the pinned version')
    if installed.get('license') != pin['licenseExpression']:
        raise SystemExit('Installed DanceRudiments licence expression does not match the pin')

    licence = (package_root / 'LICENSE').read_bytes()
    if sha(licence) != pin['licenseSha256']:
        raise SystemExit('Installed DanceRudiments LICENSE does not match the pinned hash')
    return licence


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default='node', help='Node.js executable used for the official npm API')
    parser.add_argument('--check', action='store_true', help='Validate shipped native values; write no repository files')
    args = parser.parse_args()

    upstream = json.loads((VENDOR / 'UPSTREAM.json').read_text('utf-8'))
    licence = package_lock(upstream)
    exported = json.loads(run(
        [args.node, str(ROOT / 'tools/export-rudiment-samples.mjs')],
        stdout=subprocess.PIPE,
    ).stdout)
    catalogue = exported['selected']

    if exported['sourceCatalogueCount'] != upstream['sourceCatalogueCount']:
        raise SystemExit('DanceRudiments catalogue count does not match the pin')
    if [row['name'] for row in catalogue] != upstream['selection']:
        raise SystemExit('DanceMoves rudiment selection does not match UPSTREAM.json')
    if not catalogue or len(catalogue) > 256:
        raise SystemExit('Unsupported selected catalogue size')
    for row in catalogue:
        if not 1 <= row['periodPips'] <= 65535 or len(row['samples']) != row['periodPips']:
            raise SystemExit('Unsupported rudiment period')

    tmp = ROOT / '.build' / 'rudiments-work'
    tmp.mkdir(parents=True, exist_ok=True)
    samples = tmp / 'samples.json'
    write_utf8(samples, json.dumps(catalogue, separators=(',', ':')))
    destination = OUT / 'dancerudiments-native.js'
    if args.check:
        run([args.node, str(ROOT / 'tools/check-rudiment-native.cjs'), str(destination), str(samples)])
        return

    points = []
    for row in catalogue:
        points.extend(row['samples'])
    binary = build_wasm(catalogue)
    payload = {
        'schema': 2,
        'version': upstream['version'],
        'commit': upstream['commit'],
        'pipsPerBeat': upstream['pipsPerBeat'],
        'sourceCatalogueCount': exported['sourceCatalogueCount'],
        'package': upstream['package'],
        'wasmSha256': sha(binary),
        'catalogue': [{key: value for key, value in row.items() if key != 'samples'} for row in catalogue],
        'wasmBase64': base64.b64encode(binary).decode('ascii'),
    }
    candidate = tmp / 'dancerudiments-native.js'
    write_utf8(
        candidate,
        '/* Generated from the official DanceRudiments npm API. See LICENSE. No JS motion mirror. */\n'
        'window.danceMovesRudimentsNative = ' + json.dumps(payload, separators=(',', ':')) + ';\n',
    )
    run([args.node, str(ROOT / 'tools/check-rudiment-native.cjs'), str(candidate), str(samples)])

    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(candidate, destination)
    (OUT / 'LICENSE').write_bytes(licence)
    manifest = {
        'schema': 'dance-moves-rudiments-build/v2',
        'upstream': upstream,
        'backend': 'selected-official-npm-api-samples-wasm-lookup',
        'sourceCatalogueCount': exported['sourceCatalogueCount'],
        'selectedCount': len(catalogue),
        'sampleCount': len(points),
        'wasmSha256': sha(binary),
        'runtimeSha256': sha(candidate.read_bytes()),
        'wasmGenerator': 'tools/build-rudiments.py direct deterministic WebAssembly encoder',
    }
    write_utf8(OUT / 'build-manifest.json', json.dumps(manifest, indent=2) + '\n')
    print(
        f'Built {len(catalogue)} selected rudiments from '
        f'{exported["sourceCatalogueCount"]} upstream movements, '
        f'{len(points)} samples; WASM {len(binary)} bytes'
    )


if __name__ == '__main__':
    main()
