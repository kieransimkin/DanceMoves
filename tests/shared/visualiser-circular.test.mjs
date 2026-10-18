import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCULAR_RENDERERS, validateCircularStyle, drawCircular} from '../../src/visualiser-circular.mjs';
import {validateSpectrumBands} from '../../src/spectrum-analysis.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);

function canvasTrace() {
  const paints = [], clears = [], clips = [], stack = [];
  let path = [];
  const context = {globalAlpha: .37, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 7,
    lineCap: 'butt', lineJoin: 'miter',
    save() {stack.push(Object.fromEntries(['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin'].map(key => [key, this[key]])));},
    restore() {assert.ok(stack.length, 'Canvas restore must have a matching save'); Object.assign(this, stack.pop());},
    beginPath() {path = [];},
    closePath() {path.push(['close']);},
    clip() {clips.push(structuredClone(path));},
    clearRect(...args) {clears.push(args);},
    fillRect(...args) {paints.push({kind: 'background', path: [['rect', ...args]], colour: this.fillStyle, alpha: this.globalAlpha});},
    fill() {paints.push({kind: 'fill', path: structuredClone(path), colour: this.fillStyle, alpha: this.globalAlpha});},
    stroke() {paints.push({kind: 'stroke', path: structuredClone(path), colour: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth});}
  };
  for (const method of ['moveTo', 'lineTo', 'rect', 'ellipse', 'quadraticCurveTo']) context[method] = (...args) => {
    assert.ok(args.every(Number.isFinite), `${method} coordinates must be finite`);
    if (method === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
    path.push([method, ...args]);
  };
  return {context, paints, clears, clips, stack};
}

function motionFrame(count = 32, dimensions = 2) {
  const history = Array.from({length: count}, (_, index) => ({pip: index, agePips: count - index - 1,
    ageSeconds: (count - index - 1) / 128,
    values: Array.from({length: dimensions}, (_, axis) => Math.sin(index * (.23 + axis * .11) + axis) * .85)}));
  return {pip: count - 1, sourceSeconds: (count - 1) / 128, historySpanPips: Math.max(1, count - 1),
    values: history.at(-1).values, dimensions: Array.from({length: dimensions}, (_, axis) => `axis_${axis}`), history};
}

function spectralFrame(count = 32) {
  const recording = createSpectrumRecording({count});
  const history = recording.samples.map((values, pip) => ({values, pip, agePips: count - pip - 1, ageSeconds: (count - pip - 1) / 128}));
  return {pip: count - 1, sourceSeconds: (count - 1) / 128, historySpanPips: Math.max(1, count - 1),
    values: history.at(-1).values, dimensions: recording.dimensions, history, bands: validateSpectrumBands(recording)};
}

function levelFrame(levels) {
  const recording = createSpectrumRecording({count: 1});
  const base = recording.provenance.axes[0];
  recording.provenance.axes = levels.map((_, index) => ({...base, name: `band_${index}`, gain: 1,
    normalization_divisor: 1, silent_axis: false, frequency_low_hz: index * 100, frequency_high_hz: (index + 1) * 100}));
  recording.dimensions = recording.provenance.axes.map(axis => axis.name);
  const values = levels.map(level => 2 * 10 ** ((-60 + level * 60) / 20) - 1);
  return {values, dimensions: recording.dimensions, pip: 0, sourceSeconds: 0, historySpanPips: 31,
    bands: validateSpectrumBands(recording), history: [{pip: 0, agePips: 0, ageSeconds: 0, values}]};
}

function render(renderer, frame, style = {}, width = 360, height = 280) {
  const trace = canvasTrace();
  drawCircular(trace.context, width, height, frame, renderer, validateCircularStyle(style));
  assert.equal(trace.stack.length, 0); assert.equal(trace.context.globalAlpha, .37);
  assert.equal(trace.context.lineWidth, 7); assert.equal(trace.context.lineCap, 'butt');
  return {...trace, shapes: trace.paints.filter(paint => paint.kind !== 'background')};
}
const dots = trace => trace.shapes.filter(shape => shape.path[0]?.[0] === 'ellipse');
const centre = dot => dot.path[0].slice(1, 3);

test('annular catalogue has all 60 frozen names and strict original style defaults', () => {
  assert.equal(CIRCULAR_RENDERERS.length, 60); assert.equal(new Set(CIRCULAR_RENDERERS).size, 60);
  assert.equal(CIRCULAR_RENDERERS.filter(name => name.startsWith('spectrum-')).length, 29);
  assert.equal(CIRCULAR_RENDERERS.filter(name => name.startsWith('spectrogram-')).length, 8);
  assert.equal(CIRCULAR_RENDERERS.filter(name => name.startsWith('waveform-')).length, 22);
  assert.ok(CIRCULAR_RENDERERS.includes('phase-annular-portrait')); assert.ok(Object.isFrozen(CIRCULAR_RENDERERS));
  const style = validateCircularStyle();
  assert.equal(style.inner_radius, .27); assert.equal(style.outer_radius, .96);
  assert.equal(style.line_width, 3); assert.equal(style.bar_gap, .16); assert.equal(style.peak_count, 16);
  assert.equal(style.history_limit, 40); assert.equal(style.frequency_scale, 'equal'); assert.equal(style.decay, .65);
  assert.equal(style.clockwise, true); assert.equal(style.padding, 4);
  assert.ok(Object.isFrozen(style)); assert.ok(Object.isFrozen(style.colours)); assert.equal(validateCircularStyle(style), style);
  const palette = ['red', '#1234']; const custom = validateCircularStyle({colours: palette});
  palette[0] = 'blue'; assert.equal(custom.colours[0], 'red');
  for (const input of [null, [], {gap: .2}, {hold_seconds: 1}, {inner_radius: .8, outer_radius: .7},
    {floor_db: -20, ceiling_db: -20}, {bar_gap: 1}, {peak_count: 65}, {history_limit: 3}, {rings: 1.5},
    {axis: 256}, {gain: Infinity}, {clockwise: 1}, {mirror: 'true'}, {grid: null}, {frequency_scale: 'cqt'},
    {colours: ['url(https://example.invalid)']}, {background: 'red; display:none'}]) assert.throws(() => validateCircularStyle(input));
  assert.equal(validateCircularStyle({line_width: 64, peak_count: 64, axis: 255}).line_width, 64);
});

test('all annular renderers paint finite geometry and restore Canvas state', () => {
  const spectrum = spectralFrame(), motion = motionFrame();
  for (const renderer of CIRCULAR_RENDERERS) {
    const result = render(renderer, renderer.startsWith('spectrum-') || renderer.startsWith('spectrogram-') ? spectrum : motion);
    assert.ok(result.shapes.length > 0, `${renderer} must paint observed samples`);
    assert.deepEqual(result.clears, [[0, 0, 360, 280]]); assert.equal(result.clips.length, 1);
    assert.ok(result.shapes.every(shape => shape.alpha >= 0 && shape.alpha <= 1), `${renderer} alpha must remain bounded`);
  }
});

test('radial spectral dots recover exact recorded RMS, negative gain, silence and display gain', () => {
  const frame = spectralFrame(1);
  const result = dots(render('spectrum-annular-dots', frame));
  assert.equal(result.length, 4);
  const radius = 133.5, inner = radius * .27, span = radius * (.96 - .27);
  [.1, .45, .02, 0].forEach((rms, index) => {
    const level = rms ? (20 * Math.log10(rms) + 72) / 72 : 0;
    const expected = inner + span * level;
    const [x, y] = centre(result[index]); close(Math.hypot(x - 180, y - 140), expected);
  });
  const amplified = dots(render('spectrum-annular-dots', frame, {gain: 8}));
  amplified.slice(0, 3).forEach(dot => {const [x, y] = centre(dot); close(Math.hypot(x - 180, y - 140), radius * .96);});
  const [silentX, silentY] = centre(amplified[3]); close(Math.hypot(silentX - 180, silentY - 140), inner);
});

test('frequency scales place recorded frequency centres and respect clock direction and reflection', () => {
  const frame = spectralFrame(1), equal = dots(render('spectrum-annular-dots', frame));
  const linear = dots(render('spectrum-annular-dots', frame, {frequency_scale: 'linear'}));
  assert.deepEqual(linear, equal);
  const log = dots(render('spectrum-annular-dots', frame, {frequency_scale: 'log'}));
  assert.notDeepEqual(log, equal);
  const [x, y] = centre(log[0]);
  const theta = -Math.PI / 2 + Math.PI * 2 * Math.log2(50) / Math.log2(400);
  close(Math.atan2(y - 140, x - 180), Math.atan2(Math.sin(theta), Math.cos(theta)));
  const reverse = dots(render('spectrum-annular-dots', frame, {clockwise: false}));
  const mirrored = dots(render('spectrum-annular-dots', frame, {mirror: true}));
  equal.forEach((dot, index) => {const [a, b] = centre(dot); close(centre(reverse[index])[0], 360 - a);
    close(centre(reverse[index])[1], b); close(centre(mirrored[index])[0], 360 - a); close(centre(mirrored[index])[1], b);});
  const partial = dots(render('spectrum-annular-dots', frame, {sweep_angle: 90, start_angle: 90}));
  const [px, py] = centre(partial[0]); assert.ok(px > 180 && py > 140);
});

test('annular peaks centre plateaus and apply linear contrast, separation and count', () => {
  const frame = levelFrame([.1, .8, .8, .1, .6, .1]);
  const style = {floor_db: -60, peak_threshold: .2};
  const peaks = dots(render('spectrum-annular-peaks', frame, style));
  assert.equal(peaks.length, 2);
  const all = dots(render('spectrum-annular-dots', frame, style));
  assert.deepEqual(peaks.map(centre), [centre(all[1]), centre(all[4])]);
  assert.equal(dots(render('spectrum-annular-peaks', frame, {...style, peak_count: 1})).length, 1);
  assert.equal(dots(render('spectrum-annular-peaks', frame, {...style, peak_threshold: .9})).length, 0);
  assert.equal(dots(render('spectrum-annular-peaks', levelFrame([.5, .51, .5]), style)).length, 0);
});

test('spectrograms calibrate historical values and retain bounded history endpoints', () => {
  const frame = spectralFrame(512);
  const before = structuredClone(frame);
  const trace = render('spectrogram-annular-time', frame, {history_limit: 4});
  // The fourth band is explicitly silent, so four observed rows paint 12 cells.
  assert.equal(trace.shapes.length, 12);
  assert.deepEqual(frame, before);
  const chosen = {...frame, history: [frame.history[0], frame.history[170], frame.history[341], frame.history[511]]};
  assert.deepEqual(trace.shapes, render('spectrogram-annular-time', chosen, {history_limit: 4}).shapes);
  const modified = structuredClone(chosen); modified.history[0].values[1] = -1;
  assert.notDeepEqual(trace.shapes, render('spectrogram-annular-time', modified, {history_limit: 4}).shapes);
  const sparse = motionFrame(512);
  assert.equal(dots(render('waveform-annular-dots', sparse, {history_limit: 4})).length, 12);
  assert.equal(dots(render('phase-annular-portrait', sparse, {history_limit: 4})).length, 16);
});

test('annular history is deterministic across seeks and independent of prior render calls', () => {
  const frame = motionFrame(45), copy = structuredClone(frame);
  const old = render('waveform-annular-helix', frame).shapes;
  render('waveform-annular-helix', motionFrame(100)); render('spectrogram-annular-sweep', spectralFrame(200));
  assert.deepEqual(render('waveform-annular-helix', frame).shapes, old); assert.deepEqual(frame, copy);
  assert.deepEqual(render('waveform-annular-helix', {...frame, sourceSeconds: 10000}).shapes, old);
  const changed = structuredClone(frame); changed.history[5].values[0] *= -1;
  assert.notDeepEqual(render('waveform-annular-helix', changed).shapes, old);
});

test('channel rings and paired ribbons use their actual selected native dimensions', () => {
  const frame = motionFrame(18), changed = structuredClone(frame);
  changed.history.forEach(row => {row.values[1] *= .1;}); changed.values = changed.history.at(-1).values;
  assert.notDeepEqual(render('waveform-annular-rings', frame).shapes, render('waveform-annular-rings', changed).shapes);
  assert.notDeepEqual(render('waveform-annular-ribbon', frame).shapes, render('waveform-annular-ribbon', changed).shapes);
  assert.deepEqual(render('waveform-annular-line', frame).shapes, render('waveform-annular-line', changed).shapes);
  assert.notDeepEqual(render('waveform-annular-line', frame).shapes, render('waveform-annular-line', frame, {axis: 1}).shapes);
  const single = motionFrame(12, 1);
  for (const mode of ['waveform-annular-ribbon', 'waveform-annular-bands', 'phase-annular-portrait'])
    assert.throws(() => render(mode, single), /two selected/);
  assert.doesNotThrow(() => render('waveform-annular-rings', single));
  assert.throws(() => render('waveform-annular-line', frame, {axis: 2}), /selected Rudiment dimension/);
});

test('documented annular variants preserve distinct geometric and intensity meanings', () => {
  const spectrum = spectralFrame(12), motion = motionFrame(12);
  for (const [a, b, frame] of [
    ['spectrum-annular-bars', 'spectrum-annular-bars-inward', spectrum],
    ['spectrum-annular-line', 'spectrum-annular-area', spectrum],
    ['spectrum-annular-spiral', 'spectrum-annular-helix', spectrum],
    ['spectrogram-annular-time', 'spectrogram-annular-rings', spectrum],
    ['spectrogram-annular-time', 'spectrogram-annular-heatmap', spectrum],
    ['spectrogram-annular-time', 'spectrogram-annular-frequency', spectrum],
    ['waveform-annular-bars', 'waveform-annular-spokes', motion],
    ['waveform-annular-fill', 'waveform-annular-area', motion]
  ]) assert.notDeepEqual(render(a, frame).shapes, render(b, frame).shapes, `${a} and ${b}`);
});

test('decay changes chronological fading without fading the current sample', () => {
  const frame = motionFrame(12);
  const steady = dots(render('waveform-annular-trails', frame, {decay: 0}));
  const fading = dots(render('waveform-annular-trails', frame, {decay: 1}));
  assert.ok(fading[0].alpha < steady[0].alpha); close(fading.at(-1).alpha, 1); close(steady.at(-1).alpha, 1);
  const spectrum = spectralFrame(12);
  const a = render('spectrogram-annular-sweep', spectrum, {decay: 0}).shapes;
  const b = render('spectrogram-annular-sweep', spectrum, {decay: 1}).shapes;
  assert.ok(b[0].alpha < a[0].alpha); close(b.at(-1).alpha, a.at(-1).alpha);
});

test('invalid native samples and missing Fourier evidence fail before plotting', () => {
  const frame = motionFrame();
  for (const bad of [{...frame, values: [NaN, 0]}, {...frame, values: [1.1, 0]}, {...frame, history: []},
    {...frame, history: Array(513).fill(frame.history[0])}, {...frame, history: [{values: [0]}]}])
    assert.throws(() => render('waveform-annular-line', bad), /Annular/);
  assert.throws(() => render('spectrum-annular-dots', frame), /calibrated/);
  const spectrum = spectralFrame();
  assert.throws(() => render('spectrogram-annular-time', {...spectrum, bands: spectrum.bands.slice(1)}), /calibrated/);
  assert.throws(() => render('waveform-annular-missing', frame), /Unknown/);
  assert.doesNotThrow(() => render('spectrum-annular-dots', {...spectrum, values: new Float64Array(spectrum.values)}));
});

test('null frames clear without geometry and single samples remain visible', () => {
  const empty = render('waveform-annular-line', null);
  assert.equal(empty.shapes.length, 0); assert.equal(empty.clears.length, 1);
  const collapsed = render('waveform-annular-line', motionFrame(), {}, 8, 8);
  assert.equal(collapsed.shapes.length, 0); assert.equal(collapsed.clears.length, 1);
  const single = motionFrame(1);
  for (const mode of ['waveform-annular-ribbon', 'waveform-annular-rings', 'waveform-annular-spiral', 'waveform-annular-helix', 'phase-annular-portrait'])
    assert.ok(render(mode, single).shapes.length > 0, mode);
});
