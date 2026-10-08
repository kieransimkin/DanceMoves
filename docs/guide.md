# User and integration guide

[Documentation index](README.md) · [JavaScript API](api/javascript.md) ·
[WordPress API](api/wordpress.md)

Source: [plugin entrypoint](../kieran-epk-device-orientation.php),
[timing runtime](../assets/dance-moves-core.js),
[catalogue adopter](../assets/dance-moves-catalogue-timing.js).
Baseline: **2.8.0 / `4cb6a71f60459b5579be87d7e55ac8b1426c578e`**.

## Install and upgrade

Use the reviewed release asset `DanceMoves-2.8.0.zip` (also kept in `dist/`),
not a GitHub source archive, for a
WordPress installation. Confirm its matching manifest and hashes before upload.
The visible plugin name is **DanceMoves**, but the installed folder and entrypoint
remain `kieran-epk-device-orientation/kieran-epk-device-orientation.php`. Keep that
identity when upgrading; renaming the folder can create a parallel installation.

The plugin header does not declare a minimum WordPress or PHP version. Do not
infer a supported-version matrix from that absence. Verify the site's PHP,
WordPress metadata/revision behaviour and target browsers in staging. The browser
runtime uses modern DOM, Promise/fetch, animation-frame and Web Animations APIs.
Phone input also needs a supported, secure browser context.

The shared CSS, core JavaScript, shared effect primitives and catalogue adopter are enqueued on singular
WordPress **Pages**, not arbitrary posts or archive screens. Orientation is
additionally limited by the configured page-ID map. The plugin does not create an
EPK, a music player, a lyrics transcript, or a chapter-navigation interface.

## Set page properties

Open the Page editor's **EPK Timing** meta box.

| Field | Input | Behaviour |
| --- | --- | --- |
| BPM | Finite 20–400, up to three stored decimal places | Blank clears the stored value. Unknown/invalid stored BPM resolves to 120 with `bpmSource: "fallback"`, not an assertion that the song is 120 BPM. |
| Lyric Timing File | Media Library `.lrc` attachment | The attachment ID is saved; its current URL is resolved when the page renders. |
| Cue Timing File | Media Library `.lrc` or `.cue` attachment | Uses the same bracketed timestamp grammar as LRC. |
| Timed lyric pop-ups | Checkbox, initially off | Enables the neutral built-in visual layer; it does not replace the complete readable lyric section. |
| Ambient effect | None or Paper planes | Stores `_dance_moves_effect` as `""` or `"paper-planes"`. Only the latter enqueues the plane assets; the page must supply `.ks-epk .epk-hero`. |

The hidden `_dance_moves_master_duration_ms` value is positive milliseconds, up to
one day, and is maintained through trusted server-side code rather than the meta
box or the standard page REST response. All six keys are registered for revision
support. See the [metadata reference](api/wordpress.md#page-metadata).

Editor saves require the plugin nonce, `edit_post` permission and a non-autosave
request. An invalid nonblank BPM or invalid timing attachment preserves that
field's previous value and queues an admin error; clearing a selection deletes
its metadata but **does not delete the shared Media Library attachment**. Fields
are saved independently, not as an atomic transaction. The checkbox is not
programmatically prevented from being enabled without a valid lyric file, so the
release review remains an explicit workflow requirement.

## Prepare cue and lyric files

Files selected through the editor must be readable local Media Library
attachments, no larger than **1,048,576 bytes**, with strict UTF-8 and no null or
replacement characters. There must be at least one bracketed timestamp, and all
timestamp tokens in file order must be nondecreasing. Equal timestamps are
allowed. Lyric files use `.lrc`; cue files use `.lrc` or `.cue`.

Accepted timestamp syntax is `[M:SS]`, `[MM:SS.ff]`, `[MMM:SS.fff]`, or the same
fraction introduced with `:`. Minutes have one to three digits, seconds exactly
two, and fractions one to three. Fractions are decimal seconds, **not frames**.
Use seconds 00–59 in authored files even though the current parser's pattern does
not independently reject a higher two-digit seconds field.

Example cue file:

```text
[00:04.000][SECTION: VERSE 1]
[00:20.000][SECTION: CHORUS 1]
[00:36.000]BREAK
```

Example lyric file:

```text
[00:00.000]
[00:04.000]First sung line
[00:08.000]Second sung line
[00:12.000]
[00:20.000]The repeated hook
[00:24.000]The repeated hook
```

A blank timed lyric clears the display. It is ignored by the cue parser. Multiple
timestamps on one line generate multiple entries; make sure their physical order
still satisfies the server's monotonic check. The browser sorts parsed entries,
but that does not make an out-of-order upload valid in the editor.

Metadata-only lines are ignored by the browser parsers. LRC offset tags, enhanced
word-by-word timing and conventional CD `FILE`/`TRACK`/`INDEX` cuesheet syntax are
not implemented. Timing text is data, never executable code or HTML.

The two files are fetched separately using same-origin credentials and
`cache: "no-cache"`. Cross-origin hosting needs the browser to permit the fetch.
The browser parser itself does not repeat the server's byte-size or monotonicity
validation. REST/programmatic attachment assignments need explicit validation;
see [WordPress validation](api/wordpress.md#timing-attachment-validation).

## Understand ticks before writing effects

One tick is **one sixteenth of a beat**, not a conventional sixteenth note:

```text
one tick       = 3750 / BPM milliseconds
one beat       = 16 ticks
one 4/4 bar    = 64 ticks
at 120 BPM     = 31.25 ms/tick, 500 ms/beat, 2000 ms/bar
```

Visual durations are rounded half upward to a positive integer tick. Results
above 16 are then rounded to the nearest multiple of 16, again half upward.
Consequently 17 duration ticks become 16; 24 become 32. Interval spacing uses
positive integer ticks without that long-duration quantisation. Use
`durationMilliseconds()` and the published CSS timing variables rather than
independent millisecond guesses.

The page clock starts when the core script evaluates. Playback interval helpers
wait for an active, matching audio element. `currentTick({clock: "audio"})` is a
special case: when no supplied/active audio is currently playing, it falls back to
the page clock. A paused song must therefore be guarded explicitly in a canvas
animation, rather than assuming that this call returns a frozen audio position.

There is no beat-offset, time-signature, variable-tempo or tempo-map setting. The
grid is anchored to audio time zero at a single BPM. For another meter, choose an
explicit interval, for example 48 ticks for three beats.

## Connect audio

Ordinary `<audio>` elements are discovered after both timing-file loads settle.
The preferred matching reference is the configured master duration. Otherwise the
runtime uses the first element in document order matching
`audio[data-dance-moves-master], #ks-clay-stars-audio`, otherwise the first audio
element. Mark the canonical
player explicitly when a page contains previews or unrelated audio:

```html
<audio id="release-audio" data-dance-moves-master controls preload="metadata">
  <source src="/media/release-full-length.mp3" type="audio/mpeg">
</audio>
```

A positive finite duration matches when the absolute difference is at most
`max(0.25, audio.duration / 100000)` seconds. A preview, differently trimmed master
or live/infinite-duration stream is not safely interchangeable with the canonical
programme. This is a duration check, not audio fingerprinting or beat alignment.

Matching players are marked `data-dance-moves-timing="master-length"`. Each has its
own cue cursor; interval helpers use the player most recently started via
`play`/`playing`. Owned animations follow playback-rate changes. Seeking reindexes
the cue cursor without replaying skipped cues; lyrics resume at the current line.
The core arms the earliest cue within 50 ms of an initial/seek position, including
a cue at zero. It dispatches that pending cue once at playback start, or when a
playing seek completes. Other skipped cues are not replayed. This is not general
state reconstruction: use `DanceMovesEffects.cueTimeline()` for active intervals
and deterministic seek restoration, and initialise persistent visuals in its
`render` callback. The two cue mechanisms have different landing policies; see
[core cue landings](api/javascript.md#exact-cue-landings) and
[cue timelines](api/effects.md#cuetimelineoptions).

For dynamically inserted audio, call `DanceMoves.discoverAudio()` after insertion.
There is no global audio MutationObserver. Install integrations before starting
playback; discovery is not a transport-control or automatic-play API. Avoid
simultaneous players: cues are per-player, but the lyric layer, ownership resets
and active interval clock are shared.

## Subscribe and clean up

Enqueue a page script with `dance-moves-core` as a WordPress dependency. The global
is available when that script executes, but asynchronous timing fetches may still
be pending. There is no `DanceMoves.ready()` method or ready event.

```js
(() => {
  const dm = window.DanceMoves;
  const root = document.querySelector('.ks-epk');
  if (!dm || !root) return;

  const disposers = [
    dm.onCue('CHORUS 1', detail => {
      root.dataset.section = detail.normalisedName;
    }, { id: 'release:chorus-state' }),
    dm.onEveryInterval(detail => {
      root.dataset.barTick = String(detail.boundaryTick);
    }, 64, { id: 'release:bar-state' })
  ];

  window.addEventListener('pagehide', () => {
    disposers.forEach(remove => remove());
  }, { once: true });
})();
```

This simple example assumes a normal page load; an application restoring a page
from the back-forward cache must re-register its own disposed handlers on
`pageshow`. Keep stable diagnostic IDs, and prefer `onCue()`/`onLyric()` over a
second parser or clock. For DOM listeners, register on `document`: cue and lyric
events are dispatched there, not on each EPK child.

## Adopt timed lyrics

A selected lyric file powers `onLyric()` even while the built-in pop-up is off.
The built-in layer is one body-level `.dance-moves-lyric-popover` containing a
`.dance-moves-lyric-popover__text`. It uses `textContent`, is noninteractive and
`aria-hidden`, hides on pause/end, and clears on a blank lyric. Reduced motion
keeps the words but removes entry/exit movement; forced colours have a fallback.

Before enabling it for a release, inspect that song's artwork and visual-language
record, distinguish observed/inferred/proposed/adopted decisions, and document a
distinctive treatment. Keep real text, full readable lyrics, safe areas and player
clearance. Test normal and long lines, blank clears, repeated hooks, seeking,
pause/resume/end, narrow screens, reduced motion and forced colours. A generic
checkbox-only adoption is not the approved workflow.

The renderer is appended to `body`, not inside `.ks-epk`. A selector such as
`.ks-epk .dance-moves-lyric-popover` will not reach it. Scope release styling through
an appropriate body page class or other release-specific ancestor context. See
[lyric styling](api/styling.md#timed-lyric-component).

Custom lyric consumers must handle audio `pause`/`ended` themselves when they need
to hide: `onLyric()` does not emit a synthetic blank on those events. It also does
not immediately replay the last value to a newly registered handler.

For a previous/current/next presentation, use `DanceMovesEffects.lyricStage()`.
It consumes the core's previous/next visible neighbours and owns media, seek,
visibility, preference, resize, timer and teardown lifecycle. A release adapter
should supply only its scoped visual callbacks and CSS, not another parser or clock.

## Use the shared effects API

Load after `dance-moves-effects`, or mount once in response to the document's
`dance-moves-effects-ready` event. Select the smallest matching primitive:
`pointer()` for bounded input, `playbackPulse()` for phase-aligned CSS,
`cueClass()` for a short cue-triggered class, `cueTimeline()` for reconstructable
playback state, `spritePlayback()` for a media-clock sprite atlas, `lyricStage()` for the shared three-line lyric lifecycle, and
`quality()` for a reusable quality controller. Stable IDs
identify instances for `get()`, `snapshot()` and teardown. Each has explicit
options, callback payloads and disposal semantics in the [shared API](api/effects.md).
These are APIs, not auto-enabled visual presets. In particular, a cue timeline
accepts page-owned cue objects; it does not automatically import the Page cue LRC.

For paper planes, select **Ambient effect → Paper planes** and provide an existing
hero with explicit containment. Check full and compact counts, clipping, readable
controls and reduced motion before publication. See the [paper-plane API](api/paper-planes.md).

## Provide MP3 downloads without breaking playback

Use an ordinary same-upload-host MP3 link with an explicit `download` attribute:

```html
<a href="/wp-content/uploads/2026/09/example.mp3" download>Download MP3</a>
```

On the main Page content render, DanceMoves rewrites eligible anchors to its
signed attachment endpoint. It does not rewrite players, `<source>` elements,
external media or links without `download`. Server-generated signed URLs are
shareable and do not expire automatically; they are not a private-media service.
The [download reference](api/downloads.md) covers URL helpers, request methods,
response headers, path validation and errors.

## Adopt catalogue and orientation motion

The catalogue adopter chooses `.ks-epk` first, with specific fallback roots listed
in the [adapter reference](api/adapters.md#catalogue-timing). It converts owned
animation/transition durations and delays, preserving zero and special reduced-
motion/view-timeline sentinels. It also registers the release root for cue resets
and observes inserted elements/style-attribute changes. It does not change
artwork, invent choreography, rewrite keyframe geometry, or retime canvas code.

Phone orientation is a separate nine-page adapter map. The production wrapper
checks mobile eligibility and sensor support. Permission-requesting browsers get
**Use phone motion**; denied/unavailable input leaves the ordinary page usable.
Hidden pages, reduced motion and teardown stop input work; screen rotation
recalibrates it. Release-specific motion-off controls remain relevant. CSS
transitions interpolate targets published at a two-tick cadence; the two-second
rolling window is input processing, not a musical duration.

For Clay/Stars, keep the existing legacy effects plugin active until the approved
takeover. While `KS_CLAY_STARS_EFFECTS_VERSION` is defined, DanceMoves suppresses
its Clay CSS/JS and content transform. Deactivating the legacy plugin permits
takeover on a subsequent request. Do not transplant that release's artwork or
motion treatment onto other EPKs.

## Diagnostics and deployment

Use [development and operations](development.md) for local tests, diagnostics,
performance tiers, approval gates and rollback. A motion capture is an explicit
submission of a supplied recording; ordinary plugin playback does not record or
upload phone samples. No WordPress upload, metadata write or deployment is part
of a documentation update.
