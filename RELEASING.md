# Making a DanceMoves release

> **3.0 and later:** use [the coordinated release guide](docs/releasing-shared.md).
> `v*` tags now run the shared-library tests, build npm/minified-browser/WordPress
> distributions, and publish the verified artifacts. This requires a committed
> dependency lockfile and npm publisher setup. Do not manually rebuild or upload
> a second archive over the workflow output. The procedure below is retained as
> the **historical 2.x manual release procedure**, not the current default.

[README](README.md) · [WordPress examples](docs/wordpress-examples.md)

A version in PHP, a Git tag, a published GitHub release and an installed
WordPress plugin are four different states. This source has **2.9.0** in the
plugin header; the latest published release checked for this patch was **2.8.0**.
There is no release workflow in the inspected source tree which automatically
builds/uploads a new plugin merely because you push a tag. Use the checked-in
packager and publish the exact resulting artifacts deliberately.

## 1. Select the source and version

Use a complete checkout containing the integrated rudiments code. For the
current 2.9.0 candidate, do not start from the older `v2.8.0` tag and lose the
integration, and do not apply the old integration patch twice.

```powershell
git fetch origin --tags
git status --short
git log -1 --format="%H %s"
gh release list --repo kieransimkin/DanceMoves
git tag --list "v2.9.*"
```

Stop if intended work is uncommitted, the branch is not the candidate you mean
to release, or the version/tag already exists. Commit reviewed source changes
first. If 2.9.0 has not been released, this candidate can be its first release;
a documentation-only patch does not by itself require inventing 2.10.0.

For a genuinely new version after a published release, update the plugin header
and `DANCE_MOVES_VERSION` in `kieran-epk-device-orientation.php`, then update the
version-specific tests and the four cache keys in the private phone fixture.
Search for the old version and classify each occurrence: current identity/test
expectations need updating; historical reports and the paper adapter’s own
2.6.3 snapshot identity do not automatically become the new plugin version.
When the plugin version changes, refresh the current gallery version in
`examples/wordpress/features.json`, `shared/model.cjs` under that directory, and
the example static/browser version assertions; keep provenance commits historical.
The rudiments API version and upstream 0.1.3 pin are independent identities.
Do not blindly replace version text in historical reports or dependency manifests.

`docs/check-reference.cjs` belongs to its explicitly recorded earlier reference
baseline; do not weaken its byte checks to get a green result. Refresh that
source audit deliberately when maintaining it for a new runtime. The dedicated
rudiment verifier checks the current pinned native bundle independently.

## 2. Validate the candidate

Install the repository’s required Node, PHP and Python tooling. The normal
coordinator is Windows PowerShell; use its process-level execution-policy flag,
not a machine-wide policy change. It runs the checked-in syntax, Node/PHP,
encoding and harness checks, including newly added `*.test.cjs` files.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\validate.ps1 -Mode Unit
if ($LASTEXITCODE -ne 0) { throw "Unit validation failed; do not release" }

node .\tools\verify-rudiments.cjs
if ($LASTEXITCODE -ne 0) { throw "Native rudiment verification failed" }

php .\tests\wordpress-examples-configure.test.php
if ($LASTEXITCODE -ne 0) { throw "WP-CLI example boundary checks failed" }

python .\tests\test-wordpress-examples.py
if ($LASTEXITCODE -ne 0) { throw "Example HTTP contracts failed" }

python .\tools\prepare-wordpress-examples.py --stemlab-root ..\stemlab
if ($LASTEXITCODE -ne 0) { throw "Arcadians asset integrity/preparation failed" }

python .\tests\test-wordpress-examples-browser.py
if ($LASTEXITCODE -ne 0) { throw "Browser examples are failed or blocked" }
```

The browser runner needs Playwright and a working Chromium renderer. It records
its own limitations and does not establish real-phone sensor performance.
Perform attended Arcadians playback and the real-device/public-page gates in
`TEST-PLAN.md` and `RUDIMENTS-API.md` for the changed systems. A static coverage
pass, a simulated request or a native lookup-table test is not a substitute.

Unit validation now automatically runs `tools/prepare-test-harnesses.cjs` before
the Node tests. It builds two ignored `qa/*-unit-candidate.html` files offline:
California uses a clearly labelled synthetic adapter DOM; Clay uses the existing
hash-pinned `qa/prelive/clay-stars/canonical-live-2.3.2.html` snapshot. Their script
versions come from the current plugin header. Direct adapter-test invocations
prepare their own input too. Neither the private `Z:` drive nor a network fetch
is required for these unit inputs.

These are **unit inputs, not release-acceptance evidence**. The original full-page
manifest paths are unchanged and pre-live mode rejects the unit-only marker and
`--candidate-file` overrides. Continue to use verified full EPK payloads and
attended browser/device evidence for release acceptance. Do not run the old
California preview builder against an invented `Z:` directory or treat an offline
unit pass as a full-page performance pass. A missing tracked Clay snapshot or
changed snapshot hash is still a hard failure; restore the original from Git,
never repin it automatically. See [validation setup](docs/validation-setup.md).

Do not run `tools/stage-central-effects-migrations.js` as a generic release
command: it contains fixed local workspace paths and staging transformations.

## 3. Package the exact approved bytes

Package validation also regenerates the migration manifest and needs your
actual release-evidence root. Replace the example path below with its real
location; it is not a network share to create or a directory inferred by this patch.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\validate.ps1 -Mode Package -ReleasesRoot "C:\My Songs\Releases"
if ($LASTEXITCODE -ne 0) { throw "Package validation failed" }
```

For packaging alone, without rebuilding migration evidence:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\package.ps1
if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }
```

Packaging alone is not the full Package validation gate. The expected files for
this candidate are:

```text
dist/DanceMoves-2.9.0.zip
dist/DanceMoves-2.9.0-manifest.json
```

The ZIP root must be `kieran-epk-device-orientation/`, with its original PHP
entrypoint at that root. The packager includes the rudiments module, native
assets, licences and API documentation. It excludes `examples/`, `tests/`,
`tools/`, `qa/`, and `migration/`. Arcadians audio and the local simulated server
are development assets, never part of the WordPress plugin distribution.

Verify the ZIP against its manifest:

```powershell
$version = "2.9.0"
$zip = "dist/DanceMoves-$version.zip"
$manifestPath = "dist/DanceMoves-$version-manifest.json"
$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$hash = (Get-FileHash -Algorithm SHA256 $zip).Hash
if ($manifest.version -ne $version) { throw "Manifest version mismatch" }
if ($hash -ne $manifest.zip_sha256) { throw "ZIP hash mismatch" }
if (-not $manifest.root_entrypoint_present -or -not $manifest.forward_slash_entries) { throw "Invalid ZIP layout" }
$manifest.files | Select-Object path, bytes, sha256
```

Inspect the inventory. Keep the exact ZIP unchanged after approval; repackaging
can change the archive hash even when source text is unchanged. The manifest
records content identity; the packager does not promise byte-identical archives
across independently timed builds.

Review any generated migration diffs. The repository already tracks release
ZIPs/manifests; record the new pair deliberately, not with an indiscriminate
`git add .` that could include downloaded media, reports or old patch files:

```powershell
git add -- "dist/DanceMoves-$version.zip" "dist/DanceMoves-$version-manifest.json"
git commit -m "Record DanceMoves $version release artifacts"
if ($LASTEXITCODE -ne 0) { throw "Artifact commit failed" }
# Commit any separately reviewed migration/evidence changes deliberately.
git status --short
```

There must be no unintended or unreviewed source changes. Confirm that the
packaged asset hashes still match the source being tagged. Do not rebuild the
approved ZIP merely to attach it to the release.

## 4. Tag the tested commit and create a draft release

Write a release-notes file stating the source identity, changes, migration steps,
known limitations, exact package SHA-256 and which tests passed/failed/were blocked.
Do not say "deployed" unless the WordPress installation was separately verified.

```powershell
$version = "2.9.0"
$tag = "v$version"
$sha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve candidate commit" }
if (git status --porcelain) { throw "Working tree is not clean" }

git tag -a $tag $sha -m "DanceMoves $version"
if ($LASTEXITCODE -ne 0) { throw "Tag failed; inspect before proceeding" }
git push origin HEAD
if ($LASTEXITCODE -ne 0) { throw "Branch push failed" }
git push origin $tag
if ($LASTEXITCODE -ne 0) { throw "Tag push failed" }

gh release create $tag "dist/DanceMoves-$version.zip" "dist/DanceMoves-$version-manifest.json" --repo kieransimkin/DanceMoves --verify-tag --draft --title "DanceMoves $version" --notes-file release-notes.md
if ($LASTEXITCODE -ne 0) { throw "Draft creation failed; inspect before retrying" }
```

`--verify-tag` avoids accidentally creating a tag from a default branch.
Do not force-push, move or overwrite an existing published tag/asset to repair a
mistake. Correct it in a new version with a clear note. If you used the GitHub UI,
select the exact existing tag and attach the two built files before saving the draft.

## 5. Verify and publish

Inspect the draft, source tag and asset names, then download the draft’s assets
with your authenticated CLI into a fresh directory and compare their hashes.
The draft is private to authorised repository users until explicitly published.

```powershell
gh release view $tag --repo kieransimkin/DanceMoves
gh release download $tag --repo kieransimkin/DanceMoves --dir "release-check-$version" --pattern "DanceMoves-$version*"
$downloadHash = (Get-FileHash -Algorithm SHA256 "release-check-$version/DanceMoves-$version.zip").Hash
if ($downloadHash -ne $hash) { throw "Downloaded release asset is not the approved ZIP" }
```

Only after the required release gates and final review:

```powershell
gh release edit $tag --repo kieransimkin/DanceMoves --draft=false --latest
gh release view $tag --repo kieransimkin/DanceMoves
```

The UI equivalent is **Publish release** on the reviewed draft. Keep prereleases
labelled as such; do not mark a test candidate as a stable latest release just
because an upload succeeded. GitHub’s automatic "Source code" downloads are
repository snapshots, not the installable WordPress package.

## 6. Deploy WordPress separately

A GitHub release does not install itself. Preserve the current installed ZIP,
manifest and metadata before an approved deployment. In WordPress, upload the
exact packaged ZIP through Plugins → Add New → Upload Plugin and replace the
existing plugin with the same internal slug. Verify the installed header,
versioned public asset URLs and hashes, then inspect all affected EPKs signed out.
Check normal audio playback/ranges separately from attachment downloads, exact
cue landings, pause/resume/seek, lyrics/clears, native background fallback,
responsive layout, reduced motion, forced colours and physical orientation.

Publishing a plugin does not configure `_dance_moves_*` metadata on new Pages.
Use the [WordPress guide](docs/wordpress-examples.md), with each page’s own tempo,
media attachments and approved effect choices. Do not run demo metadata values
against a production Page merely to make a screenshot match.

Rollback means reinstalling the preserved previously approved plugin artifact and
restoring the relevant Page revision/metadata when necessary; do not hard-code
an ancient version as the universal rollback target. Never delete shared timing
attachments without checking the other pages that reference them.

## Primary command references

- [GitHub CLI: create release](https://cli.github.com/manual/gh_release_create)
- [GitHub CLI: edit/publish release](https://cli.github.com/manual/gh_release_edit)
- [Existing packager](tools/package.ps1)
- [Validation coordinator](tools/validate.ps1)
