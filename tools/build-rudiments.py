#!/usr/bin/env python3
"""Rebuild the shipped exact-sample WASM backend. No network or Emscripten required.

Host C++17 compiler runs upstream functions over their ENTIRE periodic integer
input domain. Clang/wasm-ld compiles that data and the C++ lookup ABI to WASM.
JavaScript never implements a rudiment's movement function.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor' / 'dancerudiments'
OUT = ROOT / 'assets' / 'vendor' / 'dancerudiments'


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, text=True, **kwargs)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_hash(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


def pinned_text_bytes(data: bytes, expected: str, label: str) -> bytes:
    """Accept only exact upstream bytes or CRLF pairs that reconstruct that pin.

    Mirrors tools/rudiments-source-integrity.cjs; the regression tests exercise
    both implementations. BOMs, lone CR, whitespace and content remain significant.
    """
    if not isinstance(expected, str) or len(expected) != 40 or any(c not in '0123456789abcdef' for c in expected):
        raise ValueError(f'Missing or malformed upstream Git blob pin: {label}')
    raw_hash = git_blob_hash(data)
    if raw_hash == expected:
        return data
    canonical = data.replace(b'\r\n', b'\n')
    canonical_hash = git_blob_hash(canonical)
    if canonical_hash == expected:
        return canonical
    raise ValueError(f'Upstream source integrity mismatch: {label}; expected {expected}; '
                     f'raw {raw_hash}; CRLF-to-LF {canonical_hash}. '
                     'This is not solely a checkout line-ending difference. No files or pins were changed.')


def write_utf8(path: Path, text: str) -> None:
    # write_text(newline=None) would translate LF to CRLF on Windows.
    path.write_bytes(text.encode('utf-8'))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cxx', default='g++', help='Host C++17 compiler, GCC/Clang command syntax')
    parser.add_argument('--clang', default='clang++', help='Clang with wasm32 target and wasm-ld')
    parser.add_argument('--check', action='store_true', help='Validate shipped native values; write no repository files')
    args = parser.parse_args()
    upstream = json.loads((VENDOR / 'UPSTREAM.json').read_text('utf-8'))
    try:
        sources = {name: pinned_text_bytes((VENDOR / name).read_bytes(), expected, name)
                   for name, expected in upstream['files'].items()}
    except ValueError as error:
        raise SystemExit(str(error)) from error
    with tempfile.TemporaryDirectory(prefix='dancemoves-rudiments-') as td:
        tmp = Path(td)
        # Compile the verified canonical bytes, never rewrite the checkout.
        canonical_vendor = tmp / 'upstream'
        for name, data in sources.items():
            destination = canonical_vendor / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        exe = tmp / 'export.exe'
        run([args.cxx, '-std=c++17', '-O2', '-I', str(canonical_vendor / 'include'),
             str(canonical_vendor / 'src/dance_rudiments.cpp'), str(ROOT / 'tools/export-rudiment-samples.cpp'), '-o', str(exe)])
        catalogue = json.loads(run([str(exe)], stdout=subprocess.PIPE).stdout)
        if not catalogue or len(catalogue) > 256:
            raise SystemExit('Unsupported catalogue size')
        for row in catalogue:
            if not 1 <= row['periodPips'] <= 65535 or len(row['samples']) != row['periodPips']:
                raise SystemExit('Unsupported period')
        samples = tmp / 'samples.json'
        write_utf8(samples, json.dumps(catalogue, separators=(',', ':')))
        destination = OUT / 'dancerudiments-native.js'
        if args.check:
            run(['node', str(ROOT / 'tools/check-rudiment-native.cjs'), str(destination), str(samples)])
            return
        periods = ','.join(str(row['periodPips']) for row in catalogue)
        offsets, points = [], []
        for row in catalogue:
            offsets.append(len(points))
            points.extend(row['samples'])
        # Hexadecimal literals preserve every exported IEEE double on compilation.
        entries = ',\n'.join('{' + ','.join(float(x).hex() for x in point) + '}' for point in points)
        source = '''// Generated from the pinned DanceRudiments C++ samplers; DO NOT EDIT.
static const double samples[][3] = {\n%s\n};
static const int periods[] = {%s};
static const int offsets[] = {%s};
extern "C" {
int dr_abi() { return 1; }
int dr_count() { return %d; }
int dr_period(int id) { return id >= 0 && id < dr_count() ? periods[id] : 0; }
unsigned long dr_sample(int id, int pip) {
  const int period = dr_period(id);
  if (!period) return 0;
  int p = pip %% period;
  if (p < 0) p += period;
  return reinterpret_cast<unsigned long>(&samples[offsets[id] + p][0]);
}
}
''' % (entries, periods, ','.join(map(str, offsets)), len(catalogue))
        cpp = tmp / 'lookup.cpp'
        write_utf8(cpp, source)
        wasm = tmp / 'lookup.wasm'
        command = [args.clang, '--target=wasm32', '-std=c++17', '-O2', '-nostdlib',
                   '-fno-exceptions', '-fno-rtti', str(cpp), '-Wl,--no-entry', '-Wl,--export-memory',
                   '-Wl,--strip-all', '-Wl,--initial-memory=131072', '-Wl,--max-memory=131072']
        command += ['-Wl,--export=' + symbol for symbol in ['dr_abi', 'dr_count', 'dr_period', 'dr_sample']]
        run(command + ['-o', str(wasm)])
        binary = wasm.read_bytes()
        payload = {'schema': 1, 'version': upstream['version'], 'commit': upstream['commit'],
                   'pipsPerBeat': upstream['pipsPerBeat'], 'wasmSha256': sha(binary),
                   'catalogue': [{k: v for k, v in row.items() if k != 'samples'} for row in catalogue],
                   'wasmBase64': base64.b64encode(binary).decode('ascii')}
        candidate = tmp / 'dancerudiments-native.js'
        write_utf8(candidate, '/* Generated C++/WASM sample bank. MIT: see LICENSE. No JS motion mirror. */\n'
                             'window.danceMovesRudimentsNative = ' + json.dumps(payload, separators=(',', ':')) + ';\n')
        run(['node', str(ROOT / 'tools/check-rudiment-native.cjs'), str(candidate), str(samples)])
        OUT.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(candidate, destination)
        (OUT / 'LICENSE').write_bytes(sources['LICENSE'])
        manifest = {'schema': 'dance-moves-rudiments-build/v1', 'upstream': upstream,
                    'backend': 'complete-integer-domain-cpp-wasm-lookup', 'sampleCount': len(points),
                    'wasmSha256': sha(binary), 'runtimeSha256': sha(candidate.read_bytes()),
                    'lookupSourceSha256': sha(source.encode()),
                    'hostCompiler': run([args.cxx, '--version'], stdout=subprocess.PIPE).stdout.splitlines()[0],
                    'wasmCompiler': run([args.clang, '--version'], stdout=subprocess.PIPE).stdout.splitlines()[0]}
        write_utf8(OUT / 'build-manifest.json', json.dumps(manifest, indent=2) + '\n')
        print(f'Built {len(catalogue)} rudiments, {len(points)} native samples; WASM {len(binary)} bytes')


if __name__ == '__main__':
    main()
