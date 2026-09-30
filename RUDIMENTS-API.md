# DanceMoves rudiment animation API

API **1.1.0** is the selected-catalogue DanceRudiments 0.2 integration shipped
with DanceMoves 3.1.1. Repository source or a passing build is not by itself
evidence of npm, GitHub or WordPress publication.

The integration pins the published npm package `@kieransimkin/dance-rudiments` **0.2.0**, release commit `7f77874efa8a8ff96e9b1a866f14c5773553b9b6`. [UPSTREAM.json](vendor/dancerudiments/UPSTREAM.json) records the exact npm integrity, licence hash, 1,731-item source catalogue count and DanceMoves' 15-item selection. [TypeScript declarations](RUDIMENTS-API.d.ts) describe the public browser interface.

## Contents

[Architecture](#architecture-and-native-authority) · [Quick start](#quick-start) · [Catalogue](#catalogue) · [Service API](#service-api) · [Animation options](#animation-options) · [Controller API](#controller-api) · [Frame payload](#render-callback-payload) · [Clocks](#clock-and-lifecycle-contract) · [CSS](#css-and-html-contract) · [Events](#events-and-errors) · [Consumer integration](#consumer-owned-page-integration) · [WordPress](#wordpress-and-packaging) · [Build and validation](#building-and-testing) · [Limitations](#limits-and-extension-policy)

## Architecture and native authority

DanceRudiments defines positions; DanceMoves supplies musical time, lifecycle and rendering. There is no second audio clock, no beat detector, no LRC reparser and no JavaScript copy of a movement formula.

The backend is a **selected complete-integer-domain WASM lookup build** produced through the official 0.2.0 npm API. This distinction matters:

1. The build calls the official `bindNative`, `catalogue` and `sample` APIs and verifies that the source catalogue has exactly 1,731 movements.
2. It exports every integer pip only for the 15 movements in the reviewed DanceMoves allow-list, then encodes those exact IEEE-double values into a tiny import-free WebAssembly lookup module.
3. The generated browser asset contains the native module as base64 plus catalogue metadata. JavaScript selects the pattern and musical pip; native WASM returns the three coordinates.

For this pinned upstream API, each selected movement depends only on a name and integer pip with a finite periodic domain. Exhaustively compiling each selected domain preserves the upstream sampling contract; it is not sparse curve fitting or a JS approximation. The 15 selected movements comprise 1,856 unique positions. The full upstream WASM is deliberately not shipped to every WordPress page. The compact module is 44,866 bytes with no host imports, and the build compares all three axes at 5,568 wrapped positions against the official API.

The compiled browser asset is checked in. **No npm install, CDN access, Python interpreter, compiler or WASM MIME configuration is needed on the WordPress server.** Compilation is lazy and occurs once per document when `ready()` or `animate()` is used. If WASM is unavailable or blocked, loading rejects; there is deliberately no fallback JS motion implementation. Consumers retain their own static or legacy fallback styling.

This backend covers the pinned **integer-position** API only. Future upstream parameterised, stateful, curve or event APIs must receive a separately versioned binding. They must not silently be reduced to this fixed lookup contract.

## Quick start

Enqueue your page adapter with `dance-moves-rudiments` as a WordPress script dependency. That ensures the synchronous API object exists before the adapter executes; `ready()` handles asynchronous WASM compilation.

```js
const rudiments = window.DanceMovesRudiments;
// window.DanceMoves.rudiments is the same object.
const controller = rudiments.animate({
  id: 'my-release:hero-sway',
  rudiment: 'sway',
  root: '.my-release',
  target: '.my-release .moving-subject',
  clock: 'audio',
  audio: '.my-release audio',
  amplitude: { x: 12, y: 0, z: 0 }
});
controller.ready.catch(error => {
  console.warn('Rudiment unavailable; keep the static artwork.', error);
  controller.destroy();
});
// On page-adapter teardown, call controller.destroy().
```

```css
.my-release .moving-subject {
  transform: translate3d(
    var(--dance-moves-rudiment-x, 0px),
    var(--dance-moves-rudiment-y, 0px),
    var(--dance-moves-rudiment-z, 0px)
  );
}
@media (prefers-reduced-motion: reduce), (forced-colors: active) {
  .my-release .moving-subject { transform: none; }
}
```

The target must already exist. Target a bounded decorative child, not player controls or a full-page colour layer. The default CSS renderer writes variables, **not** a `transform`, so it cannot overwrite an existing transform accidentally. A page may compose those variables with its own CSS transform or use a separate child for motion.

For manual/native sampling without an animation controller:

```js
await window.DanceMovesRudiments.ready();
const offset = window.DanceMovesRudiments.sample('clay_background', 100);
// Approximately { x: -1, y: 0.9, z: 0 }; caller selects units.
const pip = window.DanceMovesRudiments.pipsFromTicks(16); // 64, not 16
```

## Catalogue

Use names as identifiers. `index` is native catalogue order for this pin, not a stable identifier across upgrades. Dimensions indicate occupied axes, not automatic mapping to a particular CSS direction. In particular, upstream's `bounce` description says vertical, but its single coordinate is returned in **x**; a vertical consumer must map x to its y translation.

| Name | Period pips | Beats at rate 1 | Dimensions |
| --- | ---: | ---: | ---: |
| `bounce` | 64 | 1 | 1 |
| `sway` | 128 | 2 | 1 |
| `circle` | 64 | 1 | 2 |
| `figure_eight` | 128 | 2 | 2 |
| `step_touch` | 128 | 2 | 2 |
| `box_step` | 256 | 4 | 2 |
| `helix` | 256 | 4 | 3 |
| `clay_background` | 256 | 4 | 2 |
| `single_stroke_roll` | 64 | 1 | 2 |
| `double_stroke_roll` | 64 | 1 | 2 |
| `multiple_bounce_roll` | 64 | 1 | 2 |
| `single_paradiddle` | 128 | 2 | 2 |
| `flam` | 64 | 1 | 2 |
| `drag` | 64 | 1 | 2 |
| `five_stroke_roll` | 128 | 2 | 2 |

## Service API

The frozen service is available as both `window.DanceMovesRudiments` and `window.DanceMoves.rudiments` after the integration script executes. It does not replace `DanceMoves`, `KieranEpkMotion` or `DanceMovesEffects`.

### Properties

| Property | Value / meaning |
| --- | --- |
| `version` | `'1.1.0'`: this API's contract version, not the plugin version |
| `upstreamVersion` | `'0.2.0'`: the pinned library version |
| `upstreamCommit` | Exact pinned source commit |
| `sourceCatalogueCount` | `1731`: movements available in the pinned upstream catalogue; `catalogue()` remains the reviewed 15-movement browser selection |
| `pipsPerBeat` | `64` |
| `ticksPerBeat` | `16`: DanceMoves timing ticks |
| `pipsPerTick` | `4` |

### `ready(): Promise<RudimentApi>`

Lazily compile and validate the bundled WASM ABI, pattern count and periods. Repeated calls return the same promise and never create duplicate native instances. Resolves with the service. Rejects when data is absent/incompatible, WASM compilation is unavailable/blocked or the native ABI disagrees. A rejected load is cached; reload the document after correcting the cause rather than creating a retry loop.

`catalogue()`, `describe()` and unit conversion work before native compilation. `sample()` requires readiness. `animate()` obtains readiness internally and exposes its own `controller.ready`.

### `catalogue(): readonly RudimentInfo[]`

Return the frozen catalogue array; each record is also frozen. Fields: `name`, `description`, `periodPips`, `dimensions` and `index`. No WASM compilation is started by this call.

### `describe(name: string): RudimentInfo | null`

Exact, case-sensitive lookup. Returns the same frozen catalogue record or `null` for an unknown name. Does not create an instance.

### `sample(name: RudimentName, pip: number): Offset3`

Return a fresh `{ x, y, z }` native offset for an **integer** musical pip. Coordinates are dimensionless and normally within `[-1,1]`. Negative inputs wrap around the period. JavaScript safe integers larger than signed 32-bit are reduced to the period **before** entering the native signed-int ABI.

Unknown names throw `RangeError`; non-numeric/non-finite inputs throw `TypeError`; fractions or unsafe integers throw `RangeError`; an unready backend throws `Error`. There is no implicit numeric-string coercion, interpolation, amplitude scaling, DOM write, timestamp conversion or registration.

### `pipsFromTicks(ticks: number): number`

Convert DanceMoves ticks to an integer pip: `floor(ticks * 4)`. Finite fractions and negative positions are allowed. A tiny `1e-9` pip tolerance prevents floating-point roundoff just below an exact musical boundary from selecting the preceding pip. The result must be a safe integer. Do **not** pass this value through `DanceMoves.quantizeTicks()`.

### `pipsFromSeconds(seconds: number, bpm?: number): number`

Convert seconds to pips: `floor(seconds * bpm * 64 / 60)`, with the same boundary tolerance. BPM defaults to the page's `DanceMoves.bpm`; explicit BPM must be finite and within `[20,400]`. Seconds must be a finite number. This is a pure conversion; it does not inspect audio playback or change the page BPM.

### `animate(options: RudimentOptions): RudimentAnimation`

Synchronously validate the registration, reserve its ID and return a controller with a `ready` promise. Mounting does not call `audio.play()` or change playback rate. The first eligible pose is rendered after native readiness; hidden, offscreen or manually paused mounts defer drawing until eligible. A destroyed pending mount cannot revive itself when compilation completes.

Duplicate IDs are rejected, **not** silently replaced. Destroy the old instance first. Only one automatic CSS-output owner may target a given element. Multiple custom-render instances may share a target with `css:false`, but the page must keep their outputs separate.

### `get(id: string): RudimentAnimation | null`

Return the existing controller, including a pending or failed controller, or `null`. The ID is the exact trimmed registration ID. No new controller is constructed.

### `snapshot(): object`

Return `{ version, upstreamVersion, loaded, error, framePending, instances }`. `loaded` means the shared WASM backend compiled. `error` is the native-loading error or `null`; per-controller rendering errors are in `instances`. `framePending` refers only to this integration's shared scheduler, not all DanceMoves or theme animation. `instances` contains fresh controller snapshots, not live DOM references. No frame history, audio history, logging or telemetry is retained by the service.

### `destroyAll(): void`

Destroy every currently registered rudiment controller. It does not pause audio, destroy the core DanceMoves runtime or unload the shared WASM backend. The singleton's visibility/page-lifecycle listeners remain available for subsequent registrations. Prefer per-controller destruction when several page adapters coexist.

## Animation options

Options are fixed after construction except `enabled` and the local pause state. Change name, rate, amplitude, phase, target or audio by destroying and remounting. The provided object is not a supported live configuration channel.

| Option | Type / default | Contract |
| --- | --- | --- |
| `id` | Required string | Trimmed, 1–160 characters, unique per document. Use a release/effect-specific stable ID. |
| `rudiment` | Required catalogue name | Exact case-sensitive name. |
| `target` | Required Element or selector | Must resolve now to one element. Selectors use `document.querySelector`. |
| `root` | Element or selector; defaults to target | Lifecycle/visibility root; target must equal it or be its descendant. |
| `clock` | `'page'` by default; `'audio'` or `'auto'` | Clock semantics below. |
| `audio` | HTMLAudioElement or selector | Required for `audio` and `auto`. Ignored for `page`. Cannot be a video or arbitrary clock object. |
| `rate` | Number; `1` | Rudiment cycles per native musical period; strictly greater than 0, at most 64. `0.5` doubles cycle duration. It is **not** `audio.playbackRate`. |
| `phasePips` | Safe integer; `0` | Signed native-pip offset, applied after rate conversion. |
| `amplitude` | Number or `{x?,y?,z?}`; `1` | Pixel gains. A scalar applies to all axes. Missing object axes are zero. Finite signed gains within ±10,000 are allowed; the page must choose appropriately bounded motion. |
| `enabled` | Boolean; `true` | `false` displays a neutral zero-offset pose and stops sampling. |
| `css` | Boolean; `true` | Write scoped x/y/z pixel custom properties. `false` leaves visual output entirely to `render`. |
| `cssPrefix` | String; `'--dance-moves-rudiment'` | Prefix for `-x`, `-y`, `-z`; must match `^--[A-Za-z][A-Za-z0-9_-]{0,75}$`. |
| `offscreen` | Boolean; `true` | Suspend outside the root's intersection when IntersectionObserver is available. No polyfill or offscreen suspension is promised without it. |
| `resetOnCue` | Boolean or cue name; `false` | `true` subscribes to all core cues; a non-empty string selects one normalised core cue name. Matching audio or manual cues reset the phase origin. Unrelated players are ignored. |
| `renderEveryFrame` | Boolean; `false` | Default suppresses unchanged-pip frame callbacks. `true` delivers continuous phase for companion art direction; native positions still use discrete integer pips. |
| `render` | Optional function | Receives the frame payload after optional CSS output. Called synchronously; do not return a promise or create a second clock. |

Invalid types/numbers/selectors throw synchronously before registration. A failed native or stylesheet mount rejects `controller.ready` and reports an error event. Runtime callback failures stop that instance, release its CSS ownership and report the error; unrelated instances continue.

The controller snapshots the options used by the contract. Do not mutate callback payloads or use them as writable state; their TypeScript interfaces are readonly. Callback objects are short-lived observations.

## Controller API

`id` is readonly. `ready: Promise<RudimentAnimation>` resolves to the same controller when native/CSS setup is complete (drawing can remain deferred by lifecycle state); it can resolve to an already-destroyed controller when teardown happened during a successful shared load. It rejects on native, CSS-output or initial-render failure. Catch it even though the implementation internally marks rejection handled for fire-and-forget use.

| Method | Result and lifecycle effect |
| --- | --- |
| `pause(): void` | Locally hold the last pose and remove the instance from the shared frame scheduler. Does not pause audio. |
| `resume(): void` | Clear local pause and resample the current clock when permitted. Does not bypass `enabled:false`, reduced motion, forced colours, hidden/offscreen state or paused audio. |
| `setEnabled(boolean): void` | Disable to neutral zero output and stop work; enable to reconstruct current position. Suitable for a quality-tier gate. Non-boolean values throw. |
| `reset(): void` | Set the current source beat as the new phase origin; the next eligible sample starts at `phasePips`. Does not seek audio or replay events. |
| `refresh(): void` | Reconcile lifecycle and render the current permitted pose, including a paused audio seek result. Local `pause`, hidden/offscreen and in-progress seeking continue to hold. |
| `snapshot(): RudimentAnimationSnapshot` | Return serialisable diagnostic state; fields below. |
| `destroy(): void` | Idempotently stop work, release ID/CSS ownership, remove audio/media-query/cue/intersection listeners and restore the target's original CSS cascade. |
| `teardown(): void` | Exact alias of `destroy()`, for consistency with other DanceMoves adapters. |

After destruction, lifecycle mutators are no-ops; `snapshot()` still works. `setEnabled()` still validates its argument. Do not remount from a stale destroyed handle; call the service with a new registration. The service automatically destroys registrations when their root or target is removed (MutationObserver when available, otherwise while a running frame is reconciled).

Controller snapshot fields are `id`, `rudiment`, `status`, `enabled`, configured `clock`, `rate`, `phasePips`, `destroyed`, `loaded`, `error`, `updates`, last `pip`, last `sourceClock`, last pixel `position`, and `framePending`. `updates` counts payload publications, including lifecycle neutral updates; it is not the display's rendered FPS. Last-position fields are `null` before a first render. `loaded` remains true after a previously loaded controller is destroyed; consult `destroyed`/`status` for activity.

Status values: `loading`, `running`, `paused`, `disabled`, `hidden`, `offscreen`, `reduced-motion`, `forced-colors`, `audio-paused`, `seeking`, `ended`, `error`, `destroyed`. They are observations, not a writable enum.

## Render callback payload

| Field | Meaning |
| --- | --- |
| `id`, `rudiment` | Registration ID and pattern name |
| `root`, `target` | Actual elements; never serialise these into telemetry |
| `audio` | Selected audio when using the audio clock; otherwise `null` |
| `clock` | Resolved `'page'` or `'audio'`, never `'auto'` |
| `sourceBeats` | Current source position in page-configured beats |
| `bpm`, `rate` | Effective page BPM and rudiment rate |
| `pip` | Wrapped integer in `[0,periodPips)`; `null` for neutral accessibility/disabled updates |
| `positionPips` | Unwrapped integer pip after origin/rate/phase; likewise `null` for neutral updates |
| `loopProgress` | Continuous wrapped phase `[0,1)` from the same clock; zero for a neutral update |
| `durationMilliseconds` | One pattern cycle at page BPM and rudiment rate, expressed for audio playbackRate 1 |
| `offset` | Native normalised `{x,y,z}`, or all zero for a neutral update |
| `position` | Pixel `{x,y,z}` after amplitude scaling |
| `reason` | `'frame'` or the status that caused a lifecycle publication |

`loopProgress` exists for companion CSS/WAAPI art direction. It is not an interpolated native coordinate. `sample()` and `offset` remain exactly integer-pip based. A slow display skips visual samples and renders the latest pip; the API does not dispatch one event for each skipped pip or attempt timer catch-up.

A custom renderer can consume normalised coordinates in another unit with `css:false`. It remains responsible for hiding/stopping its custom drawing on neutral updates and for cleaning up its own objects after controller destruction. `destroy()` removes integration resources; it cannot reverse arbitrary DOM/canvas mutations performed by a callback. Use CSSOM or WAAPI for visual updates where possible: writing inline `style` attributes inside the catalogue-owned root can invoke the existing catalogue timing observer.

## Clock and lifecycle contract

One DanceMoves tick is `1/16` beat; one native pip is `1/64` beat. The clocks are converted explicitly:

```text
page source beats = DanceMoves.currentTick({clock:'page'}) / 16
audio source beats = audio.currentTime * DanceMoves.bpm / 60
precise native pips = (source beats - reset origin) * 64 * rate + phasePips
sample pip = positive modulo(floor(precise native pips + 1e-9), periodPips)
loop duration ms = (periodPips / 64 / rate) * (60000 / page BPM)
```

`page` follows the existing page clock independently of audio. `audio` always reads the explicit player's current time, even while paused. It does **not** call `DanceMoves.currentTick({clock:'audio'})`, whose core implementation can fall back to the page clock. The new API therefore cannot accidentally resume ambient motion when a selected audio player pauses.

`auto` uses page time until it observes the first playback of its selected audio (or the audio is already playing at mount). It then latches to that audio, including pauses/end; it does not switch back to page time. This preserves an ambient introduction without inventing a second timer. Auto's first page-to-audio transition clears the prior page-clock reset origin.

`audio.playbackRate` already affects the rate at which `audio.currentTime` advances. Multiplying by it again would double-count the tempo. The `rate` option independently compresses/stretches the rudiment's musical period.

On `seeking`, clear the old reset origin and hold the previous visual until `seeked`. On landing, reconstruct from the player's actual time; no skipped pattern samples or cue events are replayed. An explicitly enabled core cue reset may establish a new origin at a cue landing through the existing core event path. Pause holds the audio pose, and end stops frame scheduling. Replay/seek uses the same absolute-time rules.

Hidden documents, pagehide, offscreen roots, reduced motion, forced colours and disabled instances do not keep an integration-owned RAF alive. When work becomes eligible again, sample the actual current position rather than integrating a wall-clock delta. With several eligible instances there is **one** shared RAF, not one per rudiment.

`pause()` is a local pose hold, not transport time preservation: if the source continues, `resume()` jumps to its correct current phase. `reset()` is an explicit phase-origin change, not a tempo change. Existing DanceMoves core cue resets and the new `resetOnCue` option are distinct mechanisms; use the latter only when a page deliberately wants its native cycle to restart at cues.

## CSS and HTML contract

Automatic output creates a stylesheet rule targeting the generated `data-dance-moves-rudiment-owner` attribute on the exact target. It sets `<prefix>-x`, `<prefix>-y`, `<prefix>-z` as six-decimal **pixel** values with `!important`. It does not set `transform`, `translate`, colour, opacity, dimensions or positioning.

The defaults are `--dance-moves-rudiment-x`, `--dance-moves-rudiment-y` and `--dance-moves-rudiment-z`. A target must not already contain the reserved owner attribute. Use `css:false` to opt out of this ownership contract. Do not use competing inline-important declarations for these reserved output variables.

The stylesheet is `#dance-moves-rudiment-values`. Hot-path values update `CSSStyleRule.style`, **not** `target.style`; this avoids activating the existing catalogue adopter's subtree `style`-attribute observer on every sample. This does not mean CSS changes are free: rendering/style costs still need profiling on the full page. Only changed strings are written. The owned rule and attribute are removed on destroy, revealing the original author cascade; no original inline style is deleted or rewritten.

Reduced motion and forced colours publish zero-offset output and stop scheduling. Retain page-level CSS fallbacks as well, especially for custom renderers and environments where the integration script never loads.

## Events and errors

Events are bubbling `CustomEvent`s dispatched on `document`. Bubbling preserves
document-level WordPress consumers when a scoped runtime emits from a nested root.
The host-neutral `dance-moves-ready` event means the runtime and synchronous
rudiment service object are available; it does not eagerly compile the WASM.

| Event | Detail | When |
| --- | --- | --- |
| `dance-moves-rudiments-ready` | `{api, version, upstreamVersion, upstreamCommit}` | Once after successful lazy native compilation |
| `dance-moves-rudiments-error` | `{id, message}` | Shared load failure (`id:null`) or a specific mount/render failure |

Subscribe before calling `ready()` when native event order matters; events are not replayed to late listeners. Prefer the readiness promise for native sampling. No per-pip DOM event is emitted, avoiding event storms.

Synchronous registration errors throw. Asynchronous initial errors reject `controller.ready`; ongoing render errors set its state to `error`, stop its frame work and release CSS ownership. Failed controllers remain inspectable in the registry until destroyed. Native-loading failure can produce both the shared error and per-controller errors; consumers should not treat those as separate user-facing incidents.

CSP can block WASM compilation or the generated stylesheet. A compatible policy must permit the bundled script, WebAssembly compilation and this style creation. Do not weaken a site's policy automatically. Correctly retain static/legacy rendering on failure and obtain a reviewed site-policy change where needed. No remote executable text, timing-file text or caller-provided CSS source is evaluated by this API.

## Consumer-owned page integration

DanceMoves does not recognise, configure or auto-mount a particular EPK. The
owning page selects its target, rudiment, rate, amplitude, CSS variables and any
companion treatment. Mount immediately when the API exists, or listen once for
the generic bubbling runtime event when WordPress prints the runtime in the
footer. Do not wait for `dance-moves-rudiments-ready` as the bootstrap signal:
native compilation is lazy and that event fires only after a consumer calls
`ready()` or `animate()`.

```js
function mountRudiment() {
  const root = document.querySelector('[data-my-page]');
  const target = root?.querySelector('[data-my-motion-target]');
  if (!root || !target || !window.DanceMovesRudiments) return;
  const controller = window.DanceMovesRudiments.animate({
    id: 'my-page:ambient-motion', root, target, rudiment: 'sway',
    clock: 'auto', audio: root.querySelector('audio'), rate: 0.5,
    amplitude: {x: 12, y: 8, z: 0}, cssPrefix: '--my-page-motion'
  });
  controller.ready.catch(() => root.dataset.myMotion = 'fallback');
}
if (window.DanceMovesRudiments) mountRudiment();
else document.addEventListener('dance-moves-ready', mountRudiment, {once:true});
```

Keep page selectors, release names, colours, timing choices, amplitudes,
companion keyframes, quality mappings and fallback markers in the page source.
Use `get(id)` for diagnostics and `destroy()` or `destroyAll()` for teardown. Do
not mount two CSS-owning controllers on the same target.

## WordPress and packaging

The entrypoint requires `dance-moves-rudiments.php`. It defines `DANCE_MOVES_RUDIMENTS_API_VERSION` (`1.1.0`) and registers `dance_moves_enqueue_rudiments(): void` on `wp_enqueue_scripts` at priority **25**, after the existing core runtime's priority 20.

| Handle | Type | Dependencies / scope |
| --- | --- | --- |
| `dance-moves-rudiments-native` | Footer script | Compact selected-movement WASM asset; all WordPress Pages |
| `dance-moves-rudiments` | Footer script | `dance-moves-core`, `dance-moves-rudiments-native`; all Pages |

The API can be used on any WordPress Page. Non-Page requests receive none of
these assets. The bridge contains no page IDs, release selectors, release names,
page-owned styles or auto-mount behaviour.

Cache versions combine the plugin version and API version. DanceMoves **3.1.1**
ships rudiment API **1.1.0**; publishable artifacts come only from the release
workflow.

The release workflow verifies the native bundle before packaging and includes the PHP module, both API-reference files and the pinned provenance record alongside the generated assets. The package retains `kieran-epk-device-orientation` as its WordPress upgrade slug. Tests, node modules and build tooling remain repository-only. The complete upstream licence accompanies the generated native browser asset.

## Building and testing

Normal consumers use the checked-in generated native bundle. Rebuild only when reviewing an upstream/library/backend change.

```sh
# Node calls the pinned official API; Python creates the deterministic compact lookup.
python tools/build-rudiments.py

# Compare the committed backend against fresh official-API samples without writing it.
python tools/build-rudiments.py --check

# Read-only package/hash/ABI gate; no compiler required.
node tools/verify-rudiments.cjs

node tests/rudiments-runtime.test.cjs
node tests/rudiments-source.test.cjs
php tests/rudiments-wordpress.php
tsc --noEmit --strict --lib es2020,dom RUDIMENTS-API.d.ts
```

The generator verifies the installed package against `package-lock.json` and the pinned registry integrity and licence hash. It rejects package drift, source-catalogue count drift and selection drift rather than fetching a moving branch. Review a new exact upstream release deliberately, rebuild, rerun exhaustive parity, then update both the DanceMoves version and evidence.

The build is deterministic for the same official package samples and records the generated JS and WASM SHA-256 values without wall-clock timestamps. The committed native asset and recorded digest are the release inputs.

The normal Unit validator discovers the new `.test.cjs` files and explicitly runs the PHP enqueue test. It remains necessary to run the existing DanceMoves suite. Package mode has its pre-existing migration/release-workspace prerequisites.

[Browser fixture](tests/rudiments-browser.html) uses the real generic API and
WASM with an explicitly labelled clock test double and locally generated silent
audio. It is not a live EPK. With Python Playwright and a permitted Chromium
installation:

```sh
python tests/test-rudiments-browser.py --chromium /path/to/chromium --output qa/rudiments-browser
```

The fixture exercises CSSOM translation, audio seeking, enabled/accessibility
state, failure reporting and teardown. It also counts inline-style mutations. A
browser navigation failure means the rendering tests did not run; it is not a
pass. Headless results do not establish physical-device FPS, GPU cost, input
latency or WordPress compatibility.

## Limits and extension policy

This API does not import timing files, infer BPM, synchronise multiple players, emit drumming stroke events, expose Python tooling in the browser or wrap unmerged future curve/event infrastructure. Each controller has an explicit clock/target; a new controller is required to change them. A pattern is sampled only at integer native pips, with no implicit interpolation.

The core's animation-reset API does not own this controller's CSSOM variables; use `resetOnCue` deliberately. Conversely, the new controller does not own or stop unrelated core/theme RAF loops. `snapshot().framePending === false` means the rudiment scheduler is idle, not that the whole page is idle.

CSSOM output still has rendering cost and callbacks allocate payload objects.
Full-page performance must be measured before deployment. Browser rendering is
not proven merely by native or mocked-DOM tests.

As the upstream library grows, retain DanceRudiments as movement authority and add movements to the explicit allow-list only when a DanceMoves consumer uses them. Do not ship the full catalogue by default or invent JavaScript formulas. A future parameterised/stateful API needs a separately versioned binding behind the same readiness, lifecycle and capability-error contracts.

## Source reference

- [Pinned DanceRudiments 0.2.0 source](https://github.com/kieransimkin/DanceRudiments/tree/7f77874efa8a8ff96e9b1a866f14c5773553b9b6): official package API, catalogue and licences.
