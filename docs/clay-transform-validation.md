# Clay/Stars transform validation on a clean checkout

## Offline Unit checks

From any normal DanceMoves clone, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\validate.ps1 -Mode Unit
if ($LASTEXITCODE -ne 0) { throw "Unit validation failed; do not release" }
```

`tests/validate-clay-transform.php` and `tests/validate-clay-legacy-collision.php`
now read [checked-in fixtures](../tests/fixtures/clay-transform/README.md), rather
than climbing three directories above the repository to infer a private
`Made from the clay and the stars` release folder. Both scripts load the actual
`kieran-epk-device-orientation.php` entrypoint and use mock WordPress context
functions. No production code or site data is changed.

The transform contract compares against a separately authored expected HTML file,
checks exact content preservation and idempotence, and exercises page, admin,
loop and query guards. The collision contract runs in its own PHP process with
the legacy plugin marker defined and checks that it blocks both insertions and
legacy-script removal. Missing or changed fixture files fail explicitly.

Both scripts are already called by the existing Unit coordinator.
`tests/clay-transform-fixtures.test.cjs` is automatically discovered with the
other `.test.cjs` tests. It relocates the minimal test inputs into a temporary
checkout, runs from an unrelated current directory, tests CRLF and disabled PHP
assertions, and deliberately breaks fixtures and production behavior to check
that failures are still detected. Temporary mutations never touch the checkout.

Focused commands:

```powershell
php .\tests\validate-clay-transform.php
if ($LASTEXITCODE -ne 0) { throw "Clay content transform failed" }
php .\tests\validate-clay-legacy-collision.php
if ($LASTEXITCODE -ne 0) { throw "Clay legacy coexistence failed" }
node .\tests\clay-transform-fixtures.test.cjs
if ($LASTEXITCODE -ne 0) { throw "PHP fixture regression checks failed" }
```

## Separate approved release-payload comparison

The old comparison against an approved full-page payload is retained as an
explicit additional mode, not silently skipped or claimed by synthetic tests:

```powershell
php .\tests\validate-clay-transform.php --base "C:\release-evidence\clay-base.html" --candidate "C:\release-evidence\clay-approved.html"
if ($LASTEXITCODE -ne 0) { throw "Supplied approved-payload comparison failed" }
```

Replace the two paths with your actual reviewed local files. Both options are
required. A missing file, unreadable file, unknown option, invalid UTF-8, or a
network URL fails. The checked-in synthetic unit fixtures are rejected in this
mode. The script does not establish who approved a supplied file; provenance and
approval remain the release owner's responsibility.

This mode first runs the offline contracts, then transforms the supplied base and
compares its bytes against the supplied candidate after removing only the former
`ks-clay-stars-warm-light-style` block (and its immediate line ending) and the
superseded `ks-clay-stars-v2-script` block. It also checks idempotence. Unlike the
checked-in fixture loader, this comparison does not normalize release-file line
endings; use a matching source/candidate pair. No expected output is generated or
rewritten. Exit 0 means all requested checks passed, 1 means a contract mismatch,
and 2 means invalid input or an execution/setup error.

## What a pass does not establish

Offline transform checks are not a browser render, real WordPress hook execution,
media playback, physical-device performance test or publication receipt. Keep the
existing pre-live harness and signed-out post-deployment checks. Package mode's
release-evidence requirements are separate and are not changed by this fix.

## California scaffold parameter groups

The later California scaffold check also requires `master`, `timing` and `effect`
parameter groups. Its manifest previously contained only the first two. It now
includes a read-only **Orientation target cadence** reference in the `effect`
group, matching the production `ksEpkOrientationConfig.transitionTargetTicks`
value (two ticks). This does not introduce an adjustable motion parameter or
change the runtime. A focused Node contract checks the reference against the PHP
configuration. Production asset hashes and the full-page acceptance rules remain
unchanged.
