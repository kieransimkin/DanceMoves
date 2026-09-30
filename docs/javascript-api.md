# Shared JavaScript API

Package: `@kieransimkin/dancemoves`, release candidate 3.0.5.
This guide describes the public shared module; [WordPress](wordpress-shared-runtime.md)
loads the same runtime through its adapter.

## Installation and first mount

After publication:

```sh
npm install @kieransimkin/dancemoves
```

From this repository before publication, run `npm install --ignore-scripts`,
commit the generated lockfile, and run `npm run build`. The included demos resolve
the built package through the repository's own package exports, not a registry
copy or a sibling checkout.

```js
import {createDanceMoves} from '@kieransimkin/dancemoves';
import '@kieransimkin/dancemoves/styles.css';

const root = document.querySelector('#arcadians');
const runtime = createDanceMoves({
  root,
  bpm: 145,
  lyricTimingUrl: '/media/canonical-lyric-timing.lrc',
  cueTimingUrl: '/media/sections.cue',
  masterDurationMilliseconds: 273604.558
});
await runtime.ready;
const stopBeat = runtime.onEveryBeat(({boundaryTick}) => {
  root.dataset.lastBeat = String(boundaryTick / 16);
}, {id: 'arcadians:beat'});

// Route/component cleanup:
stopBeat();
runtime.destroy();
```

The root must exist in a browser document. It can contain normal HTML `<audio>`
elements. The library does not autoplay audio. The canonical discovery rules,
including explicit `data-dance-moves-master` and configured master-length
matching, are retained. Mount before starting playback; call `discoverAudio()`
after adding players dynamically when immediate discovery is required.

Imports are safe during SSR. Only `createDanceMoves` requires the browser.
CJS is available with `require('@kieransimkin/dancemoves')`. The independent
`/server` entry requires Node; `/react` requires React; importing the main module
does not import either dependency.

## Mount configuration

| Option | Default and contract |
|---|---|
| `root` | Required Element. One mount per non-overlapping subtree. |
| `bpm` | Missing/null/empty selects 120 fallback. Otherwise a finite **number** from 20 to 400, rounded to three decimals. Changing tempo requires a new mount. |
| `pageId` | 0. Optional non-negative safe integer for diagnostics/legacy catalogue settings, not a requirement to have WordPress. |
| `bpmSource` | Computed; a supplied `fallback` preserves fallback provenance when converting host config. |
| `lyricTimingUrl`, `cueTimingUrl` | Empty. HTTP(S) or relative URLs; no embedded credentials or executable schemes. Served media must satisfy normal browser CORS rules. |
| `lyricPopupsEnabled` | false. Boolean, explicit opt-in to the canonical neutral renderer. Use `onLyric` or the React hook for custom treatments. |
| `masterDurationMilliseconds` | 0 (no length reference); finite number up to one day, rounded to three decimals. |
| `sharedControlTicks` | 0; enables the inherited control-duration treatment when positive. |
| `lyricDisclosureTicks` | 6; positive duration ticks. |
| `effect` | Empty or `paper-planes`. |
| `catalogue` | false; opt-in CSS timing adoption. |
| `clay` | false; initialize Clay and its native background adapter when the required Clay markup exists. |
| `clayPerformance` | Per-mount overrides for the existing Clay monitor. Fields retain their canonical validation and defaults. |
| `orientation` | Optional `{adapter, transitionTargetTicks, harness}`. Adapter is one of `ORIENTATION_ADAPTERS`. Harness remains loopback-only. |
| `paperPlanes` | `{atlasUrl, planeCount, compactPlaneCount}`. The atlas URL is required with `effect:'paper-planes'`; use the shipped asset, not a fabricated sprite. |
| `diagnostics` | false; explicitly enables diagnostic sinks. |
| `legacyGlobals` | false. WordPress compatibility mode; one per document, not for ordinary React roots. |
| `nonce` | Optional nonce attached to library-created style elements for an application's CSP. |
| `onError` | Optional callback for asynchronous readiness and cleanup errors. Handle individual native-controller `ready` failures as well. |

A bad root, overlapping mount or unknown adapter throws. Invalid config values
throw `TypeError`/`RangeError`; the public API does not silently turn bad BPM into
another tempo. `readWordPressConfig` is an internal wire adapter because
WordPress localization stringifies scalar values; generic JS should use typed
values directly.

`runtime.ready` completes canonical cue/lyric-file setup. Existing nonfatal file
fetch behaviour is preserved: an empty/unavailable timing file is not proof of a
working lyric track. Read native readiness separately with
`await runtime.rudiments.ready()`. `destroy()` is idempotent, aborts internal work
and removes resources; it does not stop or delete your audio element.

## Core methods: complete inherited surface

The core has **16 ticks per beat**. A tick lasts `3750 / bpm` milliseconds.
The native library uses **64 pips per beat**, so one core tick is four pips.
A bar in the convenience methods is four beats.

| Method | Meaning |
|---|---|
| `quantizeTicks(value)` | Round half up, minimum one; durations above 16 ticks round to multiples of 16. |
| `durationMilliseconds(ticks, bpmOverride?)` | Quantized duration at configured/override BPM. Not a raw interval-spacing conversion. |
| `currentTick(options?)` | `{clock, audio, bpm}`. Uses a supplied/active playing audio clock; otherwise page elapsed time. A paused audio element does **not** give a paused clock through this legacy helper. |
| `nextIntervalTick(interval, fromTick, strictlyFuture?)` | Next integer-spaced interval boundary; interval spacing is not the long-duration quantizer. |
| `scheduleAtInterval(interval, callback, options?)` | Schedule a page/audio boundary and return a cancellation function. |
| `deferStart(element, interval, options?)` | Defer an element's visual start; returns cancellation. The canonical start attributes/options remain available. |
| `onNextInterval(callback, interval, metadata?)` | Next available audio boundary; returns unsubscribe. |
| `onEveryInterval(callback, interval, metadata?)` | Repeating audio interval handler; unsubscribe on cleanup. |
| `onNextBeat(callback, metadata?)` | `onNextInterval` at 16 ticks. |
| `onEveryBeat(callback, metadata?)` | Repeating 16-tick audio boundaries. |
| `onNextBar(callback, metadata?)` | Next 64-tick boundary. |
| `onEveryBar(callback, metadata?)` | Repeating 64-tick boundaries. |
| `normaliseCueName(value)` | Canonical uppercase normalized matching name. |
| `parseTimingFile(text)` | Parse bracketed timestamps and named/type cues, sorted by time. |
| `parseLyricTimingFile(text)` | Parse lyrics including empty clear entries, sorted by time. |
| `onCue(name, handler, metadata?)` | Subscribe to a name or `*`; returns unsubscribe. |
| `onLyric(handler, metadata?)` | Subscribe to canonical lyric details; returns unsubscribe. |
| `fireCue(cue)` | Dispatch through the same named-cue/diagnostic/event path. Supply `{name,type,time,audio?}`. |
| `registerAnimationScope(root, selectors)` | Explicit ownership of animations that may be reset/speed adjusted by cues. Returns removal function. |
| `resetRunningAnimations(audio?)` | Reset owned running/pending animations; returns reset count. Not a global animation reset. |
| `discoverAudio()` | Discover eligible audio in this mount. |
| `setDiagnosticsSink(callbackOrNull)` | Returns false unless diagnostics was enabled at mount. Sink exceptions are contained. |
| `diagnosticsEnabled()` | Current sink status. |

Interval callbacks receive `{intervalTicks,boundaryTick,audio,clock}`. Metadata
can be a handler ID string or `{id,handlerId}` for attribution. Repeating
intervals preserve the core's seek/deduplication behaviour; use `cueTimeline`
for deterministic state restoration instead of treating interval callbacks as
an event-history replay mechanism.

Additional mount properties/methods are `version`, `bpm`, `bpmSource`,
`ticksPerBeat`, `root`, `config`, `ready`, `destroyed`, `destroy()`, `resources()`
and `on(eventName, listener)`. `on` returns unsubscribe. Resources reports owned
listener/timer/frame/observer/generated-node counts, not the browser's entire
resource inventory.

## Timed files and lyrics

Both cue and lyric files use `[mm:ss.cc]`-style timestamps, optionally three-digit
fractions. Here `.cue` means the plugin's bracketed cue format, **not a CD
cuesheet**. Example:

```text
[01:25.00][BUILD: Build 1]
[01:44.01][DROP: Drop 1]
[03:07.54][DROP: Final Drop]
```

Lyric example with an explicit gap:

```text
[00:02.89]No crown, no concrete
[00:07.76]
[00:07.81]Just mountain breath and moonlit stone
```

The lyric callback contains `pageId`, `time`, `text`, `normalisedText`, `index`,
the `previousVisible*` fields, `nextTime`, `nextText`, `nextNormalisedText`,
`nextIndex`, the `nextVisible*` fields, and `audio`. The visible neighbours skip
blank clear entries; their missing sentinel is `null`, an empty string and `-1`.
Immediate-next fields can describe a blank clear; next-visible fields skip
blanks. Absent times are null, text empty and indices -1.

Pause/end do not manufacture empty core lyric events. A custom renderer should
hide on audio pause/end; `useLyric` already clears its state for pause, end and
seeking. Render text with `textContent`/React text, not HTML injection. Styling the
neutral popup differs in scoped mode (inside the root) and WordPress legacy mode
(under body). The built-in neutral style is not song-specific art direction.

## Shared effect primitives

`runtime.effects` is the canonical registry for this mount. `get(id)` returns a
controller or null, `snapshot()` returns controller snapshots, `teardown(id)`
removes one, and `teardownAll()` removes all. Reusing an ID replaces that local
registry entry. Each factory returns `id`, `type`, `snapshot()` and `teardown()`.
Pass Elements or scoped selector strings for roots/targets.

| Factory | Configuration and extra methods |
|---|---|
| `pointer(options)` | `id`, `root`, `bounds` and event `target`; `finePointer` defaults true, `render({x,y,root,bounds,reason})` optional. Publishes `--dance-moves-x/y`. Controller `set(x,y,reason?)`, `reset(reason?)`. |
| `playbackPulse(options)` | `id`, `root`, `audio`, `ticks` (16), `className` (`dance-moves-playing`), `propertyPrefix` (`--dance-moves-pulse`), optional render. Publishes duration/delay in seconds. Controller `sync()`. |
| `cueClass(options)` | `id`, `root`, `cue` (`*`), `className`, **`durationTicks`** (16), optional render. Class is applied to root, not a separate `target`. Controller `fire(detail)`, `clear(reason?)`. Its finite duration is wall-clock based. |
| `cueTimeline(options)` | `id`, `root`, `audio`, `cues:[{id,time,end?,...}]`, optional `render` and `onCue`. Controller `restore(reason?)`, `start(reason?)`, `stop(reason?)`. |
| `lyricStage(options)` | Shared previous/current/next lyric stage. DanceMoves owns audio, lyric, cue, visibility, preference, resize and teardown lifecycle; release code supplies scoped appearance callbacks. |
| `quality(options)` | `id`, `root`, `tiers`, `initial`, sample/window ratios and cooldowns, optional render. Controller `setTier(index,reason?)`. |

Pulse render receives `{root,audio,duration,delay,ticks}`. Cue-class render
receives `{root,detail,count,durationMilliseconds}`. Timeline transient crossings
are separate from restored active intervals: a seek reconstructs state rather
than firing every cue crossed. Backward seeks start another traversal. Pause,
visibility and accessibility changes rebuild/stop according to the canonical
transport implementation. Inspect the existing timeline demo's live snapshot.

Quality defaults are tiers `full/constrained/minimal`, initial 0, sample 1600ms
(minimum 800), poor windows 2, healthy windows 5, downgrade ratio .72, recovery
ratio .9, downgrade cooldown 5000ms and recovery cooldown 12000ms. It is not the
same monitor as Clay's adaptive performance system. Preserve reduced-motion and
forced-colour CSS; a quality tier is not permission to ignore accessibility.

## Native rudiments and custom renderers

```js
await runtime.rudiments.ready();
const controller = runtime.rudiments.animate({
  id: 'arcadians:drift', root: runtime.root,
  target: runtime.root.querySelector('.drift'),
  rudiment: 'clay_background', clock: 'audio', audio: 'audio',
  rate: 0.5, amplitude: {x: 14, y: 10, z: 0}
});
await controller.ready;
// Later: controller.pause(), resume(), setEnabled(false), reset(), refresh(),
// snapshot(), destroy() / teardown().
```

```css
.drift {
  translate: var(--dance-moves-rudiment-x, 0px)
             var(--dance-moves-rudiment-y, 0px);
}
```

The native service exposes `ready()`, `catalogue()`, `describe(name)`,
`sample(name, integerPip)`, `pipsFromTicks`, `pipsFromSeconds`, `animate`, `get`,
`snapshot` and `destroyAll`. All 15 pinned motions, negative wrapping, CSS output,
custom Canvas callbacks, page/audio/auto clocks, cue resets and accessibility
suspension remain available. Controllers share the native service's scheduler
within a mount. Do not add another timer to advance them.

The complete options, callback fields and limitations are in
[the native reference](../RUDIMENTS-API.md); `lib/rudiments.d.ts` ships with npm.
The four-beat Clay pattern at rate .5 preserves the old eight-beat background
cycle. Native offsets intentionally do not include opacity, rotation or scale;
the Clay adapter preserves those accents separately at the same phase.

## Catalogue and original adapters

With `catalogue:true`, `applyCatalogueTiming()`, `catalogueTimingSnapshot()` and
`removeCatalogueAnimationScope()` are attached to the runtime. The latter removes
animation ownership only; use runtime destruction to dispose the entire mount.

`getClay()` returns the existing Clay controller when initialized. Its methods
are `setParameters`, `setMotion`, `setMotionTarget`, `setCueState`, `lifecycle`,
`reset`, `snapshot`, `teardown`. Visual parameters remain `enabled`,
`masterIntensity`, `coverTiltDegrees`, `coverTranslationPixels`,
`bloomTravelPixels`, `flareTravelPixels`, `specularTravelPixels`, and
`particleReleaseTicks`. `getClayRudiment()` exposes its native background
controller snapshot/teardown. Required markup and all original mapping examples
remain in the 23-page WordPress-style gallery, now loading the shared package.

`getPaperPlanes()` returns the canonical paper-plane controller; its stage is
bounded by `.epk-hero`, with `.epk-cover-wrap` and `.epk-heading` for stacking.
Use `effect:'paper-planes'` and a valid atlas URL. Reduced motion, forced colours,
compact mode, visibility and resize behaviour remain in that implementation.

`orientation.adapter` accepts all nine names exported by `ORIENTATION_ADAPTERS`.
Their original DOM/CSS selectors and mobile/permission policy remain unchanged;
selecting another adapter does not fabricate its required DOM. `getOrientation()`
returns its existing snapshot/reset/teardown API. The unmodified orientation
helper surface is at `orientationCore` (14 exports, including both schedulers).

For an arbitrary application layout, prefer the new generic controller:

```js
const phone = runtime.createOrientation({
  render: ({x, y}) => {
    subject.style.transform = `translate(${x * 20}px, ${y * 16}px)`;
  }
});
button.addEventListener('click', () => phone.enable().catch(console.error));
// phone.disable(); phone.reset(); phone.snapshot(); phone.destroy();
```

This uses the existing rolling mapper and frame scheduler, with a 2000ms window,
1.5-degree minimum span and 32ms smoothing constant by default. Permission must
be requested from a real user gesture. The API does not bypass browser permission
or produce trusted sensor events from synthetic data.

## Captures, metadata and events

`createRecorder({durationMilliseconds:30000,maxSamples:500})` returns `start()`
(Promise of the completed capture), `stop(reason?)`, `snapshot()`, and
`upload(sameOriginUrl,{headers?,signal?})`. Capture is explicit, bounded and never
automatically uploaded. Its schema matches the WordPress capture schema but
physical parity is not claimed. See [Node endpoints](javascript-server.md).

`validatePageConfig`, `PAGE_META_KEYS`, `fromWordPressMeta(meta,resolver)` and
`createMemoryPageStore` are importable without a DOM. The attachment resolver is
required for nonzero WordPress attachment IDs. The memory store supports `read`,
`save`, `revisions`, `restore`, `delete`; `expectedRevision` detects concurrent
updates, and configured page/revision limits bound memory. It is not durable
storage and not an authorization mechanism.

The core's `dance-moves-ready`, `dance-moves-cue`, `kieran-epk-cue` and
`dance-moves-lyric` events, plus effects/native ready/error events, are emitted
on the scoped root. The WordPress adapter preserves document dispatch. Register
lifecycle subscriptions with `runtime.on`; consumers needing initial native
readiness should await the Promise instead of hoping to subscribe before an
initialization event already fired.
