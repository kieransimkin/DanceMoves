# Spectrum visualisations

DanceMoves supplies the basic calibrated spectrum views from FrameRudiments to
JavaScript, React/Next.js and WordPress pages. The shared module draws Canvas 2D
views over saved **StemLab Fourier** `dancerudiments.recording` v1 JSON. Native
DanceRudiments/WASM owns recording sampling, StemLab owns audio analysis, and
DanceMoves owns browser rendering and lifecycle. No FFT, model, media decoder or
song dataset is added to the generic rudiment package.

## Load data only where it is used

Keep each song's analysis as a separately hosted page/media asset. Set that
page's `spectrumRecordingUrl`, or supply `recordingUrl` when creating a particular
view. Do not import a song JSON into a package entrypoint or copy it to `lib/`,
the native catalogue or plugin assets.

- Importing the package, creating an ordinary runtime, or configuring a URL
  without a spectrum canvas makes **no spectrum request**.
- Canvases in one runtime share a pending request and native table for the same
  URL. Caches are bounded and owned by that runtime; there is no global song cache.
- Each song collection mounts only its selected song. Selection changes destroy
  the previous spectrum views and abort requests that no longer have consumers.
- Destroying the last view releases its recording. A later remount loads the
  selected URL again; the browser's normal HTTP caching policy still applies.
- Source JSON is never embedded in WordPress localization. PHP stores an
  attachment ID and resolves a URL for the current page/song.

The build copies an explicit set of reusable assets. The package tests inspect
the actual npm file list and browser/WordPress archives for recording JSON and
song media. npm prepack checks the complete generated file inventory as well as
hashes, so files added to `lib/` after building are rejected instead of silently
entering a release.

## WordPress

For a single-song Page:

1. Upload the saved StemLab Fourier recording JSON to the Media Library.
2. In the **Dance-rudiment spectrum** box, select its recording and preferred style.
3. Insert `[dance_moves_spectrum]` inside the same DanceMoves content root as the
   song's native audio player. Existing EPK or ordinary entry-content roots work.
4. Preview the page and play or seek the audio.

Multiple views can share the same recording:

```text
[dance_moves_spectrum renderer="spectrum" label="Song frequency bands"]
[dance_moves_spectrum renderer="spectrum-ring" label="Circular frequency view"]
```

For a **Multiple songs** Page, set **Spectrum recording (.json)** and **Spectrum
style** separately in each Song collection row. Each configured song gets a
canvas beside its player. Unselected songs do not fetch their recording data.
An optional recording deleted from the Media Library suppresses its visualisation
while retaining that song's audio.

The page fields are `_dance_moves_spectrum_recording_id` and
`_dance_moves_spectrum_renderer`. Collection rows use `spectrum_recording_id` and
`spectrum_renderer`. Invalid editor or REST writes preserve the previous setting.
Attachment IDs, readable JSON files, MIME types, URLs and the 64 MiB byte cap are
checked by PHP. Full sample/clock/calibration validation happens in the shared
browser loader, avoiding large PHP copies of the entire analysis on page views.
For native exports that the server detects as plain text, the upload adapter
recognizes the recording format in a bounded 8 KiB header while preserving the
site's JSON upload policy. Unusual files with their format marker later than
that retain WordPress's normal MIME decision.

## JavaScript, React and Next.js

Import the shared library and stylesheet, then mount after the root exists:

```html
<section id="song">
  <audio controls data-dance-moves-master src="/songs/master.mp3"></audio>
  <figure data-dance-moves-spectrum-figure>
    <canvas data-dance-moves-spectrum="spectrum-line"
      aria-label="Frequency spectrum" width="960" height="320">
      Recorded frequency spectrum. Audio controls are above.
    </canvas>
    <figcaption data-dance-moves-spectrum-status role="status"></figcaption>
  </figure>
</section>
```

```js
import {createDanceMoves} from '@kieransimkin/dancemoves';
import '@kieransimkin/dancemoves/styles.css';

const runtime = createDanceMoves({
  root: document.querySelector('#song'),
  bpm: 120,
  spectrumRecordingUrl: '/songs/master-fourier.json',
  spectrumRenderer: 'spectrum'
});
await runtime.ready;
// React effect cleanup or route disposal:
// return () => runtime.destroy();
```

Automatic mounting is strictly scoped to `canvas[data-dance-moves-spectrum]`
within this runtime root. The canvas's `data-dance-moves-spectrum-renderer` or
nonempty `data-dance-moves-spectrum` value overrides the page's style. By default
it selects the root's `audio[data-dance-moves-master]`, then its first audio/video
element. To select a specific local player, add
`data-dance-moves-spectrum-audio="#player-id"`.

Use the explicit API for custom controls, selected axes or styles:

```js
const view = runtime.spectrum.animate({
  id: 'song:spectrum',
  target: root.querySelector('canvas'),
  audio: root.querySelector('audio'),
  recordingUrl: '/songs/master-fourier.json',
  renderer: 'spectrum',
  axes: ['band_000', 'band_001', 'band_002'],
  historyPips: 256,
  historyStride: 1,
  style: {
    floor_db: -72,
    ceiling_db: 0,
    hold_seconds: 0.4,
    decay_db_per_second: 24,
    colours: ['#76d4cf', '#edb56d'],
    labels: true
  },
  onFrame({pip, sourceSeconds, report, reason}) {
    // report is null while disabled, outside the capture, or source-mismatched.
    // Its calibrated bands/peaks can inform page-owned effects without another FFT.
  }
});
await view.ready;
view.setEnabled(false);
view.setEnabled(true);
view.pause();
view.resume();
view.refresh();
console.log(view.snapshot());
view.destroy();
```

Supply exactly one `recordingUrl` or explicit caller-owned `recording` object.
IDs and canvases have one owner inside a mount. URL input follows the normal
HTTP(S)/relative URL policy with no credentials; URL fragments are removed for
request sharing. Cross-origin assets require normal CORS permission. Errors
reject `ready` and leave an accessible unavailable state; correct the input and
create the view again. Failed acquisitions are released, and an error-state
controller can be replaced with the same ID or canvas.

All entries are SSR-safe: the browser is touched only when a runtime is created.
React/Next pages can use their existing DanceMoves provider/mount cleanup. The
WordPress adapter imports this exact shared implementation.

## Renderers

`SPECTRUM_RENDERERS` exports the supported identifiers.

| Identifier | View |
|---|---|
| `spectrum` | One calibrated bar per selected band, dBFS guides, local peaks and held markers |
| `spectrum-line` | Connected band-centre levels on a linear Hz axis |
| `spectrum-area` | Filled frequency profile |
| `spectrum-dots` | Frequency-band dots |
| `spectrum-stems` | Upright stems with current-level markers |
| `spectrum-steps` | Midpoint-bounded stepped levels |
| `spectrum-mirror` | Stems mirrored about the central baseline |
| `spectrum-radial` | Radial frequency spokes |
| `spectrum-ring` | Filled circular profile |
| `spectrum-spiral` | Spiral frequency profile with band markers |

The original bar view gives each selected band an equal slot and labels its
actual frequency range. Other Cartesian views use actual band-centre Hz
positions; circular views distribute selected bands around their geometry.
These are responsive browser adaptations of the FrameRudiments geometry, not
pixel-identical offline compositing output. The larger spectrogram, annular,
sprite and 3D catalogues are outside this basic set.

## Calibration, capture time and bounds

Each selected dimension must have StemLab provenance with `mode: fourier`,
`output_scale: bipolar`, its frequency bounds, source SHA-256, sample rate,
FFT size, signed gain, normalization divisor and silent-axis flag. Missing,
clipped or incompatible data fails validation. Bands must share source/rate/FFT
identity and have ascending nonoverlapping frequency ranges. Axes can be selected
by name or zero-based index; maximum 64 axes and 8,388,608 finite native values.

The display reverses recorded normalization and signed gain to recover
PCM-unity RMS. dBFS is `20 * log10(RMS)`; silence has `dbfs: null`. Display
floor/ceiling clipping leaves the actual amplitudes and dBFS report unchanged.
Dominant bands and plateau-aware local peaks use the FrameRudiments calibration
and selection rules. A silent current band can still retain its historical hold.
These bands do not establish exact pitch, instrument identity or audio true peaks.

Spectrum sampling follows the **recording's own source clock**:

```js
pip = Math.floor((masterSeconds - clock.beat_zero_seconds) * clock.bpm / 60 * 64);
```

Mapped excerpt/video transports supply master seconds through the existing
shared playback source. Page BPM, fixed first-beat offsets and variable beat maps
do not retime the recording. Its capture BPM can differ from the page's nominal
procedural BPM; existing `runtime.recordings.animate` compatibility checks are
unchanged. Spectrum controllers reject `clock`, `bpm`, `rate` and `phasePips`
overrides. A changed master identity clears the view until the original source
returns or the page mounts its matching recording. The page author still owns
the association of a recording with the intended audio or same-clock stem; the
browser does not download/hash the entire audio to infer that relationship.

Peak holds read bounded historical native pips, ending at the current cursor:
`historyPips` 1–512 (default 256), `historyStride` 1–120 (default 1). The span is
`(historyPips - 1) * historyStride * 60 / (captureBpm * 64)` seconds. The current
pip is included. At 120 BPM the defaults cover just under two seconds. This
browser history uses capture pips instead of FrameRudiments' encoded output
frames, making results repeatable across seeking, pause, refresh and playback
speed. It does not integrate wall-clock decay or read future samples.

Before/after the capture, on explicit disable, reduced motion or forced colours,
the view clears **before** calibration. This prevents a neutral bipolar zero
from being mistaken for audio energy. Hidden/offscreen views suspend through
the shared native scheduler. Seeking reconstructs the same report. Removal or
movement outside the owning root destroys the view, releases requests/tables and
disconnects observers. `runtime.destroy()` performs the same cleanup.

Canvas buffers follow CSS dimensions and device pixel ratio, defaulting to at
most 3×, with a four-megapixel backing-buffer cap. `pixelRatio` can explicitly
select 0.5–4×. Bare intrinsically sized canvases retain their original CSS size;
responsive canvases keep their existing layout rules. Owned attributes/sizing
are restored on destruction without overwriting later host changes.

## Style controls

| Option | Default / supported range |
|---|---|
| `floor_db`, `ceiling_db` | −72 / 0; ordered range, floor −240..0, ceiling up to +60 |
| `hold_seconds`, `decay_db_per_second` | 0.4 / 24; 0..60 seconds, 0.01..240 dB/second |
| `peak_count`, `min_peak_db` | 3 / −60; 1..32 peaks, −240..60 dB |
| `min_peak_contrast_db`, `min_peak_distance` | 3 / 2; 0..240 dB adjacent contrast, 1..256 band positions |
| `labels`, `gap`, `padding` | true / 1 / 4; labels automatically simplify in small views |
| `line_width`, `point_radius` | 2 / 3; stroke 1..24, radius 0.5..64 CSS pixels |
| `colours` | Teal, amber, lilac and blue palette; 1..256 colours |
| `background`, `peak_colour`, `label_colour` | Transparent, warm white, muted blue |

Colours accept named, hex, `rgb()` and `hsl()` values. Unsupported fields fail
validation. Read `runtime.spectrum.snapshot()` for active sources and controllers,
or `view.snapshot()` for status, pip, source seconds, backing size and the latest
calibrated report. Reports are immutable and do not expose the sample table.

## Reproduce and verify

```sh
npm run build
npm test
php tests/shared/spectrum-wordpress.php
node tests/shared/spectrum-browser.mjs
node examples/spectrum/serve.mjs
```

The [gallery](../examples/spectrum/README.md) uses synthetic fixtures and no song
assets. Browser evidence is written to `.build/browser-evidence/`; it verifies
real Canvas output, native sampling, lazy loading, two-song switching, seeking,
preferences, bounds and teardown. This is implementation/test evidence and does
not mean the user's public WordPress site has been deployed or changed.

Reference implementations: [FrameRudiments spectrum calibration](https://github.com/kieransimkin/FrameRudiments/blob/4923d01a1eb7807357ec2baaa6b16213a85fbf1c/src/framerudiments/spectrum.py)
and [basic advanced spectrum geometry](https://github.com/kieransimkin/FrameRudiments/blob/4923d01a1eb7807357ec2baaa6b16213a85fbf1c/src/framerudiments/advanced_renderers.py).
