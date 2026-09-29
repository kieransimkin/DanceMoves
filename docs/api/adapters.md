# Catalogue, orientation and release-adapter APIs

[Documentation index](../README.md) · [Core JavaScript](javascript.md) ·
[CSS/HTML](styling.md)

Baseline: **2.8.0 / `4cb6a71f60459b5579be87d7e55ac8b1426c578e`**.
Conditional globals exist only when their asset and required root have loaded.
These APIs do not create a missing EPK or register a new WordPress Page mapping.

For the separate reusable factories see [shared effects](effects.md); for the
page-selected sprite renderer see [paper planes](paper-planes.md). Their lifecycle
and quality rules differ from this file's release-specific Clay/Stars API.

## Catalogue timing

Source: [dance-moves-catalogue-timing.js](../../assets/dance-moves-catalogue-timing.js).

Root discovery first selects `.ks-epk`. Only when that is absent does it use the
configured Page ID's fallback:

| Page ID | Fallback selector |
| --- | --- |
| 130 | `.dfad-motion-stage` |
| 137 | `.birth-stories-page` |
| 140 | `#light-will-win-top` |
| 150 | `.mog-epk` |
| 298 | `.dmt-epk` |
| 397 | `.sft-epk` |
| 399 | `.entry-content` |

Other IDs use the implementation sentinel `[data-dance-moves-no-root]`, not a
publicly configurable selector. With no core/root, the script returns without
installing an API. Root discovery happens once, not on every later DOM insertion.

### Methods and aliases

| Method | Return | Behaviour |
| --- | --- | --- |
| `DanceMovesCatalogueTiming.apply()` | `CatalogueSnapshot` | Re-runs the conversion pass synchronously and marks readiness. |
| `DanceMovesCatalogueTiming.snapshot()` | `CatalogueSnapshot` | Reads evidence without running conversion. |
| `DanceMoves.applyCatalogueTiming()` | `CatalogueSnapshot` | Same function as `.apply()`. |
| `DanceMoves.catalogueTimingSnapshot()` | `CatalogueSnapshot` | Same function as `.snapshot()`. |
| `DanceMoves.removeCatalogueAnimationScope()` | void | Removes the one wildcard cue-reset scope registered by the catalogue adopter. |

Scope removal **does not** undo stylesheet/inline changes, remove generated CSS,
disconnect the MutationObserver, remove other scopes or uninstall the API. There
is no full catalogue teardown/undo method.

### What gets converted

The pass scans accessible CSS rules and referenced timing custom properties,
then inline and computed declarations on the root and descendants, then computed
`::before`/`::after` timing. Properties are `animation-duration`, `animation-delay`,
`transition-duration` and `transition-delay`. Nonzero time tokens are converted
to signed, quantised tick durations. Negative delays preserve their sign. Values
already containing `--dance-moves-` are left alone.

Zero and magnitudes at most 0.02 ms are preserved. Animation timing associated
with a non-auto/non-none view timeline preserves magnitudes at most 1 ms; Page 248
also has the legacy 1 ms rule exception. Generated CSS adds a reduced-motion
clamp for the owned subtree/pseudo-elements: 0.01 ms duration, zero delay, one
iteration and automatic scrolling.

Rule ownership is determined from root tokens or selector matches within the
root; transient selector states/pseudo-elements are stripped for matching.
Referenced timing variables can be rewritten where they are defined, including
outside the owned selector. A mixed selector list or broad shared selector is not
split into owned/unowned rules. Isolate release CSS and timing variables rather
than assuming this heuristic is a strict CSS sandbox. Inaccessible cross-origin
CSSOM sheets are skipped, though computed styles within the root can still be
converted. The pass does not rewrite canvas, shaders, JS timers, easing functions,
keyframe geometry or animation names.

The adopter registers `["*"]` on the root for cue resets. A MutationObserver
watches child insertions and `style` attributes in that root and batches another
pass into one pending animation frame. Class changes, stylesheet changes outside
the root, dynamic root replacement and audio discovery are not general observer
contracts; call `.apply()` when appropriate, and use a new page load for a new root.
Repeated passes append generated rules; this is not a side-effect-free inspection
API or a promise of stylesheet compaction.

### `CatalogueSnapshot`

```text
{
  pageId: number,
  bpm: number,
  bpmSource: "explicit" | "fallback",
  conversionCount: number,
  convertedCustomProperties: string[],
  records: [{source, property, before, after, ticks: number[]}]
}
```

Evidence is capped at **1000 records**. `conversionCount` is the retained record
count, not an unlimited total of converted tokens or elements. Custom property
names are sorted. `records` is an array copy, not a deep freeze; do not mutate
record objects. Evidence stays local to the runtime unless a consumer exports it.

## Orientation page map

Sources: [PHP map](../../kieran-epk-device-orientation.php),
[orientation wrapper](../../assets/ks-epk-device-orientation.js),
[orientation CSS](../../assets/ks-epk-device-orientation.css).

| Page | Adapter key | Required root / additional target | Release behaviour |
| --- | --- | --- | --- |
| 130 | `dying-for-a-diagnosis` | `.dfad-motion-stage`; optional `[data-tilt]`, `[data-parallax] img` | Cover shift/rotation and artwork translation; responsive artwork scale. |
| 140 | `light-will-win` | `#light-will-win-top` | Cover translation and tilt on release cards. |
| 243 | `presents-and-chocolate` | `.ks-epk[data-release="presents-and-chocolate"]` | Cover sensor shift/rotation. |
| 252 | `clay-stars` | `.ks-epk.ks-clay-stars-v2` and matching `DanceMovesClayStars.root` | Delegates to `setMotionTarget()` or `setMotion()`; no independent duplicate Clay runtime. |
| 268 | `fully-nocturnal` | `.ks-epk.fn-live[data-release="fully-nocturnal"]` | Scene/card movement; resets while `data-fnx-motion="off"`. |
| 270 | `amnesty-honestly` | `.ks-epk` | Cover tilt/shift and heading counter-movement. |
| 276 | `walk-with-me` | `.ks-epk[data-release="walk-with-me"]` and `.wwm-cover-stage` or `.epk-cover-wrap` | Cover tilt/shift and moving glow position. |
| 298 | `dmitri-my-talisman` | `.dmt-epk` | Light/parallax/tilt; resets with the `reduce-motion` class. |
| 839 | `california-screamin` | `#cs-epk.cs-epk` (release attribute optional) | Writes `--cs-x`/`--cs-y`; resets with `motion-paused`. |

The original seven adapters are joined by Clay/Stars and California Screamin'.
The wrapper can detect several roots when `config.adapter` is absent, but PHP
still controls which Pages receive its assets. There is no public
`registerAdapter()` or Page-ID filter. Adding a new production mapping requires
changes to the PHP map and wrapper factory table plus release tests.

### `window.ksEpkOrientationConfig`

WordPress emits `adapter`, `pageId`, `version`, `bpm`, `bpmSource`, `ticksPerBeat`
(16), and `transitionTargetTicks` (2). The wrapper uses BPM clamped to 20–400 and
computes `60000 / bpm / ticksPerBeat * transitionTargetTicks` milliseconds.

`harness: true` bypasses the mobile/support gate **only** on exact hostnames
`localhost` or `127.0.0.1`. It is not emitted in production. Merely loading the
core helper library does not start sensors.

### Input and permission lifecycle

The production gate requires `KSEpkOrientationCore`, mobile eligibility and sensor
support. The wrapper uses a 2000 ms rolling mapper, 1.5-degree minimum span, a
latest-sample animation-frame scheduler with 32 ms smoothing time constant, then
a target scheduler with a two-tick interval and 0.02 minimum normalised delta.
The first meaningful target is immediate; further targets retain only the latest
pending value. Release adapters apply a bounded signed square-root perceptual
curve before their own mappings.

Permission-requesting browsers get one **Use phone motion** button that requests
permission from its click handler. Granted permission starts listening; denial
shows **Phone motion blocked**. A 3500 ms availability timer can mark the button
unavailable if valid input never activates the adapter. This is an input
availability timeout, not a musical effect duration.

Visibility/pagehide stops listening and resets targets; page return can recreate
the permission control or resume nonpermission input. Screen rotation resets the
mapper. A preference change to reduced motion stops listening and removes the
control. At initial startup, the permission-control creation path is not itself
gated by the reduced-motion check, so the control can exist in the DOM in an
initially reduced-motion session. The bundled stylesheet hides it, and input
application remains gated.
Root removal triggers teardown through a MutationObserver.

### Internal lifecycle handle

`window.__ksEpkOrientationRuntime` is an internal diagnostic handle, installed
only after a valid adapter initialises. It exposes a frozen object:

| Method | Behaviour |
| --- | --- |
| `reset() -> void` | Cancels pending work, resets mapper/target state, marks supported and calls adapter reset. Does not remove listeners or permanently stop the instance. |
| `snapshot() -> object` | `{adapter, active, listening, destroyed, latest:{x,y}, reducedMotion, documentHidden}`. |
| `teardown() -> void` | Idempotently removes listeners/control/observer, cancels both schedulers, resets adapter, and deletes the global if it still points to this instance. No public restart method. |

Do not treat the leading-underscore handle as the application-level configuration
API. For reusable math or a separate test harness, use the exported core below.

## `KSEpkOrientationCore`

Source: [ks-epk-device-orientation-core.js](../../assets/ks-epk-device-orientation-core.js).
Exposed as `window.KSEpkOrientationCore` in the browser or `module.exports` in
CommonJS. It is a pure/helper library: no permission prompts, DOM writes or sensor
listeners occur merely by importing it. Supply finite numeric inputs unless a
method explicitly checks them; not every helper validates its arguments.

### Scalar and environment helpers

| Signature | Result / defaults |
| --- | --- |
| `clamp(value, min, max) -> number` | `Math.min(max, Math.max(min, value))`; does not repair NaN. |
| `hasMotionData(event) -> boolean` | True only when `beta` and `gamma` are finite numbers; nulls/numeric strings are not valid readings. |
| `isMobileDevice(environment) -> boolean` | Combines UA/mobile client hint, touch iPad detection, or coarse pointer + touch + screen width at most 1024. Fallback width is `innerWidth`, then 9999. This is eligibility detection, not a measured performance classification. |
| `sensorSupported(environment) -> boolean` | `isSecureContext !== false` and `DeviceOrientationEvent` exists. This alone does not prove hardware availability or permission. |
| `permissionRequired(environment) -> boolean` | Support plus a `DeviceOrientationEvent.requestPermission` function. |
| `screenAngle(environment) -> number` | Finite `ksHarnessScreenAngle` override, then `screen.orientation.angle`, then legacy `orientation`, otherwise 0. |
| `screenAligned(event, angle) -> {x,y}` | Rotates absolute gamma/beta into screen coordinates in degrees: `x = gamma*cos + beta*sin`, `y = beta*cos - gamma*sin`. |
| `normalise(event, neutral, angle, maximumDegrees?) -> {x,y}` | Wraps beta/gamma deltas into -180–180, screen-rotates, divides by the positive caller-supplied maximum (default 20), clamps axes to -1–1. Separate from the production rolling mapper. |
| `mapPointToWindow(point, windowState, minimumSpanDegrees?) -> {x,y}` | Maps a point using `minX/maxX/minY/maxY`; a span below the default 1.5 degrees produces zero on that axis; otherwise clamps to -1–1. |
| `smooth(previous, next, amount?) -> {x,y}` | Linear interpolation; falsy amount defaults to 0.18, then clamps to 0.01–1. Passing 0 therefore uses 0.18. |
| `smoothTimeBased(previous, next, elapsedMilliseconds, timeConstantMilliseconds?) -> {x,y}` | Uses alpha `1 - exp(-elapsed/tau)`; elapsed is nonnegative, default tau 32 ms with minimum 1. Zero elapsed returns the previous position. |

### `createRollingMapper(windowMilliseconds?, minimumSpanDegrees?) -> Mapper`

Defaults are **10000 ms** and **1.5 degrees**. The production wrapper explicitly
uses 2000 ms, so do not confuse the factory default with that runtime setting.
The numeric defaults use truthy fallback rather than a strict positive-number
validator; pass valid positive values and monotonic timestamps in milliseconds.

| Mapper method | Result |
| --- | --- |
| `push({x,y}, timestamp)` | Adds one point, evicts batches older than `timestamp - windowMilliseconds`, returns a mapped result. |
| `pushBatch({count,sumX,sumY,minX,maxX,minY,maxY}, timestamp)` | Adds weighted aggregate data; `count` has a minimum of 1. Current position is this batch's mean. |
| `reset()` | Clears retained batches; no return value. |
| `size()` | Number of retained batches, not weighted sample count. |

Mapped result:

```text
{
  x, y,                         // current point/last batch mean mapped to -1..1
  currentX, currentY,
  meanX, meanY,                  // weighted window means, in input units
  minX, maxX, minY, maxY,
  sampleCount, batchCount,
  windowMilliseconds
}
```

### `createLatestSampleRafScheduler(options) -> Scheduler`

Requires callable `requestFrame(callback)` and `commit(x, y, detail)`; otherwise
throws `TypeError`. Options:

| Option | Default / use |
| --- | --- |
| `requestFrame` | Required frame requester, e.g. bound `requestAnimationFrame`. |
| `cancelFrame` | No-op; supply a real cancellation function in a browser. |
| `now` | Function returning 0 by default; use the same time base as frame timestamps. |
| `mapper` | `createRollingMapper(2000, 1.5)`; custom object needs `push()` and `reset()`. |
| `smoothingTimeConstantMilliseconds` | 32 via numeric truthy fallback. |
| `commit` | Required consumer of the smoothed latest position. |
| `reject` | Optional callback for invalid input received while running. |

The scheduler keeps one latest finite sensor sample and one pending frame. At
flush it screen-aligns/mapping-processes the retained point and uses time-based
smoothing. The first smoothing step uses eight time constants. Commit detail is:
`{sample:{x,y}, sampleTimestamp, frameTimestamp, sampleAge, commitCount}`.
`sampleAge` is nonnegative milliseconds.

| Scheduler method | Contract |
| --- | --- |
| `receive(event, angle, timestamp?) -> boolean` | Rejects invalid beta/gamma or a torn-down instance; otherwise retains the latest screen-aligned sample and schedules one frame. Missing/nonfinite timestamp uses `now()`. |
| `reset() -> void` | Cancels the frame, clears sample/smoothing/counts and resets the mapper; does not turn a torn-down instance back on. |
| `teardown() -> void` | Resets and permanently stops the instance. |
| `pending() -> boolean` | Whether a frame ID is pending. |
| `commitCount() -> number` | Commits since reset. |

### `createTransitionTargetScheduler(options) -> TargetScheduler`

Requires `commit(x, y, detail)`, otherwise throws `TypeError`. Defaults:
`now: () => 0`, `schedule: setTimeout` wrapper, `cancel: clearTimeout`,
`intervalMilliseconds: 0`, `minimumDelta: 0`. Interval/delta are coerced to
nonnegative numbers. Use an actual monotonic `now()` in a real integration.

`receive(x, y, detail?)` rejects nonfinite axes or a torn-down instance. Outside
the rate-limit window it immediately attempts a commit; inside it retains the
latest target and schedules a single trailing timeout. Material change is the
maximum axis difference being at least `minimumDelta`. With zero minimum delta,
identical targets can still commit. A queued receive can return true even if that
target is later superseded or suppressed as too small.

Commit detail copies the supplied detail and adds `targetTimestamp` and
`targetCommitCount`. Returned methods are `receive(x,y,detail?) -> boolean`,
`reset() -> void`, `teardown() -> void`, `pending() -> boolean` and
`commitCount() -> number`. Reset clears targets/timing/counts; teardown also
permanently stops the instance. Neither factory exposes a restart or flush method.

## `DanceMovesClayStars`

Source: [clay-stars-effects.js](../../assets/clay-stars-effects.js) and
[clay-stars-effects.css](../../assets/clay-stars-effects.css).
Created only with `.ks-epk.ks-clay-stars-v2` and a descendant `.epk-cover-wrap`.
A live instance for the same root prevents duplicate initialisation. PHP normally
loads it only on Page 252 without the legacy effects constant.

### Properties and parameters

`root` is the root DOM element. `defaults` is frozen; the exported API object is
also frozen. Modify runtime parameters through `setParameters()`, not `defaults`.

| Parameter | Default | Accepted range / coercion |
| --- | --- | --- |
| `enabled` | true | Boolean when the key is present. |
| `masterIntensity` | 2 | 0–2 |
| `coverTiltDegrees` | 1.15 | 0–4 |
| `coverTranslationPixels` | 4 | 0–16 |
| `bloomTravelPixels` | 8 | 0–32 |
| `flareTravelPixels` | 18 | 0–48 |
| `specularTravelPixels` | 24 | 0–64 |
| `particleReleaseTicks` | 32 | Rounded integer 1–128; its actual duration also passes through core duration quantisation. |

Numeric values are coerced and clamped; nonfinite values keep the previous
setting. `null` coerces to zero before clamping. Motion uses bounded axes times
`masterIntensity`; reduced motion or `enabled: false` sets active motion gain to
zero. The defaults therefore produce up to 2.3 degrees cover tilt and 8 px cover
translation per axis, not the single-gain parameter magnitudes alone.

### Methods

| Signature | Return / side effects |
| --- | --- |
| `setParameters(next?)` | Returns a shallow settings copy. Applies provided/clamped fields, writes intensity/release-duration CSS variables, reapplies the last motion input. Unspecified fields remain unchanged. |
| `setMotion({x,y}?)` | Boolean; clamps/coerces input to -1–1 and coalesces into one pending animation frame. False after teardown. |
| `setMotionTarget({x,y}?)` | Boolean; cancels pending motion frame and applies the bounded target immediately. Intended for already rate-limited orientation input. False after teardown. |
| `setCueState(detail?)` | Void; reads normalised name/type or name/type, lowercases and replaces whitespace with hyphens into root cue attributes. Empty input removes cue attributes. This is state styling, not core cue dispatch or animation reset. |
| `lifecycle(state)` | Void; applies lifecycle effects below and records the state attribute. |
| `reset()` | Void; restores default visual parameters, clears cue/particle/motion state and marks lifecycle `reset`. Does **not** reset performance profile, history or counters. |
| `snapshot()` | Returns the state shape below. |
| `teardown()` | Idempotent void disposal: stops performance monitor, particle/motion tasks, listeners and cue subscription; marks runtime stopped. Does not undo all CSS/attributes, unregister the separately registered core animation scope, or recreate a live instance. |

Lifecycle strings `seeking`, `hidden`, `pagehide`, `reduced-motion` clear cues,
particles and motion; the last three also stop performance sampling and clear
consecutive health counters. `seeked` sets a `seeked`/`state` cue state.
`visible`/`pageshow` clear motion and request a settled performance window.
Other strings merely update the recorded attribute. The method does not fake
`document.hidden` or browser media preferences.

Pointer movement is active for a fine hover-capable pointer with a cached cover
bounding rectangle. Pointer enter refreshes bounds; leave/rotation resets motion;
resize invalidates bounds. Hover/focus on controls samples the particle orbit once
on an animation frame, then pointer leave/blur can play a tick-timed release from
the sampled transform/opacity. There is no permanent particle-sampling loop.

### Snapshot shape

```text
{
  destroyed: boolean,
  settings: { all visual parameters above },
  motion: {x, y, pendingFrame, commits},
  particles: {controls, pendingFrames, pendingTimers, computedStyleReads, samples},
  performance: {
    enabled, profile, reason, monitoring, poorWindows, windows, reductions,
    recoveryAttempts, healthyWindows, recoveryWaitWindows, probationFrom,
    lastFps, observedCadenceFps, lastMedianFrameMilliseconds,
    lastP95FrameMilliseconds
  },
  cue: string, cueType: string, lifecycle: string
}
```

`profile` is `full`, `constrained` or `minimal`. Metrics/cadence/probation can be
`null` before measurement/no active probation. `recoveryAttempts` counts upward
profile changes, not only confirmed recoveries. `monitoring` indicates a scheduled
timer or frame, not a promise of a measured FPS. There is no public performance
profile setter.

## Recoverable Clay/Stars performance tiers

The monitor starts at `full`. It waits for document load completion plus a settling
period, samples visible frame intervals, and continues checking even in `minimal`.
Reduced motion/hidden state suspends it. Large frame gaps reset the current sample
window instead of counting as proof of incapacity.

`constrained` stops the ambient cloud, atmosphere-particle and gold-sparkle loops
while retaining a static treatment. `minimal` also removes blur/screen blending
from those ambient planes. Phone response, controls and musical cue infrastructure
remain separate. These tiers are implemented only for Clay/Stars, not every EPK.

The fastest stable observed cadence can rise but cannot fall. A window is eligible
for cadence learning at least at 28 FPS with p95 interval at most 1.25 times its
median; eligible observations below 35 FPS use a normalised 30 FPS reference. Without an established
reference, the monitor uses 60 FPS. A poor window is below 75% of the reference in
`full` or 80% in lower tiers. A healthy window requires at least 90% of the reference
and p95 no more than 1.5 reference intervals. These are observed frame statistics,
not authoritative physical display-refresh detection.

By default, **three** consecutive poor windows trigger one downgrade. After a
cooldown of initially three valid windows and three consecutive healthy windows,
a lower tier trials the next higher one. Two poor windows fail a trial and revert;
three healthy windows confirm it. Failed trials double the cooldown up to 24
windows; confirmed recovery restores the cooldown to three. This supersedes the
historical fixed-45/50-FPS, two-window, downward-only description.

### Pre-load configuration: `window.danceMovesClayPerformanceConfig`

Set before the Clay script. Settings are captured/frozen at initialisation and are
not changed by `setParameters()`.

| Key | Default | Range / meaning |
| --- | --- | --- |
| `enabled` | true | Only literal false disables monitoring. Independent of visual `settings.enabled`. |
| `windowMilliseconds` | 1600 | 500–5000 |
| `settleMilliseconds` | 5000 | 0–10000 |
| `retryMilliseconds` | 2000 | 0–10000; retry after poor measurement without tier change. |
| `recheckMilliseconds` | 10000 | 1000–60000; spaced checks, including minimal tier. |
| `minimumIntervals` | 6 | Rounded integer 4–240. |
| `maximumIntervalMilliseconds` | 250 | 100–1000; larger gaps reset a sample window. |
| `poorWindowsBeforeReduction` | 3 | Rounded integer 2–5. |
| `fullMinimumFps` | 45 | Parsed/clamped 20–60 for compatibility, but **unused by the current cadence-relative decision logic**. |
| `constrainedMinimumFps` | 50 | Likewise parsed/clamped but unused. |

These delays measure capability and must not be substituted for the musical
clock. Do not infer physical-device performance from a synthetic unit harness or
from the frequency of phone sensor events.
