# DanceMoves

## Current release and complete reference

**DanceMoves 2.8.0** — release tag `v2.8.0`, source commit
`4cb6a71f60459b5579be87d7e55ac8b1426c578e` (28 September 2026).
The default `main` branch remained at 2.4.0 when checked on 29 September 2026;
use the release or `timed-lyrics-staging-2026-09-20` for this documentation.
That staging revision adds publication evidence only, not a different runtime.

DanceMoves is Kieran Simkin's WordPress motion/timing plugin in the wider
DanceFlow workflow. Start with the [documentation index](docs/README.md) and
[user guide](docs/guide.md). The reference covers implemented behaviour rather
than treating historical release notes as the current API contract.

| Reference | Contents |
| --- | --- |
| [Core JavaScript](docs/api/javascript.md) | All clock, interval, parser, cue, lyric, animation-scope and diagnostic methods; exact cue landings; immediate-next and next-visible lyric payloads. |
| [Shared effects](docs/api/effects.md) | `pointer`, `playbackPulse`, `cueClass`, `cueTimeline`, `quality`; all options, callbacks, returned handles and registry methods. |
| [WordPress, PHP and REST](docs/api/wordpress.md) | Page metadata, helpers, editor validation, asset dependencies, hooks and full motion-capture request/response contract. |
| [Signed MP3 downloads](docs/api/downloads.md) | All eight download helpers, anchor rewriting, signed GET/HEAD endpoint, response headers, errors and security limits. |
| [Paper planes](docs/api/paper-planes.md) | Ambient-effect selection, hero markup, configuration, snapshot/teardown, compact mode and accessibility behaviour. |
| [Orientation and release adapters](docs/api/adapters.md) | All nine orientation mappings, helper/scheduler APIs, catalogue additions and Clay/Stars settings/lifecycle/performance. |
| [CSS and HTML](docs/api/styling.md) | Tick properties, declarative starts, lyric styling, generated classes, attributes and output state. |
| [Development and source audit](docs/development.md) | Validation, packaging boundaries and baseline selection; [source provenance](docs/source-audit.md) and [machine-readable API inventory](docs/api/surface.json). |

The full reference lives in the source checkout's `docs/`, not the existing
WordPress ZIP. Packaged readers can visit the [source repository](https://github.com/kieransimkin/DanceMoves)
and select the documentation-bearing branch. This documentation change does not
rebuild release ZIPs, alter PHP/JavaScript, or change the WordPress upgrade slug.

## Rudiment animation integration (2.9.0 candidate)

DanceMoves now exposes `DanceMoves.rudiments` (also `DanceMovesRudiments`) for the
pinned DanceRudiments 0.1.3 position catalogue. The bundled native WebAssembly
backend is generated from every integer sample of the upstream C++ functions;
there is no JavaScript motion-formula mirror or runtime CDN dependency.

The integration converts 16 DanceMoves ticks per beat to 64 DanceRudiments pips
per beat. Controllers share one animation-frame scheduler and provide explicit
page/audio clocks, pause/seek handling, cue resets, accessibility and visibility
suspension, CSS-variable or callback rendering, snapshots and teardown.

The existing Clay/Stars page automatically uses `clay_background` for its
atmosphere translation. Half-speed sampling preserves the original eight-beat
cycle; the existing rotation, scale and opacity treatment shares the new phase.
The original CSS remains the capability-failure fallback. No page-content edit
is required, and the legacy-plugin coexistence guard remains authoritative.

See [the complete rudiment API reference](RUDIMENTS-API.md),
[TypeScript declarations](RUDIMENTS-API.d.ts) and the
[pinned source record](vendor/dancerudiments/UPSTREAM.json).
Run `node tools/verify-rudiments.cjs` and the new tests before packaging. This
version is a candidate: native and lifecycle contracts do not substitute for
signed-out WordPress, real-browser and physical-device acceptance.

## Reusable effect primitives (2.8.0)

DanceMoves 2.8.0 keeps repeated motion and playback mechanisms out of individual EPK payloads. The shared code owns input acquisition, requestAnimationFrame scheduling, cached geometry, audio phase, cue subscription, cue deduplication, crossing detection, seeking, pause/resume, current-time restoration, visibility and motion-preference lifecycle, and recoverable quality measurement. EPK pages keep only declarative cue data, scoped CSS and optional appearance/render callbacks.

`DanceMovesEffects.cueTimeline()` is the reusable playback state machine. Supply an audio element, sorted or unsorted cue objects and page-specific `onCue`/`render` callbacks. The primitive rebuilds state from `audio.currentTime` after seeks and visibility or preference changes, does not replay skipped cues, prevents duplicate cue firing within one traversal, and resumes from the actual playback position without maintaining a page-local clock.

| Motion type | Shared API | Replaces repeated page code | Page-owned surface |
| --- | --- | --- | --- |
| Bounded pointer/parallax | `DanceMovesEffects.pointer()` | pointer normalisation, cached bounds, one-write-per-frame scheduling, leave/orientation/visibility reset | CSS consuming `--dance-moves-x` / `--dance-moves-y`, or a `render({x,y})` callback |
| Audio-phase pulse | `DanceMovesEffects.playbackPulse()` | play/pause/rate/seek listeners, BPM-derived duration and phase correction | a playing class plus CSS using the configured duration/delay properties, or a render callback |
| Cue-local finite state | `DanceMovesEffects.cueClass()` | named DanceMoves cue subscription, bounded lifetime, retrigger and accessibility teardown | a class-styled subject or one finite render callback; never a full-frame repetitive colour layer |
| Cue timeline and state restoration | `DanceMovesEffects.cueTimeline()` | crossing deduplication, seek/visibility/preference reconstruction, effect pause/resume | declarative cue objects and `onCue`/`render` callbacks; persistent state derives from active intervals |
| Recoverable quality tier | `DanceMovesEffects.quality()` | visibility-safe sampling, sustained downgrade, continued recovery checks and hysteresis | CSS keyed from `data-dance-moves-quality`, plus an optional tier-change callback |

The runtime is page and release agnostic. It contains no release names, slugs, page IDs, song tempos, cue names, colours, images or drawing styles. It dispatches `dance-moves-effects-ready` after the API is installed so page-owned inline code can mount adapters even when WordPress prints the plugin in the footer.

```js
function mountEffects() {
  var effects = window.DanceMovesEffects;
  effects.pointer({ id: "release:hero-depth", root: ".ks-epk", bounds: ".epk-hero" });
  effects.playbackPulse({ id: "release:player-pulse", root: ".ks-epk", audio: "audio", ticks: 32, className: "is-playing" });
  effects.cueClass({ id: "release:chorus-glow", root: ".ks-epk", cue: "CHORUS 1", className: "is-chorus", durationTicks: 64 });
}
if (window.DanceMovesEffects) mountEffects();
else document.addEventListener("dance-moves-effects-ready", mountEffects, { once: true });
```

Each mount returns `snapshot()` and `teardown()` methods and is deduplicated by stable ID. `DanceMovesEffects.snapshot()` exposes current instances for a harness without retaining or transmitting frame samples. Pages should prefer CSS-only consumers; use callbacks only when the look genuinely needs custom drawing or DOM state.

## Paper Dreams flight adapter (2.6.3)

The paper-plane renderer is a reusable page-configured DanceMoves effect. It is enabled by the `_dance_moves_effect` page property value `paper-planes`, reads tempo only from the page's `_dance_moves_bpm` property, and contains no release title, slug, page ID or hard-coded song BPM. The EPK Timing sidebar exposes both properties. Pages without the effect property do not load the plane assets.

Page 256 receives a release-scoped hero renderer derived from the verified short-form flight model. Twelve atlas-backed planes cross three depth layers through glide, climb, mush, stall, nose-drop, recovery and swoop states. The adapter uses the shared DanceMoves clock at the artist-confirmed 100 BPM, but keeps the physical interpolation continuous rather than forcing a wobble on every beat.

The painted bounds are the existing hero only. The renderer writes transforms on at most 12 pooled DOM nodes (five on compact or slow-update devices), caps decoration without changing content, pauses when hidden or offscreen, and creates no full-frame audio-timed colour layer. Reduced-motion creates no animation loop; forced-colours hides the decoration. Roll belongs only to manoeuvres, avoiding the earlier permanent oscillating wobble.

### Paper Dreams performance acceptance

- Desktop cap: 12 planes; compact/slow-update cap: 5; three relative-depth profiles.
- Hot path: transform-only writes; no geometry mutation, per-frame allocation, canvas clear, moving blur field or full-viewport repaint.
- Bounds: `.epk-hero`, never the page or viewport; all controls and copy remain above the decorative layer.
- Required checks: full/compact/static state, hidden and offscreen pause, reduced motion, forced colours, overflow, hero readability, stall-to-drop continuity and the shared performance acceptance target below.

Version 2.5.0 gives every explicit WordPress-hosted MP3 download link on an EPK a signed download-only URL. That endpoint returns `Content-Disposition: attachment` while retaining the correct `audio/mpeg` media type. Player and source URLs are not rewritten, so the same MP3 remains seekable and playable in the page. Direct media URLs also remain inline. The content transformation uses WordPress's HTML Tag Processor and changes only same-site upload links whose anchor already has a `download` attribute.

Version 2.4.2 preserves exact cue landings: seeking to within 50 milliseconds of a cue arms that one cue and dispatches it once when playback starts (or immediately when seeking during playback), while ordinary scrubbing still suppresses skipped cues. Version 2.4.1 extended each playback-synchronised lyric event with the immediate next LRC entry and its exact timestamp, allowing release adapters to choreograph a preview against the existing audio clock without reparsing the LRC or creating a second timer. Version 2.4.0 added opt-in lyric pop-ups. DanceMoves parses the selected canonical LRC as inert text, follows the same master-length audio and animation-frame clock as cue timing, clears on blank cues, re-indexes after seeks, hides on pause/end, and exposes `onLyric()` plus a bubbling `dance-moves-lyric` event. The shared component is intentionally visually neutral. Every adopting EPK must add a distinct treatment derived from that song's documented visual language; enabling the checkbox without that release-specific design review is not an approved EPK workflow.

Version 2.3.6 makes automatic performance fallback recoverable. Sampling waits for load plus a five-second settling period, requires sustained poor windows, and continues in the minimal tier. Healthy windows trial one higher tier; failed trials revert with increasing cooldown. Hidden tabs and reduced motion suspend sampling. These are capability checks, so their delays do not alter the musical clock. This describes the Clay/Stars monitor. The reusable `DanceMovesEffects.quality()` controller has a separate sampling and cooldown contract; see [shared quality](docs/api/effects.md#qualityoptions).

Thresholds are relative to the fastest stable frame cadence observed in the session, including 30 Hz displays. The reference can rise but cannot fall during overload. Frame cadence alone cannot prove physical display refresh; diagnostics expose the observation. Kieran confirmed the desktop monitor operates at 30 FPS on 19 September 2026, explaining the former fixed-threshold false positive.

DanceMoves is Kieran Simkin's WordPress EPK motion runtime. Version 2.0.0 added page-level BPM, lyric-timing and cue-timing properties; a 16-ticks-per-beat musical clock; cue-driven animation resets; named cue and interval handlers; the existing seven device-orientation adapters; and the release-specific Made from the Clay and the Stars effects adapter. Version 2.1.0 moved the neutral shared EPK control and lyric-disclosure transitions onto page-resolved integer tick durations. Version 2.2.0 added catalogue-wide adoption for release-owned CSS animations, transitions, delays and timing custom properties. Version 2.3.0 confines stylesheet conversion to EPK-owned selectors and the timing variables they reference, so a mixed theme or admin stylesheet cannot transfer ownership to unrelated rules; it also carries the separately staged Clay/Stars runtime and harness refinements already present in the workspace. Version 2.3.1 raises the Clay/Stars bounded motion gain to 2x. Version 2.3.2 routes the shared permission-aware orientation runtime into that Clay/Stars adapter so physical device events actually drive its motion API while reduced motion, geometry and all other EPK systems remain unchanged. Version 2.3.3 adds measured, release-scoped adaptive performance tiers for Clay/Stars: healthy devices retain the full treatment, while only sustained low frame rate stops the expensive ambient loops and, if still necessary, removes their filters. Version 2.3.4 rate-limits orientation target writes to a two-tick cadence and lets compositor-friendly CSS transitions interpolate between them; it also adds a scoped California Screamin' adapter without changing that page's creative design.

Version 2.3.5 reconciles the Clay/Stars fallback clock and local harness with the confirmed canonical 90 BPM that the WordPress page supplies.

The WordPress plugin name is **DanceMoves**. The distributable ZIP deliberately retains the internal `kieran-epk-device-orientation` folder and entrypoint name so WordPress upgrades the installed plugin rather than installing a parallel copy.

## Page properties

Edit Page contains an **EPK Timing** meta box with:

- **BPM**: explicit finite value from 20 to 400. Blank means unknown and the public runtime uses 120 BPM without claiming that 120 is known.
- **Lyric Timing File**: a WordPress Media Library `.lrc` attachment.
- **Cue Timing File**: a WordPress Media Library `.lrc` or `.cue` attachment.
- **Timed lyric pop-ups**: off by default. Enable only when a canonical lyric LRC is selected and the EPK has an approved release-specific lyric treatment.
- **Ambient effect**: None or Paper planes (`_dance_moves_effect = "paper-planes"`). Only selected Pages load the plane assets; the existing hero must provide suitable containment.

The plugin stores attachment IDs and resolves their current WordPress URLs at render time. A hidden, revision-aware master-duration value in milliseconds supports safe matching of public audio that has the same programme length as the canonical master.

Timing files are limited to 1 MiB, must be strict UTF-8, must contain monotonic LRC/CUE timestamps, and cannot contain null or replacement characters. The browser parser treats file contents as data and never executes cue text.

## Musical clock

The shared CSS timing and tick-based helpers follow this numeric rule:

- one timing tick is one sixteenth of a beat: `3.75 / BPM` seconds;
- 16 ticks are one beat and 64 ticks are one 4/4 bar;
- DanceMoves-owned CSS animations, transitions and delays, and tick-based JavaScript effect lifetimes, use integer tick counts;
- durations greater than 16 ticks are rounded to the nearest multiple of 16 ticks;
- exact half-way cases round upward; and
- `prefers-reduced-motion` remains authoritative.

The paper-plane adapter combines page-clock ambient phase with continuous frame-delta physics; its manoeuvres are not audio-seekable or all integer-tick durations. See the [paper-plane clock contract](docs/api/paper-planes.md#rendering-and-lifecycle).

CSS receives versioned custom properties such as `--dance-moves-16t`. JavaScript uses `DanceMoves.durationMilliseconds(ticks)`. Orientation input keeps only the latest finite, screen-aligned sample; the shared scheduler publishes the latest meaningful target at a two-tick cadence and CSS transform transitions interpolate between targets. The first target remains immediate, jitter below the configured delta is suppressed, and teardown cancels any trailing target. Its two-second rolling normalisation is functional input processing, not a visual effect duration.

The catalogue adopter discovers the rendered EPK root, quantizes release-owned stylesheet, inline, computed and generated pseudo-element timing, registers the full release root for cue resets, and repeats the pass after dynamically inserted motion markup. It preserves the one-millisecond view-timeline sentinel used by November Christmas and the 0.01 ms reduced-motion sentinel. Under `prefers-reduced-motion: reduce`, the owned EPK subtree and its pseudo-elements are clamped to one 0.01 ms iteration.

The adopter changes timing ownership, not the creative design: selectors, keyframes, artwork, inputs and release identity remain page-specific. Pointer, scroll and orientation reactions remain event-driven. Canvas/WebGL effects that compute oscillator phase directly from frame time must use the public `DanceMoves.currentTick({ clock: "audio", audio })` value in their page adapter; CSS scanning cannot safely rewrite shader or drawing code.

An element can delay its CSS animation until a musical boundary:

```html
<div data-dance-moves-start-interval="16">Starts on a beat</div>
<div data-dance-moves-start-interval="64" data-dance-moves-start-clock="audio">Starts on a 4/4 bar of the active song</div>
```

Without `data-dance-moves-start-clock="audio"`, declarative starts use the page clock. For transitions or JavaScript-driven updates, use `DanceMoves.deferStart(element, ticks, { clock: "audio", start, id: "release:entrance" })` or `DanceMoves.scheduleAtInterval(ticks, callback, { id: "release:update" })`. Each returns a cancellation function. Stable IDs are required by the pre-live harness so synchronous page work can be attributed to its owning effect.

## Cue behavior and page API

The runtime fetches the page's cue file, finds every `<audio>` whose duration matches the canonical programme, and follows each active player independently. Ordinary seeking re-indexes the cue cursor without replaying skipped cues. An exact cue landing within 50 milliseconds arms only that cue: paused players dispatch it once on the next playback start, while players already running dispatch it as soon as the seek completes.

When a cue occurs during playback, DanceMoves resets every currently running DanceMoves-owned CSS/Web Animation to its first frame and immediately continues it. It does not reset WordPress, browser, player-control or third-party animations.

Page adapters can subscribe without executing timing-file text:

```js
const unsubscribe = window.DanceMoves.onCue("CHORUS 1", detail => {
  // Perform a page-specific update.
}, { id: "release:chorus-state" });
```

`"*"` subscribes to all cues. The runtime also dispatches bubbling `dance-moves-cue` and backwards-compatible `kieran-epk-cue` custom events. Local harnesses can route a data-only cue through the same production path with `DanceMoves.fireCue({ name, type, time })`.

## Timed lyric pop-ups and visual-language workflow

When enabled, DanceMoves creates one non-interactive, `aria-hidden` lyric layer and writes lyric text with `textContent`; timing-file text is never interpreted as markup. The full readable lyric section remains the accessible source, so rapid sung lines are not repeatedly announced by assistive technology. Blank LRC cues clear the layer. Reduced-motion mode keeps the words but removes entrance and exit motion; forced-colours mode supplies a high-contrast fallback.

Page adapters can respond to the same lyric state without running a second parser or clock:

```js
const removeLyrics = DanceMoves.onLyric(detail => {
  document.querySelector('.ks-epk')?.toggleAttribute(
    'data-hook-line',
    detail.normalisedText === 'HAVE SOME TAT'
  );
}, { id: 'release:lyric-treatment' });
```

Each detail also exposes `nextTime`, `nextText`, `nextNormalisedText` and `nextIndex` for the immediate next LRC entry. A blank next entry is deliberately preserved because its timestamp is a real lyric-clear boundary. The final entry reports `nextTime: null`, an empty next text and `nextIndex: -1`. Release adapters may use these fields with `detail.audio.currentTime` for seek-, pause- and playback-rate-safe choreography; they must not fetch or parse the LRC again.

The `nextVisibleTime`, `nextVisibleText`, `nextVisibleNormalisedText` and `nextVisibleIndex` fields instead describe the next nonblank lyric, skipping clear entries. Missing future entries use `null` time, empty text and index `-1`. The [lyric payload reference](docs/api/javascript.md#onlyric) specifies both sets of fields and the separate pause/end responsibilities of a custom renderer.

An EPK may override the neutral component through `.dance-moves-lyric-popover` and `.dance-moves-lyric-popover__text`, their public state attributes, and CSS custom properties. Adoption is a design task, not a switch-only task. Before enabling it for any release:

1. read the release's current visual-language record and inspect its artwork, typography, texture, palette, motifs and motion rules;
2. state what is observed, inferred, proposed and adopted;
3. design a unique lyric container, typography, entrance/replacement motion and any restrained cue-specific emphasis that belong to that song rather than copying another EPK;
4. use DanceMoves ticks or `onLyric()` only—never add a second LRC parser, timer or audio clock;
5. preserve real text, the complete readable lyrics, mobile safe areas, player/control clearance, `prefers-reduced-motion`, forced colours and a static fallback; and
6. stage and test ordinary lines, blank clears, repeated hooks, pause, resume, seek, end, narrow screens and long lines before action-time approval.

The release-local visual-language file and EPK change record must name the treatment, explain why it fits the song, record the fallback, and give a measurable acceptance test. If the visual evidence does not support a distinctive treatment yet, leave the checkbox off.

EPK code can attach one-shot or repeating handlers to the active master-length song clock:

```js
const removeNext = DanceMoves.onNextInterval(updateOnce, 16, { id: "release:next-beat" });
const removeLoop = DanceMoves.onEveryInterval(updateRepeatedly, 64, { id: "release:bar-loop" });

DanceMoves.onNextBeat(updateOnce);  // 16 ticks
DanceMoves.onEveryBeat(updateRepeatedly);
DanceMoves.onNextBar(updateOnce);   // 64 ticks, assuming 4/4
DanceMoves.onEveryBar(updateRepeatedly);
```

Every registration returns a remover. One-shot handlers remove themselves after firing. Repeating handlers pause with playback and stop at the end of the song or when their remover is called. “Bar” deliberately means four beats; a page using another meter should call the interval functions with its explicit tick count.

Performance diagnostics are disabled unless the boot configuration explicitly contains `diagnostics: true`. A development harness may then attach a bounded receiver with `DanceMoves.setDiagnosticsSink(callback)`. The core does not retain, log or transmit diagnostic records, and ordinary WordPress configuration does not enable the sink. Missing cue or interval IDs are reported as unattributed and block pre-live approval.

## Release adapters

- Page 130: Dying for a Diagnosis orientation adapter
- Page 140: Light Will Win orientation adapter
- Page 243: Presents & Chocolate orientation adapter
- Page 252: Made from the Clay and the Stars timing and visual-effects adapter
- Page 268: Fully Nocturnal orientation adapter
- Page 270: Amnesty, honestly? orientation adapter
- Page 276: Walk With Me orientation adapter
- Page 298: Dmitri My Talisman orientation adapter
- Page 839: California Screamin' orientation adapter

Page 252's visual treatment remains release-specific. DanceMoves reuses its neutral timing and input infrastructure elsewhere but does not transplant its clay, cuneiform, cloud, warm-light or button choreography to other EPKs.

While the old `Made from Clay and Stars EPK Effects` plugin is active, DanceMoves suppresses its page-252 assets and content transform. Deactivating the old plugin makes DanceMoves take over on the next request, preventing a double-loaded effect stack.

## Adaptive Clay/Stars performance

Page 252 starts every ordinary session in the `full` profile. DanceMoves waits for the visible page to settle, measures animation-frame intervals for 1.6 seconds and uses the median interval rather than a user-agent or device-class guess. Background/hidden time and individual gaps above 250 milliseconds are discarded, so tab throttling cannot reduce the effect.

Quality decisions are relative to the fastest stable cadence observed after the visible page has loaded and settled, so a smooth 30 Hz display is not misclassified as a failed 60 Hz device. Sustained poor windows step only the release-scoped root from `full` to `constrained`, then to `minimal`. The constrained tier stops the two full-page cloud drifts, the atmosphere particle loop and the ambient gold sparkle loops while preserving their static appearance, BPM/cue behaviour, phone tilt, warm-light response and controls. The minimal tier also removes blur and screen blending from those static ambient planes. Sampling continues lightly at the lowest automatic tier; sustained healthy windows, hysteresis, probation and increasing retry delays allow one-level recovery without oscillation or restarting playback.

The selected profile is exposed as `data-dance-moves-performance="full|constrained|minimal"` on the Clay/Stars EPK root. `DanceMovesClayStars.snapshot().performance` reports the current profile, reason, measured frame-rate statistics and reduction count without retaining or transmitting samples. `prefers-reduced-motion` remains authoritative and stops the sampler as well as non-essential motion.

## Performance guidance

Treat the effect stack as one shared frame budget. A cue that is inexpensive alone can still drop frames when it starts while snow, fog, lyric motion, audio progress, pointer input and theme effects are already active. Audit the combined peak, not only each component in isolation.

| Potential issue | Typical symptom or evidence | Preferred workaround | Verification |
|---|---|---|---|
| Layout work in a frame loop | Repeated layout/recalculate-style work; movement stutters as DOM size grows | Read geometry once outside the hot path; batch remaining reads before writes; animate `transform` and `opacity`; use CSS variables for scoped state; never drive `top`, `left`, `width`, `height`, padding or border geometry every frame | Performance trace shows no recurring layout owned by the effect; element bounds and control geometry remain stable |
| Large CSS blur, filter, backdrop-filter or screen-blended plane | Sustained slowdown while a fog, warmth or glow layer moves | Replace blur with naturally feathered gradients or pre-rendered texture; remove blend modes from moving planes; confine the layer to the smallest explicit region; keep full-scene grading static | Computed style shows no avoidable moving filter/blend; declared effect bounds are smaller than the viewport; representative pixels outside the bounds remain stable |
| Per-particle canvas shadows, gradients or state changes | A cue entrance spikes when particle count rises | Batch similar particles into a few paths/alpha buckets; use halo/core fills or a small cached sprite; group by colour/composite mode; set drawing state once per batch; reserve blur for low-count, short-lived special effects | Focused old/new draw benchmark plus full-stack cue test; source audit confirms the expensive state is not changed per particle |
| Excessive particle or DOM-node count | High scripting/paint cost, garbage collection or slow style calculation | Prefer Canvas/WebGL for dense decoration; cap desktop and compact counts separately; pool/reuse objects and nodes; remove expired items promptly; reduce count before reducing essential content | Diagnostics expose active counts; mobile and desktop peaks remain within the declared caps; no detached-node growth after repeated cues |
| Oversized canvas backing store or uncapped device-pixel ratio | GPU memory/bandwidth rises sharply on high-DPI screens | Size CSS and backing dimensions separately; cap effect DPR (normally lower on compact devices); resize only when dimensions actually change; keep local effects on local canvases | Record CSS size, backing size and effective DPR at desktop/mobile breakpoints; confirm no unexpected allocation after resize |
| Full-canvas clear or repaint while idle | Canvas consumes frame time after the visible effect has ended | Start the renderer only while particles are alive; perform one terminal clear; cancel the frame handle on pause/end/teardown; do not clear an already clean canvas | Idle diagnostics show no effect-owned frame callbacks or clears; replay starts cleanly without a stale frame |
| Several independent `requestAnimationFrame` loops | Each subsystem schedules work separately and peak cue work becomes unpredictable | Share one page-level frame coordinator where practical; otherwise make every loop demand-driven, pause hidden/offscreen work and document its owner; combine snow/fog inputs rather than recomputing them | Diagnostics attribute every callback to an effect ID; hidden, paused and idle states have the expected bounded loop count |
| Per-frame allocation and formatting | Periodic garbage-collection hitch; CPU cost grows with particle count | Reuse arrays/typed arrays/objects; avoid `Array.from`, `filter`, template-string formatting, gradients and path objects in sustained hot loops; allocate finite cue bursts once and mutate in place | Allocation profile remains flat through repeated cues; heap returns to baseline after effects expire |
| Too many promoted layers or indiscriminate `will-change` | GPU memory pressure, flicker or slower compositing despite transform-only motion | Promote only actively moving bounded subjects; remove `will-change` after finite transitions when practical; avoid one composited layer per particle or lyric line | Layer inspection shows a deliberate bounded set; no increase after repeated interactions |
| Transparent overdraw across the viewport | GPU/compositor cost remains high even when elements are visually subtle | Crop canvases and effect planes to their useful area; lower overlapping translucent layer count; render opaque/static material once; avoid stacking multiple full-screen alpha surfaces | Compare the declared painted area with the viewport; full-stack trace improves when the layer is disabled without changing unrelated content |
| Cue-start workload burst | The first chorus/section frame is much slower than the steady state | Precompute deterministic geometry during idle time after load; spread particle births across a beat; avoid compiling shaders, decoding images or creating many nodes at the cue; keep the first cue path warm when safe | Capture the cue entrance separately; no long task or shader/image setup begins at the musical boundary |
| WebGL shader complexity or context loss | Low-end device falls back, turns blank or spends excessive GPU time | Keep shader iterations bounded; use modest precision where visually safe; provide a cheaper Canvas/static fallback; handle `webglcontextlost` and restore only when appropriate; never retry in a tight loop | Test WebGL, forced fallback and context-loss paths; fallback preserves content and cue timing at lower visual cost |
| Resize, pointer, scroll or orientation event storm | Input causes more updates than display frames | Store the latest finite input and commit it once on the next animation frame; debounce expensive resize reconstruction; clamp values and ignore sub-threshold sensor jitter | Event flood test produces at most one visual commit per rendered frame and no layout writes in the handler |
| Timer-based audio choreography | Drift, duplicate work after seeking, or callbacks that continue while paused | Use the shared DanceMoves audio clock and cue/interval API; re-index on seek; cancel on pause/end/teardown; do not add a second timing parser or independent high-frequency timer | Seek, pause/resume, rate-change and duplicate-suppression tests pass without changing BPM or cue timing |
| Hidden-tab throttling misread as weak hardware | Automatic quality drops after switching tabs and never recovers | Exclude hidden time and long throttled gaps; wait for visible settling; use sustained windows, hysteresis, probation and recoverable tier upgrades | Hidden/resume test neither causes a false permanent downgrade nor restarts the song |
| Competing third-party/theme animation or long task | Local microbenchmark passes but the live EPK still misses frames | Profile the rendered page with all production scripts and effects; remove duplicate adapters; defer unrelated non-essential work; prefer fewer simultaneous decorative systems | Signed-out full-stack trace identifies effect ownership; disabling the candidate alone has the expected bounded difference |
| Missing reduced-motion/static path | Low-power or motion-sensitive users still pay for decoration | Treat `prefers-reduced-motion` and the page motion switch as authoritative; avoid creating decorative loops at all; retain readable static content and cue controls | Emulated reduced motion shows no decorative frame loop, stable controls and complete content |

### Performance acceptance target

- Establish the fastest stable foreground cadence after load settles, using the actual candidate stack. A 30 Hz display is not a failed 60 Hz display.
- During steady animation, require the candidate median frame interval to remain within 20% of that stable reference and its 95th-percentile interval within 50%, unless physical-device evidence establishes a stricter release target.
- For a known 60 Hz device, aim for at least 50 rendered frames per second during the busiest sustained passage; for a known 30 Hz device, aim for at least 27. These are acceptance targets, not claims about an unknown display.
- A cue entrance must not add an effect-owned task longer than one reference frame budget. Inspect the entrance separately from the following steady loop.
- Test the full simultaneous peak at desktop, representative tablet and compact mobile sizes. Include reduced motion, hidden/resumed playback and the cheapest declared fallback tier.
- Synthetic benchmarks can compare implementations, but only an attended physical-device run or trustworthy foreground trace can establish perceptual frame-rate success.

Choose the cheapest effect that delivers the documented art direction. Prefer, in order: a transform/opacity change on one bounded element; a finite CSS transition; a small batched Canvas effect; an adaptive Canvas/WebGL system with a static fallback; and only then a sustained multi-layer renderer. Do not add another continuous full-viewport system when a local finite cue effect communicates the same idea.

## Validation and packaging

The complete test design and publication gates are in `TEST-PLAN.md`.

For every new or materially changed EPK effect, use the [checked-in development and harness workflow](docs/development.md). It covers manifest-driven controls, deterministic input/cue simulation, attributable timing, scoped CSS audits and pre-live evidence without publishing or writing to WordPress.

In the source repository, run `tools/validate.ps1 -Mode Unit` for the normal read-only validation path. It checks syntax, automated contracts, strict UTF-8 and the Clay content transform without rebuilding migration or package artifacts. Run `tools/validate.ps1 -Mode Package` only when an explicit migration/package rebuild is intended, or `tools/validate.ps1 -Mode All` for both stages. Development tests and tools remain in the repository and are intentionally excluded from the WordPress ZIP.

The validator checks PHP and JavaScript syntax, unit/contract tests, strict UTF-8, the page-252 content transform and plugin identity. Package mode additionally rebuilds migration/package artifacts and verifies the distributable ZIP layout, version and hashes. `tools/test-validator-failure.ps1` proves that a deliberate syntax failure returns non-zero and is attributed to its fixture. Both Unit and Package validation are mandatory for the exact ZIP before every WordPress upload.

After every authorised upload, arm browser exception capture before loading the public site and sweep every published EPK in the canonical catalogue. Block completion or roll back when any page emits a new syntax/uncaught exception, fails a required plugin asset, renders `&#038;&#038;` or `&amp;&amp;` inside executable inline code, or exposes only the shared cue-ready marker without its page adapter's initialization marker. This browser-native post-upload gate catches WordPress rendering corruption that local plugin-source parsing cannot see. A clean parse sweep is necessary but does not replace attended playback and motion QA.

No WordPress upload, timing-media upload, page-meta save or legacy-plugin deactivation should occur until the exact ZIP and migration manifest have action-time approval. Public verification must cover signed-out desktop, tablet and mobile rendering, Unicode, reduced motion, audio/chapter controls, cue resets, named handlers and all nine registered orientation adapters.

For the EPK download route, verify one rendered MP3 download anchor from each materially different markup pattern, require a signed DanceMoves URL, and capture its response headers. The download response must be HTTP 200 with `Content-Type: audio/mpeg`, `Content-Disposition: attachment` and the expected byte count. Independently reload at least one on-page player and require its direct media request to remain HTTP 206/200 `audio/mpeg` with no forced-attachment header. A successful WordPress plugin notice does not prove either behaviour.

## Rollback

- Shared-runtime regression: reinstall the exact previously approved, compatible ZIP and verify its recorded checksum; preserve page metadata and confirm the rollback still supports the page integrations in use.
- Page-252-only regression: reactivate `Made from Clay and Stars EPK Effects` 1.0.0; DanceMoves then suppresses its page-252 adapter.
- Metadata problem: restore the Page meta revision or clear the attachment ID. Do not delete shared Media Library files without first auditing references.

## Potential problems

Start with the deployed plugin version, the browser console/network panel and the
specific API's snapshot. These are current integration checks, not a log of past
shell errors or resolved development incidents.

| Symptom | What to check | Reference |
| --- | --- | --- |
| Runtime missing, or an older version appears | Confirm the selected release/tag, Page request, footer script output, dependency order and loaded asset versions. `main` is not the 2.8.0 release baseline. | [Loading and configuration](docs/api/javascript.md#loading-globals-and-types) |
| Cues or lyrics do not appear | Verify the selected UTF-8 timing attachment, bracketed timestamps, successful fetch and master-duration match. Call `discoverAudio()` for deliberately inserted players. A final status of `none` can mask a fetch failure: inspect the request and entry counts. | [Audio discovery](docs/api/javascript.md#audio-discovery-and-playback) |
| A chapter landing or resumed section has the wrong visual state | Core LRC subscriptions arm one cue within 50 ms. Shared timelines instead reconstruct active intervals and default to no landing callbacks; use their render state for persistent section styling. Do not replay skipped transient cues to restore a section. | [Cue timelines](docs/api/effects.md#cuetimelineoptions) |
| Custom lyric styling fails, or remains visible on pause | The generated layer is a direct child of `body`, not `.ks-epk`. Use `nextVisible*` only for a nonblank preview; preserve blank clear cues. Custom renderers must handle pause/end separately. | [Lyric styling](docs/api/styling.md), [lyric events](docs/api/javascript.md) |
| Phone motion is absent | Check the adapter's root, mobile/sensor/secure-context gates, user permission and reduced-motion state. Verify real sensor events on the intended device; a synthetic event is not physical-device evidence. | [Orientation runtime](docs/api/adapters.md) |
| Paper planes are absent or obscure the hero | Save Ambient effect = Paper planes, provide `.ks-epk .epk-hero`, verify the atlas request and hero containment/stacking. Reduced-motion and forced-colour CSS intentionally hide decoration; offscreen/hidden state pauses flight. | [Paper-plane requirements](docs/api/paper-planes.md) |
| Animation slows down or quality appears stuck | Measure the full visible page after load, inspect the active controller's snapshot and remove duplicate effect owners. Shared `quality()` and Clay/Stars use different thresholds and recovery rules; neither is a physical refresh-rate detector. | [Shared quality](docs/api/effects.md#qualityoptions), [Clay/Stars](docs/api/adapters.md) |
| An MP3 opens inline or its download returns 404 | Rewriting requires an explicit `<a download>` processed through main Page content and a supported local uploads URL. Check the signature and readable local MP3. Keep direct `<audio>`/`<source>` responses inline; do not force attachment headers site-wide. | [Download endpoint](docs/api/downloads.md) |
| Validation fails in a fresh checkout | Use the documented Unit coordinator and check the named missing fixture or hash mismatch. Build required previews from approved canonical inputs; do not weaken a failing assertion or treat a missing browser/device run as a pass. | [Development prerequisites and gates](docs/development.md) |

For a new issue, record the plugin commit/version, affected API or page root,
minimal reproduction, expected/actual result and relevant evidence. Do not put
one-off command mistakes, private workspace paths or resolved incident diaries
back into this section. Existing release and deployment history remains in Git,
`migration/` and `qa/`.
