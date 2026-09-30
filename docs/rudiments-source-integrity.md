# DanceRudiments package integrity and selected builds

DanceMoves pins `@kieransimkin/dance-rudiments` 0.2.0 in `package-lock.json` and
records its release commit, npm integrity, licence expression, licence SHA-256,
upstream catalogue count and selected movement names in
`vendor/dancerudiments/UPSTREAM.json`.

## Verification rules

`node tools/verify-rudiments.cjs` checks:

1. the installed package version and licence expression;
2. the lockfile version and npm integrity;
3. the package and shipped licence hashes;
4. exact agreement between the pin and generated build manifest;
5. generated JavaScript and WASM SHA-256 values;
6. the import-free ABI, periods, finite coordinates, negative wrapping and
   complete sample count; and
7. that the generated catalogue is exactly the reviewed selection, in order.

The build never fetches a moving branch. `npm ci` restores the exact package
from the lockfile; the builder rejects any mismatch before generating output.

## Why the browser bundle is selected

DanceRudiments 0.2.0 exposes 1,731 movements and its complete upstream WASM is
about 25 MB. DanceMoves does not send that full catalogue to every WordPress
page. `tools/export-rudiment-samples.mjs` binds the official native API, verifies
the complete catalogue count, then exports every pip only for the 15 names in
the `selection` allow-list.

`tools/build-rudiments.py` encodes those exact samples into a deterministic,
import-free lookup WASM. The current selected module is about 45 KB. JavaScript
does not reproduce movement formulae. A movement is added only when a reviewed
DanceMoves consumer needs it, followed by source, browser and regression QA.

## Native rebuilding

```powershell
python -X utf8 .\tools\build-rudiments.py
python -X utf8 .\tools\build-rudiments.py --check
node .\tools\verify-rudiments.cjs
```

The build needs Node, Python and the pinned installed npm package; it does not
need a C++ compiler. Work files stay under ignored `.build/rudiments-work`.
This avoids Python 3.14 `TemporaryDirectory` creating an unreadable `0o700`
directory on some mapped Windows drives. If the observable symptom is
`PermissionError` beneath a generated temporary directory, use the fixed
workspace rather than changing project-drive permissions. The Python
`tempfile` documentation confirms that `dir` controls placement and that
Windows cleanup can surface `PermissionError` when directory access is
incompatible.

## Review boundary

A package-integrity pass proves the checked source inputs and generated lookup
agree. It is not browser rendering, WordPress deployment, device performance or
release approval. Run the complete DanceMoves suites and Clay browser fixture,
then use the repository release workflow to create publishable artifacts.
