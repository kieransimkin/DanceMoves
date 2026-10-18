# Rudiment visualisers

DanceMoves provides **all 222 FrameRudiments visualisers** through `runtime.visualisers`:
84 views accepting native movement and 138 requiring calibrated spectrum/spectrogram data. Movement views
use the existing native DanceRudiments patterns or a page-owned saved recording.
Spectral views require saved StemLab Fourier calibration. All views share the
existing playback, scheduling, preferences and teardown owners. The catalogue
includes 52 sprite/atlas modes, three filled solid meshes and three music-aware
meshes. The music views additionally accept calibrated spectral deformation;
music terrain can display observed FFT history.

This is a Canvas adaptation of the renderer catalogue and original sprite assets in
[FrameRudiments at c8d1c9a75630a88324e49a1446820392514092dd](https://github.com/kieransimkin/FrameRudiments/tree/c8d1c9a75630a88324e49a1446820392514092dd),
under the [MIT licence](https://github.com/kieransimkin/FrameRudiments/blob/c8d1c9a75630a88324e49a1446820392514092dd/LICENSE),
Copyright (c) 2026 Kieran Simkin. Original renderer identifiers and family controls
are retained, with responsive Canvas geometry and deterministic native histories.
Browser output is not pixel-identical to offline Pillow compositing.

Keep a song's recording JSON beside that page's media. Supply its URL only when
mounting that page or view. Song samples are never imported by a runtime
entrypoint, added to the generic DanceRudiments catalogue, or embedded in
WordPress localization. The [resource contract](#loading-ownership-and-bounds)
explains how multiple views share a load and release it.

## Start with native movement

The package and stylesheet imports below assume a bundler. Importing the module
is safe during server rendering; create the runtime after its root exists.
See [React and Next.js](react-next.md) for the existing mount/provider lifecycle.

```html
<section id="movement">
  <canvas id="movement-path" width="640" height="320"
    aria-label="Figure-eight movement path">
    Figure-eight movement path.
  </canvas>
  <canvas id="movement-circle" width="640" height="320"
    aria-label="Circular history of the figure-eight movement">
    Circular movement history.
  </canvas>
</section>
```

```js
import {createDanceMoves} from '@kieransimkin/dancemoves';
import '@kieransimkin/dancemoves/styles.css';

const root = document.querySelector('#movement');
const runtime = createDanceMoves({root, bpm: 120});

const path = runtime.visualisers.animate({
  id: 'movement:path',
  target: '#movement-path',
  rudiment: 'figure_eight',
  renderer: 'path',
  axes: ['x', 'y'],
  clock: 'page',
  historyPips: 256,
  style: {line_width: 3, radius: 4, background: '#101b2e'}
});

const circular = runtime.visualisers.animate({
  id: 'movement:circular',
  target: '#movement-circle',
  rudiment: 'figure_eight',
  renderer: 'waveform-annular-line',
  axes: ['x', 'y'],
  clock: 'page',
  historyPips: 256,
  style: {
    inner_radius: 0.25,
    outer_radius: 0.95,
    axis: 0,
    line_width: 3,
    colours: ['#76d4cf', '#edb56d'],
    background: '#101b2e'
  }
});

await Promise.all([runtime.ready, path.ready, circular.ready]);

// Wire these calls to the page's own controls as needed:
path.pause();
path.resume();

// In React effect cleanup or route disposal:
// runtime.destroy();
```

These two views share the native pattern and require no recording request.
For motion synchronized to a player, pass its root-local element/selector as
`audio` and use `clock: 'audio'`. Standard media controls start playback.

Set the canvas's CSS dimensions for the intended layout. The runtime maintains
its backing resolution separately:

```css
#movement canvas {
  display: block;
  width: 100%;
  height: 20rem;
}
```

## Render a recorded sonogram

Host the saved recording separately from the library. Replace the example media
paths with the matching master and native Fourier recording for this page.

```html
<section id="song">
  <audio id="song-master" controls preload="metadata"
    data-dance-moves-master src="/media/current-song/master.mp3"></audio>
  <figure data-dance-moves-visualiser-figure>
    <canvas id="song-sonogram" width="960" height="400"
      aria-label="Recorded frequency history of this song"
      aria-describedby="song-sonogram-status">
      Recorded frequency history. Audio controls are above.
    </canvas>
    <figcaption id="song-sonogram-status"
      data-dance-moves-visualiser-status role="status"
      aria-live="polite" aria-atomic="true"></figcaption>
  </figure>
</section>
```

```js
import {createDanceMoves} from '@kieransimkin/dancemoves';
import '@kieransimkin/dancemoves/styles.css';

const song = createDanceMoves({
  root: document.querySelector('#song'),
  bpm: 120
});

const sonogram = song.visualisers.animate({
  id: 'song:sonogram',
  target: '#song-sonogram',
  audio: '#song-master',
  recordingUrl: '/media/current-song/fourier.dancerudiments.json',
  renderer: 'spectrogram-log',
  historyPips: 256,
  historyStride: 2,
  style: {
    floor_db: -72,
    ceiling_db: 0,
    contrast: 1.35,
    history_limit: 96,
    background: '#101b2e'
  },
  onFrame({pip, sourceSeconds, values, report, reason}) {
    // Read the current bounded state here if the page needs it.
    // values and report are null when the view is cleared.
  }
});
await Promise.all([song.ready, sonogram.ready]);

// On route disposal:
// song.destroy();
```

No `clock`, `bpm`, `rate`, `phasePips` or `resetOnCue` override is accepted
for a recording. The `bpm` in `createDanceMoves` is the page's musical clock;
the saved view reads the recording's own capture BPM and origin.

A motion renderer can also consume this recording's normalized channels.
Selecting `renderer: 'waveform'`, for example, plots native channel values.
A spectral renderer additionally decodes and validates their Fourier calibration.

## Declarative page mounting

Set one source in the page configuration and add marked canvases inside the
same runtime root. This is an alternative to imperative ownership of those
canvases.

| Page option | Default | Contract |
|---|---|---|
| `visualiserRecordingUrl` | `''` | Relative or HTTP(S) recording URL, at most 4,096 characters, without credentials or control characters |
| `visualiserRudiment` | `''` | One of the 15 native names below |
| `visualiserRenderer` | `'waveform'` | One of the 222 catalogue identifiers |
| `visualiserAxes` | `[]` | All dimensions when empty; otherwise up to 64 unique native dimension **names** in display order |
| `visualiserAssetBaseUrl` | `''` | Host URL for the shipped sprite directory; relative or HTTP(S), no credentials, query or fragment. Required only for built-in sprite views; WordPress supplies it |
| `visualiserSpriteTheme` | `''` | Renderer default, or one of the 17 sprite themes; retained but unused by other families |
| `visualiserTerrainSource` | `'procedural'` | `'fft'` requires `spatial-music-terrain` and a configured recording source |
| `visualiserSpectralDeform` | `false` | Boolean; true requires a music-aware renderer and a configured recording source |

Both source fields empty means no declarative visualiser mounts. Setting both
is an error. A native pattern cannot be paired with a spectral renderer, FFT
terrain or enabled spectral deformation. Source fields may remain empty while
configuring those controls; the page then remains inactive.

```html
<section id="declarative-song">
  <audio id="declarative-master" controls data-dance-moves-master
    src="/media/current-song/master.mp3"></audio>
  <canvas data-dance-moves-visualiser="spectrogram-log"
    data-dance-moves-visualiser-audio="#declarative-master"
    width="960" height="400" aria-label="Song frequency history">
    Song frequency history.
  </canvas>
  <canvas data-dance-moves-visualiser="spectrum-annular-bars"
    width="640" height="400" aria-label="Circular song frequency bands">
    Circular song frequency bands.
  </canvas>
</section>
```

```js
const runtime = createDanceMoves({
  root: document.querySelector('#declarative-song'),
  bpm: 120,
  visualiserRecordingUrl: '/media/current-song/fourier.dancerudiments.json',
  visualiserRenderer: 'waveform',
  visualiserAxes: [] // Use every recorded dimension.
});
await runtime.ready;
```

For a page without recording data, use `visualiserRudiment: 'circle'` and a
movement renderer, for example `visualiserRenderer: 'waveform-annular-line'`.

Automatic mounting recognizes `canvas[data-dance-moves-visualiser]`, including
the root itself when it is a canvas. Renderer precedence is:

1. Nonempty `data-dance-moves-visualiser-renderer`.
2. Nonempty value of `data-dance-moves-visualiser`.
3. The page's `visualiserRenderer`.

An optional `data-dance-moves-visualiser-audio` selects a player inside the same
root. Otherwise the mount chooses `audio[data-dance-moves-master]`, then the
first `audio,video`. A recording requires that player; a native pattern without
one uses the page clock. Source, axes and the relevant theme/music controls come
from page configuration. Use the
imperative API for per-canvas styles, different sources, selected indexes or
clock/rate controls; those options are not parsed from arbitrary data attributes.

Configuration holds references only. A configured recording URL with no marked
canvas causes no recording request. [Configuration validation](../src/config.mjs)
runs before mounting; errors there fail runtime creation.

## Sources, dimensions and time

### Native patterns and axis eligibility

Native samples come from the existing DanceRudiments/WASM catalogue. No movement
formula is reimplemented for a renderer. One native pip is 1/64 beat; a
DanceMoves tick is 1/16 beat.

| Native source | Available dimensions |
|---|---|
| `bounce`, `sway` | `x` |
| `circle`, `figure_eight`, `step_touch`, `box_step`, `clay_background` | `x, y` |
| `single_stroke_roll`, `double_stroke_roll`, `multiple_bounce_roll`, `single_paradiddle`, `flam`, `drag`, `five_stroke_roll` | `x, y` |
| `helix` | `x, y, z` |

The following eight views require at least **two selected dimensions**:

```text
path
waveform-ribbon
phase-portrait
phase-points
waveform-annular-ribbon
waveform-annular-bands
phase-annular-portrait
waveform-phase-trails
```

All other default movement views require at least one. Wire and solid views accept one
dimension: the second channel controls pitch when present, otherwise the first
channel supplies that input too. Sprite and music geometry accepts a single
native channel and uses zero for absent secondary movement channels. Music
FFT terrain and spectral deformation require **at least three selected calibrated
Fourier bands**, even though their default native modes require only one axis.

Imperative `axes` accepts 1..64 unique names or zero-based indexes 0..63, with
omission meaning all source dimensions. Each selected axis must exist. Page
configuration and WordPress accept names only, matching
`^[a-z][a-z0-9_]{0,127}$`. An `axis` style option indexes the **selected** list,
not the original recording. Although its independent style bound is 0..255,
drawing rejects a value outside the actual selected dimensions.

### Saved recording contract and spectral calibration

A saved source must be native `dancerudiments.recording` schema version 1,
`sample_dtype: 'float64'`, `pips_per_beat: 64`, with 1..64 named dimensions,
finite samples in [-1,1], and its original capture clock/provenance.
See [recording playback](audio-recording-playback.md) for the native format.

Every selected spectral axis must have StemLab provenance with:

- `mode: 'fourier'`, `output_scale: 'bipolar'`, and `clipped_windows: 0`.
- Valid `normalization_divisor`, nonzero `gain` for a non-silent axis, and a
  boolean `silent_axis`.
- `frequency_low_hz` and `frequency_high_hz` within the source Nyquist limit.
- A shared `source_sha256`, `source_sample_rate` and power-of-two
  `fourier.fft_size` in 16..65,536.

Selected frequency bands must be ascending and non-overlapping. Gaps are
permitted. Reversed/overlapping selections, mixed sources or clipped Fourier
exports fail validation. Provenance may be an object or a JSON string; string
provenance is bounded at 1 MiB.

For a non-silent normalized sample `v`, calibrated display analysis recovers:

```text
rms = max(0, ((v / gain + 1) / 2) * normalization_divisor)
dbfs = rms > 0 ? 20 * log10(rms) : null
```

A declared silent axis has zero RMS. Negative capture gains are supported.
Display floors, ceilings, gains and amplitude curves do not alter the saved
samples or provenance. The report uses PCM-unity RMS dBFS; its peaks are local
band maxima, with deterministic plateau selection and contrast/separation
rules. They are not audio true peaks. A smooth or silent spectrum may correctly
have no qualifying peaks.

Frequency scales `log`, `mel`, `bark`, `erb` and `third-octave` transform
the positions of existing recorded bands. They do not calculate new FFTs,
filterbanks, audio frequencies or measured third-octave band powers. The
`spectrum-log` and `spectrum-third-octave` views share the logarithmic position
transform. Effect delta/variance modes calculate visual statistics over the
selected bounded sample history.

Fourier provenance establishes consistency between recorded bands. The
visualiser does not independently hash an arbitrary audio file against the
recording's `source_sha256`; bind the matching source explicitly. Existing
source-verified beat-map validation remains a separate playback concern.

### Clock behavior and deterministic history

Generic patterns use the existing page/audio/auto clock:

| Clock | Behavior |
|---|---|
| `page` | Page musical time at the page BPM; independent of audio |
| `audio` | Explicit selected player's mapped source time and shared rhythmic phase; holds when paused |
| `auto` | Page time until the first playback of its selected player, then stays latched to that player |

For generic patterns the default is `audio` if a player is supplied, otherwise
`page`. Audio-bound procedural phase follows the existing fixed alignment or
opt-in, source-verified variable beat map. See [variable tempo](variable-tempo.md)
and the [native clock contract](../RUDIMENTS-API.md#clock-and-lifecycle-contract).

Saved recordings always use **mapped master seconds and their capture clock**:

```text
pip = floor(
  (master_seconds - recording.clock.beat_zero_seconds)
  * recording.clock.bpm / 60 * 64
  + 1e-8
)
```

The shared playback source maps registered excerpts/video transports to original
master time first. Neither variable beat phase nor page BPM reinterprets the
capture. `playbackRate` already affects advancing media time and is not
multiplied again. A changed bound playback identity clears the view as
`source-mismatch`; replace its controller with the matching recording when
switching source. Capture-origin resets are rejected. These rules are specific
to the visualiser API; the older `runtime.recordings.animate` page-BPM matching
contract is unchanged.

History is reconstructed directly from native integer pip positions on each
required draw, in oldest-to-newest order, including the current sample. Seeking
to the same source time reconstructs the same history; there is no accumulating
RAF buffer or wall-clock integration. Saved history stops at `start_pip`.
Outside `[start_pip, start_pip + sample_count)` the entire view clears rather
than looping or treating a neutral sample as Fourier evidence.

`historyPips` is the **number of source samples available to a view**, despite
its name. `historyStride` is their spacing in native pips. Thus the maximum
span is `(historyPips - 1) * historyStride` native pips. For example, 256 samples
at stride 2 cover at most 510 pips, or 3.984375 seconds for a 120 BPM capture.

Internally, historical samples carry `agePips`; `ageSeconds` is derived from
capture BPM for recordings and is **null for generic patterns**. A current BPM
does not establish the elapsed seconds of past samples across a variable beat
map, rate change or reset. Generic histories represent native pattern phase,
not a reconstructed past media timeline. Cartesian time plots use actual pip
ages within the configured span, preserving empty time before a capture starts.
Circular histories distribute available samples around their selected geometry.

## Imperative API and lifecycle

The public definitions are in [types/index.d.ts](../types/index.d.ts), the
controller in [src/visualisers.mjs](../src/visualisers.mjs), and renderer metadata
in [assets/visualiser-catalogue.json](../assets/visualiser-catalogue.json).

### Creation options

| Option | Default / bounds | Meaning |
|---|---|---|
| `id` | Required, trimmed 1..160 characters | Unique within the runtime's native/spectrum/visualiser owners |
| `target` | Required canvas element or selector | Must belong to this runtime root; one live visualiser owner per canvas |
| `rudiment` | Exactly one source | Native name; movement views only |
| `recordingUrl` | Exactly one source | Bounded relative/HTTP(S) URL, resolved against the page |
| `recording` | Exactly one source | Already-owned native recording object; imperative input only |
| `renderer` | `'waveform'` | Catalogue identifier |
| `axes` | All dimensions; explicit list 1..64 | Unique source names or indexes |
| `audio` | Required for recordings/audio/auto clocks | Root-local media element/selector or supported shared playback source |
| `clock` | Generic only; `page`, `audio`, `auto` | Default follows whether audio was supplied |
| `rate` | Generic only; 1, finite (0,64] | Native phase speed multiplier |
| `phasePips` | Generic only; 0, safe integer | Native phase offset; range ±9,007,199,254,740,991 |
| `resetOnCue` | Generic only; omitted | Boolean or cue-name string, using the native controller's cue-reset behavior |
| `historyPips` | 256, integer 1..512 | Available history sample count |
| `historyStride` | 1, integer 1..120 | Native pips between those samples |
| `style` | Family defaults below | Strict renderer-family style object |
| `pixelRatio` | Device ratio clamped to 1..3; explicit .5..4 | Requested backing scale, further limited by pixel budget |
| `enabled` | `true`, boolean | Local enable control |
| `offscreen` | `true`, boolean | Suspend while the canvas is offscreen; `false` opts out |
| `onFrame` | Omitted, function | Receives immutable current state after a draw or explicit clear |

Supply exactly one source, not empty placeholder values for the other source
keys. Omit recording-only forbidden controls entirely. A per-view `bpm` option
is rejected for both source types.

### Handles and observations

`animate()` returns a frozen controller whose methods control its owned runtime
state. Source, renderer, axes and style remain fixed for that controller; destroy
and recreate it to change those settings.

| Method / property | Contract |
|---|---|
| `ready` | Promise resolving to the handle after source/native startup; rejects initial asynchronous load, calibration or drawing failure |
| `setEnabled(boolean)` | Enables or clears/disables this view |
| `pause()` / `resume()` | Local pose hold; source transport continues, so resume samples its current position |
| `refresh()` | Requests reconciliation/redraw at the current source position |
| `reset()` | Changes a generic pattern's phase origin; throws for saved recordings |
| `snapshot()` | Returns current bounded diagnostics |
| `destroy()` / `teardown()` | Idempotent release of controller, source reference, canvas ownership and integration resources |

Clearing happens automatically for disabled/preference/outside/error states;
there is no public `clear()` method. Resizing is observed automatically.

`snapshot()` includes identity and configuration, `status`, `error`,
`destroyed`, `enabled`, `paused`, `clock`, `rate`, `pip`,
`sourceSeconds`, selected `dimensions`, current `values`, `historyLength`,
`report`, `renderReport`, `historyPips`, `historyStride`, `canvasWidth` and
`canvasHeight`. Recording `rate` is null. It never includes the full recording
or full historical table.

The immutable `onFrame` payload contains:

```js
{
  id, renderer, rudiment, pip, sourceSeconds, reason,
  dimensions, values, historyLength, report, renderReport
}
```

A clear publishes `values: null`, `report: null`, `renderReport: null` and `historyLength: 0`.
A spectral report contains calibrated current bands, peaks, dominant band,
source SHA-256, FFT size and bin resolution. Non-spectral views have
`report: null`. Decorative family gains/curves are not rewritten into the
calibrated report. Callbacks run when drawing/clearing is necessary, not as a
guaranteed per-RAF event stream. Keep them bounded; thrown callback errors are
treated as view failures. The separate `renderReport` contains bounded sprite
or spatial diagnostics; the earlier families return null. It never contains
image pixels, depth arrays or a full source history. Spectral music modes include
both their calibrated `report` and their CPU `renderReport`.

Service discovery and ownership helpers:

```js
const rows = runtime.visualisers.catalogue();
const info = runtime.visualisers.describe('waveform-annular-line');
const existing = runtime.visualisers.get('movement:circular');
const state = runtime.visualisers.snapshot();
// state: {renderers, sources, patterns, atlases, instances}

runtime.visualisers.destroyAll();
```

`describe()` returns metadata or null. Rows expose `name`, `label`,
`description`, `family`, `styleFamily`, `requiresSpectrum`, `supportsSpectrum`,
`requiresAtlas`, `minDimensions` and `usesHistory`. `requiresSpectrum` describes
the unconditional prerequisite; `supportsSpectrum` also identifies the three
music modes with optional calibration. The module also exports frozen
`VISUALISER_CATALOGUE`, `VISUALISER_RENDERERS` and
`VISUALISER_RUDIMENTS` arrays. The service's `sources` count includes shared
recording URL resources used by either visualiser API in this root. `atlases`
counts pending or decoded atlas resources owned by this root. The exported
`SPRITE_THEMES` and `SPRITE_ATLASES` contain only names and pinned metadata.

### Errors, preferences and cleanup

Invalid imperative options throw synchronously when their validity is already
known. Recording schema, selected dimensions and calibration errors can occur
after fetching; catch `view.ready`. Later rendering failures appear in the
handle's `status: 'error'` and `error` diagnostics; an already resolved
readiness promise cannot reject a second time.

A failed view clears, stops its drawing/resize work, and releases its source.
Its error-state handle remains inspectable and can be replaced using the same
ID or canvas. Destroying during loading cannot resurrect the view when the
pending promise finishes.

A malformed declarative canvas is contained individually: valid sibling views
and the song player remain mounted. The failed handle and accessible status
remain available. `runtime.ready` still rejects, and `createDanceMoves`'s
`onError` callback receives that readiness error when supplied. The aggregate
ready event is not dispatched on failed readiness.

Disabled, reduced-motion and forced-colours states clear and stop scheduling.
Hidden documents, offscreen canvases, manual pause and an in-progress seek hold
the previous pose. Seek completion reconstructs the current source position.
Paused/ended audio holds its actual time without an ambient fallback. The
existing shared native scheduler owns animation requests; the views add no
independent timers.

Removing a canvas, moving it outside its runtime root, destroying its controller
or destroying the runtime releases its ownership. Roots cannot overlap.
Canvas attributes, dimensions, intrinsic sizing adjustments and status text
owned by the integration are restored on teardown when they still contain the
integration's values. External changes are preserved.

## WordPress pages and song collections

For a single-song Page, use the **Dance-rudiment visualiser** side box:

1. Select **Visualiser recording (.json)** or a **Bundled rudiment**. Clear the
   other field when changing source type.
2. Choose **Visualiser style** from the grouped 222-renderer selector.
3. Optionally enter **Axes (optional, in display order)** as comma-separated
   native names, for example `x, y` or `band_000, band_001`.
4. For sprites, optionally choose **Sprite theme**. For music modes, optionally
   enable saved-spectrum deformation; music terrain also offers an FFT source.
5. Insert the shortcode inside the same DanceMoves content root as its player.

```text
[dance_moves_visualiser renderer="waveform-annular-line" label="Circular movement history"]
```

The shortcode accepts `renderer` and `label`; omitting the renderer uses the
Page selection. Source, axes and applicable theme/music controls come from the Page box. A recording requires a
player. A native pattern can animate on a page without audio. No configured
source means the shortcode emits no visualiser.

For **Page type → Multiple songs (independent clocks)**, configure the
**Rudiment visualiser** controls in each **Song collection** row instead.
Each row has its own recording/pattern, renderer, axes, theme and music controls next to the existing
master/timing controls. A configured song gets its canvas beside its player;
the single-page shortcode emits nothing on collection Pages. Only the selected
song owns a mounted runtime and loads its recording. Selection changes tear
down the previous song's views and release pending requests that no longer have
consumers. See [word timing and song collections](word-and-multi-song.md).

| Page metadata key | Collection row field | Localized page configuration |
|---|---|---|
| `_dance_moves_visualiser_recording_id` | `visualiser_recording_id` | `visualiserRecordingUrl` |
| `_dance_moves_visualiser_rudiment` | `visualiser_rudiment` | `visualiserRudiment` |
| `_dance_moves_visualiser_renderer` | `visualiser_renderer` | `visualiserRenderer` |
| `_dance_moves_visualiser_axes` | `visualiser_axes` | `visualiserAxes` |
| `_dance_moves_visualiser_sprite_theme` | `visualiser_sprite_theme` | `visualiserSpriteTheme` |
| `_dance_moves_visualiser_terrain_source` | `visualiser_terrain_source` | `visualiserTerrainSource` |
| `_dance_moves_visualiser_spectral_deform` | `visualiser_spectral_deform` | `visualiserSpectralDeform` |

WordPress stores an attachment ID and small selection metadata, resolving the
attachment to a URL for the page. It does not store/localize the recording's
sample body. The Page editor and REST adapter validate compatible selections;
invalid saves preserve the prior setting, and invalid REST writes are rejected.
Full native sample and spectral calibration validation remains in the shared
browser loader.

`visualiserAssetBaseUrl` is derived from the installed plugin's asset directory
and passed into each selected-song mount. It is not Page metadata. PHP reads
only the small trusted atlas manifest for the theme list; image bytes load in the
page that mounts a sprite view. See the [WordPress guide](wordpress-shared-runtime.md).

The upload/attachment checks retain the 64 MiB limit and existing JSON policy.
For large native exports detected as plain text, the existing upload adapter
recognizes the native format within a bounded 8 KiB header. See
[spectrum uploads](spectrum-visualisations.md#wordpress) for that compatibility
path. Renderer choices come from the shared catalogue JSON; native choices come
from the build manifest. PHP does not maintain a second drawing implementation.
Implementation: [dance-moves-visualisers.php](../dance-moves-visualisers.php).

## Complete renderer catalogue

These are exact identifiers, grouped by geometry and style contract. Names
beginning `spectrum`, `spectrogram`, `sprite-spectrum` or `sprite-spectrogram`
require calibrated Fourier data. Other names accept native patterns or normalized
recording channels by default; optional music spectral settings additionally
require saved calibration.

| Group | Count | Style contract |
|---|---:|---|
| Original movement primitives | 4 | Separate particles/bars/waveform/path controls |
| Original basic spectra | 10 | Legacy spectrum |
| Advanced spectra | 7 | Advanced spectral |
| Advanced spectrograms | 10 | Advanced spectral |
| Advanced movement | 10 | Advanced motion |
| Annular spectra | 29 | Circular |
| Annular spectrograms | 8 | Circular |
| Annular movement | 23 | Circular |
| Effect spectra | 24 | Effects |
| Effect spectrograms | 18 | Effects |
| Effect movement | 18 | Effects |
| Spatial wire geometry | 3 | Wire |
| Sprite spectra | 20 | Sprites |
| Sprite spectrograms | 12 | Sprites |
| Sprite waveforms | 12 | Sprites |
| Sprite movement | 8 | Sprites |
| Solid spatial geometry | 3 | Solid |
| Music-aware spatial geometry | 3 | Music |
| **Total** | **222** | **138 require spectral data; 84 accept movement by default** |

### Original movement primitives — 4

Seeded particles, signed bars, time-series channels and paired-axis paths.

```text
particles
bars
waveform
path
```

### Original basic spectra — 10

Current calibrated bands as bars, lines, filled shapes, dots, stems and circular
layouts. Existing users can continue using `runtime.spectrum`.

```text
spectrum
spectrum-line
spectrum-area
spectrum-dots
spectrum-stems
spectrum-steps
spectrum-mirror
spectrum-radial
spectrum-ring
spectrum-spiral
```

### Advanced spectra — 7

Bounded historical profiles, local peaks and alternative frequency positioning.

```text
spectrum-horizon
spectrum-waterfall
spectrum-ridgeline
spectrum-peaks
spectrum-log
spectrum-mel
spectrum-third-octave
```

### Advanced spectrograms — 10

Recorded band history on Cartesian, mirrored, transposed or polar layouts.

```text
spectrogram-linear
spectrogram-log
spectrogram-mel
spectrogram-bark
spectrogram-erb
spectrogram-peaks
spectrogram-contours
spectrogram-mirror
spectrogram-transposed
spectrogram-polar
```

### Advanced movement — 10

Native channel histories, envelopes, ribbons, polar traces and paired phase plots.

```text
waveform-area
waveform-mirror
waveform-dots
waveform-steps
waveform-oscilloscope
waveform-envelope
waveform-ribbon
waveform-polar
phase-portrait
phase-points
```

### Annular spectra — 29

Radial bars, meters, points, frequency profiles, concentric layers and spirals.

```text
spectrum-annular-bars
spectrum-annular-bars-inward
spectrum-annular-bars-bipolar
spectrum-annular-bars-mirror
spectrum-annular-split
spectrum-annular-sunburst
spectrum-annular-fan
spectrum-annular-petals
spectrum-annular-led
spectrum-annular-led-inward
spectrum-annular-ticks
spectrum-annular-arc
spectrum-annular-dial
spectrum-annular-dots
spectrum-annular-lollipop
spectrum-annular-orbit
spectrum-annular-caterpillar
spectrum-annular-peaks
spectrum-annular-area
spectrum-annular-line
spectrum-annular-ribbon
spectrum-annular-halo
spectrum-annular-rose
spectrum-annular-concentric
spectrum-annular-sectors
spectrum-annular-layers
spectrum-annular-gauge
spectrum-annular-spiral
spectrum-annular-helix
```

### Annular spectrograms — 8

Recorded spectral histories arranged as annuli, sweeps and spiral traces.

```text
spectrogram-annular-time
spectrogram-annular-rings
spectrogram-annular-heatmap
spectrogram-annular-stripes
spectrogram-annular-contour
spectrogram-annular-frequency
spectrogram-annular-sweep
spectrogram-annular-spiral
```

### Annular movement — 23

Signed motion histories distributed over rings/arcs, or paired annular phase.

```text
waveform-annular-line
waveform-annular-fill
waveform-annular-area
waveform-annular-envelope
waveform-annular-halo
waveform-annular-rose
waveform-annular-pulse
waveform-annular-mirror
waveform-annular-ribbon
waveform-annular-rings
waveform-annular-bands
waveform-annular-bars
waveform-annular-spokes
waveform-annular-led
waveform-annular-petals
waveform-annular-sectors
waveform-annular-arc
waveform-annular-dots
waveform-annular-radar
waveform-annular-trails
waveform-annular-spiral
waveform-annular-helix
phase-annular-portrait
```

### Effect spectra — 24

Alternative meter/profile geometries, bounded trails and band statistics.

```text
spectrum-cityscape
spectrum-led-matrix
spectrum-capsules
spectrum-outline-blocks
spectrum-peak-ladder
spectrum-staircase
spectrum-eq-curve
spectrum-ribbon-stack
spectrum-peak-trails
spectrum-gel-bars
spectrum-lollipop-grid
spectrum-mountain-range
spectrum-band-delta
spectrum-band-variance
spectrum-energy-tiles
spectrum-semi-circle
spectrum-fan-meter
spectrum-braided-lines
spectrum-rain-bars
spectrum-bead-stacks
spectrum-dash-grid
spectrum-thermometer
spectrum-wave-fence
spectrum-partition
```

### Effect spectrograms — 18

Tiles, cells, perspective terrain, time strips and patterned frequency histories.

```text
spectrogram-pixel-mosaic
spectrogram-isometric-terrain
spectrogram-voxel-city
spectrogram-frequency-stripes
spectrogram-dot-cloud
spectrogram-isobands
spectrogram-negative
spectrogram-tape
spectrogram-slit-scan
spectrogram-trails
spectrogram-hex-cells
spectrogram-bead-grid
spectrogram-tunnel
spectrogram-record-grooves
spectrogram-quilt
spectrogram-crosshatch
spectrogram-triangle-tiles
spectrogram-pixel-rain
```

### Effect movement — 18

Oscilloscope variants, echoes, quantized traces, paired channels and motion meters.

```text
waveform-phosphor
waveform-echo
waveform-sample-beads
waveform-channel-braid
waveform-pulse-train
waveform-quantised
waveform-triggered
waveform-spiral-trace
waveform-butterfly
waveform-horizon
waveform-heat-ribbon
waveform-dotted-envelope
waveform-vertical-scope
waveform-phase-trails
waveform-polar-radar
waveform-dna-helix
waveform-block-meter
waveform-signal-staircase
```

### Spatial wire geometry — 3

Depth-sorted Canvas projections whose orientation/deformation follows native
values and whose orbit follows source seconds.

```text
spatial-torus
spatial-sphere
spatial-terrain
```

### Sprite and atlas geometry — 52

The complete sprite identifier list, theme metadata, grid layout and controls
are in [Sprite and atlas visualisers](#sprite-and-atlas-visualisers).

### Filled spatial geometry — 6

Solid meshes use native values and source time for orientation and deformation.
Music meshes add procedural materials, displacement, terrain weathering and
optional calibrated Fourier geometry.

```text
spatial-solid-torus
spatial-solid-sphere
spatial-solid-terrain
spatial-music-torus
spatial-music-sphere
spatial-music-terrain
```

## Exact style reference

Styles use the original snake_case keys. Objects must be plain objects, numbers
must be finite numbers, booleans must be booleans, and unknown keys fail.
No numeric-string coercion or arbitrary CSS declarations are accepted.
Bounds below are inclusive unless shown otherwise; `integer` means a safe
integer. Controls apply to the variants that use the corresponding geometry:
for example, a point radius does not change a line-only view.

Validate independently of mounting with:

```js
import {validateVisualiserStyle} from '@kieransimkin/dancemoves';

const style = validateVisualiserStyle('waveform-annular-line', {
  inner_radius: 0.25,
  outer_radius: 0.95,
  line_width: 3
});
// Frozen normalized style, including defaults.
// Source-dependent axis/layout checks occur when the view is prepared/drawn.
```

There is no universal cross-family postprocessing style. For example, `grid`
is valid for advanced motion, circular and effect views, but not for the original
`waveform` primitive. Use the table for the selected renderer.

### Common fields

Every family accepts these three fields. Spatial and sprite renderers override their defaults
and add stricter bounds as shown in their table.

| Field | Default | Units / validation |
|---|---|---|
| `colours` | `['#76d4cf', '#edb56d', '#c8a4f7', '#92b9ff']` | Array of 1..256 safe CSS colour strings, cycling as needed |
| `padding` | 4 | CSS pixels, 0..256 |
| `background` | `'transparent'` | Safe CSS colour |

Each colour string is at most 128 characters before trimming. Supported syntax
is a named CSS colour (including `transparent`), 3/4/6/8-digit hex, numeric
`rgb()/rgba()` or `hsl()/hsla()` with the supported comma/space forms.
CSS variables, `url()`, expressions and declarations are rejected. Native
Canvas compositing handles alpha. Palette arrays and normalized styles are frozen.

### Original movement primitive styles

| Renderer | Field | Default | Units / bounds |
|---|---|---|---|
| `particles` | `count` | 24 | Particle count, integer 1..512 |
| `particles` | `radius` | 3 | CSS pixels, .5..256 |
| `particles` | `amplitude` | .7 | Normalized movement mix, 0..1 |
| `particles` | `seed` | 0 | Integer 0..9,007,199,254,740,991 |
| `particles` | `trail` | 4 | Historical trail samples, integer 1..32 |
| `particles` | `lag` | 1 | Additional historical sample delay per particle, integer 0..32 |
| `bars` | `orientation` | `'vertical'` | `vertical` or `horizontal` |
| `bars` | `gap` | 2 | CSS pixels, 0..4,096 |
| `bars` | `negative_colour` | `'#edb56d'` | Safe CSS colour |
| `bars` | `baseline_colour` | `'#9ca4bc'` | Safe CSS colour |
| `waveform` | `line_width` | 2 | CSS pixels, integer 1..64 |
| `waveform` | `layout` | `'stacked'` | `stacked` or `overlay` |
| `waveform` | `baseline_colour` | `'#536078'` | Safe CSS colour |
| `path` | `line_width` | 2 | CSS pixels, integer 1..64 |
| `path` | `radius` | 3 | Current-position marker radius, CSS pixels .5..256 |

Particle anchors use a deterministic JavaScript Mulberry32 generator and native
history. The Python random generator's exact pixels are not reproduced.
Particle delays beyond available history use its oldest sample. Bars need
enough layout room for the selected channels and gaps; stacked waveform lanes
must accommodate their line width. Increase the canvas or reduce those controls
if drawing reports insufficient space.

### Original ten spectrum styles

| Field | Default | Units / bounds |
|---|---|---|
| `floor_db` | -72 | dBFS, -240..0 |
| `ceiling_db` | 0 | dBFS, `floor_db + .01`..60 |
| `hold_seconds` | .4 | Captured source seconds, 0..60 |
| `decay_db_per_second` | 24 | dB per source second, .01..240 |
| `peak_count` | 3 | Integer 1..32 |
| `min_peak_db` | -60 | dBFS, -240..60 |
| `min_peak_contrast_db` | 3 | Adjacent band contrast in dB, 0..240 |
| `min_peak_distance` | 2 | Selected-band index spacing, integer 1..256 |
| `labels` | `true` | Boolean |
| `gap` | 1 | CSS pixels, 0..128 |
| `line_width` | 2 | CSS pixels, integer 1..24 |
| `point_radius` | 3 | CSS pixels, .5..64 |
| `peak_colour` | `'#f5eddf'` | Safe CSS colour |
| `label_colour` | `'#c4d1e7'` | Safe CSS colour |

Hold/decay uses only the available bounded capture history. Increase
`historyPips`/`historyStride` when a longer hold is needed; no setting
accumulates unbounded past peaks. The bar `spectrum` view displays held markers,
dBFS guides and local peaks. See the
[basic spectrum reference](spectrum-visualisations.md) for its unchanged API.

### Advanced spectrum and spectrogram styles

Applies to the seven advanced spectra and ten advanced spectrograms.

| Field | Default | Units / bounds |
|---|---|---|
| `floor_db` | -72 | dBFS, -240..0 |
| `ceiling_db` | 0 | dBFS, `floor_db + .01`..60 |
| `line_width` | 2 | CSS pixels, integer 1..24 |
| `contrast` | 1.35 | Intensity exponent control, .1..4; heat intensity uses exponent `1 / contrast` |
| `history_limit` | 96 | Displayed history budget, integer 8..256 |

History profiles are additionally capped at 40 rows and polar spectrograms at
72 rows. Reducing the display budget preserves endpoints; it does not change
the underlying source clock or calibrated samples.

### Advanced movement styles

Applies to the ten advanced movement views.

| Field | Default | Units / bounds |
|---|---|---|
| `line_width` | 2 | CSS pixels, integer 1..24 |
| `grid` | `true` | Boolean |

### Circular styles

All 60 annular views share this family contract.

| Field | Default | Units / bounds |
|---|---|---|
| `inner_radius` | .27 | Fraction of available outer plot radius, 0..0.95 |
| `outer_radius` | .96 | Fraction of available outer plot radius, .05..1; must exceed `inner_radius` |
| `start_angle` | 0 | Degrees, -36,000..36,000 |
| `sweep_angle` | 360 | Degrees, 5..360 |
| `clockwise` | `true` | Boolean |
| `mirror` | `false` | Boolean; horizontal reflection about viewport centre |
| `grid` | `false` | Boolean |
| `line_width` | 3 | CSS pixels, integer 1..64 |
| `bar_gap` | .16 | Fraction of angular slot, 0..0.9 |
| `bar_width` | 1 | Angular width multiplier, .1..1 |
| `gain` | 1 | Display magnitude multiplier where used, 0..8 |
| `floor_db` | -72 | dBFS, -240..0 |
| `ceiling_db` | 0 | dBFS, `floor_db + .01`..60 |
| `fill_alpha` | 170 | Alpha byte, integer 0..255 |
| `led_segments` | 16 | Segment count, integer 2..64 |
| `rings` | 4 | Ring/layer count, integer 1..12 |
| `history_limit` | 40 | Family history budget, integer 4..256 |
| `axis` | 0 | Selected motion channel index, integer 0..255; must exist |
| `twists` | 2 | Spiral/helix turns, .2..12 |
| `cap_radius` | 2.5 | CSS pixels, .5..20 |
| `peak_threshold` | .18 | Normalized visual peak level, 0..1 |
| `peak_count` | 16 | Integer 1..64 |
| `decay` | .65 | Historical attenuation strength, 0..1 |
| `frequency_scale` | `'equal'` | `equal`, `linear`, `log`, `mel`, `bark`, `erb` |

Zero angle is twelve o'clock, increasing clockwise by default. `equal`
allocates equal angular slots; other frequency scales use recorded band bounds.
The available radius accounts for canvas padding and drawing margins.
`gain` affects spectral display levels and applicable magnitude-based motion
variants; signed line/path variants preserve their native coordinates.

Annular spectrograms use at most `min(history_limit, 80)` rows; annular motion
uses at most `min(history_limit * 3, 240)`; annular phase uses at most
`min(history_limit * 4, 256)`. Each is also limited by available source history.
`decay` deterministically fades sweep/trail histories. Independent channels feed
motion rings. The Canvas adaptation gives closely related modes small geometric
distinctions, including bar widths versus spokes, heatmap versus band colours,
and helix versus spiral traces; it does not claim every identifier must produce
a unique image for every input.

### Effect styles

All 60 effect views share this family contract. Styling operates on current or
bounded historical display values.

| Field | Default | Units / bounds |
|---|---|---|
| `line_width` | 2 | CSS pixels, integer 1..32 |
| `floor_db` | -72 | dBFS, -240..0 |
| `ceiling_db` | 0 | dBFS, `floor_db + .01`..60 |
| `gain` | 1 | Display magnitude multiplier, 0..8 |
| `history_limit` | 48 | Displayed history budget, integer 4..256 |
| `axis` | 0 | Selected motion channel index, integer 0..255; must exist |
| `segments` | 14 | Meter segmentation, integer 2..64 |
| `quantize` | 0 | Visual levels, integer 0..64; 0/1 disable level quantization |
| `gap` | .14 | Cell/slot fraction, 0..0.95 |
| `fill_alpha` | 175 | Alpha byte, integer 0..255 |
| `decay` | .72 | Historical attenuation control, 0..1 |
| `bead_radius` | 3.5 | CSS pixels, .5..20 |
| `perspective` | .46 | Projected display depth fraction, 0..1 |
| `smoothing` | 0 | Adjacent-band radius for applicable display smoothing, integer 0..16 |
| `threshold` | .06 | Normalized visual threshold, 0..1 |
| `stride` | 1 | Additional historical row subsampling, integer 1..16; newest row preserved |
| `amplitude_curve` | `'linear'` | `linear`, `sqrt`, `square`, `log`, `ease` |
| `colour_map` | `'axis'` | `axis`, `level`, `time`, `alternating`, `mono`, `rainbow` |
| `mirror` | `false` | Boolean |
| `reverse` | `false` | Boolean |
| `grid` | `false` | Boolean |
| `baseline` | `false` | Boolean |

This family's `stride` is a display selection on the already bounded history;
`historyStride` at controller creation determines native sampling spacing.
Opacity/decay and intensity curves are evaluated from source samples, with no
feedback buffer. Perspective/isometric effects are Canvas geometry.

### Spatial wire styles

| Field | Default | Units / bounds |
|---|---|---|
| `geometry` | Implied by renderer | `torus`, `sphere` or `terrain`; if supplied, must match the renderer |
| `camera_distance` | 4.8 | Projection scene units, 2.5..30 |
| `fov` | 55 | Degrees, 20..110 |
| `rotation` | 0 | Degrees, -360..360 |
| `orbit` | 35 | Degrees per source second, -360..360 |
| `depth` | .7 | Normalized movement deformation amount, 0..2 |
| `line_width` | 2 | CSS pixels, integer 1..24 |
| `fog` | .22 | Depth attenuation amount, 0..1 |
| `glow` | .35 | Layered-stroke intensity, 0..1 |
| `rings` | 13 | Mesh subdivision count, integer 3..48 |
| `segments` | 30 | Mesh subdivision count, integer 6..96 |
| `padding` | 8 | CSS pixels, **integer** 0..256 |
| `background` | `'#101b2e'` | Safe CSS colour |
| `colours` | `['#68d9f4', '#fa7dbb']` | 1..16 safe CSS colours |

These are projected wire meshes, using native values for yaw/pitch/amplitude
and current source seconds for orbit. Their geometry is depth-sorted and clipped
to the viewport. Layered strokes approximate the offline glow without a pixel
readback, GPU or solid depth buffer. Setting `orbit: 0` removes the independent
source-second orbit while retaining movement-driven deformation.

### Solid spatial styles

The three `spatial-solid-*` views use filled triangles and an actual per-pixel
depth buffer. Near-plane clipping, reciprocal camera-depth interpolation and
linear-light Cook–Torrance/GGX shading follow the original CPU pipeline. They
accept these fields; music views inherit them with the differences below.

| Field | Default | Units / bounds |
|---|---|---|
| `geometry` | Implied by renderer | `torus`, `sphere`, `terrain`; explicit value must match |
| `backend` | `'cpu'` | `cpu` or `auto`; explicit `gpu` is unsupported and throws |
| `camera_distance` | 4.8 | Scene units, 2.5..30 |
| `fov` | 55 | Degrees, 20..110 |
| `rotation` | 0 | Degrees, -360..360 |
| `orbit` | 35 | Degrees per source second, -360..360 |
| `depth` | .7 | Native deformation strength, 0..2 |
| `rings` | 14 | Mesh subdivisions, integer 3..48 |
| `segments` | 24 | Mesh subdivisions, integer 6..72 |
| `ambient` | .26 | Ambient light, 0..1 |
| `roughness` | .42 | GGX surface roughness, .06..1 |
| `metallic` | .2 | Metallic material mix, 0..1 |
| `light_direction` | `[-.45, -.35, .82]` | Three finite numbers, nonzero vector; normalized on validation |
| `light_colour` | `'#ffffff'` | Safe CSS colour |
| `fog` | .18 | Depth-terminated fog density, 0..1 |
| `fog_colour` | `'#597ca3'` | Safe CSS colour |
| `fog_steps` | 6 | Bounded depth integration steps, integer 2..24 |
| `fog_resolution` | 240 | Longest fog-grid edge cap, integer 64..720 |
| `glow` | .18 | Five-tap separable soft halo mix, 0..1 |
| `raster_size` | 512 | Longest internal raster edge cap, integer 64..1,024 |
| `padding` | 8 | CSS pixels, integer 0..256 |
| `background` | `'#101b2e'` | Safe CSS colour |
| `colours` | `['#5bc9ef', '#f6a6c9', '#bea9fc']` | 1..16 safe CSS colours |

```js
const solid = runtime.visualisers.animate({
  id: 'solid-sphere', target: solidCanvas, rudiment: 'helix',
  renderer: 'spatial-solid-sphere',
  style: {roughness: 0.25, metallic: 0.7, orbit: 20, raster_size: 320}
});
await solid.ready;
```

The default mesh has 672 faces; the maximum has 6,912 before clipping, up to
13,824 after clipping. The raster preserves the viewport aspect ratio, never
upscales a smaller CSS viewport, and owns at most 1,048,576 pixels. Its RGBA,
depth and scratch arrays occupy 12 bytes per internal pixel. Canvas presentation
still respects the shared backing-buffer cap and device pixel ratio.

Extreme displacement or perspective can put many triangle bounding boxes over
the viewport. If their candidate-pixel count exceeds 8,388,608, the renderer
deterministically reduces raster resolution until all faces fit that work limit.
It retains every clipped face and its depth test. This decision depends on the
current source/style/viewport, so seeking back produces the same result.
`rasterLimited` and the actual dimensions make the reduction observable.

The CPU fog pass samples a bounded grid and bilinearly expands it. The glow
is a bounded five-tap Canvas adaptation of the offline blur. Neither implies
pixel-identical Pillow compositing. The CPU path calculates no GPU shadow maps;
GPU-only shadow/scattering controls are rejected instead of silently ignored.

### Music-aware spatial styles

The three `spatial-music-*` views add native-driven vertex displacement,
twist/ripples and procedural rock, snow and ice materials. They use normalized
channels from either a native pattern or an ordinary saved movement recording
by default. `colours` defaults to `['#ffffff']`, a neutral material tint;
authored colours multiply the procedural material. Inherited `depth` scales
deformation, with its default .7 preserving the original amplitude.

| Additional field | Default | Units / bounds |
|---|---|---|
| `terrain_source` | `'procedural'` | `procedural` or `fft`; `fft` only for `spatial-music-terrain` |
| `spectral_deform` | `false` | Boolean; adds calibrated current-band displacement to any music mesh |
| `spectral_gain` | .5 | Calibrated displacement strength, 0..4 |
| `terrain_height` | 1 | Terrain height multiplier, 0..5 |
| `fft_floor_db` | -72 | Display floor for calibrated energy, -120..-6 dBFS |
| `fft_gain` | 1 | Calibrated display-energy multiplier, 0..8 |
| `mesh_gain` | 1 | Native-driven mesh displacement multiplier, 0..4 |
| `audio_displacement` | .18 | Native-channel displacement strength, 0..2 |
| `audio_frequency` | 4 | Geometric ripple frequency, .1..32 |
| `audio_twist` | .2 | Native-channel twist amount, -4..4 |
| `audio_ripple_speed` | .4 | Geometric ripple rate in source time, 0..12 |
| `texture_scale` | 3 | Procedural material scale, .01..64 |
| `texture_octaves` | 4 | Material noise octaves, integer 1..8 |
| `bump_strength` | .24 | Procedural relief strength, 0..4 |
| `normal_strength` | .45 | Material normal perturbation, 0..4 |
| `weathering` | .3 | Terrain weathering mix, 0..1 |
| `thermal_erosion` | .2 | Terrain thermal erosion amount, 0..1 |
| `hydraulic_erosion` | .15 | Terrain water/sediment erosion amount, 0..1 |
| `glaciation` | .25 | Terrain glacial shaping amount, 0..1 |
| `erosion_iterations` | 4 | Bounded terrain iterations, integer 0..24 |
| `seed` | 17 | Deterministic material/terrain seed, integer 0..2,147,483,647 |
| `snowline` | .55 | Material snow threshold, -2..4 |
| `ice_coverage` | .35 | Material ice mix, 0..1 |
| `light_power` | 2 | Direct material-light multiplier, 0..16 |
| `light_azimuth` | -125 when either light angle is supplied | Degrees, -360..360; overrides vector direction together with elevation |
| `light_elevation` | 45 when either light angle is supplied | Degrees, -85..85 |
| `camera_pitch` | 0 | Additional pitch, degrees -65..65 |

No new analysis file, live FFT, audio decoder or model is required. Controls with
`audio_` names describe how the supplied native channels influence geometry;
they do not inspect audio samples. Procedural textures and erosion are decorative
geometry/material operations, not measurements or modifications of recorded bands.

For saved FFT terrain, mount the matching source with at least three selected,
ascending, calibrated Fourier axes:

```js
const terrain = runtime.visualisers.animate({
  id: 'song-terrain', target: terrainCanvas, audio: songAudio,
  recordingUrl: '/media/current-song/fourier.dancerudiments.json',
  renderer: 'spatial-music-terrain',
  historyPips: 256, historyStride: 2,
  style: {terrain_source: 'fft', spectral_deform: true, terrain_height: 1.4,
    fft_floor_db: -72, raster_size: 320, weathering: 0.15}
});
await terrain.ready;
```

FFT terrain maps log-spaced recorded frequencies across columns and observed
native pip ages across rows. It reduces available history to at most `rings + 1`
rows and retains empty time before the capture starts. At the first sample,
one measured row forms a narrow display strip; it is not repeated across the
unobserved past. `sourcePips` lists the actual selected rows. Enabling only
`spectral_deform` uses the current calibrated bands and reports only that pip.
The capture clock remains authoritative for both.

Every spatial `renderReport` is frozen and contains `backend`, `geometry`,
`rasterWidth`, `rasterHeight`, `triangles`, `coveredPixels`, `rasterPixelTests`,
`rasterLimited`, `depthBuffer`, `shading`, `fog`, `shadows`, `sourcePips` and
`sourceSha256`. `backend: 'auto'` additionally includes a `fallbackReason` that
identifies the deterministic CPU implementation. A calibrated source supplies
its SHA-256; native/ordinary movement reports null. Only this small report is
exposed; per-view image/depth/scratch buffers are destroyed with their controller.

## Loading, ownership and bounds

The reusable library contains geometry, metadata, 17 original reusable sprite
atlases and generic native rudiments.
It contains no song recordings, audio, separation models or authored song FFT
tables. A page chooses and fetches its own recording only when creating a view
that needs it. Cross-origin URLs require the normal server CORS permission.

Within one runtime, `runtime.visualisers` and `runtime.spectrum` share:

- One request/prepared native table for a normalized recording URL. Relative URLs
  resolve against the document, fragments are removed, and query strings remain
  significant.
- Reference-counted ownership: destroying one view keeps other consumers alive;
  releasing the last removes the resource and aborts a pending fetch.
- Bounded source caches: at most 2,048 native pip samples, 16 historical windows
  and 32 calibrated reports per prepared recording; generic pattern caches are
  similarly scoped, without spectral reports.
- Canvas/ID ownership, responsive sizing and removal observation.

Sprite views additionally share one atlas resource for the same normalized URL,
digest and grid in this runtime. Its encoded PNG is capped at 16 MiB, each side
at 4,096 pixels and its decoded image at 16,777,216 pixels. Hash verification
requires Web Crypto on HTTPS or localhost. Each bank's processed cells have both
an entry cap and a pixel cap; its decoded image and cells are released together.
No sprite atlas is requested by a non-sprite view or a page with no matching
canvas. See [sprite loading and limits](#sprite-and-atlas-visualisers).

Different runtime roots have separate pools. After last-owner release, a new
view acquires the URL again; ordinary browser HTTP caching can still apply.
An inline `recording` object is prepared for that explicit view and is not
URL-deduplicated. The integration discards its extra JavaScript sample table
after copying into the native sampler; callers remain responsible for any
original object references they retain.

The loader bounds recording JSON at **64 MiB**, sample values at **8,388,608**,
dimensions at **64**, and pip positions to the native signed 32-bit recording
range. It validates bytes, schema and sample values before playback.
Every view has at most 512 historical samples; family display limits further
bound geometry. Historical reduction preserves observed endpoints.

Canvas drawing uses CSS coordinates and the layout's measured dimensions.
Each backing buffer is capped at **4,194,304 pixels** even when a larger pixel
ratio is requested. Tiny/collapsed canvases clear/skip drawing; ResizeObserver
(or window-resize fallback) updates the surface. Plot clipping contains wide
strokes, rings and extreme camera projections.

These are bounds per source/view, not an unlimited-view performance guarantee.
Choose the number of simultaneously visible views and history budgets for the
page's layout and devices. The [gallery](../examples/visualisers/README.md) caps
itself at 12 mounted views.

## Accessibility and page integration

Give each canvas a useful `aria-label` and fallback content. Keep ordinary
audio controls and other page content available independently of the drawing.
The runtime sets `role="img"`, preserves an authored label, and exposes
`data-dance-moves-visualiser-state`.

Wrap the canvas in `[data-dance-moves-visualiser-figure]` with a
`[data-dance-moves-visualiser-status]` caption for human-readable loading,
unavailable, preference and source-boundary messages. The caption must belong
to the same runtime root. WordPress emits this markup with polite, atomic live
status announcements. Status text changes with state, not with every sample.

The page decides whether it needs additional textual band summaries from the
bounded `onFrame` report. The runtime does not emit the full recording/history
into DOM attributes, event diagnostics or global page state.

## Compatibility, browser scope and runnable gallery

The original ten `SPECTRUM_RENDERERS`, `runtime.spectrum.animate()`,
`spectrumRecordingUrl`, `spectrumRenderer` and
`[dance_moves_spectrum]` remain supported with their existing style contract.
The wider API dispatches those identifiers to the same basic drawing code.
Their recording loads can be shared with the new API inside one root. Existing
native motion and `runtime.recordings` contracts remain intact.

The upstream reference contains 222 visualisers, and this port covers all their
renderer identifiers: geometry/time-series/wire views, 52 sprite/atlas modes,
three solid meshes and three music-aware meshes. The browser implementation
adapts their original controls, images and CPU geometry to Canvas. It does not
expose the optional native OpenGL backend, GPU shadow/scattering pipeline,
universal offline pixel postprocessing or global style modulation. Unsupported
fields and explicit GPU requests fail validation. Static per-sprite grading,
effects and placement controls are included. No new DSP, audio-analysis model
or song-feature dataset is introduced.

Run the reproducible gallery from the repository root:

```sh
npm ci
npm run build
npm run demo:visualisers
```

Open <http://127.0.0.1:4195>; `PORT` selects another port. The gallery lists all
222 modes and starts with four native views. Its presets include sprite atlases,
solid meshes and music geometry; theme and music-response selectors expose their
relevant controls. The first spectral view loads the example's synthetic
recording; the first use of an atlas loads that sheet. Its eight-second generated tone and hand-authored
band samples demonstrate the rendering/calibration contract; the bands are not
a measured FFT analysis of that tone. Example recordings are generated by the
example server and excluded from npm, browser and WordPress release bundles.

```sh
npm run test:visualisers:browser
```

The browser regression exercises the gallery's catalogue, source clocks, shared
loads, responsive rendering, preferences, seeking and teardown.
`DANCEMOVES_BROWSER_EXECUTABLE` may select a compatible Chromium executable;
otherwise it uses the installed Playwright Chromium. See the
[gallery README](../examples/visualisers/README.md) and
[shared visualiser tests](../tests/shared/visualiser-runtime.test.mjs) for
reproduction and source-level contracts.

## Sprite and atlas visualisers

The 52 sprite views stamp cells from a decoded PNG atlas onto the same Canvas
surface and native histories used by the geometry views. They retain the
FrameRudiments identifiers and static sprite controls. The sprite spectrum and
spectrogram families require a saved recording with valid Fourier calibration;
sprite waveform and motion families accept a native pattern or saved normalized
channels. Every sprite renderer accepts one or more selected channels. No song
recording or artwork is loaded by importing the library.

### Sprite renderer identifiers

| Family | Exact identifiers |
|---|---|
| Spectrum, 20 | `sprite-spectrum-lcd`, `sprite-spectrum-lcd-horizontal`, `sprite-spectrum-lcd-mirrored`, `sprite-spectrum-led`, `sprite-spectrum-led-radial`, `sprite-spectrum-vfd`, `sprite-spectrum-retro`, `sprite-spectrum-neon`, `sprite-spectrum-crystal`, `sprite-spectrum-fire`, `sprite-spectrum-ice`, `sprite-spectrum-icons`, `sprite-spectrum-petals`, `sprite-spectrum-ring`, `sprite-spectrum-halo`, `sprite-spectrum-mosaic`, `sprite-spectrum-city`, `sprite-spectrum-gauge`, `sprite-spectrum-spokes`, `sprite-spectrum-orbits` |
| Spectrogram, 12 | `sprite-spectrogram-lcd`, `sprite-spectrogram-led`, `sprite-spectrogram-pixels`, `sprite-spectrogram-heatmap`, `sprite-spectrogram-icons`, `sprite-spectrogram-neon`, `sprite-spectrogram-crystal`, `sprite-spectrogram-fire`, `sprite-spectrogram-radial`, `sprite-spectrogram-spiral`, `sprite-spectrogram-rain`, `sprite-spectrogram-blocks` |
| Waveform, 12 | `sprite-waveform-lcd`, `sprite-waveform-led`, `sprite-waveform-dots`, `sprite-waveform-icons`, `sprite-waveform-neon`, `sprite-waveform-ribbon`, `sprite-waveform-bars`, `sprite-waveform-mirrored`, `sprite-waveform-annular`, `sprite-waveform-spiral`, `sprite-waveform-sparks`, `sprite-waveform-crystal` |
| Motion, 8 | `sprite-motion-path`, `sprite-motion-orbit`, `sprite-motion-cloud`, `sprite-motion-constellation`, `sprite-motion-trails`, `sprite-motion-particles`, `sprite-motion-xy`, `sprite-motion-icon-grid` |

The segmented meters, radial lamps, glyph rings, native traces and temporal
cells have distinct layouts. Closely related upstream modes have small explicit
Canvas distinctions: retro cells are square, mosaic colours vary by segment,
city bars narrow at their roofs, neon adds a narrow lit highlight, LED traces
retain constant lamp intensity, ribbons use wider cells, and constellation
views thin alternate historical stamps. An icon grid uses the selected native
channels independently. Identical or silent inputs can still produce matching
images in related modes.

### Load the selected atlas for this page

The package ships 17 separate, pinned PNG atlases under
`lib/assets/visualiser-sprites/` (source files are in
`assets/visualiser-sprites/`). Each is 768 by 768 pixels with an 8 by 8 grid.
Their names are:

`lcd`, `lcd-green`, `lcd-amber`, `led`, `vfd`, `arcade`, `neon`, `glass`,
`metal`, `crystal`, `pixel`, `hud`, `plasma`, `fire`, `ice`, `mono`,
`generated-neon`.

`SPRITE_THEMES` exposes the frozen names. `SPRITE_ATLASES` exposes a frozen
mapping from theme to `{file, sha256, width, height, columns, rows}`. These
constants contain metadata; image bytes remain separate files. Several related
themes intentionally share an upstream image digest.

For a bundler deployment, copy that directory to a public asset directory and
set `visualiserAssetBaseUrl` to its HTTP(S) or relative directory URL. The browser
fetches and verifies the selected theme only when its view is created. The base
URL must have no credentials, control characters, query or fragment; its maximum
length is 4,096 characters. WordPress supplies the shipped asset directory
automatically. Normal CORS permission is required when hosting assets elsewhere.

```html
<section id="sprite-movement">
  <canvas id="sprite-path" width="640" height="360"
    aria-label="Figure-eight movement drawn with image glyphs">
    Figure-eight movement drawn with image glyphs.
  </canvas>
</section>
```

```js
import {createDanceMoves} from '@kieransimkin/dancemoves';

const runtime = createDanceMoves({
  root: document.querySelector('#sprite-movement'),
  bpm: 120,
  visualiserAssetBaseUrl: '/assets/dancemoves/visualiser-sprites/'
});
const glyphs = runtime.visualisers.animate({
  id: 'movement:sprite-path',
  target: '#sprite-path',
  rudiment: 'figure_eight',
  axes: ['x', 'y'],
  renderer: 'sprite-motion-path',
  clock: 'page',
  historyPips: 256,
  style: {
    sprite_theme: 'generated-neon',
    sprite_size: 20,
    history_limit: 48,
    sprite_glow: 2,
    background: '#101b2e'
  }
});
await Promise.all([runtime.ready, glyphs.ready]);

// During route cleanup, runtime.destroy() releases this view and its atlas.
```

For a recorded spectrum, use `recordingUrl`, the page's matching `audio` and a
renderer such as `sprite-spectrum-lcd`; the capture-clock contract earlier in
this guide still applies. `visualiserSpriteTheme` is the page default for
declarative sprite canvases. To select separate themes or cell effects on
individual canvases, create imperative views with `style.sprite_theme` and the
other style controls below.

### Custom pinned atlases

A view can select its own page-owned image through `style.sprite_asset`.
The descriptor must have exactly `url` and `sha256`; the upstream spelling
`{path, sha256}` is also accepted and normalized to `{url, sha256}`. A relative
`path` is interpreted as a browser URL against the page, never as a filesystem
path. The SHA-256 must contain 64 hexadecimal characters and match the exact PNG
bytes. URL limits are the same as for other asset references; custom URLs may
include a query, and fragments are removed from the resource identity.

The following complete style fragment uses the shipped generated-neon digest
for a separately hosted copy of that exact file. Replace both URL and digest
when using different artwork. Set `sprite_columns` and `sprite_rows` to the
actual grid of the custom image.

```js
const customGlyphs = runtime.visualisers.animate({
  id: 'movement:custom-glyphs',
  target: '#custom-sprite-path', // A second canvas inside runtime.root.
  rudiment: 'circle',
  renderer: 'sprite-motion-path',
  style: {
    sprite_asset: {
      url: '/media/this-page/generated-neon.png',
      sha256: '3e077af675e6724e850f85d70087f0c80593b5572de2fe48166fe976d818ed07'
    },
    sprite_columns: 8,
    sprite_rows: 8,
    sprite_index: 32,
    animation_frames: 8,
    animation_stride: 6,
    sprite_size: 24
  }
});
await customGlyphs.ready;
```

A custom atlas needs no built-in asset base URL. `sprite_columns` and
`sprite_rows` can differ from eight only when `sprite_asset` is present.
Supported assets are **static PNGs**, at most **16 MiB**, at most **4,096 pixels
per side** and **16,777,216 pixels total**. Dimensions must divide evenly into
the grid. Animated PNGs, unknown themes, invalid grids, out-of-range tile
indexes, missing files and digest mismatches fail the view's `ready` promise
and use its normal contained error state. A secure origin with Web Crypto,
including HTTPS or localhost, is required for digest verification. Image
decoding happens after the byte, dimension and digest checks.

### Sprite source and atlas timing

Atlas animation uses a logical **60-frame-per-source-second** clock:

```js
spriteFrame = Math.floor(sourceSeconds * 60 + 1e-8);
position = Math.floor(
  (spriteFrame * sprite_animation_rate + sprite_animation_phase)
  / animation_stride
);
```

`sourceSeconds` comes from the mapped master media time when a player is
selected; page-clock native views use the runtime's elapsed source clock.
Seeking to the same source time produces the same atlas selection, spin and
jitter regardless of repaint count or the order of previous seeks. Pausing,
hidden-view suspension and reduced-motion preferences use the existing
controller lifecycle. `sprite_spin` is degrees per logical source frame; for
example, `1` means 60 degrees per source second.

For built-in cells without an explicit index, the chosen shape row has eight
palette columns. With more than one animation frame, columns cycle through
`min(animation_frames, 8)` positions. An explicit built-in `sprite_index`
advances from that cell and wraps across the 64-cell atlas. Custom atlases
advance from `sprite_index + sprite_palette_shift` and wrap across their
`sprite_columns * sprite_rows` cells. `sprite_animation_phase` is measured
before division by `animation_stride`, so a phase of six advances one cell
at the default stride of six. `animation_frames: 1` keeps atlas selection
static while spin and jitter can still follow source time.

This animation clock does not change native sampling. Motion and spectral
history remain native integer-pip samples, with the newest sample included.
Display reduction preserves both observed endpoints. Cartesian time placement
uses `agePips / historySpanPips`; a recording that has only just started occupies
the observed portion of the plot. Radial and spiral history use the same age
fraction. Historical cells share the current atlas animation frame, matching
the upstream frame-local renderer, rather than replaying separate historical
sprite animations. The runtime does not infer elapsed seconds for old generic
samples across a variable beat map.

`axis` selects the waveform channel. Motion views use that selected channel
and the following selected channel, wrapping when necessary. With one channel,
the secondary coordinate is zero; the orbit view also uses the existing channel
for its radius so its geometry remains responsive to the input.

### Sprite styles: source, layout and display

All fields are optional. Numeric values must be finite; fields marked integer
reject fractions. Unknown fields fail validation. The common `padding`,
`background` and `colours` contract applies; the defaults are padding `4`,
transparent background, and the shared safe CSS palette. Controls for a
particular geometry affect the modes that draw that geometry: meter segmentation
applies to meters, frequency thresholds apply to spectrogram cells, and radial
controls apply to radial layouts.

| Field | Default | Units / bounds |
|---|---|---|
| `sprite_theme` | Renderer-dependent | One of the 17 theme names above |
| `sprite_asset` | `null` | Pinned `{url, sha256}` or `{path, sha256}` descriptor |
| `sprite_columns` | 8 | Grid columns, integer 1..32; must be 8 for built-ins |
| `sprite_rows` | 8 | Grid rows, integer 1..32; must be 8 for built-ins |
| `shape` | Renderer-dependent | `segment`, `dot`, `tube`, `crystal`, `icon`, `spark`, `block`, `flame` |
| `sprite_index` | Custom: 0; built-in: shape row times 8 | Integer 0..1023, also less than the selected grid's cell count |
| `sprite_size` | 12 | Base cell size in CSS pixels, integer 2..256 |
| `sprite_opacity` | 1 | Multiplier, 0..1; effective stamp alpha is quantized to 1/32 |
| `sprite_colour` | `'original'` | `original`, `tint`, `level`; tint by axis/column or display level |
| `tint_strength` | 1 | Luminance-preserving tint blend, 0..1, quantized to 1/32 |
| `sprite_tint_colour` | `null` | Safe CSS colour overriding palette tint; source alpha is retained |
| `sprite_outline_colour` | `'#ffffff'` | Safe CSS outline colour |
| `sprite_blend` | `'normal'` | `normal`, `add`, `screen`, `multiply`, `lighten`, `difference` |
| `pixelated` | `true` for `arcade`/`pixel`, otherwise `false` | Boolean; nearest-neighbour versus smoothed cell scaling |
| `segment_count` | 12 | Meter segments, integer 2..64 |
| `segment_gap` | .18 | Segment/cell gap fraction, 0..0.8 |
| `off_opacity` | .1 | Unlit meter alpha, 0..1 |
| `bar_gap` | .16 | Slot/cell gap fraction, 0..0.9 |
| `orientation` | `'vertical'` | `vertical`, `horizontal`; explicit horizontal mode stays horizontal |
| `start_angle` | -90 | Degrees, -3600..3600; zero points right, positive is clockwise |
| `sweep_angle` | 360 | Degrees, 5..360 |
| `inner_radius` | .28 | Available radius fraction, 0..0.9; must be below `outer_radius` |
| `outer_radius` | .93 | Available radius fraction, .1..1 |
| `history_limit` | 64 | Display sample budget, integer 2..512 |
| `bin_stride` | 1 | Spectral band stride, integer 1..64 |
| `sample_stride` | 1 | Display history stride, integer 1..32; newest sample preserved |
| `spacing` | 5 | Additional waveform/motion thinning, integer 1..64; step `max(1, round(spacing / 5))` |
| `threshold` | .035 | Spectrogram visibility threshold after calibration, 0..1 |
| `floor_db` | -72 | Calibrated dBFS floor, -240..0 |
| `ceiling_db` | 0 | Calibrated dBFS ceiling, `floor_db + .01`..60 |
| `animation_frames` | 1 | Cycled atlas cells, integer 1..8 |
| `animation_stride` | 6 | Logical 60fps source frames per atlas step, integer 1..240 |
| `axis` | 0 | Index in selected native channels, integer 0..255; must exist for motion/waveform |
| `mirror` | `false` | Boolean; duplicate applicable meter/waveform/motion geometry across its midline |
| `rings` | 3 | Spectrum ring count, integer 1..16 |
| `twists` | 2 | Spiral revolutions, .1..20 |
| `seed` | 0 | Deterministic layout/density seed, integer 0..4294967295 |
| `max_stamps` | 8000 | Attempted stamps per frame, integer 1..25000; exceeding this fails explicitly |

Theme/shape defaults follow the upstream suffix rules exactly. For example,
LCD spectrum variants use `lcd`/`segment`, crystal modes use
`crystal`/`crystal`, fire uses `fire`/`flame`, and path uses
`generated-neon`/`icon`. The upstream multiword suffix behavior is preserved:
`sprite-motion-icon-grid` defaults to `arcade`/`block`, and
`sprite-spectrum-led-radial` defaults to `generated-neon`/`spark`. Supply an
explicit `sprite_theme`, `shape` or `sprite_index` to choose a different atlas
appearance. Explicit `shape` overrides the mode's normal shape-row choice;
explicit `sprite_index` overrides both.

### Sprite styles: the 40 cell and placement controls

These static controls operate on actual atlas pixels or the image transform.
They are independent of offline style-modulation tracks. Unless described as
rounded, values can be fractional within the stated bounds.

| Field | Default | Units / bounds |
|---|---|---|
| `sprite_scale` | 1 | Uniform cell-size multiplier, .05..8 |
| `sprite_scale_x` | 1 | Horizontal size multiplier, .05..8 |
| `sprite_scale_y` | 1 | Vertical size multiplier, .05..8 |
| `sprite_rotation` | 0 | Glyph degrees, -3600..3600 |
| `sprite_spin` | 0 | Degrees per logical 60fps source frame, -90..90 |
| `sprite_offset_x` | 0 | Layout translation in CSS pixels, -1024..1024 |
| `sprite_offset_y` | 0 | Layout translation in CSS pixels, -1024..1024 |
| `sprite_layout_rotation` | 0 | Degrees about the canvas centre, -360..360 |
| `sprite_spread` | 1 | Distance multiplier about the canvas centre, 0..4 |
| `sprite_anchor_x` | 0 | Anchor offset fraction, -1..1; -1 left, 0 centre, 1 right |
| `sprite_anchor_y` | 0 | Anchor offset fraction, -1..1; -1 top, 0 centre, 1 bottom |
| `sprite_shear_x` | 0 | Horizontal shear factor, -0.8..0.8 |
| `sprite_shear_y` | 0 | Vertical shear factor, -0.8..0.8 |
| `sprite_jitter` | 0 | Deterministic source-frame/slot displacement, CSS pixels, 0..48 |
| `sprite_angle_jitter` | 0 | Deterministic slot-angle amplitude, degrees, 0..180 |
| `sprite_visible_fraction` | 1 | Deterministic slot-selection fraction, 0..1 |
| `sprite_palette_shift` | 0 | Palette/custom-cell offset, -64..64, rounded to integer |
| `sprite_animation_rate` | 1 | Logical source-frame rate multiplier, 0..16 |
| `sprite_animation_phase` | 0 | Logical source-frame offset before stride division, -10000..10000 |
| `sprite_hue_shift` | 0 | Hue rotation, degrees, -3600..3600 |
| `sprite_saturation` | 1 | HSV saturation multiplier, 0..4 |
| `sprite_brightness` | 1 | RGB brightness multiplier, 0..4 |
| `sprite_contrast` | 1 | RGB contrast about mid-grey, 0..4 |
| `sprite_gamma` | 1 | Gamma exponent control `value ** (1 / gamma)`, .1..5 |
| `sprite_temperature` | 0 | Positive red / negative blue gain, -1..1 |
| `sprite_red` | 1 | Red-channel gain, 0..4 |
| `sprite_green` | 1 | Green-channel gain, 0..4 |
| `sprite_blue` | 1 | Blue-channel gain, 0..4 |
| `sprite_posterize` | 0 | Channel levels, 0..16, rounded; 0/1 disable posterization |
| `sprite_pixel_size` | 1 | Cell pixelation size, 1..16, rounded; 1 disables pixelation |
| `sprite_blur` | 0 | Per-cell blur radius, pixels, 0..16 |
| `sprite_glow` | 0 | Coloured halo blur radius, pixels, 0..20 |
| `sprite_outline` | 0 | Alpha-border radius, pixels, 0..10, rounded |
| `sprite_shadow` | 0 | Shadow blur radius, pixels, 0..20; 0 disables the shadow |
| `sprite_shadow_x` | 2 | Shadow offset in cell pixels, -64..64; active when shadow is enabled |
| `sprite_shadow_y` | 3 | Shadow offset in cell pixels, -64..64; active when shadow is enabled |
| `sprite_shadow_opacity` | .6 | Shadow alpha multiplier, 0..1 |
| `sprite_scanlines` | 0 | Alternating cell-row darkening, 0..1 |
| `sprite_grain` | 0 | Deterministic cell-pixel noise amount, 0..1 |
| `sprite_sharpen` | 0 | Cell sharpening amount, 0..4 |

The four rounded controls use Python-compatible ties-to-even rounding.
Effective cell width and height after layout sizing and scale multipliers must
each remain at most **1,024 pixels**; a larger result is rejected. Palette tint
preserves image luminance and alpha. HSV/channel controls, scanlines and grain
grade the selected cell. Pixelation and sharpening operate on its bounded
resampled pixels. Glow, outline and shadow are composited from its alpha and
colours; blur/glow/shadow require Canvas 2D filter support and produce an explicit
error if that support is unavailable.

The Canvas implementation grades after bounded cell resampling and applies
rotation/shear while drawing. Halos are attached to that cached cell, so they
rotate/shear with it. Offline Pillow uses different sampling and transform
ordering. These controls preserve their visual purpose and deterministic input
dependencies; the browser port does not promise pixel-identical PNG output.

### Sprite resource ownership and reports

Inside one runtime, views with the same normalized atlas URL, SHA-256, grid and
custom/built-in status share one pending request, decoded image and processed
cell bank. A view releases its atlas when it is destroyed or fails preparation.
The last owner aborts pending work, clears processed canvases and closes a
decoded `ImageBitmap` when available. A later view reacquires the asset. Separate
runtime roots have separate owners. Custom images are requested only by their
own page/view; the generic DanceRudiments package receives no image or song data.

Each bank caches at most **128 processed cells** and **8,388,608 processed
pixels**, evicting the least recently used cells until both limits fit. Halos
count toward that pixel budget; halo padding is capped at 80 pixels per side.
Unmodified cells use direct image source rectangles. Rotation, shear, opacity
and placement never become cache keys, so source-time spinning cannot create a
new cached bitmap every frame. Temporary processing canvases are released after
each cell is prepared. The per-view 512-sample history and Canvas backing-buffer
limits elsewhere in this guide still apply.

`onFrame` and `snapshot()` expose the small sprite-specific result through
`renderReport`. A spectral view's calibrated band report remains separately in
`report`. The sprite render report is:

```js
{
  kind: 'sprite-rudiment',
  stamps: 96,           // Attempted layout stamps; bounded by max_stamps.
  drawn_stamps: 90,     // Image stamps submitted after opacity/density selection.
  animation_frame: 120, // Logical source-clock frame, not a repaint counter.
  atlas: {
    sha256: '…',
    width: 768,
    height: 768,
    columns: 8,
    rows: 8,
    custom: false
  }
}
```

Clipping may hide a submitted stamp, so `drawn_stamps` is not a visible-pixel
count. The report and nested atlas metadata are frozen. They contain no image,
pixel buffer, asset URL or full history. Clearing a view sets both reports to
`null` through the existing controller contract.

All 52 sprite identifiers and all 40 static cell/placement controls are included.
The offline project-level universal postprocessing chain, sprite modulation
tracks, media encoding and connected-alpha atlas authoring/cleaning tools remain
outside this runtime. Their project fields are not accepted as sprite styles.
Use a prepared static atlas and the explicit browser controls above.
