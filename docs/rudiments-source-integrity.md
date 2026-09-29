# DanceRudiments source integrity and Windows line endings

The native source identity in `vendor/dancerudiments/UPSTREAM.json` is the
upstream **Git blob SHA-1**, not a SHA-256 file checksum. Generated JavaScript
and compiled WebAssembly are separately checked against SHA-256 values in
`assets/vendor/dancerudiments/build-manifest.json`.

## A clean Windows checkout reports a different header hash

The DanceRudiments 0.1.3 pinned LF header has Git blob ID
`6414362b2720262c8dd01630d7750b2501fd0c14`. Converting **only** its 47 LF line
endings to CRLF produces `2376c476651fe506e8a92c9e3786f4775c1e9b38`.
The file grows from 1,734 to 1,781 bytes; its C++ text is unchanged.

Git may convert unspecified text paths according to `core.autocrlf`.
The repository previously specified LF for JavaScript and other formats, but
not C++ headers, C++ sources or extensionless `LICENSE` files. Explicit LF
attributes now cover those paths, including both copies of the MIT licence.
See the [Git attributes reference](https://git-scm.com/docs/gitattributes).

Existing working files may remain CRLF after changing attributes. No reset,
reclone, global Git setting change, manual re-encoding or pin update is needed.

## Verification rules

`node tools/verify-rudiments.cjs` checks each pinned upstream text file as follows:

1. Accept its exact bytes when its Git blob ID matches the existing pin.
2. Otherwise replace only CRLF byte pairs with LF **in memory**, and accept the
   result only when that reconstructs the same existing Git blob ID.
3. Reject every other difference, with the filename, expected ID, raw ID and
   canonical ID in the error. Working files and pins are never changed.

There is no Unicode decoding/re-encoding, whitespace trimming, BOM stripping,
blank-line removal or conversion of lone CR characters. Mixed LF/CRLF is
accepted only when CRLF-to-LF reconstructs the exact pin. Both licence copies
must independently match the licence pin; two identically damaged copies do
not pass. This tolerance applies **only to pinned upstream source/licence
text**, not generated JavaScript, WASM bytes, or package-manifest checksums.

The verifier still checks manifest/pin agreement, byte-exact generated JS,
WASM hashes, no host imports, ABI, catalogue periods, bounded finite values,
negative wrapping, sample count and invalid IDs. No source hashes, native
samples, runtime code, plugin version or release artifacts change in this fix.

## Native rebuilding

`python tools/build-rudiments.py --check` uses the same pinned-text rule. It
compiles verified source bytes staged into a temporary directory, not modified
working-tree files. The normal rebuild writes explicit UTF-8 bytes so Windows
cannot translate generated JS or manifest line endings, and writes the verified
upstream licence bytes. The rebuild still requires the documented compiler(s);
ordinary validation needs none.

A normal rebuild may produce different compiler-dependent WASM bytes and
updates its generated manifest as before. Those changes need review; this fix
does not regenerate the shipped backend or claim cross-compiler byte identity.

## Regression checks

```powershell
node .\tools\verify-rudiments.cjs
node .\tests\rudiments-line-endings.test.cjs
```

The regression suite uses temporary copies, reproduces the reported hashes,
checks the actual verifier and source-ownership test under LF and CRLF,
rejects substantive source/licence edits and JS/WASM tampering, verifies a
local Git checkout with `core.autocrlf=true`, and runs the Python builder's
matching tests. The existing Unit runner discovers the new `.test.cjs` file.
It requires Git and Python as well as Node, but no C++ compiler and no network.

An independently runnable Python check is:

```powershell
python -X utf8 .\tests\test-rudiments-line-endings.py
```

After the targeted checks, rerun the repository's complete Unit gate. A source
integrity pass is not a browser, WordPress deployment or release approval.
