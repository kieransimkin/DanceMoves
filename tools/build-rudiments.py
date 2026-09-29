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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cxx', default='g++', help='Host C++17 compiler, GCC/Clang command syntax')
    parser.add_argument('--clang', default='clang++', help='Clang with wasm32 target and wasm-ld')
    parser.add_argument('--check', action='store_true', help='Validate shipped native values; write no repository files')
    args = parser.parse_args()
    upstream = json.loads((VENDOR / 'UPSTREAM.json').read_text('utf-8'))
    for name, expected in upstream['files'].items():
        data = (VENDOR / name).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if actual != expected:
            raise SystemExit(f'Unreviewed upstream change: {name}; update pin deliberately, not automatically')
    with tempfile.TemporaryDirectory(prefix='dancemoves-rudiments-') as td:
        tmp = Path(td)
        exe = tmp / 'export.exe'
        run([args.cxx, '-std=c++17', '-O2', '-I', str(VENDOR / 'include'),
             str(VENDOR / 'src/dance_rudiments.cpp'), str(ROOT / 'tools/export-rudiment-samples.cpp'), '-o', str(exe)])
        catalogue = json.loads(run([str(exe)], stdout=subprocess.PIPE).stdout)
        if not catalogue or len(catalogue) > 256:
            raise SystemExit('Unsupported catalogue size')
        for row in catalogue:
            if not 1 <= row['periodPips'] <= 65535 or len(row['samples']) != row['periodPips']:
                raise SystemExit('Unsupported period')
        samples = tmp / 'samples.json'
        samples.write_text(json.dumps(catalogue, separators=(',', ':')), 'utf-8')
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
        cpp.write_text(source, 'utf-8')
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
        candidate.write_text('/* Generated C++/WASM sample bank. MIT: see LICENSE. No JS motion mirror. */\n'
                             'window.danceMovesRudimentsNative = ' + json.dumps(payload, separators=(',', ':')) + ';\n', 'utf-8')
        run(['node', str(ROOT / 'tools/check-rudiment-native.cjs'), str(candidate), str(samples)])
        OUT.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(candidate, destination)
        shutil.copyfile(VENDOR / 'LICENSE', OUT / 'LICENSE')
        manifest = {'schema': 'dance-moves-rudiments-build/v1', 'upstream': upstream,
                    'backend': 'complete-integer-domain-cpp-wasm-lookup', 'sampleCount': len(points),
                    'wasmSha256': sha(binary), 'runtimeSha256': sha(candidate.read_bytes()),
                    'lookupSourceSha256': sha(source.encode()),
                    'hostCompiler': run([args.cxx, '--version'], stdout=subprocess.PIPE).stdout.splitlines()[0],
                    'wasmCompiler': run([args.clang, '--version'], stdout=subprocess.PIPE).stdout.splitlines()[0]}
        (OUT / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', 'utf-8')
        print(f'Built {len(catalogue)} rudiments, {len(points)} native samples; WASM {len(binary)} bytes')


if __name__ == '__main__':
    main()
