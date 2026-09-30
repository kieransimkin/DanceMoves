# JavaScript API reference

[Documentation index](../README.md) · [Adapter APIs](adapters.md) ·
[CSS/HTML contract](styling.md) · [WordPress configuration](wordpress.md)

Source: [assets/dance-moves-core.js](../../assets/dance-moves-core.js).
Baseline: **2.8.0 / `4cb6a71f60459b5579be87d7e55ac8b1426c578e`**.

## Loading, globals and types

`window.DanceMoves` and `window.KieranEpkMotion` reference the **same object**.
Load page code after the WordPress `dance-moves-core` script handle. The object is
created synchronously during script evaluation; DOM setup and file fetching are
separate. There is no module package, constructor, public `init()`, `ready()`
promise, `destroy()` or general configuration setter in the core.

In the signatures below, `Cancel` means `() => void`, and `Element` means a real
DOM element. Times in parsed entries are **seconds**; duration helper results are
**milliseconds**; `boundaryTick` and `currentTick()` are **ticks**. Supply finite
numbers and functions. Most numeric helpers coerce with `Number()` rather than
throwing on malformed values, so nonfinite arguments can produce nonfinite
results; this is not a runtime-validated TypeScript interface.

### Core properties

| Property | Type | Meaning |
| --- | --- | --- |
| `version` | string | Boot `version`, or `""` when absent. |
| `bpm` | number | Boot BPM if finite and within 20–400, otherwise 120. |
| `bpmSource` | `"explicit"` or `"fallback"` | Explicit only when the boot source string is exactly `"explicit"`. |
| `ticksPerBeat` | number | Always 16. |

Treat these as read-only integration data. Changing `DanceMoves.bpm` does not
change the BPM captured by the core's internal clock or rewrite its configuration.

### Boot object: `window.danceMovesConfig`

WordPress emits this before the core script. A standalone harness must do the same.

| Key | Type / normal WordPress value | Core behaviour |
| --- | --- | --- |
| `pageId` | number | Event/diagnostic page identity; numerically coerced, fallback 0. |
| `version` | string, `"2.8.0"` | Exposed on the API and HTML state. |
| `bpm` | number, 20–400 or fallback 120 | Captured at script evaluation. |
| `bpmSource` | `"explicit"` / `"fallback"` | Provenance marker. |
| `fallbackBpm` | number, 120 | Informational: the core's fallback is hard-coded to 120. |
| `lyricTimingUrl` | string, `""` when unset | Fetched whether or not pop-ups are enabled. |
| `lyricPopupsEnabled` | boolean, false | Gates the built-in renderer, not lyric parsing/subscriptions. Use a real boolean; the core tests truthiness. |
| `cueTimingUrl` | string, `""` when unset | Optional cue-file fetch. |
| `masterDurationMilliseconds` | number, 0 when unknown | Positive value fixes the reference duration; otherwise audio discovery derives it. |
| `tickDefinition` | `"sixteenth-of-beat"` | Informational. |
| `ticksPerBeat` | number, 16 | Informational for the core, which fixes its own value at 16. |
| `longDurationQuantumTicks` | number, 16 | Informational for the core, which fixes its own quantum at 16. |
| `sharedControlTicks` | number, 8 on selected pages, otherwise 0 | Positive value enables shared control timing, quantised as a visual duration. |
| `lyricDisclosureTicks` | number, normally 5, 6 or 7 | Defaults to 6 when falsy; quantised as a visual duration. |
| `effect` | `""` or `"paper-planes"` | Emitted by WordPress for ambient-effect loading; the core clock itself does not interpret it. |
| `diagnostics` | optional boolean | Only literal `true` permits a diagnostics sink. **Not emitted by ordinary WordPress configuration.** |

A boot change requires a fresh runtime/page load. There is no public method to
replace the internally loaded cue or lyric list. Parsing text with the public
parsers returns data but does not install it in the playback engine.

## Duration and clock methods

### `quantizeTicks(value) -> number`

First rounds half upward with `floor(Number(value) + 0.5)`, with a minimum of 1.
If that integer exceeds 16, rounds it to a multiple of 16, also half upward.
This rule is for **visual durations**, not interval spacing.

```js
DanceMoves.quantizeTicks(0);    // 1
DanceMoves.quantizeTicks(1.5);  // 2
DanceMoves.quantizeTicks(17);   // 16
DanceMoves.quantizeTicks(24);   // 32
DanceMoves.quantizeTicks(432);  // 432
```

### `durationMilliseconds(ticks, bpmOverride?) -> number`

Returns `(3750 / effectiveBpm) * quantizeTicks(ticks)`. A truthy override replaces
the configured BPM; an invalid/out-of-range truthy override resolves to 120. An
omitted/falsy override uses the configured BPM. At 120 BPM, 16 ticks is 500 ms.
Do not use this method to represent a negative delay: calculate the positive
duration and negate the result.

### `currentTick(options?) -> number`

Options: `clock?: "page" | "audio"`, `audio?: HTMLAudioElement`, `bpm?: number`.
Returns a potentially fractional tick, not an integer beat counter.

An explicit `audio` takes precedence even without `clock: "audio"`. Otherwise
`clock: "audio"` selects the runtime's active matching player. When that element
is playing, not ended, and has a finite `currentTime`, the result is
`currentTime * effectiveBpm * 16 / 60`. In **every other case** it returns elapsed
page-clock time at the effective BPM. It is therefore not a frozen-song-time API.

```js
const audio = document.querySelector('#release-audio');
if (audio && !audio.paused && !audio.ended) {
  const phase = DanceMoves.currentTick({ audio }) % 64;
  // Use phase in a page-owned canvas/WebGL effect.
}
```

### `nextIntervalTick(intervalTicks, fromTick, strictlyFuture?) -> number`

Rounds the interval half upward to an integer of at least 1; it does **not** apply
the duration quantum above 16. Coerces/clamps `fromTick` to a nonnegative value.
Returns the next interval boundary. A tick within 0.001 of a boundary is treated
as on that boundary: the current tick is returned unless `strictlyFuture` is
truthy, in which case one interval is added.

```js
DanceMoves.nextIntervalTick(16, 17);       // 32
DanceMoves.nextIntervalTick(16, 32);       // 32
DanceMoves.nextIntervalTick(16, 32, true); // 48
```

## Scheduling and interval subscriptions

All methods in this section return a `Cancel`. Cancellation does not undo work
already performed. Retain removers and invoke them when disposing page code.

### Boundary detail

```text
{
  intervalTicks: number,
  boundaryTick: number,
  audio: HTMLAudioElement | null,
  clock: "audio" | "page"
}
```

Callbacks are ordinary synchronous JavaScript callbacks. These APIs schedule
visual work near a boundary; they do not implement sample-accurate audio
scheduling, an AudioContext clock, or background-tab execution guarantees.

### Diagnostic identity

The metadata accepted by subscriptions is a string ID, or an object with `id` or
`handlerId`. IDs are trimmed and limited to 160 characters. A missing ID becomes
an `unattributed:...` label; this does not disable the callback, but the release
workflow requires attributable IDs for pre-live evidence. IDs label diagnostics;
they are not lookup keys for cancelling a subscription.

### `scheduleAtInterval(intervalTicks, callback, options?) -> Cancel`

Throws `TypeError` when `callback` is not a function. Interval ticks are rounded
to an integer of at least 1, without long-duration quantisation.

| Option | Meaning |
| --- | --- |
| `clock` | Defaults to the page clock; `"audio"` waits for playing active audio. |
| `audio` | Explicit audio element; selects the audio scheduling branch independently of `clock`. It is not required to be master-duration-bound by this low-level method. |
| `strictlyFuture` | Used when choosing the initial boundary for audio scheduling. The page-clock branch does not honour it. |
| `id`, `handlerId` | Diagnostic identifier, with `id` preferred. |

Page scheduling uses a timeout to the next page boundary and may call the callback
**synchronously** when the computed delay is at most 1 ms. Do not reference an
as-yet-unassigned return value from inside that callback. Audio scheduling polls
with `requestAnimationFrame`, waits through absent/paused audio, and fires with a
0.02-tick tolerance. It cancels when a previously followed source ends. A large
forward jump reselects a boundary rather than replaying all missed intervals.

The scheduled callback is not wrapped in the subscription error logger: an
exception propagates from the synchronous callback/timer/frame invocation, though
an enabled diagnostic span records it. Audio seeks are not a fully specified
interval rebaselining API; cancel and re-register around seeks when that matters.

### `deferStart(target, intervalTicks, options?) -> Cancel`

Requires an element with `nodeType === 1`, otherwise throws `TypeError`. Options
are those above plus `start?: (detail) => void`.

Immediately sets `data-dance-moves-waiting="true"` and removes the started marker.
At the boundary it sets `data-dance-moves-started="true"`, removes the waiting
marker, resets/plays animations returned by `target.getAnimations({subtree:true})`,
then calls `start(detail)` and dispatches bubbling `dance-moves-start` from the
target. This animation reset is not filtered through registered ownership scopes.
If `start` throws, the subsequent start event is not dispatched.

Cancellation only cancels the schedule; it does **not** clear waiting markers or
restore animation styles. A programmatic target is not automatically paused by
setting the waiting marker: the provided CSS pause selector specifically uses
`data-dance-moves-start-interval`. Supply that attribute or your own waiting style.

```js
const target = document.querySelector('#release-intro');
if (target) {
  target.setAttribute('data-dance-moves-start-interval', '16');
  const cancel = DanceMoves.deferStart(target, 16, {
    clock: 'audio',
    id: 'release:intro',
    start(detail) { target.dataset.startTick = String(detail.boundaryTick); }
  });
  // Keep cancel for disposal. Remove/restore waiting styles yourself on abort.
}
```

### `onNextInterval(func, interval, metadata?) -> Cancel`

**Callback first, interval second.** Equivalent to audio-clock
`scheduleAtInterval(interval, func, {strictlyFuture:true, ...identity})`, using the
active matching player. Fires once and cancels itself. `metadata` is diagnostic
identity only; it cannot select an explicit audio element.

### `onEveryInterval(func, interval, metadata?) -> Cancel`

**Callback first, interval second.** Throws `TypeError` for a nonfunction. Repeats
on the active matching player's integer interval boundaries, beginning with a
future boundary. Waits while no player is active, pauses with playback and removes
itself after its followed source ends. It is not automatically reinstalled when
a finished track is replayed.

A switch to another active player selects a new future boundary. A forward jump
of more than an interval skips the backlog; smaller delays can result in catch-up
callbacks. Backward seeks do not automatically reset this method's saved boundary.
Cancel/re-register on seek for deterministic post-seek intervals. Callback errors
are logged as `DanceMoves interval handler failed` and do not remove the loop.

### Beat and bar aliases

| Method | Equivalent |
| --- | --- |
| `onNextBeat(func, metadata?) -> Cancel` | `onNextInterval(func, 16, metadata)` |
| `onEveryBeat(func, metadata?) -> Cancel` | `onEveryInterval(func, 16, metadata)` |
| `onNextBar(func, metadata?) -> Cancel` | `onNextInterval(func, 64, metadata)` |
| `onEveryBar(func, metadata?) -> Cancel` | `onEveryInterval(func, 64, metadata)` |

Bars mean **four beats**. A three-beat phrase should use interval 48 explicitly.

## Timing parsers

### `normaliseCueName(value) -> string`

Coerces a falsy value to an empty string, trims, uppercases, replaces each run of
characters outside ASCII `A–Z` and `0–9` with a space, and trims again. It is not
Unicode-aware transliteration; retain original text for display.

```js
DanceMoves.normaliseCueName(' chorus-1! '); // 'CHORUS 1'
```

### `parseTimingFile(text) -> CueEntry[]`

Returns `[]` for nonstrings or strings containing a null or replacement character.
Normalises line endings; reads bracketed timestamps with one-to-three minute
digits, two second digits, and optional one-to-three decimal fraction digits
introduced by `.` or `:`. Removes timestamps from the label. Empty labels and
untimestamped lines are ignored. Multiple timestamps create multiple entries.
A label such as `[SECTION: CHORUS 1]` becomes type `SECTION`, name `CHORUS 1`;
otherwise type defaults to `CUE` and outer square brackets are removed from name.
Entries are filtered to finite nonnegative time and sorted by time.

```text
CueEntry = {
  time: number,                 // seconds
  type: string, name: string, label: string,
  normalisedType: string, normalisedName: string, normalisedLabel: string
}
```

The parser does not fetch, install, validate file size, implement LRC offsets,
require physically ordered timestamps, or execute labels. Server attachment
validation and its error codes are documented separately.

### `parseLyricTimingFile(text) -> LyricEntry[]`

Same input rejection and timestamp grammar, but **keeps blank timed lines** and
treats the remaining text as the lyric, without cue-type parsing. Returns entries
sorted by time. The final entry at an equal timestamp is the one selected by the
playback engine's at-or-before lookup.

```text
LyricEntry = { time: number, text: string, normalisedText: string }
```

## Cue and lyric subscriptions

### `onCue(name, handler, metadata?) -> Cancel`

Throws `TypeError` for a nonfunction. `name === "*"` receives all cues; other
names are normalised. A cue calls the group for its normalised name, then its
normalised full label when different, then the wildcard group. It does **not**
independently dispatch a group for the cue type. To observe all `SECTION` cues,
subscribe to `"*"` and filter `detail.normalisedType`.

For the same normalised key and same function object, registering again replaces
metadata rather than adding another entry. Removers delete that function from
the group, so old removers can remove a later re-registration of the same pair.
Separate registrations for name, label and wildcard can invoke the same function
more than once for one cue. Callback exceptions are logged and later handlers
continue.

### Cue detail and dispatch order

```text
CueDetail = {
  pageId: number,
  time: number,                 // cue time, seconds
  type: string, name: string, label: string,
  normalisedType: string, normalisedName: string,
  audio: HTMLAudioElement | null,
  resetAnimationCount: number
}
```

`normalisedLabel` is present on parsed entries but is **not** included in the
published detail. Dispatch first resets running owned animations, then invokes
registered handlers, then dispatches `dance-moves-cue` and the legacy
`kieran-epk-cue` on `document`. These bubbling custom events share the same detail
object; do not mutate it. Listening to both event names duplicates your work.

```js
const removeCue = DanceMoves.onCue('CHORUS 1', detail => {
  console.log(detail.time, detail.resetAnimationCount);
}, { id: 'release:chorus' });

function inspectCue(event) { console.log(event.detail.name); }
document.addEventListener('dance-moves-cue', inspectCue);
// Cleanup:
removeCue();
document.removeEventListener('dance-moves-cue', inspectCue);
```

### `fireCue(input) -> CueDetail`

Pass `{name?, type?, label?, time?}`. Requires a nonempty name or fallback label;
otherwise throws `TypeError`. Default type is `CUE`; default label is the name.
Invalid/negative time becomes zero. Normalisation, owned resets, handlers and DOM
events follow the ordinary cue path, but `audio` is `null`. Useful for a local
harness; it does not seek audio or alter the loaded file/cue cursor. Calling it is
not gated by the diagnostics flag and it can reset real page animations.

<a id="onlyric"></a>

### `onLyric(handler, metadata?) -> Cancel`

Throws `TypeError` for a nonfunction. Subscribes by function identity; registering
the same function again replaces its metadata. Runs when a bound playing audio
changes lyric index and on playback restart/reindex, including blank entries and
the before-first-entry state. There is no name filter and no immediate replay on
registration. Callback errors are logged and do not stop subsequent handlers.

```text
LyricDetail = {
  pageId: number,
  time: number,                 // entry seconds; 0 if no entry
  text: string, normalisedText: string,
  index: number,                // zero-based; -1 before the first entry
  previousVisibleTime: number | null,
  previousVisibleText: string, previousVisibleNormalisedText: string,
  previousVisibleIndex: number,
  nextTime: number | null,
  nextText: string, nextNormalisedText: string, nextIndex: number,
  nextVisibleTime: number | null,
  nextVisibleText: string, nextVisibleNormalisedText: string,
  nextVisibleIndex: number,
  audio: HTMLAudioElement | null
}
```

`previousVisible*` scans backwards to the first nonblank trimmed lyric. `next*`
describes the **immediately following LRC entry**, including a blank
clear. `nextVisible*` scans forward to the first nonblank trimmed lyric, skipping
all blank clears. Missing next entries use `null` time, `""` text/normalised text
and `-1` index. Before the first entry, look-ahead starts at entry zero. Repeated
nonblank lines still count as distinct entries; normalisation is the same ASCII
cue-name normalisation, not a translation or Unicode-preserving identifier.

For `[00:01]A`, `[00:02]`, `[00:03]B`, the A event has `nextTime: 2`,
`nextText: ""`, `nextVisibleTime: 3`, and `nextVisibleText: "B"`. A preview should
use those timestamps with `detail.audio.currentTime`; do not parse the LRC twice
or assume the next visible line starts at the blank clear. The forward fields
were added by the 2.4.1/2.5.1 changes; the previous-visible fields were added
with the shared lyric stage in 3.0.4.

After callbacks, the core dispatches bubbling `dance-moves-lyric` on `document`
with the same detail. It then updates the built-in visual layer when enabled.
No compatibility lyric-event alias exists. Pause/end hide the built-in renderer
without invoking subscribers or dispatching a blank lyric. A custom renderer
must implement its own pause/end handling with the native audio events.

### Exact cue landings

The core tests a **50 ms** neighbourhood at initial audio binding, after `seeked`,
and after end when re-arming time zero. It selects the earliest cue in that
neighbourhood, not necessarily the nearest. A paused landing is held until
`play`/`playing`; a playing seek invokes it during restart. The pending marker is
cleared so the ordinary `play` followed by `playing` sequence does not duplicate
that pending dispatch. Seeking clears the previous pending marker.

This is separate from skipped-cue suppression and from the interval schedulers.
Do not assume an arbitrary current section is reconstructed by `onCue()`.
If a pending cue is slightly **ahead** of a landing, the cursor can later cross
that same cue normally, so the pending-marker rule is not universal cue-ID
deduplication. Use [cueTimeline](effects.md#cuetimelineoptions) when you need
explicit traversal deduplication, interval state, or optional seek-landings.

## Animation ownership and audio discovery

### `registerAnimationScope(root, selectors) -> Cancel`

Registers a root exposing `getAnimations()`. A missing/incompatible root produces
a no-op remover. `selectors` must be an array; falsy entries are removed. **An
empty list owns no animations.** An animation must target an element inside the
root and match one selector itself or through `closest()`. Invalid selectors are
ignored. Use narrow release-owned selectors, or `["*"]` only when the entire
subtree is deliberately owned. Multiple scopes deduplicate animation objects.

Returns a remover for that one scope. It does not stop animations or undo styling.

### `resetRunningAnimations(audio?) -> number`

Finds owned animations in `running` or `pending` state. For each, sets
`currentTime = 0`, sets a positive supplied `audio.playbackRate` (otherwise 1),
and calls `play()`. Returns the count of successfully reset animations. Paused,
finished and unrelated animations are not restarted. Per-animation failures are
ignored. Passing `audio` does not perform a duration-match check here.

<a id="audio-discovery-and-playback"></a>

### `discoverAudio() -> void`

Scans current `<audio>` elements, establishes a reference duration if absent, and
binds players whose positive finite duration differs from the reference by at
most `max(0.25, audio.duration / 100000)` seconds. Unknown durations get a one-shot
`loadedmetadata` listener. Bound elements are retained in a WeakSet and marked
`data-dance-moves-timing="master-length"`; later calls do not double-bind them.

Reference selection uses the first element in document order matching
`audio[data-dance-moves-master], #ks-clay-stars-audio`, otherwise the first audio. The reference is fixed once known. Replacing the
source on an already bound element does not remove its existing binding or
revalidate the new source. For dynamic player replacement, create a new element
and call discovery; use a fresh page load when changing the master programme.

The playback engine binds `play`, `playing`, `pause`, `ended`, `seeking`, `seeked`,
`ratechange` and `timeupdate`. It uses animation frames while playing. There is no
public unbind method or automatic discovery of later DOM insertions in the core.
The separate [effects API](effects.md) supplies a cue-timeline controller; its
`start()`/`stop()` control effect processing, not the underlying media transport.

## Optional catalogue additions

When an EPK root is found by the separately loaded catalogue script, these
functions are added to the same `DanceMoves` / `KieranEpkMotion` object:

| Function | Meaning |
| --- | --- |
| `applyCatalogueTiming() -> CatalogueSnapshot` | Re-run CSS timing adoption. |
| `catalogueTimingSnapshot() -> CatalogueSnapshot` | Read bounded conversion evidence. |
| `removeCatalogueAnimationScope() -> void` | Unregister the catalogue's wildcard cue-reset scope only. |

`DanceMovesCatalogueTiming.apply()` and `.snapshot()` alias the first two.
These additions are absent if the adopter cannot find a root. See the complete
[adopter contract](adapters.md#catalogue-timing), including what removal does not
undo.

## Diagnostics

### `setDiagnosticsSink(sink) -> boolean`

Returns `false` without enabling anything unless boot configuration contained
literal `diagnostics: true`. When permitted, `null`/`undefined` removes the sink,
a function installs/replaces it, and any other value throws `TypeError`.
Successful changes return `true`. Only one sink is retained.

### `diagnosticsEnabled() -> boolean`

True only when diagnostics were allowed at boot and a sink is currently attached.
Enabling the flag alone does not retain or publish records.

Every record contains `type`, `startTime`, `endTime`, `duration` (milliseconds) and
`pageId`. `duration` measures synchronous work around a span, not the lifetime of
a returned Promise or the full browser rendering pipeline. Optional `error` is a
message limited to 500 characters. Sink exceptions are swallowed.

| Record `type` | Additional fields |
| --- | --- |
| `interval-handler` | `handlerId`, `intervalTicks`, `boundaryTick`, `clock`, `repeating` |
| `cue-handler` | `handlerId`, `registration`, `cueName`, `cueType`; DOM event dispatches use `custom-event:<event-name>` IDs |
| `lyric-handler` | `handlerId`, `lyricIndex`, `lyricTime` |
| `animation-reset` | `resetCount`, `playbackRate` |
| `cue-dispatch-total` | `cueName`, `cueType`, `resetAnimationCount` |
| `cue-reindex` | `time`, `nextIndex`, `cueCount` |
| `cue-detect` | `currentTime`, `firedCount`, `nextIndex` |

A bounded development receiver:

```js
const records = [];
const allowed = DanceMoves.setDiagnosticsSink(record => {
  if (records.length === 200) records.shift();
  records.push(record);
});
// `allowed` is false on ordinary WordPress pages.
// Dispose after collecting the local evidence:
DanceMoves.setDiagnosticsSink(null);
```

The core neither stores nor transmits diagnostic records. This does not describe
external sinks or the independent capture REST endpoint. Keep detailed diagnostics
and test recording interfaces out of public deployment.
