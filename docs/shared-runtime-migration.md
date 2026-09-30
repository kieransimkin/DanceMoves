# DanceMoves 3: one source, three distributions

This records the historical 3.0.0 **source migration**, based on DanceMoves 2.9.0 commit
`3a6e67652a1bf6968b9ac0715ee5d5eff1e74c98`. Applying the patch does not publish
anything or change an installed WordPress site. The npm package name is
`@kieransimkin/dancemoves`; package registration and trusted publishing require
maintainer action before the first publication.

## Repository architecture

| Location | Responsibility |
|---|---|
| `assets/` | The single maintained implementation of the existing browser engines, CSS, editor frontend and native data. These are now shared-library source, not a second WordPress implementation. |
| `src/index.mjs`, `src/scope.mjs` | Explicit per-root mounting and ownership of browser resources. |
| `src/config.mjs` | Host-neutral metadata validation, WordPress metadata conversion and bounded revision-store abstraction. |
| `src/react.mjs` | Optional client-only React hooks, provider, rudiment component and metadata editor. |
| `src/server.mjs` | Node HTTP services for timing validation, signed MP3 attachments and private captures. |
| `src/wordpress.mjs`, `src/wordpress-config.mjs` | Thin adapter that imports the shared factory, reads WordPress's localized configuration and restores legacy globals. No animation implementation. |
| `kieran-epk-device-orientation.php`, `dance-moves-rudiments.php` | WordPress-native settings, media, metadata revisions, download/capture endpoints, page selection and enqueue aliases. |
| `tools/build-modules.mjs` | Deterministically compiles the existing engines into scoped ESM installer functions. No runtime eval, Function constructor, CDN or script injection. |
| `tools/build-shared.mjs` | Produces ESM/CommonJS, React/Node entrypoints, minified browser and WordPress library artifacts with esbuild. |
| `lib/` | Generated shared-library outputs; ignored by Git, included in npm. |
| `.build/wordpress/` | Separate WordPress staging tree; includes selected **byte-identical** `lib/` outputs, never raw engine sources. |

The compiler does not create a second definition of a movement, timing parser,
cue handler or adapter. It moves each canonical script's execution inside an
installer function and instruments resource ownership using a TypeScript AST.
The small checked source substitutions expose timing-file readiness and qualify
CSS owner identifiers. Unexpected source changes at those integration points
stop the build rather than silently emitting an incompatible wrapper.

Both distributions consume those same functions. The WordPress archive contains
`lib/wordpress.js` and `lib/admin.min.js` as its only JavaScript files; the former
bundles the shared module and its initialization adapter. It does **not** also
ship a second `assets/dance-moves-core.js`, a separate effect engine or separate
native-data script. Existing script handles are kept as WordPress dependency
aliases with `src=false`.

The native movement authority remains the pinned DanceRudiments 0.1.3 C++/WASM
sample bank. This patch does not import a newer atlas from a sibling checkout.
`tools/verify-rudiments.cjs` still checks its existing source, licence and native
hash contracts before building the library.

## Instance lifetime and compatibility

`createDanceMoves({root,...})` installs a runtime into one DOM subtree. Queries,
CSS timing properties, generated nodes and event dispatch are scoped to that
root. Separate, non-overlapping roots may use different BPMs and the same local
controller IDs. Overlapping mounts are rejected. Consumers must call `destroy()`
on route changes; the React hook does this automatically, including development
Strict Mode's setup/cleanup/remount cycle.

Mount-time listeners, timers, frames, observers, fetches and generated styles
are tracked. Disposal aborts outstanding internal fetches, suppresses late
promise callbacks, removes generated nodes and restores owned style/attribute
values when the host has not subsequently changed them. A retained destroyed
runtime is not a valid factory for more effects.

Consumer-owned callbacks that mutate other elements remain the consumer's
responsibility. Destroy your controllers and undo those writes in your effect
cleanup. The scope is resource ownership, not a security sandbox.

Normal JavaScript imports do not read or write browser globals. The WordPress
adapter deliberately enables `legacyGlobals`, preserving `window.DanceMoves`,
`window.KieranEpkMotion`, `window.DanceMovesEffects`, the native API and adapter
aliases for existing EPK page scripts. There should be only one legacy-global
mount per document. Do not run two copies of the WordPress bundle.

## Important boundaries

The new package includes JavaScript equivalents of the server features; it does
not run PHP in a browser or pretend a client-side object is a database. WordPress
continues using its own capabilities, nonces, Media Library, post metadata,
revision storage and private posts. Other applications provide authorization,
private persistence and production rate limiting to the Node APIs.

The browser API never contains the server download secret. Signed attachment
URLs are not a DRM/paywall: the ordinary playable MP3 remains a separate static
URL. Motion-capture client flags are reported observations, not server-attested
physical-device evidence.

Catalogue adoption is opt-in outside WordPress. In scoped mounts it adopts
computed durations and inline styles inside that root, without rewriting shared
stylesheet rules that other React roots may use. Legacy WordPress mode preserves
the existing global stylesheet-adoption behaviour. Both paths use the same
canonical catalogue implementation.

## WordPress migration

Build and install the new WordPress ZIP. Keep the existing plugin directory
`kieran-epk-device-orientation/` and its PHP entrypoint. No page IDs, timing
attachments or `_dance_moves_*` keys are renamed. The Clay legacy-plugin guard
and existing page-to-orientation mappings remain in PHP.

Scripts enqueued by handle continue to work. Hand-written URLs to old raw
`assets/*.js` files must be replaced with handle dependencies or the public npm
API. Raw source checkouts are not installable plugin ZIPs: build first. Cache
URLs now point into `lib/` and use the new plugin version.

For using a retained 2.9.x release, use that release's instructions; do not move
its published tag or replace its assets. The new release workflow is for tags
created after this migration is committed.

## Guides

- [JavaScript API](javascript-api.md)
- [React and Next.js](react-next.md)
- [Node services](javascript-server.md)
- [WordPress installation and metadata](wordpress-shared-runtime.md)
- [Builds, CI and publishing](releasing-shared.md)
- [Unchanged native API contract](../RUDIMENTS-API.md)
