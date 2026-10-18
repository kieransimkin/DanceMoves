// Display analysis of saved StemLab Fourier evidence; no FFT or audio decoding.
// Adapted from FrameRudiments spectrum.py at 4923d01a1eb7807357ec2baaa6b16213a85fbf1c (MIT).
/*!
 * FrameRudiments spectrum calibration and analysis — MIT License
 * Copyright (c) 2026 Kieran Simkin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
export const SPECTRUM_RENDERERS = Object.freeze([
  'spectrum', 'spectrum-line', 'spectrum-area', 'spectrum-dots', 'spectrum-stems',
  'spectrum-steps', 'spectrum-mirror', 'spectrum-radial', 'spectrum-ring', 'spectrum-spiral'
]);

const MAX_AXES = 64, MAX_HISTORY = 512;
const approvedBands = new WeakSet(), approvedStyles = new WeakSet();
const axisName = /^[a-z][a-z0-9_]{0,127}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function number(value, label, min = -Number.MAX_VALUE, max = Number.MAX_VALUE) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a finite number in ${min}..${max}`);
  }
  return value;
}
function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  number(value, label, min, max);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}
function checkedBands(input) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_AXES) {
    throw new TypeError('Spectrum requires 1..64 calibrated Fourier bands');
  }
  const bands = Array.from(input, band => {
    if (!record(band) || typeof band.name !== 'string' || !axisName.test(band.name)) {
      throw new TypeError('Fourier band needs a native dimension name');
    }
    const index = integer(band.index, 'Fourier dimension index', 0, MAX_AXES - 1);
    if (typeof band.silent !== 'boolean') throw new TypeError('Fourier silent_axis must be boolean');
    const divisor = number(band.divisor, 'Fourier normalization divisor', 0);
    const gain = number(band.gain, 'Fourier gain');
    if (!band.silent && (divisor <= 0 || gain === 0)) {
      throw new RangeError('Non-silent Fourier axes need a positive divisor and nonzero gain');
    }
    const lowHz = number(band.lowHz, 'Fourier frequency low', 0);
    const highHz = number(band.highHz, 'Fourier frequency high', lowHz);
    const sampleRate = integer(band.sampleRate, 'Fourier source sample rate', 1);
    const fftSize = integer(band.fftSize, 'Fourier FFT size', 16, 65536);
    if (highHz <= lowHz || highHz > sampleRate / 2 || (fftSize & (fftSize - 1))) {
      throw new RangeError('Invalid Fourier frequency bounds or FFT size');
    }
    if (typeof band.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(band.sourceSha256)) {
      throw new TypeError('Fourier source SHA-256 is required');
    }
    return Object.freeze({index, name: band.name, lowHz, highHz, divisor, gain,
      silent: band.silent, sourceSha256: band.sourceSha256.toLowerCase(), sampleRate, fftSize});
  });
  if (new Set(bands.map(band => band.index)).size !== bands.length ||
      new Set(bands.map(band => band.name)).size !== bands.length) {
    throw new TypeError('Spectrum selected axes must be unique');
  }
  const first = bands[0];
  if (bands.some(band => band.sourceSha256 !== first.sourceSha256 ||
      band.sampleRate !== first.sampleRate || band.fftSize !== first.fftSize)) {
    throw new TypeError('Spectrum bands must share source, sample rate and FFT size');
  }
  if (bands.some((band, index) => index > 0 && band.lowHz < bands[index - 1].highHz)) {
    throw new RangeError('Spectrum axes must be in ascending, non-overlapping frequency order');
  }
  Object.freeze(bands);
  approvedBands.add(bands);
  return bands;
}

/** Validate only Fourier metadata; the native recording service owns capture validation/playback. */
export function validateSpectrumBands(recording, axes) {
  if (!record(recording) || recording.format !== 'dancerudiments.recording' ||
      recording.schema_version !== 1 || recording.pips_per_beat !== 64 ||
      recording.sample_dtype !== 'float64') {
    throw new TypeError('Spectrum requires a native dancerudiments.recording v1 Fourier recording');
  }
  const dimensions = recording.dimensions;
  if (!Array.isArray(dimensions) || !dimensions.length || dimensions.length > MAX_AXES ||
      new Set(dimensions).size !== dimensions.length ||
      Array.from(dimensions).some(name => typeof name !== 'string' || !axisName.test(name))) {
    throw new TypeError('Spectrum requires 1..64 unique native recording dimensions');
  }
  let provenance = recording.provenance;
  if (typeof provenance === 'string') {
    if (provenance.length > 1024 * 1024) throw new RangeError('Fourier provenance is too large');
    try { provenance = JSON.parse(provenance); }
    catch { throw new TypeError('Malformed StemLab Fourier calibration provenance'); }
  }
  if (!record(provenance) || provenance.producer !== 'StemLab' ||
      !Array.isArray(provenance.axes) || !provenance.axes.length || provenance.axes.length > 256) {
    throw new TypeError('Spectrum requires StemLab Fourier calibration provenance');
  }
  const byName = new Map();
  for (const row of provenance.axes) {
    if (!record(row) || typeof row.name !== 'string' || !axisName.test(row.name)) {
      throw new TypeError('Malformed Fourier axis metadata');
    }
    if (byName.has(row.name)) throw new TypeError('Duplicate Fourier axis metadata');
    byName.set(row.name, row);
  }
  const selected = axes === undefined ? dimensions.map((_, index) => index) : axes;
  if (!Array.isArray(selected) || !selected.length || selected.length > MAX_AXES) {
    throw new TypeError('Select 1..64 existing Fourier axes');
  }
  return checkedBands(Array.from(selected, axis => {
    const index = typeof axis === 'string' ? dimensions.indexOf(axis) :
      integer(axis, 'Spectrum selected axis', 0, dimensions.length - 1);
    if (index < 0) throw new RangeError(`Unknown Fourier axis: ${axis}`);
    const row = byName.get(dimensions[index]);
    if (!row || row.mode !== 'fourier' || row.output_scale !== 'bipolar') {
      throw new TypeError('Spectrum dimensions must be calibrated bipolar Fourier bands');
    }
    if (integer(row.clipped_windows, 'Clipped Fourier windows') !== 0) {
      throw new RangeError('Clipped Fourier axes cannot recover calibrated RMS; re-export without clipping');
    }
    return {index, name: row.name, lowHz: row.frequency_low_hz, highHz: row.frequency_high_hz,
      divisor: row.normalization_divisor, gain: row.gain, silent: row.silent_axis,
      sourceSha256: row.source_sha256, sampleRate: row.source_sample_rate,
      fftSize: record(row.fourier) ? row.fourier.fft_size : undefined};
  }));
}

// Deliberately bounded colour syntax: no URLs, CSS variables, declarations or expressions.
const namedColours = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black ' +
  'blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue ' +
  'cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
  'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray ' +
  'darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick ' +
  'floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey ' +
  'honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue ' +
  'lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon ' +
  'lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen ' +
  'linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
  'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose ' +
  'moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
  'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red ' +
  'rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue ' +
  'slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet ' +
  'wheat white whitesmoke yellow yellowgreen').split(' '));
const component = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const alpha = `${component}%?`, rgb = `${component}%?`, hue = `${component}(?:deg|grad|rad|turn)?`;
const rgbColour = new RegExp(`^rgba?\\(\\s*(?:${rgb}\\s*,\\s*${rgb}\\s*,\\s*${rgb}(?:\\s*,\\s*${alpha})?|${rgb}\\s+${rgb}\\s+${rgb}(?:\\s*\\/\\s*${alpha})?)\\s*\\)$`, 'i');
const hslColour = new RegExp(`^hsla?\\(\\s*(?:${hue}\\s*,\\s*${component}%\\s*,\\s*${component}%(?:\\s*,\\s*${alpha})?|${hue}\\s+${component}%\\s+${component}%(?:\\s*\\/\\s*${alpha})?)\\s*\\)$`, 'i');
function colour(value, label) {
  if (typeof value !== 'string' || !value.length || value.length > 128) {
    throw new TypeError(`${label} must be a CSS colour string`);
  }
  const clean = value.trim();
  if (!namedColours.has(clean.toLowerCase()) &&
      !/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(clean) &&
      !rgbColour.test(clean) && !hslColour.test(clean)) {
    throw new TypeError(`${label} must use a named, hex, rgb() or hsl() CSS colour`);
  }
  return clean;
}
const styleKeys = new Set(['floor_db', 'ceiling_db', 'hold_seconds', 'decay_db_per_second',
  'peak_count', 'min_peak_db', 'min_peak_contrast_db', 'min_peak_distance', 'labels', 'gap',
  'colours', 'padding', 'background', 'line_width', 'point_radius', 'peak_colour', 'label_colour']);

/** Shared, immutable Canvas style; calibrated display limits never modify recorded amplitudes. */
export function validateSpectrumStyle(style = {}) {
  if (approvedStyles.has(style)) return style;
  if (!record(style)) throw new TypeError('Spectrum style must be an object');
  for (const key of Object.keys(style)) {
    if (!styleKeys.has(key)) throw new TypeError(`Unsupported spectrum style field: ${key}`);
  }
  const field = (key, fallback) => Object.hasOwn(style, key) ? style[key] : fallback;
  const floor = number(field('floor_db', -72), 'Spectrum floor', -240, 0);
  const ceiling = number(field('ceiling_db', 0), 'Spectrum ceiling', floor + 0.01, 60);
  const labels = field('labels', true);
  if (typeof labels !== 'boolean') throw new TypeError('Spectrum labels must be boolean');
  const palette = field('colours', ['#76d4cf', '#edb56d', '#c8a4f7', '#92b9ff']);
  if (!Array.isArray(palette) || !palette.length || palette.length > 256) {
    throw new TypeError('Spectrum colours must be a nonempty list of at most 256 CSS colours');
  }
  const normalized = Object.freeze({
    floor_db: floor, ceiling_db: ceiling,
    hold_seconds: number(field('hold_seconds', 0.4), 'Peak hold seconds', 0, 60),
    decay_db_per_second: number(field('decay_db_per_second', 24), 'Peak decay', 0.01, 240),
    peak_count: integer(field('peak_count', 3), 'Peak count', 1, 32),
    min_peak_db: number(field('min_peak_db', -60), 'Peak threshold', -240, 60),
    min_peak_contrast_db: number(field('min_peak_contrast_db', 3), 'Adjacent peak contrast', 0, 240),
    min_peak_distance: integer(field('min_peak_distance', 2), 'Peak separation', 1, 256),
    labels, gap: number(field('gap', 1), 'Spectrum gap', 0, 128),
    colours: Object.freeze(Array.from(palette, value => colour(value, 'Spectrum palette'))),
    padding: number(field('padding', 4), 'Spectrum padding', 0, 256),
    background: colour(field('background', 'transparent'), 'Spectrum background'),
    line_width: integer(field('line_width', 2), 'Spectrum line width', 1, 24),
    point_radius: number(field('point_radius', 3), 'Spectrum point radius', 0.5, 64),
    peak_colour: colour(field('peak_colour', '#f5eddf'), 'Spectrum peak colour'),
    label_colour: colour(field('label_colour', '#c4d1e7'), 'Spectrum label colour')
  });
  approvedStyles.add(normalized);
  return normalized;
}

function amplitudes(bands, values) {
  if ((!Array.isArray(values) && !(ArrayBuffer.isView(values) && !(values instanceof DataView))) ||
      values.length !== bands.length) throw new TypeError('Spectrum sample dimensions differ');
  return bands.map((band, index) => {
    const value = number(values[index], 'Native Fourier sample', -1, 1);
    const rms = band.silent ? 0 : Math.max(0, (value / band.gain + 1) / 2 * band.divisor);
    return number(rms, 'Recovered Fourier RMS', 0);
  });
}
function peakIndices(levels, style) {
  const candidates = [];
  for (let start = 0; start < levels.length;) {
    let end = start;
    while (end + 1 < levels.length && Math.abs(levels[end + 1] - levels[start]) <= 1e-9) end++;
    const neighbours = [];
    if (start) neighbours.push(levels[start - 1]);
    if (end + 1 < levels.length) neighbours.push(levels[end + 1]);
    const surrounding = neighbours.length ? Math.max(...neighbours) : style.floor_db;
    const height = levels[start], contrast = height - surrounding;
    if (height >= style.min_peak_db && height > surrounding && contrast >= style.min_peak_contrast_db) {
      candidates.push({index: Math.floor((start + end) / 2), start, end, contrast});
    }
    start = end + 1;
  }
  candidates.sort((a, b) => levels[b.index] - levels[a.index] || a.index - b.index);
  const selected = [];
  for (const peak of candidates) {
    if (selected.every(previous => Math.abs(peak.index - previous.index) >= style.min_peak_distance)) {
      selected.push(peak);
      if (selected.length === style.peak_count) break;
    }
  }
  return selected;
}

/** Pure spectrum report over selected native axes and bounded source-time history. */
export function analyseSpectrum(inputBands, values, history = [], style = {}) {
  const bands = approvedBands.has(inputBands) ? inputBands : checkedBands(inputBands);
  const settings = validateSpectrumStyle(style);
  if (!Array.isArray(history) || history.length > MAX_HISTORY) {
    throw new RangeError('Spectrum history must contain at most 512 samples');
  }
  const rms = amplitudes(bands, values);
  const dbfs = rms.map(value => value > 0 ? 20 * Math.log10(value) : null);
  const levels = dbfs.map(value => value === null ? settings.floor_db : Math.max(settings.floor_db, value));
  const held = [...levels];
  for (const sample of history) {
    if (!record(sample)) throw new TypeError('Spectrum history samples need ageSeconds and values');
    const age = number(sample.ageSeconds, 'Spectrum history ageSeconds', 0);
    const previous = amplitudes(bands, sample.values);
    const decay = Math.max(0, age - settings.hold_seconds) * settings.decay_db_per_second;
    previous.forEach((value, index) => {
      const db = value > 0 ? 20 * Math.log10(value) : settings.floor_db;
      held[index] = Math.max(held[index], db - decay);
    });
  }
  const entry = index => ({axis: bands[index].name, index, low_hz: bands[index].lowHz,
    high_hz: bands[index].highHz, rms: rms[index], dbfs: dbfs[index],
    display_dbfs: Math.min(settings.ceiling_db, levels[index]), held_dbfs: held[index]});
  const peaks = peakIndices(levels, settings).map(peak => ({...entry(peak.index),
    plateau_low_hz: bands[peak.start].lowHz, plateau_high_hz: bands[peak.end].highHz,
    adjacent_contrast_db: peak.contrast}));
  let dominant = 0;
  for (let index = 1; index < rms.length; index++) if (rms[index] > rms[dominant]) dominant = index;
  return {kind: 'stemlab-fourier-band-spectrum', units: 'PCM-unity RMS dBFS',
    source_sha256: bands[0].sourceSha256, fft_size: bands[0].fftSize,
    fft_bin_resolution_hz: bands[0].sampleRate / bands[0].fftSize,
    bands: bands.map((_, index) => entry(index)), peaks, dominant: rms[dominant] > 0 ? entry(dominant) : null,
    peak_method: 'local band maxima; plateaus centred; adjacent contrast; strongest first',
    hold_clock: 'bounded recorded source-time history; no audio true-peak claim'};
}
