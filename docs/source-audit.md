# Documentation source audit

[Documentation index](README.md) · [Machine-readable inventory](api/surface.json)

## Baseline and scope

This documentation describes **DanceMoves 2.8.0**, release tag `v2.8.0` at
`4cb6a71f60459b5579be87d7e55ac8b1426c578e`, whose commit message is
“Add shared cue timeline transport recovery” (28 September 2026). GitHub's latest
published release was rechecked on 29 September 2026. The default branch `main`
is not the current release baseline: it still points to 2.4.0.

The staging branch `timed-lyrics-staging-2026-09-20` at
`c95f24f326a5f5334e4fe63c1e705ec13b1d59d6` is one commit ahead. The comparison
changes only `migration/dance-moves-2.8.0-cue-timeline-staging-2026-09-28.md`
(publication evidence); no runtime or README delta is being silently omitted.
This reference and patch target the release and also match that staging revision.
No 2.9 feature is inferred from a recollection or an unverified local workspace.

The published release asset lists ZIP SHA-256
`599d6e377f142d8b56dfb735df96122993fb8ce1015fe582533f21e408f30e48`.
That is provenance from the release metadata, not a claim that this documentation
review independently downloaded/deployed that ZIP or verified a live WordPress
installation. This patch changes documentation only and supersedes the earlier
2.4.0 documentation patch rather than layering on top of it.

The reference covers the public timing object and alias, conditional catalogue
additions, orientation helper exports and diagnostic lifecycle handle, Clay/Stars
adapter, paper-plane API, all five shared effect factories and their returned
handles, all entrypoint PHP functions, metadata, registered hooks, enqueued
handles, signed-download HTTP API, REST capture, timing formats, events, CSS/DOM state and development
workflow. It does not promote internal local functions or test-only globals into
supported page APIs.

[api/surface.json](api/surface.json) records the reviewed source blob IDs and
export/function inventory, so the next documentation update can compare actual
exports rather than relying on release prose. A symbol appearing in that
inventory means it was documented; it is not an assertion that every code path
has an automated or physical-device test.

## Source-to-reference map

| Source | Reference coverage |
| --- | --- |
| [Plugin entrypoint](../kieran-epk-device-orientation.php) | [WordPress/PHP/REST](api/wordpress.md): constants, all PHP functions, metadata schemas and sanitisation, editor validation, capture permission/payload/errors, asset loading and legacy collision. |
| [Shared effects](../assets/dance-moves-effects.js) | [Effects API](api/effects.md): all factories, registry methods, return handles, options, payloads, restoration, accessibility and quality rules. |
| [Paper-plane JS](../assets/paper-dreams-flight.js), [CSS](../assets/paper-dreams-flight.css) | [Paper-plane API](api/paper-planes.md): metadata gate, config, DOM requirements, methods, snapshot, physics/clock distinction and lifecycle. |
| [Download helpers in PHP](../kieran-epk-device-orientation.php) | [Downloads](api/downloads.md): all eight functions, query vars, filtering scope, HMAC, GET/HEAD, headers, errors and security limits. |
| [Timing core](../assets/dance-moves-core.js) | [JavaScript](api/javascript.md): properties, all exported methods, types, clocks, scheduling, parsing, audio selection, ownership, events, diagnostics and limitations. |
| [Catalogue adopter](../assets/dance-moves-catalogue-timing.js) | [Adapters](api/adapters.md): conditional methods/aliases, root selection, conversion evidence and observer/ownership boundaries. |
| [Orientation core](../assets/ks-epk-device-orientation-core.js) | [Adapters](api/adapters.md): every exported helper, factory options, returned methods and snapshot/detail fields. |
| [Orientation runtime](../assets/ks-epk-device-orientation.js) | [Adapters](api/adapters.md): all nine page adapters, configuration, permission and lifecycle behavior; [styling](api/styling.md): state and release-local outputs. |
| [Clay/Stars runtime](../assets/clay-stars-effects.js) | [Adapters](api/adapters.md): parameters, methods, complete snapshot, lifecycle, adaptive performance configuration and recovery. |
| [Core CSS](../assets/dance-moves-core.css), [orientation CSS](../assets/ks-epk-device-orientation.css), [Clay/Stars CSS](../assets/clay-stars-effects.css) | [Styling](api/styling.md): timed variables, declarative starts, lyric structure, shared transitions, output attributes, performance/reduced-motion/forced-colours treatments. |
| [Admin selector](../assets/dance-moves-admin.js) | [Guide](guide.md) and [WordPress](api/wordpress.md): selection/clear UI, filename extension check and the stronger server-side save validation. |
| [Unit/package coordinator](../tools/validate.ps1), [packager](../tools/package.ps1) | [Development](development.md): exact invocation, side effects, package allowlist and warning-vs-gate distinction. |
| [Tests](../tests/) and [test plan](../TEST-PLAN.md) | [Development](development.md): focused contracts, planned versus implemented checks, acceptance evidence and physical-device limitations. |

## Corrections and details that matter to integrations

| Previous ambiguity or easy assumption | Source-accurate contract in this reference |
| --- | --- |
| Performance quality only steps down, using fixed 45/50 FPS cutoffs | The current runtime can recover, uses session-observed cadence-relative thresholds and defaults to three poor windows. In Clay/Stars, legacy fixed-FPS fields are read but no longer drive decisions; the generic quality primitive is a different algorithm. |
| The latest plugin must be whatever `main` says | Releases/tags establish 2.8.0; staging differs only in publication evidence. |
| Every lyric preview means the next LRC entry | `next*` includes blank clears; `nextVisible*` skips them. Both have timestamps and sentinel values. |
| Core and shared timelines use identical seek rules | Core queues one nearby cue by default; timeline landing callbacks are opt-in and not queued while paused. |
| A timeline snapshot `fired` list is an execution log | It also contains past cues marked consumed on rebuild; `active` holds half-open interval IDs. |
| All motion uses one scheduling model | Page scheduling can invoke synchronously at an immediate boundary; audio scheduling waits for playback. Interval subscriptions and duration quantisation use different tick rounding rules. |
| `currentTick({clock:"audio"})` freezes while paused | Without usable playing audio, it returns the page clock. Playback-bound schedulers separately wait for playback. |
| A file called `.cue` accepts standard CD cuesheets | The plugin consumes bracketed LRC-style timestamped labels, not `TRACK`/`INDEX` syntax. |
| Upload validation, editor selection and REST updates are equivalent | Upload checks are limited, editor selection validates file content/order, and REST attachment metadata only sanitises the ID. Trusted integrations must explicitly use the full attachment validator. |
| Pop-up opt-in makes lyrics into a generic design preset | The component is neutral and visual-only. A release-specific treatment and accessible full lyric section are required. |
| `onLyric()` reports every playback state | It reports indexed lyric changes/re-indexing. Pause/end hide the built-in layer but do not emit an empty lyric event. |
| No layer can exist without valid lyrics | Initial creation checks the entry list, but a later bound-audio tick can create an empty idle layer when pop-ups are enabled. Layer existence is not successful-load evidence. |
| Lyric overrides belong under `.ks-epk` | The renderer appends the layer to `body`, outside the EPK root. Override the component using a release-specific ancestor/page selector. |
| Cue callbacks contain all parser fields | The dispatched cue detail omits `normalisedLabel`, although parsed cue entries include it. |
| Repeating intervals are fully seek-aware | Forward jumps skip old boundaries; backward seeks can retain the old boundary. Remove/re-register where immediate rebasing is needed. |
| All matching audio players share one independent clock per effect | Cue/lyric detection binds per player, but interval helpers follow the latest active player and the visual lyric layer is shared. Avoid simultaneous playback. |
| `discoverAudio()` supplies automatic dynamic observation | It is an explicit discovery pass; call it after inserting new audio. Existing bound elements are not fully revalidated when their source changes. |
| Catalogue ownership is a complete CSS isolation boundary | Selectors and referenced variable definitions can also match outside the release. Broad/mixed selectors still require an ownership review. |
| Every orientation transition is compositor-only | The existing Light Will Win hero transitions `background-position`; device performance remains an empirical acceptance check. |
| All public JavaScript has a global destroy/reconfigure API | The core has no global destroy or dynamic BPM setter. Each registration owns its remover, and some adapter teardowns leave CSS or registered scopes. |
| Motion capture is authenticated by a private deployment secret | The legacy capture token is fixed in public source, with no user-capability check on that route. Origin checking is conditional on a supplied origin. Treat it as a restricted legacy diagnostic interface, not a strong authentication design. |
| Unit success means every EPK has passed pre-live validation | The California full-page scaffold failure is a warning in the current coordinator. Browser, release and physical-device evidence remain separate gates. |
| Shared quality equals the Clay performance adapter | Different sample metrics, limits, cooldowns and preference-initialization behaviour are explicitly documented. |
| Signed MP3 URLs authenticate individual users or expire | They sign a path with the WordPress auth salt; they are shareable, non-expiring and do not make source media private. |
| Paper planes are fully beat-quantized and audio-seekable | Page-clock ambient phase and frame-delta physical simulation are different from cue-timeline playback. |
| A paper snapshot version is the plugin version | Adapter snapshot is 2.6.3 inside DanceMoves 2.8.0. |
| Paper static mode guarantees three visible reduced-motion sprites | Final reduced-motion CSS hides all planes. Forced colours hides the stage without itself stopping JS. |
| A docs directory will automatically be included in the plugin ZIP | The packager includes only the PHP entrypoint, root README and assets. This patch keeps full reference docs in the source repository and leaves packaging unchanged. |

These are documentation corrections or exposed implementation constraints, not
runtime fixes. The patch does not change authentication, parser validation,
scheduler semantics, CSS ownership, tests, release assets or packaging code.
Security or lifecycle changes should be reviewed and tested separately rather
than silently described as already implemented.

## Maintaining the reference

On a later source update, compare the core object literal, catalogue additions,
orientation factory exports, shared effects and returned handles, paper-plane and
Clay/Stars object literals, PHP function declarations,
metadata registration, route registration, configuration reads, event dispatches
and generated CSS/DOM state against `surface.json`. Update examples, defaults,
return types, failure behavior and cleanup semantics together.

Run documentation link/encoding/example checks and the repository's unit
coordinator in a suitable checkout. Verify any changed examples against the
actual runtime. Mark physical/browser/WordPress checks as `NOT RUN` until they
have been performed against the exact candidate. Preserve dated QA evidence;
do not rewrite old results to imply a new build was tested.

## Troubleshooting cleanup

The root README now keeps current, actionable integration checks. The duplicate
early incident section, long one-off error diary and dated performance incident
register were removed, not relocated into a new archive document. Current API
limitations, performance guidance and publication gates remain documented.
The original complete 89,530-byte README was materialized from GitHub and verified
against blob `5b58348ff8f1a2b7ace30c3e8cae389dc7061c62` before generating the patch.
