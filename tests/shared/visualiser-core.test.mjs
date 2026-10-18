import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_RENDERERS, validateCoreStyle, drawCore} from '../../src/visualiser-core.mjs';
import {validateSpectrumBands} from '../../src/spectrum-analysis.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);

function canvasTrace() {
  const paints = [], clears = [], clips = [], stack = [];
  let path = [];
  const context = {globalAlpha: .37, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 7,
    lineCap: 'butt', lineJoin: 'miter',
    save() {stack.push(Object.fromEntries(['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin'].map(key => [key, this[key]])));},
    restore() {assert.ok(stack.length, 'Canvas state must be balanced'); Object.assign(this, stack.pop());},
    beginPath() {path = [];}, closePath() {path.push(['close']);},
    clip() {clips.push(structuredClone(path));}, clearRect(...args) {clears.push(args);},
    fillRect(...args) {paints.push({kind: 'background', path: [['rect', ...args]], colour: this.fillStyle, alpha: this.globalAlpha});},
    fill() {paints.push({kind: 'fill', path: structuredClone(path), colour: this.fillStyle, alpha: this.globalAlpha});},
    stroke() {paints.push({kind: 'stroke', path: structuredClone(path), colour: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth});}
  };
  for (const method of ['moveTo', 'lineTo', 'rect', 'ellipse', 'quadraticCurveTo']) context[method] = (...args) => {
    assert.ok(args.every(Number.isFinite), `${method} must receive finite coordinates`);
    if (method === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
    path.push([method, ...args]);
  };
  return {context, paints, clears, clips, stack};
}
function makeFrame(rows, historySpanPips = Math.max(1, rows.length - 1)) {
  const history = rows.map((values, pip) => ({values, pip, agePips: rows.length - pip - 1, ageSeconds: (rows.length - pip - 1) / 128}));
  return {values: rows.at(-1), dimensions: rows[0].map((_, index) => `axis_${index}`), pip: rows.length - 1,
    sourceSeconds: (rows.length - 1) / 128, historySpanPips, history};
}
function motionFrame(count = 32, dimensions = 2) {
  return makeFrame(Array.from({length: count}, (_, index) => Array.from({length: dimensions}, (_, axis) => Math.sin(index * (.23 + axis * .1) + axis) * .85)));
}
function spectralFrame(count = 32, historySpanPips = Math.max(1, count - 1)) {
  const recording = createSpectrumRecording({count});
  return {...makeFrame(recording.samples, historySpanPips), dimensions: recording.dimensions, bands: validateSpectrumBands(recording)};
}
function render(renderer, frame, style = {}, width = 200, height = 100) {
  const trace = canvasTrace();
  drawCore(trace.context, width, height, frame, renderer, validateCoreStyle(style, renderer));
  assert.equal(trace.stack.length, 0); assert.equal(trace.context.globalAlpha, .37);
  assert.equal(trace.context.lineWidth, 7); assert.equal(trace.context.lineCap, 'butt');
  return {...trace, shapes: trace.paints.filter(paint => paint.kind !== 'background')};
}
const dots = trace => trace.shapes.filter(shape => shape.path[0]?.[0] === 'ellipse');
const centre = dot => dot.path[0].slice(1, 3);
const rectangles = trace => trace.shapes.filter(shape => shape.path[0]?.[0] === 'rect');

test('core catalogue contains the 31 additional modes and keeps primitive style families strict', () => {
  assert.equal(CORE_RENDERERS.length, 31); assert.equal(new Set(CORE_RENDERERS).size, 31); assert.ok(Object.isFrozen(CORE_RENDERERS));
  assert.equal(CORE_RENDERERS.filter(name => name.startsWith('spectrum-')).length, 7);
  assert.equal(CORE_RENDERERS.filter(name => name.startsWith('spectrogram-')).length, 10);
  assert.ok(!CORE_RENDERERS.includes('spectrum')); assert.ok(!CORE_RENDERERS.includes('spectrum-line'));
  const particles = validateCoreStyle({}, 'particles');
  assert.equal(particles.count, 24); assert.equal(particles.radius, 3); assert.equal(particles.amplitude, .7);
  assert.equal(particles.trail, 4); assert.equal(particles.lag, 1); assert.equal(particles.seed, 0);
  assert.equal(validateCoreStyle({}, 'bars').gap, 2); assert.equal(validateCoreStyle({}, 'waveform').layout, 'stacked');
  const spectrum = validateCoreStyle({}, 'spectrogram-linear');
  assert.equal(spectrum.floor_db, -72); assert.equal(spectrum.contrast, 1.35); assert.equal(spectrum.history_limit, 96);
  assert.equal(validateCoreStyle({}, 'waveform-area').grid, true);
  assert.ok(Object.isFrozen(spectrum)); assert.ok(Object.isFrozen(spectrum.colours));
  assert.equal(validateCoreStyle(spectrum, 'spectrum-log'), spectrum);
  assert.throws(() => validateCoreStyle(spectrum, 'waveform-area'), /Unsupported/);
  for (const [renderer, style] of [['particles', {seed: -1}], ['particles', {count: 513}], ['particles', {lag: 33}],
    ['particles', {trail: 0}], ['particles', {amplitude: 1.1}], ['bars', {orientation: 'diagonal'}],
    ['bars', {line_width: 2}], ['bars', {negative_colour: 'url(x)'}], ['waveform', {layout: 'single'}],
    ['path', {radius: 0}], ['path', {line_width: 65}], ['spectrum-log', {gain: 2}],
    ['spectrum-log', {floor_db: -10, ceiling_db: -10}], ['spectrum-log', {history_limit: 7}],
    ['waveform-area', {grid: 1}], ['waveform-area', {layout: 'overlay'}]])
    assert.throws(() => validateCoreStyle(style, renderer), `${renderer} rejects ${JSON.stringify(style)}`);
  assert.throws(() => validateCoreStyle({}, 'spectrum-line'), /Unknown/);
  assert.equal(validateCoreStyle({line_width: 64}, 'waveform').line_width, 64);
});

test('all 31 core renderers paint finite native geometry with balanced Canvas state', () => {
  const spectrum = spectralFrame(), motion = motionFrame();
  for (const renderer of CORE_RENDERERS) {
    const result = render(renderer, renderer.startsWith('spectrum-') || renderer.startsWith('spectrogram-') ? spectrum : motion);
    assert.ok(result.shapes.length > 0, `${renderer} must paint its observations`);
    assert.equal(result.clips.length, 1); assert.deepEqual(result.clears, [[0, 0, 200, 100]]);
    assert.ok(result.shapes.every(shape => shape.alpha >= 0 && shape.alpha <= 1));
  }
});

test('particles follow native axes, sampled lag and trail opacity with deterministic anchors', () => {
  const frame = makeFrame([[-1, 1], [0, 0], [1, -1]]);
  const style = {count: 2, trail: 2, lag: 1, amplitude: 1};
  const result = dots(render('particles', frame, style));
  assert.deepEqual(result.map(centre), [[100, 50], [193, 93], [193, 93], [100, 50]]);
  assert.deepEqual(result.map(dot => dot.alpha), [.5, 1, .5, 1]);
  const seeded = render('particles', frame, {seed: 42, count: 3, amplitude: 0, trail: 1}).shapes;
  assert.deepEqual(render('particles', motionFrame(100), {seed: 42, count: 3, amplitude: 0, trail: 1}).shapes, seeded);
  assert.notDeepEqual(render('particles', frame, {seed: 43, count: 3, amplitude: 0, trail: 1}).shapes, seeded);
  render('particles', motionFrame(40), {seed: 600});
  assert.deepEqual(render('particles', frame, {seed: 42, count: 3, amplitude: 0, trail: 1}).shapes, seeded);
  assert.equal(dots(render('particles', motionFrame(100), {count: 512, trail: 32})).length, 512 * 32);
});

test('signed bars preserve polarity, calibrated-independent native values and orientation', () => {
  const frame = makeFrame([[.5, -.25]]), vertical = rectangles(render('bars', frame));
  assert.deepEqual(vertical.map(shape => shape.path[0]), [['rect', 4, 27, 94, 23], ['rect', 100, 50, 94, 11.5]]);
  assert.equal(vertical[0].colour, '#76d4cf'); assert.equal(vertical[1].colour, '#edb56d');
  const horizontal = rectangles(render('bars', frame, {orientation: 'horizontal'}));
  assert.deepEqual(horizontal.map(shape => shape.path[0]), [['rect', 100, 4, 48, 44], ['rect', 76, 50, 24, 44]]);
  assert.throws(() => render('bars', frame, {gap: 100}), /bar gap/);
  assert.equal(render('bars', {...frame, history: undefined}).shapes.length, 3);
});

test('path ends at the latest selected XY position and paired views reject a single axis', () => {
  const frame = makeFrame([[-1, 1], [0, 0], [1, -1]]);
  assert.deepEqual(centre(dots(render('path', frame)).at(-1)), [193, 93]);
  for (const renderer of ['path', 'waveform-ribbon', 'phase-portrait', 'phase-points'])
    assert.throws(() => render(renderer, motionFrame(10, 1)), /two selected/);
  assert.doesNotThrow(() => render('particles', motionFrame(10, 1)));
  const stacked = render('waveform', frame).shapes, overlay = render('waveform', frame, {layout: 'overlay'}).shapes;
  assert.notDeepEqual(stacked, overlay);
  const first = stacked.find(shape => shape.colour === '#76d4cf');
  assert.equal(first.path.at(-1)[2], 5);
});

test('Cartesian motion history uses actual pip ages and does not stretch startup observations', () => {
  const frame = makeFrame([[0], [.5], [1]], 100);
  const result = dots(render('waveform-dots', frame, {grid: false}));
  result.forEach((dot, index) => close(centre(dot)[0], 194 - (2 - index) * 188 / 100));
  assert.ok(centre(result[0])[0] > 190); assert.equal(centre(result.at(-1))[0], 194);
  assert.notDeepEqual(render('waveform-dots', {...frame, historySpanPips: 2}, {grid: false}).shapes,
    render('waveform-dots', frame, {grid: false}).shapes);
  const copy = structuredClone(frame), baseline = render('waveform-polar', frame).shapes;
  render('waveform-polar', motionFrame(100));
  assert.deepEqual(render('waveform-polar', {...frame, sourceSeconds: 800}).shapes, baseline);
  assert.deepEqual(frame, copy);
});

test('spectrogram midpoint cells preserve real startup and single-sample time extents', () => {
  const frame = spectralFrame(3, 100), cells = rectangles(render('spectrogram-linear', frame));
  // Every cell has an opaque dark base and one palette layer.
  assert.equal(cells.length, 3 * 4 * 2);
  const first = cells[0].path[0]; close(first[1], 7 + .975 * 186); close(first[3], .01 * 186);
  assert.ok(first[1] > 188, 'unobserved older history stays unpainted');
  for (let row = 1; row < 3; row++) {
    const previous = cells[(row - 1) * 8].path[0], current = cells[row * 8].path[0];
    close(previous[1] + previous[3], current[1]);
  }
  const last = cells.at(-1).path[0]; close(last[1] + last[3], 193);
  const single = rectangles(render('spectrogram-linear', spectralFrame(1, 100)));
  assert.equal(single.length, 8); close(single[0].path[0][1], 7 + .995 * 186);
  assert.ok(single[0].path[0][3] > 0 && single[0].path[0][3] < 1);
  const polar = render('spectrogram-polar', spectralFrame(1, 100));
  assert.ok(polar.shapes.length > 0);
  const points = polar.shapes.flatMap(shape => shape.path.filter(command => ['moveTo', 'lineTo'].includes(command[0])));
  assert.ok(points.every(point => point[1] > 97 && point[1] <= 100.000001));
});

test('spectrum frequency coordinates and heights use recovered RMS and actual band centres', () => {
  const frame = spectralFrame(1), log = render('spectrum-log', frame).shapes[0];
  const [move, x, y] = log.path[0]; assert.equal(move, 'moveTo');
  close(x, 6 + 188 * Math.log2(50) / Math.log2(400)); close(y, 94 - (52 / 72) * 88);
  const third = render('spectrum-third-octave', frame).shapes;
  assert.deepEqual(third, render('spectrum-log', frame).shapes);
  assert.notDeepEqual(render('spectrum-mel', frame).shapes, third);
  const negativeGainY = log.path[2][2]; close(negativeGainY, 94 - (20 * Math.log10(.02) + 72) / 72 * 88);
  assert.equal(log.path[3][2], 94, 'the explicitly silent band is at the floor');
  const peaks = dots(render('spectrum-peaks', frame)); assert.equal(peaks.length, 1);
  const [px] = centre(peaks[0]); close(px, 7 + 186 * 150 / 400);
});

test('spectrogram scales and contrast change display coordinates or colour, not recorded data', () => {
  const frame = spectralFrame(8), copy = structuredClone(frame);
  const linear = rectangles(render('spectrogram-linear', frame)), mel = rectangles(render('spectrogram-mel', frame));
  assert.notDeepEqual(linear[0].path, mel[0].path);
  const contrast = rectangles(render('spectrogram-linear', frame, {contrast: 3}));
  assert.deepEqual(linear.map(cell => cell.path), contrast.map(cell => cell.path));
  assert.notDeepEqual(linear.map(cell => cell.alpha), contrast.map(cell => cell.alpha));
  assert.deepEqual(frame, copy);
  assert.equal(rectangles(render('spectrogram-mirror', frame)).length, linear.length * 2);
  assert.ok(rectangles(render('spectrogram-peaks', frame)).length < linear.length);
  assert.notDeepEqual(rectangles(render('spectrogram-transposed', frame)), linear);
});

test('history spectra preserve bounded endpoints, actual time depth and deterministic seeking', () => {
  const frame = spectralFrame(512), explicit = {...frame, history: [0, 73, 146, 219, 292, 365, 438, 511].map(index => frame.history[index])};
  const result = render('spectrum-waterfall', frame, {history_limit: 8}).shapes;
  assert.equal(result.length, 8);
  assert.deepEqual(render('spectrum-waterfall', explicit, {history_limit: 8}).shapes, result);
  render('spectrum-waterfall', spectralFrame(200));
  assert.deepEqual(render('spectrum-waterfall', frame, {history_limit: 8}).shapes, result);
  assert.notDeepEqual(render('spectrum-horizon', frame, {history_limit: 8}).shapes, result);
  assert.notDeepEqual(render('spectrum-ridgeline', frame, {history_limit: 8}).shapes, result);
  const start = spectralFrame(3, 100);
  assert.notDeepEqual(render('spectrum-horizon', start).shapes, render('spectrum-horizon', {...start, historySpanPips: 2}).shapes);
  assert.ok(render('spectrum-horizon', spectralFrame(1, 100)).shapes.length > 0);
});

test('motion envelope preserves native extrema per pixel and paired plots respond to the second channel', () => {
  const frame = makeFrame([[-1], [.5], [1]], 1000);
  const result = render('waveform-envelope', frame, {grid: false});
  const envelope = result.shapes[0];
  assert.deepEqual(envelope.path, [['moveTo', 194, 6], ['lineTo', 194, 94]]);
  const pair = motionFrame(20), changed = structuredClone(pair);
  changed.history.forEach(row => {row.values[1] *= -.25;}); changed.values = changed.history.at(-1).values;
  for (const renderer of ['waveform-ribbon', 'phase-portrait', 'phase-points'])
    assert.notDeepEqual(render(renderer, pair).shapes, render(renderer, changed).shapes);
  assert.deepEqual(render('waveform-oscilloscope', pair).shapes, render('waveform-oscilloscope', changed).shapes);
  assert.notDeepEqual(render('waveform-steps', pair).shapes, render('waveform-area', pair).shapes);
});

test('invalid samples, time ages and Fourier evidence fail; null or collapsed frames clear cleanly', () => {
  const frame = motionFrame();
  for (const invalid of [{...frame, values: [NaN, 0]}, {...frame, values: [0, 2]}, {...frame, history: []},
    {...frame, history: Array(513).fill(frame.history[0])}, {...frame, historySpanPips: Infinity},
    {...frame, history: [{...frame.history[0], agePips: NaN}]},
    {...frame, history: [frame.history.at(-1), frame.history[0]]}])
    assert.throws(() => render('waveform-area', invalid), /Core/);
  assert.throws(() => render('spectrum-log', frame), /calibrated/);
  assert.throws(() => render('spectrogram-linear', {...spectralFrame(), bands: []}), /calibrated/);
  assert.equal(render('waveform-area', null).shapes.length, 0);
  assert.equal(render('particles', frame, {}, 8, 8).shapes.length, 0);
  for (const renderer of ['particles', 'waveform', 'path', 'waveform-steps', 'waveform-ribbon', 'waveform-polar', 'phase-portrait'])
    assert.ok(render(renderer, motionFrame(1)).shapes.length > 0, renderer);
});
