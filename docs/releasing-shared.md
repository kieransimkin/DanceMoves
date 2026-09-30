# Shared builds, CI and npm/GitHub publication

The same repository now produces:

| Distribution | Output |
|---|---|
| npm | `@kieransimkin/dancemoves` tarball, with ESM, CJS, React/Node entrypoints, declarations and styles |
| Plain browser | `DanceMoves-browser-VERSION.zip` with minified `dancemoves.min.js`, styles and static assets |
| WordPress | `DanceMoves-wordpress-VERSION.zip` preserving `kieran-epk-device-orientation/` |

The current source candidate version is read from `package.json`; never hard-code
an earlier release name into a deployment instruction. Published tags and assets
must not be overwritten. Package publishing is not WordPress deployment.

## First checkout: dependency lock is required before a release

```sh
npm install --ignore-scripts
npm run build
npm test
npm run test:legacy
npm run demo:prepare
npx playwright-core install --with-deps chromium
npm run test:browser
npm run test:next
npm run test:next:smoke
```

Commit the generated **package-lock.json** with the reviewed source. This patch
pins direct development dependencies, but does not invent registry integrity
values without fetching them. CI can bootstrap an unlocked pull request so its
resolved lockfile is inspectable; **tag/release builds fail closed without a
committed lockfile**. From then on use `npm ci --ignore-scripts`.

The lockfile and compiler versions are part of the build input. Minified assets
are ignored/generated, not hand-maintained alongside canonical sources. Never
edit `lib/` or `.build/wordpress/` as a way to fix a source bug.

## Local independent builds

```sh
npm run build:library
npm run package:web
npm run package:wordpress
```

`build:library` creates shared outputs only. `build:wordpress` also stages the
WordPress adapter. `package:wordpress` builds/stages then uses the Python ZIP
packager; the retained `tools/package.ps1` delegates to that command. No private
`Z:` drive or migration-evidence directory is needed to build an archive.

`npm run build` builds all targets once. CI then packages the already-tested
staging tree, web files and npm package without rebuilding between artifacts.
Archives use sorted paths and fixed timestamps. WordPress output checks its
single-runtime invariant; every distribution has SHA-256 metadata.

For a local npm tarball after a successful build:

```sh
npm pack
```

Prepack checks the generated manifest against actual output bytes. Do not publish
a tarball from an earlier build under a newer source version.

## CI

`.github/workflows/ci.yml` runs on main pushes and pull requests. It builds/tests
on Ubuntu and Windows, with Node 22 and 24, PHP 8.3 and Python 3.12. Node/React
SSR tests, existing engine/PHP/harness tests, source integrity and packaging
checks remain gates. A browser job runs real Chromium/React and a production
Next build/route smoke test using canonical Arcadians assets.

Missing dependencies, source files, media or a blocked browser are failures, not
successful skipped tests. The CI workflows do not deploy the WordPress site.
Real Safari/phone measurements and application-specific accessibility checks
remain attended acceptance work.

## One-time npm setup

The workflow cannot register your npm account permissions through repository
source code. Before the first publication:

1. Ensure your npm account may publish public packages under `@kieransimkin`.
2. Create a GitHub environment named **npm**, optionally with required reviewers.
3. Register the package once if it does not exist. The release workflow supports
   a narrowly scoped, short-lived **NPM_BOOTSTRAP_TOKEN** environment secret for
   that first publish. Alternatively publish the exact tested CI tarball
   interactively; do not rebuild different bytes for the same version.
4. On npm package Settings → Trusted Publisher, configure **GitHub Actions**:
   owner `kieransimkin`, repository `DanceMoves`, filename `release.yml`,
   environment `npm`. Permit **direct `npm publish`**, not stage-only publication.
5. Remove the bootstrap token after trusted publishing works. Keep permissions
   and protection rules on release tags and the npm environment deliberate.

The job uses a GitHub-hosted runner, Node 24, npm 11.6.0 and `id-token: write`.
It publishes with provenance. New npm trusted publishers currently default to
stage publishing unless direct publishing is explicitly allowed; a stage-only
configuration will not make this direct-publish workflow succeed.

These requirements follow the official npm trusted-publishing documentation:
<https://docs.npmjs.com/trusted-publishers/>. npm requires at least CLI 11.5.1 and
Node 22.14 for this route. No package registration or publisher configuration is
claimed to have been performed by applying this patch.

## Release tags

After the migration, tests and setup are committed:

```sh
git status --short
npm run check:release
git tag -a vVERSION -m "DanceMoves VERSION"
git push origin HEAD
git push origin refs/tags/vVERSION
```

The release workflow triggers on `v*` tag pushes, also supports an existing
published GitHub release event, and has a manual retry input for an **existing**
tag. It verifies the tag, npm version, PHP header and runtime constant, then:

- runs build and release tests;
- creates the npm tarball, minified browser ZIP, WordPress ZIP, manifests and
  `SHA256SUMS.txt` from that tested build;
- uploads them as an Actions artifact;
- publishes the exact tarball to npm using the protected npm job;
- attaches the same artifacts to the GitHub release and publishes it.

A prerelease version such as `3.0.1-rc.1` uses npm's **next** dist-tag and a GitHub
prerelease. Stable versions use **latest**. A tag alone cannot bypass a failed
test or incomplete setup. The three products are generated even if a later npm
authorization step fails; retrieve the tested Actions artifact while fixing the
publisher setup.

Re-running a job is safe only for identical outputs. Existing npm versions are
compared using SHA-512 integrity; different bytes fail. Existing GitHub assets
are compared by SHA-256 and are never uploaded with `--clobber`. A registry
network/server error is not treated as proof that a version is absent. There
is intentionally no operation that moves an existing tag or overwrites a
published package version.

## Updating the next version

```sh
npm version 3.0.1 --no-git-tag-version
npm run build
npm test
npm run test:legacy
```

The version lifecycle synchronizes the PHP header/constant, current phone cache
keys and gallery version. Review and commit **all** resulting version changes,
including package-lock.json, before creating `v3.0.1`. Run browser/Next acceptance
again as appropriate to the changes. Native API/upstream dependency versions and
historical evidence are independent: do not globally replace their version text.

## Verify the result

On GitHub inspect the tag commit, build/test jobs, npm job, attached filenames and
checksums. Confirm the registry version and its provenance. For WordPress,
install the exact generated ZIP separately, retain rollback artifacts and check
public pages/caches. Publication does not set page metadata, migrate site data
or prove live rendering.
