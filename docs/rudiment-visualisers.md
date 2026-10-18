# Rudiment visualisers

DanceMoves provides **164 Canvas 2D visualisers** through `runtime.visualisers`:
58 movement views and 106 calibrated spectrum/spectrogram views. Movement views
use the existing native DanceRudiments patterns or a page-owned saved recording.
Spectral views require saved StemLab Fourier calibration. All views share the
existing playback, scheduling, preferences and teardown owners.

This is a Canvas adaptation of the self-contained geometry in
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
| `visualiserRenderer` | `'waveform'` | One of the 164 catalogue identifiers |
| `visualiserAxes` | `[]` | All dimensions when empty; otherwise up to 64 unique native dimension **names** in display order |

Both source fields empty means no declarative visualiser mounts. Setting both
is an error. A native pattern cannot be paired with a spectral renderer.

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
one uses the page clock. Source and axes come from page configuration. Use the
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

All other movement views require at least one. The three wire views accept one
dimension: the second channel controls pitch when present, otherwise the first
channel supplies that input too. They do not require a three-axis recording.

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
`report`, `historyPips`, `historyStride`, `canvasWidth` and
`canvasHeight`. Recording `rate` is null. It never includes the full recording
or full historical table.

The immutable `onFrame` payload contains:

```js
{
  id, renderer, rudiment, pip, sourceSeconds, reason,
  dimensions, values, historyLength, report
}
```

A clear publishes `values: null`, `report: null` and `historyLength: 0`.
A spectral report contains calibrated current bands, peaks, dominant band,
source SHA-256, FFT size and bin resolution. Non-spectral views have
`report: null`. Decorative family gains/curves are not rewritten into the
calibrated report. Callbacks run when drawing/clearing is necessary, not as a
guaranteed per-RAF event stream. Keep them bounded; thrown callback errors are
treated as view failures.

Service discovery and ownership helpers:

```js
const rows = runtime.visualisers.catalogue();
const info = runtime.visualisers.describe('waveform-annular-line');
const existing = runtime.visualisers.get('movement:circular');
const state = runtime.visualisers.snapshot();
// state: {renderers, sources, patterns, instances}

runtime.visualisers.destroyAll();
```

`describe()` returns metadata or null. Rows expose `name`, `label`,
`description`, `family`, `styleFamily`, `requiresSpectrum`,
`minDimensions` and `usesHistory`. The module also exports frozen
`VISUALISER_CATALOGUE`, `VISUALISER_RENDERERS` and
`VISUALISER_RUDIMENTS` arrays. The service's `sources` count includes shared
recording URL resources used by either visualiser API in this root.

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
2. Choose **Visualiser style** from the grouped 164-renderer selector.
3. Optionally enter **Axes (optional, in display order)** as comma-separated
   native names, for example `x, y` or `band_000, band_001`.
4. Insert the shortcode inside the same DanceMoves content root as its player.

```text
[dance_moves_visualiser renderer="waveform-annular-line" label="Circular movement history"]
```

The shortcode accepts `renderer` and `label`; omitting the renderer uses the
Page selection. Source and axes come from the Page box. A recording requires a
player. A native pattern can animate on a page without audio. No configured
source means the shortcode emits no visualiser.

For **Page type → Multiple songs (independent clocks)**, configure the
**Rudiment visualiser** controls in each **Song collection** row instead.
Each row has its own recording/pattern, renderer and axes next to the existing
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

WordPress stores an attachment ID and small selection metadata, resolving the
attachment to a URL for the page. It does not store/localize the recording's
sample body. The Page editor and REST adapter validate compatible selections;
invalid saves preserve the prior setting, and invalid REST writes are rejected.
Full native sample and spectral calibration validation remains in the shared
browser loader.

The upload/attachment checks retain the 64 MiB limit and existing JSON policy.
For large native exports detected as plain text, the existing upload adapter
recognizes the native format within a bounded 8 KiB header. See
[spectrum uploads](spectrum-visualisations.md#wordpress) for that compatibility
path. Renderer choices come from the shared catalogue JSON; native choices come
from the build manifest. PHP does not maintain a second drawing implementation.
Implementation: [dance-moves-visualisers.php](../dance-moves-visualisers.php).

## Complete renderer catalogue

These are exact identifiers, grouped by geometry and style contract. All names
beginning `spectrum` or `spectrogram` require calibrated Fourier data; the
remaining names accept native patterns or normalized recording channels.

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
| **Total** | **164** | **106 spectral, 58 movement** |

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

Every family accepts these three fields. Wire renderers override their defaults
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

## Loading, ownership and bounds

The reusable library contains geometry, metadata and generic native rudiments.
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

## Compatibility, omitted families and runnable gallery

The original ten `SPECTRUM_RENDERERS`, `runtime.spectrum.animate()`,
`spectrumRecordingUrl`, `spectrumRenderer` and
`[dance_moves_spectrum]` remain supported with their existing style contract.
The wider API dispatches those identifiers to the same basic drawing code.
Their recording loads can be shared with the new API inside one root. Existing
native motion and `runtime.recordings` contracts remain intact.

The upstream reference contains 222 visualisers. This port covers the 164
self-contained geometry/time-series/wire views. The remaining **58** are
excluded: **52 sprite/image modes, three solid spatial renderers, and three
music-aware renderers**. Sprite asset loading, solid rasterization/depth buffers,
music-analysis dependencies, universal postprocessing, and style modulation are
not exposed by this API. Their renderer identifiers and unsupported style fields
are rejected. The geometry
families do not introduce a new DSP or media-processing pipeline.

Run the reproducible gallery from the repository root:

```sh
npm ci
npm run build
npm run demo:visualisers
```

Open <http://127.0.0.1:4195>; `PORT` selects another port. The gallery lists all
164 modes and starts with four native views. The first spectral view loads the
example's synthetic recording. Its eight-second generated tone and hand-authored
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
