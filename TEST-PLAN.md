# DanceMoves test and EPK publication gates

## Purpose

This document defines two independent gates:

1. **Plugin release gate** — proves the shared DanceMoves package, timing engine, input runtime and release adapters are safe to deploy.
2. **EPK pre-live gate** — proves one exact staged EPK candidate preserves the canonical live page and works with the approved plugin package.

Passing the plugin gate does not approve any EPK for publication. Passing an EPK gate does not approve a different page, payload or plugin hash.

Use `PASS`, `FAIL`, `BLOCKED` and `NOT RUN`. Only `PASS` satisfies a required check. Every result must name the tested artifact hash, environment, viewport or device, time and evidence path.

## Current baseline and migration delta

On 2026-08-31 all seven existing Node contract files passed:

- `capture-duration.test.cjs`
- `core.test.cjs`
- `dance-moves-core.test.cjs`
- `dance-moves-wordpress-contract.test.cjs`
- `mobile-api-contract.test.cjs`
- `runtime.test.cjs`
- `wordpress-upload-contract.test.cjs`

Those tests cover core orientation maths, rolling-window mapping, simulated event shape, timing quantisation, cue parsing, animation ownership, WordPress metadata/security contracts, capture duration/decimation and upload limits.

They are not yet the acceptance suite for the new low-latency design:

- `runtime.test.cjs` currently requires a 30 ms visual rate limit and batching metadata.
- `wordpress-upload-contract.test.cjs` currently requires a `background-position` transition.
- `README.md` names `tools/validate.ps1`, but that coordinator is not present in the current plugin folder.

The new suite must replace those two legacy performance expectations with one-pending-`requestAnimationFrame` coalescing and compositor-only movement. It must also add a real validator that produces one combined result and exits non-zero on any required failure.

## Gate A — plugin release

### A1. Static, package and WordPress contract tests

| ID | Test | Pass condition | Automation |
|---|---|---|---|
| P-001 | Syntax and encoding | PHP lint and JavaScript syntax pass; every source is strict UTF-8; no `U+FFFD`, nulls, confirmed mojibake or broken CSS escapes | Required automated |
| P-002 | Package contents | ZIP has one expected plugin root, no masters, credentials, reports, test captures or unrelated files; extracted files hash-match the staged source | Required automated |
| P-003 | Deterministic identity | Version, plugin header, enqueue versions and package manifest agree; rebuilding unchanged source produces the same file inventory and content hashes | Required automated |
| P-004 | WordPress save security | Capabilities, nonce verification, autosave/revision handling, sanitisation and attachment ownership/type checks all pass | Required automated |
| P-005 | Timing-file safety | Strict UTF-8, 1 MiB limit, monotonic timestamps and permitted extensions/MIME pass; null, replacement, malformed and executable-looking cue text is rejected or treated only as data | Required automated |
| P-006 | Secret and privacy scan | No deploy credential or reusable secret appears in browser assets, HTML fixtures, ZIP listings or client configuration; capture data is bounded, sanitised and private | Required automated plus review |
| P-007 | Upgrade and rollback shape | Package upgrades the intended existing plugin rather than creating a parallel installation; preserved rollback ZIP and hash are recorded | Required staged WordPress |

### A2. Musical clock and cue-engine tests

| ID | Test | Pass condition | Automation |
|---|---|---|---|
| P-010 | Tick formula | For representative BPM values 20, 116, 120 and 400, one tick is exactly `3750 / BPM` milliseconds; 16 ticks equal one beat and 64 equal one 4/4 bar | Required automated |
| P-011 | Quantisation boundaries | `1.4→1`, `1.5→2`, `16→16`, `17→16`, `24→32`, `108→112`, `396→400`, `552→560`; invalid/negative/non-finite input uses the documented safe behaviour | Required automated |
| P-012 | BPM provenance | Explicit BPM is used and labelled explicit; blank/invalid BPM uses 120 only as a labelled fallback and never changes an evidence record to “verified” | Required automated |
| P-013 | CSS/JS duration parity | Every owned animation, transition, delay and cleanup timeout resolves from the same tick count; no visual millisecond/second literal bypasses the clock | Required automated and computed-style browser check |
| P-014 | Cue parsing | LRC/CUE tags, multiple timestamps, fractional seconds, duplicate times, whitespace and normalised names parse predictably; malformed or non-monotonic files fail closed | Required automated |
| P-015 | Cue crossing | Forward playback fires each crossed cue once; `timeupdate` plus rAF cannot double-fire; pause does not advance cues | Required automated browser/runtime |
| P-016 | Seek, loop and rate changes | Forward seek does not replay skipped cues; backward seek and loop correctly re-index; playback-rate changes are reflected in owned animation playback without changing musical position | Required automated browser/runtime |
| P-017 | Audio ownership | Only an audio element matching the canonical master-duration tolerance drives cues; wrong-duration players and decorative audio are ignored | Required automated browser/runtime |
| P-018 | Handler isolation | Named, wildcard and custom-event paths agree; unsubscribe works; one handler error cannot stop other handlers or player controls | Required automated |
| P-019 | Animation ownership | Only running/pending animations in registered DanceMoves scopes reset; WordPress, browser, player-control and third-party animations remain untouched | Required automated browser/runtime |
| P-019a | Deferred start | Declarative and programmatic starts wait for the requested tick boundary; 16 aligns to the next beat and 64 to the next 4/4 bar | Required automated browser/runtime |
| P-019b | Interval handlers | `onNextInterval` fires once; `onEveryInterval` fires at each boundary while the master audio plays, pauses with it, stops at song end, and its returned remover cancels future calls | Required automated browser/runtime |

### A3. Orientation input and frame scheduler tests

| ID | Test | Pass condition | Automation |
|---|---|---|---|
| P-020 | Availability and permission | Insecure context and unsupported device fail closed; iOS permission is requested only from a user gesture; denial leaves the EPK fully usable | Required automated plus physical device |
| P-021 | Finite input and axes | Null, missing, `NaN` and infinite samples are ignored; beta/gamma and screen-orientation changes map consistently in portrait and both landscapes | Required automated |
| P-022 | Rolling normalisation | The documented 10-second rolling window expires old extrema, respects the minimum span and maps/clamps output to `[-1,+1]` without division spikes | Required automated |
| P-023 | Latest-sample coalescing | A burst of 240 synthetic sensor events before one display frame schedules exactly one pending rAF and commits the final valid sample, not an average or stale sample | Required automated |
| P-024 | At-most-one visual commit | The sensor listener only validates/stores data and requests a frame; DOM writes never exceed rAF callbacks and are zero while no new valid sample is pending | Required automated instrumentation |
| P-025 | Hot-path layout safety | No `getBoundingClientRect`, computed-style, `offset*`, `scroll*` or other layout read occurs in the sensor callback or visual commit | Required static plus instrumented browser |
| P-026 | Bounded outputs | Every adapter clamps all translations, rotations, scales, light positions and opacity values to its documented range under extreme and rapidly alternating input | Required property/fuzz test |
| P-027 | Lifecycle reset | `visibilitychange`, page hide, orientation change, reduced-motion change and adapter removal cancel pending work, clear stale samples and restore neutral styles | Required automated browser/runtime |
| P-028 | Multiple instances | Reinitialisation, page-cache restore and repeated content transforms create one listener set, one control and one decorative layer; teardown removes all owned listeners | Required automated browser/runtime |

### Performance telemetry contract

Every synthetic run, browser trace and physical-device run must use the same low-overhead instrumentation contract. Instrumentation is a test/debug build feature and must be disabled in the ordinary public build.

Record these spans with `performance.now()` on one shared timeline:

- raw `deviceorientation` handler entry/exit, including validation, normalisation and scheduling;
- every scheduled rAF ID, callback entry/exit and visual commit;
- cue detection/re-index time;
- owned-animation reset time;
- total cue dispatch time;
- each EPK-specific named/wildcard cue handler entry/exit, labelled by page, cue name/type and handler ID; and
- any synchronous custom-event listener time attributable to the cue dispatch.

For each span type record count, total time, mean, p50, p95, p99 and maximum. For rAF also record requested time, callback time, preceding frame interval, callback duration, whether a new sample was committed and the age of that sample. For sensor events record received, rejected, coalesced and committed counts. For cue handlers record invocation count and errors as well as duration; synchronous blocking time is the frame-risk metric, while returned asynchronous work is recorded separately through explicit child measures when an adapter creates it.

Record frame behaviour over the exact active test interval:

- detected refresh interval/rate;
- observed frame count and effective FPS;
- p50, p95, p99 and maximum frame interval;
- frames exceeding 1.5× and 2× the detected refresh interval;
- longest uninterrupted missed-frame sequence; and
- plugin-off versus plugin-on change on the same device/run conditions.

The measurement harness must measure its own empty-wrapper overhead and subtract or report it. A test fails if timing buffers overflow, marks/measures are silently dropped, handler names cannot be attributed, or instrumentation changes event/rAF counts. Raw samples and the summary must both be retained so averages cannot conceal spikes.

### A4. Adapter, CSS and accessibility tests

| ID | Test | Pass condition | Automation |
|---|---|---|---|
| P-030 | Page scoping | Each adapter activates only for its intended page/root; an unknown page receives no adapter CSS, markup or listener | Required automated |
| P-031 | Legacy collision | On page 252, DanceMoves and the old Clay plugin can never run the same effect stack; activation/deactivation order remains deterministic | Required staged WordPress |
| P-032 | Idempotent transform | Running the Clay content transform twice leaves one of every inserted element and preserves all canonical content | Required DOM test |
| P-033 | Clay motion contract | Cover depth, light/specular response, buttons, particle snapshot/release and cue state use the documented bounded variables and tick durations; button size and hit area do not change | Required automated browser plus visual QA |
| P-034 | Compositor path | Continuous phone/pointer movement changes only `transform` and, where justified, `opacity` on bounded layers; no `background-position`, layout property or full-document composited plane is animated | Required CSS audit plus performance trace |
| P-035 | Pointer/touch/keyboard parity | Fine-pointer hover is enhancement only; focus and activation expose equivalent controls; touch does not depend on hover; the page works when sensor permission is unavailable | Required browser and real device |
| P-036 | Reduced motion | `prefers-reduced-motion: reduce` stops non-essential loops and neutralises live tilt without hiding content or disabling required controls | Required computed-style/browser |
| P-037 | Forced colours and contrast | Controls, focus indicators and state remain perceivable in forced colours and at the documented contrast target | Required browser plus review |
| P-038 | Unicode-generated content | Cuneiform and other supplementary-plane generated content resolves to the intended code points in computed `content`; no replacement glyph or mojibake appears | Required automated DOM plus screenshot |
| P-039 | WordPress formatting artefacts | Proven direct-child `<br>`/empty-`<p>` artefacts are neutralised only inside the release scope; intentional paragraphs and line breaks remain | Required rendered-DOM test |

### CSS property and bottleneck audit

The audit must inspect stylesheet rules, inline styles, Web Animations keyframes, transitions and JavaScript `style`/custom-property writes. A CSS variable is classified by every property that consumes it; updating `--x` is not compositor-safe merely because the write is a custom property.

| Classification | Examples | Gate behaviour |
|---|---|---|
| Layout-triggering | `width`, `height`, `min/max-*`, `top/right/bottom/left`, margin, padding, border width, font size, line height, grid/flex tracks, `gap` | Fail when continuously animated or updated per sensor/rAF frame; require a documented static/state-change justification otherwise |
| Paint-triggering | `background-position/size/image`, gradients, `box-shadow`, `text-shadow`, border colour/radius, fill/stroke, `mask-*`, `object-position` | Fail for continuous sensor/rAF movement; for infrequent cue transitions, require a bounded element, trace evidence and performance-budget PASS |
| Potentially expensive compositing | `filter`, `backdrop-filter`, large blur, `clip-path`, complex masks, blend modes, fixed/sticky translucent layers | Highlight automatically; fail if the affected area is unbounded, recurring paint appears, layer memory proliferates or a frame budget is missed |
| Normally compositor-friendly | `transform`, `opacity` | Allowed only after trace confirmation; highlight oversized layers, excessive simultaneous layers, permanent `will-change`, 3D flattening/flicker and full-document surfaces |

The automated report must name selector/element, source file and line when available, property, animation/transition name, duration, iteration count, trigger (`loop`, `sensor`, `pointer`, `cue`, `state`), consumer of any CSS variable, rendered bounds/viewport coverage and observed layout/paint/composite activity. Unknown or dynamically constructed properties are `BLOCKED` until traced.

Also scan and highlight these non-property bottlenecks:

- layout reads after style writes in one event/frame;
- broad inherited custom-property updates on `:root` or a large ancestor;
- repeated selector queries, DOM insertion, class/attribute churn or `getAnimations()` scans in a hot path;
- duplicate listeners, rAF loops, timers, observers or effect roots;
- unbounded arrays/maps/recordings and retained detached nodes;
- large decoded images, video, canvases, SVG filters, particle counts and overdraw;
- full-page fixed layers, blend/backdrop stacks and excessive promoted layers;
- synchronous cue handlers that perform parsing, network work or bulk DOM/style mutation;
- player/cue polling when paused or when no matching audio exists; and
- console/network retry loops, third-party scripts and WordPress formatting nodes that expand layout work.

### A5. Performance and stability tests

Test the plugin-off page and the same page with DanceMoves enabled on the same run, device, viewport, refresh rate and thermal state. Apply the performance telemetry contract above and retain the raw timing stream, summary and trace.

| ID | Test | Pass condition | Evidence |
|---|---|---|---|
| P-040 | Synthetic load | At 20, 60, 120 and 240 input events/second for 30 seconds, commits never exceed display frames, the newest sample wins and values remain finite; orientation-handler and rAF distributions are complete | Machine-readable raw timings, summary and trace |
| P-041 | 60 Hz reference device | Effective FPS and missed-frame distribution are recorded; orientation handler p95 ≤0.5 ms and p99 ≤1 ms; rAF effect callback p95 ≤4.2 ms; input event to next visual commit p95 ≤two refresh intervals; effect-attributable long tasks ≥50 ms = 0; additional dropped-frame rate versus plugin-off baseline ≤1 percentage point | Physical-device capture |
| P-042 | 120 Hz reference device | Effective FPS and missed-frame distribution are recorded; orientation handler p95 ≤0.5 ms and p99 ≤1 ms; rAF effect callback p95 ≤2.1 ms; input event to next visual commit p95 ≤two refresh intervals; effect-attributable long tasks ≥50 ms = 0; additional dropped-frame rate versus plugin-off baseline ≤1 percentage point | Physical-device capture |
| P-043 | Cue-handler timing | Every core reset/dispatch span and EPK-specific cue handler is named and timed; total synchronous cue work p95 ≤50% of the detected frame interval, each handler p95 ≤25%, no unhandled error, and no cue produces a frame interval >2× baseline | Raw measures grouped by page/cue/handler |
| P-044 | CSS/property trace | The property audit has no unapproved layout/paint animation; continuous tilt produces compositor updates without recurring layout or full-page paint; promoted layers stay bounded and the tab remains responsive | Property inventory, DevTools trace and layer evidence |
| P-045 | Five-minute soak | No listener/timer/rAF growth, unbounded sample retention, progressive frame-rate collapse, crash or visibly stuck state after hide/show, cue bursts and rotate cycles | Before/after counters and trace |
| P-046 | Fault injection | Missing timing file, failed fetch, invalid BPM, missing root, no matching audio, permission denial and handler exception degrade to a readable functional EPK without uncaught errors | Automated browser log |

The budgets above are release blockers for the nominated reference devices. If a browser cannot expose a metric, mark it `BLOCKED`, not `PASS`, and obtain equivalent physical-device evidence before release.

### Plugin gate decision

The package may be proposed for deployment only when:

- every required P-test is `PASS` for the exact ZIP hash;
- the legacy 30 ms/background-position assertions have been replaced, not merely skipped;
- the validator exists, runs all automated checks and exits non-zero on a required failure;
- physical 60 Hz and 120 Hz results are attached;
- the rollback package and deployment procedure have been rehearsed on staging; and
- unresolved advisory findings are explicitly listed.

## Gate B — each EPK before it is made live

### B1. Canonical evidence and candidate construction

| ID | Test | Pass condition |
|---|---|---|
| E-001 | Live canonical snapshot | Signed-out live HTML, visible content, links, embeds, players, downloads, calendar actions, contact routes, shared navigation, accessibility behaviour and responsive layout are inventoried with URL, time and hash |
| E-002 | Authoritative release inputs | Official cover/identity and release facts match authoritative release sources; rhythmic movement has a canonical-master hash, BPM evidence, method, confidence and tick-duration map |
| E-003 | Originality record | References consulted, neutral mechanism reused, target-specific metaphor/composition/activation/motion changes and accessibility/performance improvements are documented; the effect cannot be explained as another page with only assets/colours/speeds changed |
| E-004 | Merge-first parity | Candidate contains every canonical fact and working feature unless removal was explicitly requested; parity checklist has no unexplained missing item |
| E-005 | Exact staged artifacts | Readable source, exact WordPress transport payload, plugin ZIP, page-meta values and dependency versions are staged and hashed; the previous WordPress revision/rollback target is recorded |
| E-006 | Capacity preflight | Host-level free space/quota and temp-write health are verified; block under 256 MiB free, at 95% quota use, on an exhaustion warning or failed temp probe; warn below 1 GiB or 10% free |

### B2. Staged rendered-page tests

| ID | Test | Pass condition |
|---|---|---|
| E-010 | Desktop layout | Fixed 1440 px viewport has the intended desktop composition, readable hierarchy and zero positive horizontal overflow |
| E-011 | Tablet layout | Fixed 900 px viewport in the 761–1024 px contract has a deliberate tablet composition, not a shrunken desktop or reused mobile layout; zero positive horizontal overflow |
| E-012 | Mobile layout | Fixed 390 px viewport has the intended mobile composition, usable touch targets and zero positive horizontal overflow |
| E-013 | Structural DOM | One instance of every canonical section/control; sequential non-overlapping section rectangles; no duplicate effect roots; WordPress `<br>`/empty-`<p>` artefacts are scoped and harmless |
| E-014 | Functional routes | Every retained internal/external link, player, chapter control, download, calendar action, contact route and shared navigation path is exercised; response/target is recorded |
| E-015 | Input modes | Pointer, touch, keyboard and sensor-denied operation work; sensor-enabled behaviour passes on a physical iPhone Safari and physical Android Chrome when tilt is part of the page |
| E-016 | Motion intent | All automatic loops resolve to the release BPM/tick map; input-driven motion is bounded, stable, non-obstructive and returns to neutral after lifecycle resets |
| E-017 | Performance telemetry | With real imagery, players, WordPress markup and viewport-specific layer sizes, record FPS/frame intervals plus orientation-handler, rAF, cue dispatch/reset and every EPK-specific cue-handler duration; pass the applicable P-040–P-045 budgets against the same page with effects disabled |
| E-018 | Reduced motion and accessibility | Keyboard order/focus, accessible names, 200% zoom/reflow, reduced motion and forced colours pass; no information or action depends only on motion, colour or hover |
| E-019 | Unicode round trip | Readable source and exact payload are strict UTF-8; intended code points match in visible text, attributes, accessible names and computed pseudo-content; no `U+FFFD`, double encoding, broken entity/escape or mojibake |
| E-020 | Console/network stability | No uncaught exception, mixed-content error, blocked required asset, repeated failed request, duplicate asset version or unexpected third-party dependency occurs |
| E-021 | Screenshot validity | Clean fixed-viewport screenshots exist for 1440, 900 and 390 px; a tall animated full-page stitch is supplementary only and cannot overrule DOM counts/rectangles |
| E-022 | Per-page property inventory | At 1440, 900 and 390 px, every active CSS animation, transition, WAAPI keyframe and JS/custom-property write is classified; no continuous layout/paint property is active, and every highlighted filter/mask/blend/layer risk has a passing trace or is removed |
| E-023 | Per-page bottleneck review | The report lists hot-path DOM/layout access, layer/element bounds, image/video decode sizes, particles, observers/listeners/timers, cue-handler mutations and third-party activity; every material finding is resolved or explicitly blocks publication |

### B3. Approval, publication and persisted verification

| ID | Test | Pass condition |
|---|---|---|
| E-030 | Action-time approval | Immediately before mutation, approval identifies the exact page ID/URL, payload hash, plugin ZIP hash, metadata values and intended legacy-plugin state |
| E-031 | Single controlled save | The approved package/page/meta changes are applied once; any HTML/JSON 500 or write-to-disk error stops further mutation until capacity is remediated and persistence is checked |
| E-032 | Persisted source | Reloaded editor/REST source and metadata hash-match the approved candidate; expected asset versions and one release sentinel are present |
| E-033 | Signed-out public QA | A fresh signed-out response repeats E-010 through E-020 at 1440, 900 and 390 px; physical phone tilt is repeated if applicable |
| E-034 | Feature parity after save | Public counts, destinations and behaviours match the pre-save parity checklist; a save acknowledgement alone is not evidence of correct rendering |
| E-035 | Rollback readiness | Previous revision/plugin ZIP can be restored without deleting shared media; rollback trigger and responsible action are recorded |
| E-036 | Durable reconciliation | Local readable source, exact transport payload, hashes, manifests and one same-date Markdown report in the release's established report location are reconciled only to the verified live result |

### EPK gate decision

An EPK must not be made live, or must be rolled back, if any of these are true:

- a canonical content/function item is missing or broken;
- the 900 px tablet layout is not deliberate, or any required viewport overflows;
- rhythmic motion lacks defensible BPM/master evidence;
- sensor motion has not passed on both nominated physical mobile platforms;
- the exact candidate misses a performance budget or causes recurring layout/paint;
- orientation, rAF or cue-handler timing is missing, unattributed or over budget;
- the property inventory finds a continuous layout/paint animation or an unresolved expensive compositing risk;
- reduced-motion, keyboard, focus, forced-colour or Unicode integrity fails;
- WordPress capacity is below the safe write threshold or transport integrity is unknown;
- legacy and DanceMoves effects can double-load;
- the persisted signed-out result differs from the approved hashes or staged rendering; or
- exact action-time approval is absent.

Subjective tuning notes may remain advisory only when they do not affect content, function, accessibility, originality, performance or the documented visual contract.

## Required evidence bundle

Keep evidence under the release's existing QA/report structure without creating duplicate same-date reports:

- canonical signed-out HTML/hash and parity checklist;
- readable candidate and exact WordPress payload hashes;
- plugin ZIP and extracted-file hashes;
- BPM/master provenance and timing map;
- machine-readable plugin and EPK test results;
- fixed-viewport 1440/900/390 screenshots;
- physical iPhone/Android sensor recordings when applicable;
- 60 Hz/120 Hz counters and performance traces;
- raw and summarised orientation-handler, rAF, cue-dispatch/reset and per-EPK cue-handler timings;
- the CSS/custom-property consumer inventory and bottleneck report;
- console/network log, DOM counts/rectangles and overflow results;
- Unicode/code-point comparison;
- approval record, persisted-source hash and signed-out verification time; and
- rollback revision/package reference.

## Proposed automation layout

The implementation phase should add these narrowly scoped runners instead of one opaque script:

- `tests/sensor-raf-scheduler.test.cjs` — P-020 through P-028.
- `tests/clay-adapter.test.cjs` — P-030 through P-039.
- `tests/performance-budget.e2e.mjs` — P-040 through P-046.
- `tests/css-property-audit.e2e.mjs` — property/consumer classification and P-044.
- `tests/performance-instrumentation.js` — shared marks/measures, frame-rate sampling and named cue-handler attribution used by plugin and EPK runs.
- `tests/wordpress-render.e2e.mjs` — rendered staging and transport checks.
- `tools/validate.ps1` — syntax, encoding, unit/contract tests, browser tests, package hashes and a combined non-zero exit status.
- `tools/epk-prelive.ps1` — one-page evidence manifest and gate summary; never publishes.

Publication remains a separate, approval-gated operation. No test runner may upload, save, activate, deactivate or publish by itself.

## Potential problems

### A passing unit suite can preserve the obsolete performance design

- **Symptom:** all existing Node tests pass even though the runtime still uses a 30 ms cadence and animates `background-position`.
- **Cause:** two contract tests explicitly assert those legacy behaviours, so green results prove consistency with v1.2.4 rather than the new low-latency/compositor acceptance criteria.
- **Corrective action:** replace the cadence assertion with latest-sample/one-pending-rAF invariants and replace the background-position assertion with a transform/opacity compositor audit; fail if either legacy behaviour returns.
- **Verification:** P-023, P-024 and P-034 pass, and searches/tests prove no continuous adapter path animates `background-position` or uses a fixed visual cadence.
- **Limit:** static absence is insufficient; the real-device performance gates must also pass.

### A documented validator command can be mistaken for an implemented gate

- **Symptom:** the README instructs maintainers to run `tools/validate.ps1`, but the file is absent.
- **Cause:** documentation and the current plugin inventory have drifted.
- **Corrective action:** treat orchestration as unimplemented until the proposed validator exists, calls every required automated suite, records artifact hashes and exits non-zero on any required failure.
- **Verification:** a deliberate failing fixture produces a non-zero exit and names the failed test; the corrected fixture produces one complete PASS manifest.
- **Limit:** the validator cannot replace WordPress staging, physical-device evidence or action-time publication approval.
