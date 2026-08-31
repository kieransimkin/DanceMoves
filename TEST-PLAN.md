# DanceMoves test and EPK publication gates

## Potential problems

### Windows execution policy can block the validator before any test runs

- **Symptom:** invoking `tools\\validate.ps1` directly fails with `PSSecurityException` and `running scripts is disabled on this system`.
- **Cause:** the current Windows PowerShell execution policy blocks direct script execution even though the validator source is local and readable.
- **Corrective action:** run the same checked-in validator with `powershell -NoProfile -ExecutionPolicy Bypass -File .\\tools\\validate.ps1 -Mode <mode>`; do not change the machine-wide execution policy.
- **Verification:** the validator proceeded through PHP syntax and the Node contract suites, then reported the next attributable harness-lock result.
- **Limit:** the process-level bypass permits this one invocation; it does not validate the script's content or make a failing test pass.

### Cross-realm arrays can fail strict deep equality in VM tests

- **Symptom:** a Node `vm` fixture reports that two arrays have the same `['*']` structure but are not reference-equal under `assert.deepStrictEqual`.
- **Cause:** the production array was created in the VM realm and has a different prototype from the host test realm.
- **Corrective action:** normalize the small primitive collection into the host realm with `Array.from()` and compare its stable serialized value.
- **Verification:** the catalogue timing fixture accepts the wildcard ownership scope and continues to assert the computed tick conversions.
- **Limit:** use this only for cross-realm primitive fixtures; object-rich structures should be validated field by field rather than flattened indiscriminately.

### A DOM timing fixture needs a real CSSStyleDeclaration surface

- **Symptom:** the catalogue timing VM test reaches the root element and fails with `TypeError: style.getPropertyValue is not a function`.
- **Cause:** the minimal root fixture exposed only an iterable `style`, while the production adopter correctly calls the CSSStyleDeclaration `getPropertyValue`, `getPropertyPriority` and `setProperty` methods on every inspected element.
- **Corrective action:** give the fixture no-op implementations of the three CSSStyleDeclaration methods while retaining an empty iterator.
- **Verification:** the adopter completes root and rule traversal, then the test reaches its duration, reduced-motion and view-timeline assertions.
- **Limit:** the no-op root style is appropriate only because this fixture's timed declarations live in its CSS rules; inline-style conversion requires a populated style mock or a browser test.

### Dense one-line DevTools expressions can hide an audit syntax error

- **Symptom:** `Runtime.evaluate` returns `SyntaxError: Unexpected token` before any catalogue result is produced.
- **Cause:** a compressed nested-loop audit expression lost a structural delimiter while being transported as one line.
- **Corrective action:** keep the main-world audit as a structured multiline source string, evaluate it separately from the injected runtime, and inspect the protocol exception before reading a result value.
- **Verification:** the corrected expression completed on all 17 release-specific EPK systems at 1440, 900 and 390 pixels.
- **Limit:** successful evaluation proves only that the audit ran; its root choice and assertions still require independent checks.

### The document marker is not the owned EPK root

- **Symptom:** a catalogue audit reports WordPress toolbar controls as unquantized page motion and shows zero release conversions.
- **Cause:** DanceMoves marks both `document.documentElement` and the release root as ready, and an unrestricted ready-marker selector returns `<html>` first.
- **Corrective action:** resolve the release root from the configured page selector or exclude `document.documentElement`; assert the expected root identity before interpreting timing records.
- **Verification:** the corrected audit selected all 17 expected release roots and found zero unquantized computed timing tokens after adoption at all three viewport classes.
- **Limit:** this is an audit-selection rule; the document marker remains useful as a page-level readiness signal.

### Repeated read-only injection can leave duplicate generated style IDs

- **Symptom:** a reduced-motion probe reads a generated timing style without the latest media rule even though the injected source contains it.
- **Cause:** injecting successive development revisions into the same main-world document can leave more than one `#dance-moves-catalogue-pseudo-timing` element; `querySelector` returns the oldest one.
- **Corrective action:** use a clean navigation context for each revision, or inspect every matching style node and the final computed value; never treat the first duplicate development node as production state.
- **Verification:** the final computed pseudo-element duration on page 310 was `0.01ms`, with no active named animation above the reduced-motion threshold.
- **Limit:** normal WordPress enqueue loads one catalogue runtime; this warning applies to deliberate repeated development injection.

### Reduced motion must outrank generated pseudo-element timing

- **Symptom:** page 310's `garden-light-drift` pseudo-element retains a 24-second running duration under emulated reduced motion after catalogue quantization.
- **Cause:** the generated quantized pseudo-element rule was appended after a same-specificity reduced-motion rule, so source order restored the long duration.
- **Corrective action:** emit the reduced-motion rule after generated timing rules and give it a two-attribute owned-root selector; clamp the owned subtree and its pseudo-elements to one `0.01ms` iteration with zero delay.
- **Verification:** the exact staged runtime reports no active named animation above `0.02ms` and zero document overflow on page 310 under `prefers-reduced-motion: reduce`.
- **Limit:** inert declarations with `animation-name: none` may retain long source values, but they do not animate; page scripts and canvas loops still need their own reduced-motion branch.

### Signed-in WordPress chrome can look like EPK overflow

- **Symptom:** page 399 reports eight pixels of document overflow at every viewport while its EPK root itself fits exactly.
- **Cause:** the authenticated WordPress admin bar's display-name control extends beyond the viewport; it is absent from signed-out public rendering.
- **Corrective action:** report EPK-root and document overflow separately, list document-only offenders, and repeat the release gate signed out after publication.
- **Verification:** all 17 EPK roots had zero positive overflow at 1440, 900 and 390 pixels; the only signed-in document offender was the admin-bar display name.
- **Limit:** excluding known admin chrome is valid only when the owned EPK root is clean and signed-out persisted verification is still performed.

### Ordered dictionaries can export as blank TSV columns

- **Symptom:** the JSON manifest contains all 47 populated page objects, while the TSV has 48 lines but blank title, page ID, URL and BPM columns.
- **Cause:** `Select-Object` and `Export-Csv` did not expose ordered-dictionary keys as ordinary PowerShell object properties.
- **Corrective action:** cast each generated migration row to `[pscustomobject][ordered]` before collecting or exporting it.
- **Verification:** require 47 imported TSV rows, non-empty title/page ID/URL on every row, and field parity with the JSON manifest for all page IDs before any WordPress migration.
- **Limit:** structural parity does not verify that the underlying BPM or timing-file evidence is correct; retain the separate evidence gates.

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

- `runtime.test.cjs` now requires latest-sample rAF coalescing; the legacy 30 ms visual rate limit and batching metadata have been removed.
- `wordpress-upload-contract.test.cjs` currently requires a `background-position` transition.
- `tools/validate.ps1` exists, but its original default path rebuilt migration and package artifacts during ordinary validation; read-only and explicit package modes are required.

The new suite must replace those two legacy performance expectations with one-pending-`requestAnimationFrame` coalescing and compositor-only movement. The validator must grow from the implemented Unit/Package/All foundation into the combined browser, performance and pre-live coordinator described below.

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
| P-022 | Rolling normalisation | The DanceMoves production two-second rolling window expires old extrema, respects the minimum span and maps/clamps output to `[-1,+1]` without division spikes; changing that duration requires a separate A/B tuning decision and physical-device evidence | Required automated |
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

### Read-only validation can unexpectedly rebuild release artifacts

- **Symptom:** running the normal validation command changes migration manifests or files under `dist` even though no package build was intended.
- **Cause:** the original coordinator always invoked migration building and packaging.
- **Corrective action:** use `-Mode Unit` as the read-only default, require explicit `-Mode Package` or `-Mode All` for release-artifact writes, and keep the deliberate failing fixture outside ordinary scans.
- **Verification:** Unit mode leaves migration/dist hashes unchanged; `tools/test-validator-failure.ps1` confirms a non-zero attributed failure; Package mode alone performs the declared rebuild.
- **Limit:** the implemented modes do not yet provide the planned browser, physical-device or per-EPK pre-live orchestration.

### A UTF-8 BOM can make a valid PowerShell-generated manifest fail in Node

- **Symptom:** `JSON.parse()` fails at the first character with `SyntaxError: Unexpected token '﻿'` even though PowerShell can read the JSON and the visible first character is `{`.
- **Cause:** the existing migration manifest begins with a UTF-8 byte-order mark, which Node's `JSON.parse()` does not remove automatically.
- **Corrective action:** read the file as UTF-8 and remove only a leading `U+FEFF` before parsing: `.replace(/^\uFEFF/, "")`. Do not rewrite or strip intentional Unicode elsewhere in the manifest.
- **Verification:** `tools/audit-live-epk-motion.mjs` subsequently fetched all 47 manifest pages, received HTTP 200 for each, preserved the Arabic/Persian titles, and wrote both JSON and TSV audit artifacts.
- **Limit:** apply this only to a leading BOM at the JSON transport boundary; it does not justify deleting other Unicode characters or accepting malformed JSON.

### Intentional production-asset edits invalidate the live-harness hash pin

- **Symptom:** unit validation fails in `harness-foundation.test.cjs` with `production hash mismatch` immediately after an intentional core CSS or JavaScript change.
- **Cause:** the harness manifest pins the exact production assets it exercises, so any legitimate source change makes the earlier snapshot stale.
- **Corrective action:** inspect the production diff first, calculate SHA-256 for each intentionally changed asset, and update only the matching `productionHashes` entry in `tests/harness/plugin-core/effect-harness.manifest.json`. Never refresh hashes merely to silence unexplained drift.
- **Verification:** the foundation test matches both current production hashes and the full Unit validator reaches the property audit.
- **Limit:** a matching hash proves fixture/source identity, not that the changed motion is accessible, performant or visually correct.

### A shared transition list can accidentally introduce a continuous paint risk

- **Symptom:** the effect-harness validator reports `CSS_CONTINUOUS_RISK` for `box-shadow in transition` after an otherwise small timing migration.
- **Cause:** a broad shared transition-property list included `box-shadow` even though the basic EPK hover state does not change that property.
- **Corrective action:** compare the actual base and interactive states and keep only properties that visibly change. For the shared EPK controls, use `background-color, color, transform, border-color`; do not add `box-shadow` speculatively.
- **Verification:** the harness reports no blocking findings, the computed transition property contains only the four intended properties, and Unit validation passes.
- **Limit:** release-specific controls may legitimately use other properties, but they require their own performance trace and must not inherit this neutral shared decision automatically.

### Browser evaluation may not expose the Web Animations API in the isolated test world

- **Symptom:** a live-page check throws `TypeError: document.getAnimations is not a function` even though the page's main runtime is using Web Animations and DanceMoves has initialized.
- **Cause:** the browser controller's isolated evaluation world did not expose `document.getAnimations`, while the tab's main-world Chrome DevTools Protocol runtime did.
- **Corrective action:** feature-detect `document.getAnimations` in isolated checks; for animation ownership, reduced-motion and public API verification, bind the developer-protocol controller to the current tab and evaluate in the main world. Never interpret an isolated-world API omission as proof that the public page lacks the feature.
- **Verification:** the main-world runtime exposed DanceMoves 2.1.0, returned the complete public timing API, loaded 19 cues, reset 13 owned animations at a live cue and reported no active animations under emulated reduced motion.
- **Limit:** this is a test-controller compatibility workaround; it does not waive the need to check the rendered DOM, computed styles and user-visible behaviour.

### `Invoke-WebRequest` content type varies with the response MIME type

- **Symptom:** an otherwise read-only SHA-256 check fails while hashing `Invoke-WebRequest.Content`, may print the fetched asset in the error, or `ZipArchive.Close()` is reported as unavailable.
- **Cause:** binary timing-file responses expose `Content` as `byte[]`, text JavaScript responses expose it as `string`, and .NET `ZipArchive` uses `Dispose()` rather than `Close()` in this PowerShell runtime.
- **Corrective action:** normalize response content to bytes with a type check, UTF-8 encode only string content, hash the resulting byte array, and dispose archive streams and archives with `Dispose()`.
- **Verification:** the signed-out deployed `dance-moves-core.js` hash was `EC755C134346656650B89A3F9FD54DFF71AE85F812E1FB0116BE1337E640FFEA`, exactly matching the file inside the approved DanceMoves 2.1.0 ZIP.
- **Limit:** byte equality proves deployed-file identity; it does not by itself prove runtime initialization, accessibility or visual correctness.

### One EPK selector must not transfer timing ownership to an entire stylesheet

- **Symptom:** an authenticated rendered page reports hundreds of converted declarations, including WordPress theme or admin rules that are unrelated to the EPK.
- **Cause:** catalogue adoption treated a stylesheet as wholly owned when any selector in it matched an EPK root, so unrelated sibling rules inherited timing conversion.
- **Corrective action:** decide ownership per style rule. Convert animation and transition properties only for selectors that resolve to an owned EPK root; in unrelated rules, convert only custom properties that an owned rule demonstrably references.
- **Verification:** `catalogue-timing.test.cjs` places an unrelated `.wp-admin .toolbar` transition in the same stylesheet as an EPK selector and requires its `.4s` duration to remain unchanged; the complete Unit validator passes.
- **Limit:** referenced custom properties may be defined outside the owned selector and still need conversion. Do not restrict those definitions without first tracing their consumers.

### Fixed waits can audit the catalogue before adoption is ready

- **Symptom:** all rendered systems report the catalogue timing root as not ready after a nominal 250 ms delay, despite the asset loading successfully.
- **Cause:** stylesheet traversal, dynamic markup and browser scheduling do not have a reliable fixed completion time.
- **Corrective action:** wait for `[data-dance-moves-catalogue-root="ready"]` with a bounded timeout before sampling computed timing, overflow or conversion counts.
- **Verification:** after waiting on the explicit marker, all 51 desktop/tablet/mobile checks across the 17 release systems reached ready state.
- **Limit:** readiness proves the adopter finished its current pass; dynamic content inserted later must still be covered by its observer and separately tested.

### Same-version WordPress replacement can leave an open tab on stale JavaScript

- **Symptom:** WordPress reports a successful same-version plugin replacement, while an already-open browser tab continues to execute the earlier catalogue asset.
- **Cause:** the public URL and `?ver=` cache key are unchanged, allowing the browser cache to retain the previous bytes.
- **Corrective action:** hash the exact enqueued public asset URL against the approved ZIP, temporarily disable the test tab's network cache for runtime QA, then restore normal cache behaviour. Prefer a new semantic version for any subsequent corrective package.
- **Verification:** the exact 2.2.0 catalogue URL returned the approved 12,799-byte asset and SHA-256 `89A9A750AA0B0936516DE8D44C090C989530A0767C5EDDFB98038DDE84E20013`; fresh-cache runtime checks then initialized the deployed build.
- **Limit:** do not clear the user's browser cache as a workaround. Byte identity and fresh-cache runtime behaviour are both required.

### Raw root width can count intentionally clipped decoration as overflow

- **Symptom:** an EPK root has a large `scrollWidth - clientWidth` even though the visible document has zero horizontal overflow.
- **Cause:** release artwork and atmospheric layers intentionally extend beyond a root whose computed `overflow-x` is `hidden`; the raw scroll box still includes those clipped descendants.
- **Corrective action:** record both document overflow and root overflow, inspect the root's computed overflow mode and test fixed-viewport screenshots. Treat only visible/user-reachable overflow as the layout failure.
- **Verification:** affected roots were clipped with `overflow-x: hidden`, while the rendered document remained at zero positive overflow; page 399's remaining eight pixels were isolated to authenticated WordPress admin chrome and absent from signed-out HTML.
- **Limit:** hidden overflow is not automatically safe; verify that no required control, focus indicator or content is clipped.

### Browser controller evaluation may omit same-origin `fetch`

- **Symptom:** a public asset hashing expression fails with `TypeError: fetch is not a function` in the controller's isolated evaluation world.
- **Cause:** that evaluation world does not expose the page's normal `fetch` surface.
- **Corrective action:** perform same-origin byte reads in the tab's main-world developer-protocol runtime and hash the returned bytes there; keep isolated evaluation for DOM operations it supports.
- **Verification:** all nine deployed plugin assets were read and byte-matched to the approved 2.2.0 package.
- **Limit:** this is a controller-world workaround, not permission to bypass cross-origin or authentication boundaries.

### A keyframe audit can accidentally include later media queries

- **Symptom:** the Clay compositor test reports a layout property in keyframes even though every actual keyframe animates only transform and opacity.
- **Cause:** the test sliced from the first `@keyframes` to end-of-file, so `max-width:` in a later media query matched the layout-property expression.
- **Corrective action:** bound the inspected source from the first keyframe to the first following media query before applying declaration checks.
- **Verification:** the corrected assertion still scans every Clay keyframe block, finds no layout declaration, and the complete Unit validator passes.
- **Limit:** if future keyframes are added after media queries, replace this boundary with a brace-aware keyframe parser rather than silently excluding them.

### A release adapter directory is not necessarily a standalone effect harness

- **Symptom:** the generic harness validator reports every scaffold file missing when pointed at `tests/harness/clay-stars`.
- **Cause:** that folder intentionally contains a release manifest and thin adapter consumed by the generated shared harness; it is not a self-contained harness root.
- **Corrective action:** validate `plugin-core` directly for the shared scaffold, then invoke the validator's shared-manifest mode with the Clay manifest and `plugin-core` as `--shared-root`; retain `clay-adapter.test.cjs` for runtime contracts.
- **Verification:** both shared scaffold passes, the Clay shared-manifest pass and the Clay adapter contract now run in Unit mode.
- **Limit:** promote the Clay folder to a standalone harness only by adding the complete required scaffold; do not add placeholder files merely to silence this error.

### Minified CSS can close a keyframe and continue with other rules on one line

- **Symptom:** the shared Clay harness reports many static layout declarations as continuously animated, all at one minified candidate line.
- **Cause:** line-scoped keyframe state classified every declaration on a line containing `@keyframes` as part of that animation, even after its closing brace.
- **Corrective action:** calculate brace-bounded character ranges for each standard or WebKit keyframe block and classify every declaration by its own absolute offset.
- **Verification:** the same generated Clay candidate changed from multiple false blocking findings to `PASS`; its one remaining `box-shadow` transition is retained as a review warning, and Unit mode now runs this shared-manifest validator.
- **Limit:** the range scanner assumes balanced CSS braces; malformed CSS remains a validation failure and must not be normalized silently.

### WordPress exposes duplicate Add Plugin links

- **Symptom:** an exact `Add Plugin` role locator fails strict mode because both the Plugins submenu and page-title action are visible.
- **Cause:** WordPress renders two links with the same accessible name in different navigation regions.
- **Corrective action:** scope the locator to `#wpbody-content` for the page-title action, or to the explicitly labelled main navigation when the submenu is intended.
- **Verification:** the scoped page-title link opened the uploader and the approved ZIP reached the 2.2.0-to-2.3.0 comparison screen.
- **Limit:** do not resolve duplicate mutation controls with `.first()` unless the containing region and intended action have already been established.

### Scripted audio playback can be blocked without a user gesture

- **Symptom:** `audio.play()` rejects with `NotAllowedError` and no cue or interval callback fires.
- **Cause:** Chromium's autoplay policy requires a user activation even for this muted test path.
- **Corrective action:** prepare the read-only timing position and handlers, focus the visible native audio control and use its Space-key play action, then pause and restore the track position after sampling.
- **Verification:** visible playback crossed the 12.95-second `VOCAL INTRO` cue, fired one next-beat handler and three repeating beat handlers; a second run fired the next/every bar and 64-tick interval handlers once each.
- **Limit:** do not disable autoplay policy or synthesize playback state. Keep test playback muted and stop it immediately after the bounded sample.

### The public cue event uses a hyphenated name

- **Symptom:** an animation resets and the named Clay cue handler updates, but a test listener reports zero document cue events.
- **Cause:** the listener used `dance-moves:cue`; the published contract is `dance-moves-cue`.
- **Corrective action:** bind to the exact event name exported by the core contract and keep named handler verification separate.
- **Verification:** the corrected listener observed exactly one event from `DanceMoves.fireCue`, while the owned animation reset from 2,500 ms to 0 and remained running.
- **Limit:** do not infer event names from dataset keys or CSS naming conventions; use the documented runtime contract.

### Nested JavaScript templates can remove regular-expression escapes

- **Symptom:** a signed-out audit reports every page missing versioned scripts even though the HTML visibly contains both URLs.
- **Cause:** a regular expression embedded inside a JavaScript template string lost the intended escapes before main-world evaluation.
- **Corrective action:** for exact immutable asset URLs, use direct `String.includes()` checks; reserve generated regular expressions for cases that require pattern matching and inspect their final source first.
- **Verification:** the corrected exact-URL audit found core and catalogue 2.3.0 on all 47 pages with zero failures.
- **Limit:** exact substring checks do not replace parsing where URL normalization, alternate hosts or multiple equivalent encodings are valid.
