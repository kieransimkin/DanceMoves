# Shared effect API — DanceMovesEffects

[Documentation index](../README.md) · [Core timing API](javascript.md) ·
[Release adapters](adapters.md) · [CSS/HTML](styling.md)

Source: [assets/dance-moves-effects.js](../../assets/dance-moves-effects.js).
Current shared-library baseline: **3.1.0**. Historical 2.7/2.8 notes below
identify when the earlier primitives were introduced.

This is the reusable, page-independent layer introduced in 2.7 and extended with
`cueTimeline()` in 2.8 and `lyricStage()` in 3.0.4. It supplies mechanisms rather than artwork. It does not
replace the core's LRC parser, audio discovery, named cue subscriptions or clock.
It contains six factories and four registry methods. Every factory returns a
frozen handle with `id`, `type`, `snapshot()` and `teardown()` plus the methods
specified below. The returned object is frozen; its internal state is mutable.

## Loading and ready event

WordPress enqueues `dance-moves-effects` after `dance-moves-core`, before the
catalogue adopter. The module installs only if `window.DanceMoves` already exists
and `window.DanceMovesEffects` does not. It does not retry a missing dependency.
Its `version` property copies `DanceMoves.version`.

After installation it dispatches **`dance-moves-effects-ready`** from the scoped
EPK root, or from `document` in WordPress compatibility mode, with
`detail: { api: window.DanceMovesEffects, version: string }`. It is a native
`CustomEvent` with `bubbles: true` and `cancelable: false`, so established
document-level adapters receive it in either mode. It fires once
per successful installation; a late listener does not receive a replay.

```js
function mountReleaseEffects() {
  const effects = window.DanceMovesEffects;
  const root = document.querySelector('.ks-epk');
  if (!effects || !root || effects.get('release:hero-pointer')) return;
  effects.pointer({
    id: 'release:hero-pointer',
    root,
    bounds: root.querySelector('.epk-hero') || root
  });
}
if (window.DanceMovesEffects) mountReleaseEffects();
else document.addEventListener('dance-moves-effects-ready', mountReleaseEffects, { once: true });
```

A theme/plugin can instead enqueue its adapter with
`array('dance-moves-effects')`. Factory calls require their DOM roots to exist;
the ready event means the API is installed, not that all page content or audio
metadata has finished loading.

## Shared options, errors and instance registry

| Item | Contract |
| --- | --- |
| `options` | Optional object; defaults to `{}`. Use an actual object, not a serialized JSON string. |
| `id` | Supplied truthy value converted to string, otherwise generated as `dance-moves:<factory-type>:<serial>`. Serial is shared by factories. Stable, unique IDs are recommended. |
| `root` | Element (`nodeType === 1`) or CSS selector. Omitted/nonstring/non-element falls back to the first `.ks-epk`. A supplied selector uses `document.querySelector`, not a root-scoped lookup. |
| Missing root | Throws `Error`. An unmatched explicit selector does not fall back to `.ks-epk`. Invalid selectors can throw the browser's selector exception. |
| `render` | Optional synchronous callback, with a factory-specific payload. Many factories invoke it during construction, before the returned handle exists. |
| Numeric options | Generally coerced with `Number()`; nonfinite values use the documented fallback. Explicit `null` becomes zero before bounds are applied. Supply finite numbers deliberately. |
| Callback failure | Unlike core `onCue`/`onLyric` dispatch, the shared layer generally does not catch `render`/`onCue` exceptions. A thrown callback can interrupt construction or frame scheduling. Keep callbacks bounded and nonthrowing. |

All registry operations are synchronous:

| Method | Return and behaviour |
| --- | --- |
| `get(id)` | Handle for `String(id)`, or `null`. |
| `snapshot()` | Array of all registered instances' current snapshot objects, in Map insertion order. No historical samples. |
| `teardown(id)` | Calls the registered instance's teardown, if present; returns `undefined`. Missing IDs are a no-op. |
| `teardownAll()` | Tears down a snapshot of all current instances; returns `undefined`. Does not remove the `DanceMovesEffects` global. |

A factory registering an existing ID tears down the old instance and replaces it.
This occurs **after** the new factory has set up its listeners/initial state, so
old cleanup can affect CSS/classes shared with the replacement. Prefer an
explicit `effects.teardown(id)` before mounting a replacement on the same target.
Retained old handles are not safe to reuse: teardown deletes by ID, not identity,
and most instance methods do not have a destroyed guard. Dispose old references.

Teardown cancels the factory's own timers/frames/listeners but is not a general
DOM rollback. CSS variables, state attributes, and page-owned callback changes
can remain. There is no automatic root-removal observer for these primitives.

## pointer(options)

Returns `{ id, type: "pointer", set, reset, snapshot, teardown }`.

| Option | Default | Meaning |
| --- | --- | --- |
| `root`, `id`, `render` | Shared options | CSS state is written on `root`, even when bounds/target differ. |
| `bounds` | Root | Element/selector whose cached rectangle defines input normalization. |
| `target` | Bounds element | Element/selector receiving `pointermove` and `pointerleave`. |
| `finePointer` | `true` | Only literal `false` disables the `(hover: hover) and (pointer: fine)` requirement. |

The factory caches `getBoundingClientRect()` at construction, on ResizeObserver
notifications, and on `orientationchange`. It maps the pointer against that
rectangle to normalized x/y, coalesces movement to one pending animation frame,
and clamps committed values to `[-1, 1]`. It writes unitless four-decimal strings
to `--dance-moves-x` and `--dance-moves-y` and a reason to
`data-dance-moves-pointer`.

Native pointer handling is inactive when the page is hidden, reduced motion or
forced colours is active, or the default fine-pointer condition fails. Inactive
state resets coordinates to zero. Pointer leave resets to zero without disabling
subsequent movement; orientation changes recache geometry and reset. There is no
scroll listener: a bounding box that moves without resizing can be stale. Mount
on stable geometry or remount after layout changes that move it.

`render` receives:

```text
{ x: number, y: number, root: Element, bounds: DOMRect | null, reason: string }
```

| Instance method | Contract |
| --- | --- |
| `set(x, y, reason?)` | Immediately coerces/clamps values, writes CSS, sets reason (default `"active"`), calls render; returns `undefined`. This is the raw apply function: it bypasses native-input accessibility/visibility gates and does not cancel an already queued pointer frame. |
| `reset(reason?)` | Cancels the pending frame, commits zero coordinates with default reason `"reset"`; returns `undefined`. Does not change the `active` input-gate flag. |
| `snapshot()` | `{id, type:"pointer", active:boolean, x:number, y:number, bounds:{width,height}\|null}`. Pending normalized values can be reflected before the frame commits/clamps them. |
| `teardown()` | Calls reset with `"teardown"`, disconnects ResizeObserver, removes listeners and unregisters the ID. Leaves zeroed CSS/attributes. |

Native reasons include `active`, `leave`, `orientation`, `inactive`; an eligible
reconcile writes `ready` without calling render. Manual reasons are unrestricted.
`set()` is useful for a deterministic harness but is not permission-aware phone
input; use the [orientation API](adapters.md) for device sensors.

## playbackPulse(options)

Returns `{ id, type: "playback-pulse", sync, snapshot, teardown }`.

| Option | Default | Meaning |
| --- | --- | --- |
| `root`, `id`, `render` | Shared options | Root owns the class and custom properties. |
| `audio` | First `audio` inside root | Element/selector. Missing element throws `Error`; no master-duration matching is required. A selector is document-scoped. |
| `ticks` | `16` | Rounded integer, minimum 1; passed through `DanceMoves.durationMilliseconds()`, so long-duration quantisation also applies. |
| `className` | `dance-moves-playing` | Single CSS class toggled for eligible playback. |
| `propertyPrefix` | `--dance-moves-pulse` | Trailing hyphens removed; `-duration` and `-delay` appended. Supply a valid custom-property prefix. |

For effective playback rate `r = max(0.01, finite(audio.playbackRate, 1))`:

```text
duration = DanceMoves.durationMilliseconds(ticks) / 1000 / r
delay = -((audio.currentTime / r) % duration)
```

Both properties are written as six-decimal **seconds** strings. `ticks` in the
callback/snapshot is the input's rounded integer, not necessarily its later
quantized duration. The negative delay aligns a CSS cycle to current media time.
There is no continuous JavaScript frame loop: native audio events trigger updates.

The factory reconciles at creation and on `loadedmetadata`, `timeupdate`,
`seeking`, `seeked`, `ratechange`, `play`, `playing`, `pause`, `ended` and reduced
motion/forced-colour changes. It toggles the playing class only when not paused,
not ended and neither accessibility preference is active. There is no visibility
listener; hidden-tab CSS/render behaviour remains the consumer's responsibility.

`render` receives `{root, audio, duration, delay, ticks}`; duration/delay are
numbers in seconds, not strings. The callback also runs for pause and inactive
updates. It does not receive a `playing` boolean: inspect the audio/preferences
or the configured class.

| Instance method | Contract |
| --- | --- |
| `sync()` | Recomputes properties, data attribute and callback; returns `undefined`. Does **not** itself toggle the playing class. Native event reconciliation does both. |
| `snapshot()` | `{id, type:"playback-pulse", ticks, playing:boolean, duration:string}`; playing reads the configured class, duration reads the CSS property. |
| `teardown()` | Removes the playing class and listeners and unregisters. Leaves pulse properties and data attribute. |

`data-dance-moves-pulse` is `inactive` under reduced motion/forced colours,
otherwise `paused` or `playing` based on `audio.paused`. Unlike the playing class,
this marker does not separately check `audio.ended`.

An unobtrusive CSS consumer can use the standard prefix and playing class:

```css
.release-status-dot { animation: none; }
.ks-epk.dance-moves-playing .release-status-dot {
  animation: release-breathe var(--dance-moves-pulse-duration)
    ease-in-out var(--dance-moves-pulse-delay) infinite;
}
@keyframes release-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
@media (prefers-reduced-motion: reduce), (forced-colors: active) {
  .ks-epk .release-status-dot { animation: none !important; }
}
```

Do not turn a pulse into full-frame flashing or use repeated colour changes as
an accessibility fallback. Page CSS remains subject to catalogue ownership rules.

## cueClass(options)

Returns `{ id, type: "cue-class", fire, clear, snapshot, teardown }`.

| Option | Default | Meaning |
| --- | --- | --- |
| `root`, `id`, `render` | Shared options | ID is also passed to the core cue subscription for diagnostic attribution. |
| `cue` | `"*"` | Passed to `DanceMoves.onCue()`; named and wildcard matching follow the core normalisation rules. |
| `className` | `dance-moves-cue-active` | Single class added for each active transient. |
| `durationTicks` | `16` | Rounded integer, at least 1, then duration-quantized by the core. |

A cue clears the previous timer/class, increments a lifetime firing count, adds
the class and sets `data-dance-moves-cue-effect="active"`. It calls render, then
schedules removal after `DanceMoves.durationMilliseconds(durationTicks)`.
Retriggering restarts this lifetime. Reduced motion/forced colours prevent firing
and clear an existing transient when the preference changes.

This is a **wall-clock timeout**, not an audio interval: pausing, changing playback
rate, seeking, ending audio or hiding the page does not automatically pause/clear
it. Use `cueTimeline()` for reconstructable song-relative state, or explicitly
clear a transient on relevant native events. Do not run both mechanisms for the
same visual unless duplicate actions are intentionally handled.

`render` receives `{root, detail, count, durationMilliseconds}`. `detail` is the
core `CueDetail` for subscriptions, or any argument passed to `fire`. Render runs
on fire, **not** on clear/completion; the class and data attribute carry clearing.

| Instance method | Contract |
| --- | --- |
| `fire(detail)` | Runs the same local transient path, respecting reduced-motion/forced-colour gates; returns `undefined`. Does not dispatch a core cue or globally reset owned animations. |
| `clear(reason?)` | Cancels timeout, removes class, writes default reason `idle`; returns `undefined`. Does not reset count. |
| `snapshot()` | `{id, type:"cue-class", cue:string, active:boolean, count:number}`. |
| `teardown()` | Clears with `teardown`, removes core subscription and preference listeners, unregisters. |

Other reason markers: `restart`, `complete`, `inactive`, `reduced-motion`,
`forced-colours`. `restart` is transient before `active`. Initial creation does
not write an idle marker or remove a pre-existing class.

## cueTimeline(options)

Returns `{ id, type: "cue-timeline", restore, start, stop, snapshot, teardown }`.
This is the **2.8.0** transport-recovery primitive. It follows a supplied audio
player's actual current time, calls transient cue callbacks for crossings, and
rebuilds ongoing interval state after discontinuities. It does not call
`audio.play()`, `audio.pause()`, seek the player or change playback rate.

### Options and cue schema

| Option | Default | Meaning |
| --- | --- | --- |
| `root`, `id`, `render` | Shared options | Root receives `data-dance-moves-cue-timeline` state. |
| `audio` | First root `audio` | Element/selector; required to resolve, otherwise throws `Error`. No master-length check here. |
| `cues` | `[]` | Array of `{id?, time, end?, data?}`. Non-arrays become an empty list. Items are mapped to frozen records and sorted by start time. |
| `onCue` | Unset | Synchronous callback for a not-yet-fired crossing or enabled seek landing. |
| `seekLandingTolerance` | `0.05` seconds | Coerced finite number, clamped to minimum 0. Used both for rebuild cutoff and landing matching. |
| `fireOnSeekLanding` | `false` | Only literal `true` allows transient cue firing near a completed seek, and only while audio is not paused. |
| `maxCrossingGap` | `1.25` seconds | Minimum 0.05. A larger observed forward media-time jump is treated as a discontinuity, not a chain of missed crossings. |

Each normalized cue is `{id:string, time:number, end:number|null, data:any}`.
`time` must coerce to a finite nonnegative number; invalid time throws `TypeError`.
Supply real numbers: `null` and an empty string coerce to zero. A truthy ID is
stringified, otherwise `cue-<original-array-index>` is generated before sorting.
Use **unique IDs**: firing deduplication is by ID, so duplicate IDs suppress each
other even at different timestamps.

Omitting `end` produces `null` (a transient point). A finite coercible `end` defines
an interval; the implementation does not validate `end > time`. Explicit
`end: null` coerces to zero, so **omit** it for point cues. Invalid/nonfinite ends
become null. Active intervals use **`time <= audio.currentTime < end`**; overlapping
intervals are allowed. `data` is passed through by reference, not deeply frozen,
validated, fetched, parsed or executed. Treat it as application data.

A timeline does **not** automatically read `cueTimingUrl`, register `onCue()` with
the core, reset animations or emit `dance-moves-cue`. Supply declarative cues in
code, or explicitly pass the data returned by a reviewed parser integration. Do
not introduce a second timebase or claim cue-file-to-timeline wiring is automatic.

### Callback payloads

```text
onCue({
  root: Element,
  audio: HTMLAudioElement,
  cue: { id, time, end, data },
  time: number,                      // current audio seconds
  reason: "crossing" | "seek-landing",
  generation: number
})

render({
  root: Element,
  audio: HTMLAudioElement,
  time: number,                      // current audio seconds
  previousTime: number,
  reason: string,
  playing: boolean,                  // audio playing and not blocked
  active: Cue[],                     // complete current interval set
  generation: number,
  detail: null | { deltaSeconds: number }
})
```

`detail.deltaSeconds` is a capped wall-frame delta (`0..0.25` seconds, initially
zero), **not** the audio-time delta and not a beat duration. Rebuild/frame code
updates `previousTime` before rendering, so it often equals `time`; it is not a
reliable old-position delta source. `active` contains full cue records, whereas
the snapshot's `active` contains IDs. The callback's `playing` does not incorporate
an effect-only `stop()` or the audio's `seeking` property; obey `reason` too when
suppressing motion. Render callbacks are still invoked for inactive states and
must implement a static fallback.

### Crossing, restoration and transport lifecycle

An ordinary frame fires cues for `previous < cue.time <= now`, at most once per
ID in the current traversal. A backward change beyond 1 ms, or a forward change
larger than `maxCrossingGap`, calls rebuild without emitting skipped transients.
Persistent intervals are reconstructed immediately from the new current time.
A high playback rate or long delayed frame can therefore exceed the crossing gap
and intentionally suppress otherwise crossed transient cues.

Every rebuild increments `generation`, clears the fired-ID set, then marks cues
strictly earlier than `time - seekLandingTolerance` as consumed. A backward seek
allows future recrossings to fire again. The `fired` snapshot therefore includes
both actually invoked cues and past cues suppressed during reconstruction; it is
**not an event history**. A cue at time zero does not fire just because play starts
at zero: initialize appearance through render rather than a synthetic crossing.

| Trigger | Behaviour and render reasons |
| --- | --- |
| Construction | Rebuilds with `initial`; starts with `initial-playing` if already unpaused and eligible. |
| `play`, `playing` | Starts one frame loop, publishes `play` / `playing`; does not rebuild the fired set. Duplicate start calls while a frame exists do not add a second loop, but currently publish `paused` even if the audio is playing. The next frame publishes `frame`. |
| Ordinary frame | Fires crossings, renders `frame`, schedules next frame. |
| `pause` | Cancels frame, publishes `paused`; no fired-set reset. |
| `seeking` | Cancels frame, publishes `seeking`. |
| `seeked` | Rebuilds with `seeked`; optional playing landing calls `onCue` for **every** cue within tolerance. Starts with `resume-after-seek` when unpaused. Paused seek landings are not queued for later playback. |
| `ratechange`, `loadedmetadata` | Rebuilds with `ratechange` / `metadata`, no landing callbacks. |
| `ended` | Stops with `ended`; does not clear the fired set by itself. Normal restart/seek restoration is needed for a fresh traversal. |
| Hidden document | Stops with `hidden`. |
| Visible document | Rebuilds with `visible`, then starts with `resume-after-visible` when eligible; no skipped-cue replay. |
| Reduced-motion change | Rebuilds with `reduced-motion` / `motion-restored`; restoration requests `resume-after-motion`. A pending frame stops at its next blocked check. |
| Forced-colour change | Rebuilds with `forced-colours` / `colours-restored`; restoration requests `resume-after-colours`. |
| Frame detects pause/end/blocking | Stops with `paused`, `ended` or `inactive`. |

### Instance methods and snapshot

| Method | Return and semantics |
| --- | --- |
| `restore(reason?)` | `undefined`. Rebuilds from current audio time, default `manual-restore`, never fires landings. Does not start a stopped loop or stop a running one. |
| `start(reason?)` | `undefined`. Starts effect frames when eligible, default `playing`. Does not start audio. If already scheduled, paused, ended or blocked, publishes the corresponding fallback state rather than scheduling another loop. |
| `stop(reason?)` | `undefined`. Cancels effect frame, changes status, publishes default `paused`. Does not pause audio; later native events can restart it. |
| `snapshot()` | Shape below. Status is stored controller status, not necessarily the last render reason or DOM marker. |
| `teardown()` | Stops with `teardown`, removes all registered listeners and unregisters the ID. Leaves attributes/page-rendered state. Do not reuse the handle after disposal. |

```text
{
  id: string, type: "cue-timeline", status: string,
  time: number, previousTime: number, generation: number,
  fired: string[], active: string[]
}
```

The distinction from core cue landings is intentional in this reference: core
LRC playback arms **one** nearby cue by default and queues paused landings; the
shared timeline defaults to **no** landing callbacks and, when explicitly enabled,
fires all matching IDs only for an unpaused seek.

### Complete interval-state example

The page owns the cues and visual class. DanceMoves owns seeking and time tracking.
The render callback re-establishes the complete state, so a seek into a chorus
does not require a fabricated transient cue:

```js
function mountTimeline() {
  const effects = window.DanceMovesEffects;
  const root = document.querySelector('.ks-epk');
  const audio = root?.querySelector('audio');
  if (!effects || !root || !audio || effects.get('release:sections')) return;
  effects.cueTimeline({
    id: 'release:sections', root, audio,
    cues: [
      { id: 'verse-1', time: 0, end: 20, data: { section: 'verse' } },
      { id: 'chorus-1', time: 20, end: 40, data: { section: 'chorus' } },
      { id: 'verse-2', time: 40, end: 60, data: { section: 'verse' } }
    ],
    render(state) {
      const chorus = state.active.some(cue => cue.data?.section === 'chorus');
      root.classList.toggle('release-chorus', chorus);
      const stopped = ['paused', 'ended', 'hidden', 'inactive', 'seeking', 'teardown'].includes(state.reason);
      root.classList.toggle('release-motion-running', state.playing && !stopped);
    }
  });
}
if (window.DanceMovesEffects) mountTimeline();
else document.addEventListener('dance-moves-effects-ready', mountTimeline, { once: true });

// When permanently disposing this page integration (not merely pausing audio):
function disposeTimeline() {
  document.removeEventListener('dance-moves-effects-ready', mountTimeline);
  window.DanceMovesEffects?.teardown('release:sections');
  document.querySelector('.ks-epk')?.classList.remove('release-chorus', 'release-motion-running');
}
```

The example's timestamps are illustrative, not actual song data. Keep meaningful
section styling readable when motion is stopped, and add explicit reduced-motion
and forced-colour CSS for any animated treatment.

## lyricStage(options)

Returns `{ id, type: "lyric-stage", restore, snapshot, teardown }`, or a
temporary `lyric-stage-pending` handle while the core lyric popover is being
created. It upgrades the neutral popover into previous/current/next visible
slots without parsing the LRC again or adding a page-owned playback clock.

| Option | Default | Meaning |
| --- | --- | --- |
| `root`, `id` | Shared options | Release root and stable registry identity. |
| `audio` | First root `audio` | Required playback element or selector. |
| `popover` | `.dance-moves-lyric-popover` | Existing core popover. When absent, mounting waits for `dance-moves-lyric-ready`. |
| `travelTicks` | `32` | Positive integer duration of the approach to the next visible line. |
| `cueDurationTicks` | `32` | Default finite lifetime for `renderCue` output. |
| `render(state)` | Unset | State callback for phase, progress, resize and lifecycle reconciliation. |
| `renderLyric(state)` | Unset | Release-owned finite lyric treatment. May return a cleanup function or `{durationTicks, cleanup}`. |
| `renderCue(state)` | Unset | Release-owned bounded cue treatment with the same cleanup forms. |

The slots are `{previous,current,next,viewport,track}`. Lyric detail includes the
core `previousVisible*` and `nextVisible*` fields, so blank clear entries remain
part of the canonical timeline while the visual stage shows meaningful neighbours.
Phases include `waiting`, `travelling`, `arrived`, `paused`, `ended` and
`inactive`. Progress is clamped to `0..1` and published as
`--dance-moves-lyric-progress`.

DanceMoves owns lyric/cue subscriptions, media events, the animation frame,
wake-up timers, visibility, resize, reduced motion, forced colours and teardown.
Page callbacks may style or animate a bounded release-specific subject; they
must not attach a second LRC parser, media listener or clock. Teardown cancels
finite callback work, restores the original current-text node and removes the
stage wrapper and public stage attributes.

## quality(options)

Returns `{ id, type: "quality", setTier, snapshot, teardown }`. This reusable
controller is **not the Clay/Stars performance monitor**. Do not copy settings or
probation/backoff assumptions between them.

| Option | Default | Normalisation/meaning |
| --- | --- | --- |
| `root`, `id`, `render` | Shared | Controller publishes state; the page must implement cheaper tiers in CSS/rendering. |
| `tiers` | `["full","constrained","minimal"]` | Nonempty array mapped to strings; lowest index is highest quality. Other input falls back to defaults. |
| `initial` | `0` | Rounded and clamped to valid tier index. |
| `sampleMilliseconds` | `1600` | Finite, minimum 800. |
| `poorWindows` | `2` | Rounded, minimum 2. |
| `healthyWindows` | `5` | Rounded, minimum 3. |
| `downgradeRatio` | `0.72` | Clamped to `0.2..0.95`. A lower measured ratio increments poor count. |
| `recoveryRatio` | `0.9` | Clamped between downgradeRatio and 1. A higher ratio increments healthy count. |
| `downgradeCooldownMilliseconds` | `5000` | Finite fallback; no nonnegative clamp in source. |
| `recoveryCooldownMilliseconds` | `12000` | Finite fallback; no nonnegative clamp in source. |

A window estimates `fps = frameCount * 1000 / elapsedMilliseconds`. The reference
is `max(previousReference, min(60, fps))`, so it never decreases and is capped at
60. This is **frame-count/elapsed-window** sampling, not Clay's median/p95 or a
physical refresh-rate measurement. There is no startup load/settle gate, explicit
long-gap rejection, recovery probation or exponential cooldown. The first slow
window can establish a low reference; do not describe it as independent device
capacity detection.

After enough poor windows and cooldown, the index increases by one; after enough
healthy windows and recovery cooldown, it decreases by one. Mid-band samples reset
both counters. There is one shared last-shift clock, initially zero relative to
animation-frame time. The minimum tier continues to sample for recovery.

When hidden or under either accessibility preference, frame callbacks continue
but reset the measurement window and skip sampling. Visibility change resets the
window, not explicitly the poor/healthy counters. A **preference change** saves
the prior tier once, publishes the last tier, and restores the saved tier once
both preferences are off. The constructor publishes `initial` but does **not**
call that preference-transition handler initially. If a preference is already
active on mount, CSS/rendering must provide the static fallback immediately; the
tier attribute alone is not proof that accessibility handling has run.

| Instance method | Contract |
| --- | --- |
| `setTier(index, reason?)` | Rounded/clamped numeric index; default reason `manual`; returns `undefined`. Does not reset counters/cooldowns or disable automatic changes. It takes an index, not a tier name. |
| `snapshot()` | `{id, type:"quality", tier:string, index:number, referenceFps:number, poorWindows:number, healthyWindows:number}`. Counters are accumulated evidence, not the configured thresholds. |
| `teardown()` | Sets running false, cancels frame, removes listeners and unregisters. Leaves the selected tier/CSS markers. |

Render payload:
`{root, tier:string, index:number, reason:string, sample:null|{fps:number}}`.
Reasons include `initial`, `measuring`, `sustained-low-fps`, `sustained-recovery`,
`prefers-reduced-motion`, `forced-colours`, `preference-restored` and a manual
reason. Render fires on every measured window, **not only tier changes**.

The root receives `data-dance-moves-quality`, `data-dance-moves-quality-reason`,
and, for sampled updates, one-decimal `data-dance-moves-fps` and
`data-dance-moves-reference-fps`. No automatic CSS reduction is installed by this
primitive. Keep cheaper tiers visually acceptable and benchmark the whole page.

## Testing and limits

The shipped [cue-timeline contract](../../tests/cue-timeline.test.cjs) exercises
crossing deduplication, pause/resume, forward/backward seeks, active-interval and
visibility reconstruction, and registry removal. The
[lyric-stage contract](../../tests/lyric-stage.test.cjs) exercises neighbour
selection, travel progress, cue/lyric cleanup, preferences and teardown. The
[primitive contract](../../tests/effects-primitives.test.cjs) is mostly static
source assertions. Neither establishes physical-device frame performance or
complete callback-error, duplicate-ID, accessibility or post-teardown coverage.
Use [development gates](../development.md) for those checks. Do not represent a
documentation correction as a change in runtime behaviour.
