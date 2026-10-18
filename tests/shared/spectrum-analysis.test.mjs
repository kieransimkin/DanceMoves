import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECTRUM_RENDERERS, validateSpectrumBands, validateSpectrumStyle, analyseSpectrum}
  from '../../src/spectrum-analysis.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);
function levelsFixture(levels) {
  const recording = createSpectrumRecording({count: 1});
  const base = recording.provenance.axes[0];
  recording.provenance.axes = levels.map((_, index) => ({...base,
    name: `band_${index}`, frequency_low_hz: index * 100, frequency_high_hz: (index + 1) * 100,
    gain: 1, normalization_divisor: 1, silent_axis: false}));
  recording.dimensions = recording.provenance.axes.map(axis => axis.name);
  recording.samples = [levels.map(db => 2 * 10 ** (db / 20) - 1)];
  return {bands: validateSpectrumBands(recording), values: recording.samples[0]};
}

test('ten FrameRudiments renderer identifiers and normalized style are immutable', () => {
  assert.deepEqual(SPECTRUM_RENDERERS, ['spectrum', 'spectrum-line', 'spectrum-area', 'spectrum-dots',
    'spectrum-stems', 'spectrum-steps', 'spectrum-mirror', 'spectrum-radial', 'spectrum-ring', 'spectrum-spiral']);
  assert.ok(Object.isFrozen(SPECTRUM_RENDERERS));
  const style = validateSpectrumStyle();
  assert.equal(style.floor_db, -72); assert.equal(style.ceiling_db, 0);
  assert.equal(style.hold_seconds, 0.4); assert.equal(style.decay_db_per_second, 24);
  assert.equal(style.peak_count, 3); assert.equal(style.min_peak_distance, 2);
  assert.equal(style.labels, true); assert.equal(style.gap, 1);
  assert.ok(Object.isFrozen(style)); assert.ok(Object.isFrozen(style.colours));
  assert.equal(validateSpectrumStyle(style), style);
  const palette = ['#1234', 'red']; const custom = validateSpectrumStyle({colours: palette});
  palette[0] = 'blue'; assert.equal(custom.colours[0], '#1234');
});

test('exact Python fixture recovers calibrated RMS, negative gain, silence and frequency peaks', () => {
  const recording = createSpectrumRecording();
  const bands = validateSpectrumBands(recording);
  assert.ok(Object.isFrozen(bands)); assert.ok(bands.every(Object.isFrozen));
  const report = analyseSpectrum(bands, recording.samples[0]);
  [0.1, 0.45, 0.02, 0].forEach((rms, index) => close(report.bands[index].rms, rms));
  close(report.bands[0].dbfs, -20);
  close(report.bands[1].dbfs, 20 * Math.log10(0.45));
  assert.equal(report.bands[3].dbfs, null);
  assert.equal(report.bands[3].display_dbfs, -72);
  assert.equal(report.dominant.low_hz, 100);
  assert.equal(report.peaks[0].high_hz, 200);
  assert.equal(report.fft_bin_resolution_hz, 31.25);
  assert.equal(report.fft_size, 256);
  assert.equal(report.source_sha256, 'ab'.repeat(32));
  assert.equal(report.kind, 'stemlab-fourier-band-spectrum');
  assert.doesNotThrow(() => JSON.stringify(report));
});

test('per-band normalization is reversed without equalising the actual strengths', () => {
  const recording = createSpectrumRecording({count: 1});
  recording.provenance.axes[0].normalization_divisor = 0.2;
  recording.provenance.axes[1].normalization_divisor = 0.9;
  recording.samples[0][0] = 0;
  recording.samples[0][1] = 0;
  const report = analyseSpectrum(validateSpectrumBands(recording), recording.samples[0]);
  close(report.bands[0].rms, 0.1); close(report.bands[1].rms, 0.45);
  assert.equal(report.dominant.index, 1);
});

test('provenance accepts native JSON strings and axes preserve selected original indexes', () => {
  const recording = createSpectrumRecording({count: 1});
  recording.provenance = JSON.stringify(recording.provenance);
  const byName = validateSpectrumBands(recording, ['band_001', 'band_003']);
  assert.deepEqual(byName, validateSpectrumBands(recording, [1, 3]));
  assert.deepEqual(byName.map(band => band.index), [1, 3]);
  const report = analyseSpectrum(byName, byName.map(band => recording.samples[0][band.index]));
  assert.equal(report.bands[0].index, 0);
  assert.equal(report.bands[0].axis, 'band_001');
  assert.equal(report.bands[0].low_hz, 100);
});

test('silent Fourier axes allow zero calibration and all-silent frames have no dominant or peaks', () => {
  const recording = createSpectrumRecording({count: 1});
  recording.provenance.axes.forEach(axis => {axis.silent_axis = true; axis.gain = 0; axis.normalization_divisor = 0;});
  const report = analyseSpectrum(validateSpectrumBands(recording), [0, 0, 0, 0]);
  assert.equal(report.dominant, null); assert.deepEqual(report.peaks, []);
  assert.ok(report.bands.every(band => band.rms === 0 && band.dbfs === null && band.held_dbfs === -72));
});

test('peak holds use declared history age and remain deterministic across seeks and unrelated calls', () => {
  const recording = createSpectrumRecording(); const bands = validateSpectrumBands(recording);
  const current = recording.samples[100], high = recording.samples[0];
  const history = [{ageSeconds: 0.6, values: high}];
  const report = analyseSpectrum(bands, current, history);
  close(report.bands[1].held_dbfs, 20 * Math.log10(0.45) - 0.2 * 24);
  assert.ok(report.bands[1].held_dbfs > report.bands[1].dbfs);
  const duringHold = analyseSpectrum(bands, current, [{ageSeconds: 0.2, values: high}]);
  close(duringHold.bands[1].held_dbfs, 20 * Math.log10(0.45));
  const expired = analyseSpectrum(bands, current, [{ageSeconds: 8, values: high}]);
  close(expired.bands[1].held_dbfs, expired.bands[1].dbfs);
  assert.deepEqual(analyseSpectrum(bands, current, history), report);
  close(analyseSpectrum(bands, current).bands[1].held_dbfs, 20 * Math.log10(0.05));
  assert.deepEqual(history, [{ageSeconds: 0.6, values: high}]);
});

test('plateau peaks use midpoint, adjacent contrast, strongest-first spacing and count limits', () => {
  const {bands, values} = levelsFixture([-60, -10, -10, -60, -20, -60]);
  const style = {min_peak_db: -50, min_peak_contrast_db: 3, min_peak_distance: 2};
  const report = analyseSpectrum(bands, values, [], style);
  assert.deepEqual(report.peaks.map(peak => peak.index), [1, 4]);
  close(report.peaks[0].adjacent_contrast_db, 50); close(report.peaks[1].adjacent_contrast_db, 40);
  assert.equal(report.peaks[0].plateau_low_hz, 100);
  assert.equal(report.peaks[0].plateau_high_hz, 300);
  assert.deepEqual(analyseSpectrum(bands, values, [], {...style, min_peak_distance: 4}).peaks.map(p => p.index), [1]);
  assert.equal(analyseSpectrum(bands, values, [], {...style, peak_count: 1}).peaks.length, 1);
  assert.deepEqual(analyseSpectrum(bands, values, [], {...style, min_peak_contrast_db: 60}).peaks, []);
  assert.deepEqual(analyseSpectrum(bands, values, [], {...style, min_peak_db: -5}).peaks, []);
});

test('boundary peaks use available neighbours and dominant survives rejected local peaks', () => {
  const {bands, values} = levelsFixture([-10, -60, -20]);
  assert.deepEqual(analyseSpectrum(bands, values).peaks.map(peak => peak.index), [0, 2]);
  const rejected = analyseSpectrum(bands, values, [], {min_peak_db: -5});
  assert.deepEqual(rejected.peaks, []); assert.equal(rejected.dominant.index, 0);
});

test('display floor and ceiling leave actual RMS, dBFS and holds intact', () => {
  const recording = createSpectrumRecording({count: 1});
  const report = analyseSpectrum(validateSpectrumBands(recording), recording.samples[0], [],
    {floor_db: -30, ceiling_db: -10});
  close(report.bands[1].rms, 0.45); close(report.bands[1].dbfs, 20 * Math.log10(0.45));
  assert.equal(report.bands[1].display_dbfs, -10);
  close(report.bands[1].held_dbfs, report.bands[1].dbfs);
  assert.ok(report.bands[2].dbfs < -30); assert.equal(report.bands[2].display_dbfs, -30);
});

test('corrupt or unrecoverable Fourier calibration fails before drawing', () => {
  const changes = [
    axis => {axis.clipped_windows = 1;}, axis => {axis.clipped_windows = 0.5;},
    axis => {delete axis.clipped_windows;}, axis => {axis.gain = 0;},
    axis => {axis.gain = NaN;}, axis => {axis.normalization_divisor = 0;},
    axis => {axis.normalization_divisor = -1;}, axis => {axis.silent_axis = 'false';},
    axis => {axis.mode = 'peak';}, axis => {axis.output_scale = 'unipolar';},
    axis => {axis.source_sha256 = 'unknown';}, axis => {axis.frequency_high_hz = 6000;},
    axis => {axis.frequency_high_hz = axis.frequency_low_hz;},
    axis => {axis.frequency_low_hz = -1;}, axis => {axis.source_sample_rate = Infinity;},
    axis => {axis.fourier.fft_size = 255;}, axis => {axis.fourier.fft_size = 8;},
    axis => {delete axis.fourier;}
  ];
  for (const change of changes) {
    const recording = createSpectrumRecording({count: 1}); change(recording.provenance.axes[0]);
    assert.throws(() => validateSpectrumBands(recording));
  }
});

test('generic motion, missing calibration, mixed identity and conflicting axis selections fail', () => {
  assert.throws(() => validateSpectrumBands({kind: 'named', pattern: 'circle'}), /recording/);
  for (const provenance of [null, {}, 'broken json', {producer: 'Other', axes: []}]) {
    const recording = createSpectrumRecording({count: 1}); recording.provenance = provenance;
    assert.throws(() => validateSpectrumBands(recording), /provenance/);
  }
  for (const change of [
    r => r.provenance.axes.push({...r.provenance.axes[0]}),
    r => r.provenance.axes.pop(),
    r => {r.provenance.axes[1].source_sha256 = 'cd'.repeat(32);},
    r => {r.provenance.axes[1].source_sample_rate = 16000;},
    r => {r.provenance.axes[1].fourier.fft_size = 512;},
    r => {r.provenance.axes[1].frequency_low_hz = 99;}
  ]) {
    const recording = createSpectrumRecording({count: 1}); change(recording);
    assert.throws(() => validateSpectrumBands(recording));
  }
  const recording = createSpectrumRecording({count: 1});
  for (const axes of [[], new Array(1), [1, 0], [0, 0], ['band_000', 0], ['missing'], [4], [-1], [0.5], [null]]) {
    assert.throws(() => validateSpectrumBands(recording, axes));
  }
  assert.throws(() => validateSpectrumBands(recording, [1, 0]), /ascending/);
});

test('style bounds, unknown options and unsafe colour strings fail explicitly', () => {
  for (const style of [null, [], {labels: 1}, {floor_db: NaN}, {floor_db: -241},
    {ceiling_db: -72}, {hold_seconds: -1}, {hold_seconds: 61}, {decay_db_per_second: 0},
    {peak_count: 1.2}, {peak_count: 33}, {min_peak_distance: 0}, {colours: []}, {colours: new Array(1)},
    {colours: new Array(257).fill('red')}, {line_width: 0}, {padding: Infinity},
    {point_radius: 0}, {gap: -1}, {unknown: true}, {background: 'url(https://example.com)'},
    {peak_colour: 'red; background:black'}, {label_colour: 'var(--colour)'}, {colours: ['notacolour']}]) {
    assert.throws(() => validateSpectrumStyle(style));
  }
  for (const value of ['#abc', '#abcd', '#aabbcc', '#aabbccdd', 'rebeccapurple',
    'rgb(255, 0, 12)', 'rgba(10, 20, 30, 0.4)', 'rgb(0 30 100 / 40%)',
    'hsl(30, 50%, 70%)', 'hsla(10deg, 40%, 50%, .5)', 'hsl(20 10% 50% / .2)']) {
    assert.equal(validateSpectrumStyle({background: value}).background, value);
  }
});

test('analysis bounds reject mismatched samples, non-finite values and future or excessive history', () => {
  const recording = createSpectrumRecording({count: 1}), bands = validateSpectrumBands(recording);
  for (const values of [[], [0, 0, 0], [NaN, 0, 0, 0], [2, 0, 0, 0], [null, 0, 0, 0]]) {
    assert.throws(() => analyseSpectrum(bands, values));
  }
  for (const history of [null, [null], [{ageSeconds: -1, values: recording.samples[0]}],
    [{ageSeconds: Infinity, values: recording.samples[0]}], [{ageSeconds: 1, values: []}],
    new Array(513).fill({ageSeconds: 1, values: recording.samples[0]})]) {
    assert.throws(() => analyseSpectrum(bands, recording.samples[0], history));
  }
  assert.deepEqual(analyseSpectrum(bands, Float64Array.from(recording.samples[0])),
    analyseSpectrum(bands, recording.samples[0]));
});
