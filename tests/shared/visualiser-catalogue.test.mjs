import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {VISUALISER_CATALOGUE, VISUALISER_RENDERERS, VISUALISER_RUDIMENTS, describeVisualiser} from '../../src/visualiser-catalogue.mjs';
import {CORE_RENDERERS} from '../../src/visualiser-core.mjs';
import {CIRCULAR_RENDERERS} from '../../src/visualiser-circular.mjs';
import {EFFECT_RENDERERS} from '../../src/visualiser-effects.mjs';
import {WIRE_RENDERERS, validateWireStyle, drawWire} from '../../src/visualiser-wire.mjs';
import {SPECTRUM_RENDERERS, validateSpectrumStyle} from '../../src/spectrum-analysis.mjs';
import {validateVisualiserStyle, drawVisualiser} from '../../src/visualiser-drawing.mjs';

const readJSON = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);

test('the immutable 164-view catalogue exactly covers the five implemented name arrays', () => {
  assert.equal(VISUALISER_CATALOGUE.length, 164); assert.equal(VISUALISER_RENDERERS.length, 164);
  assert.deepEqual([CORE_RENDERERS.length, CIRCULAR_RENDERERS.length, EFFECT_RENDERERS.length, WIRE_RENDERERS.length, SPECTRUM_RENDERERS.length], [31, 60, 60, 3, 10]);
  const implementations = [...CORE_RENDERERS, ...CIRCULAR_RENDERERS, ...EFFECT_RENDERERS, ...WIRE_RENDERERS, ...SPECTRUM_RENDERERS];
  assert.equal(new Set(implementations).size, 164, 'no duplicate registration can hide an unimplemented renderer');
  assert.deepEqual([...VISUALISER_RENDERERS].sort(), implementations.sort());
  assert.deepEqual(VISUALISER_RENDERERS, VISUALISER_CATALOGUE.map(view => view.name));
  assert.ok(Object.isFrozen(VISUALISER_CATALOGUE)); assert.ok(Object.isFrozen(VISUALISER_RENDERERS));
  for (const view of VISUALISER_CATALOGUE) {
    assert.ok(Object.isFrozen(view)); assert.equal(describeVisualiser(view.name), view);
    assert.match(view.name, /^[a-z][a-z0-9-]{0,127}$/);
    assert.equal(typeof view.label, 'string'); assert.ok(view.label.length > 0);
    assert.equal(typeof view.description, 'string'); assert.ok(view.description.length > 0);
    assert.deepEqual(Object.keys(view).sort(), ['name', 'label', 'description', 'family', 'styleFamily', 'requiresSpectrum', 'minDimensions', 'usesHistory'].sort());
  }
  assert.equal(describeVisualiser('spatial-solid-torus'), null);
  assert.equal(describeVisualiser('sprite-spectrum-lcd'), null);
  assert.equal(describeVisualiser('missing'), null);
});

test('catalogue capability flags distinguish 106 Fourier views and 58 native motion views', () => {
  const spectral = VISUALISER_CATALOGUE.filter(view => view.requiresSpectrum), motion = VISUALISER_CATALOGUE.filter(view => !view.requiresSpectrum);
  assert.equal(spectral.length, 106); assert.equal(motion.length, 58);
  assert.ok(spectral.every(view => ['spectrum', 'spectrogram'].includes(view.family)));
  assert.ok(motion.every(view => ['motion', 'spatial'].includes(view.family)));
  const pairs = ['path', 'waveform-ribbon', 'phase-portrait', 'phase-points', 'waveform-annular-ribbon',
    'waveform-annular-bands', 'phase-annular-portrait', 'waveform-phase-trails'];
  assert.deepEqual(motion.filter(view => view.minDimensions === 2).map(view => view.name).sort(), pairs.sort());
  assert.equal(motion.filter(view => view.minDimensions === 1).length, 50);
  assert.ok(WIRE_RENDERERS.every(name => describeVisualiser(name).minDimensions === 1 && !describeVisualiser(name).usesHistory));
  for (const names of [SPECTRUM_RENDERERS, CIRCULAR_RENDERERS, EFFECT_RENDERERS, WIRE_RENDERERS]) {
    const expected = names === SPECTRUM_RENDERERS ? 'spectrum' : names === CIRCULAR_RENDERERS ? 'circular' : names === EFFECT_RENDERERS ? 'effects' : 'wire';
    assert.ok(names.every(name => describeVisualiser(name).styleFamily === expected));
  }
});

test('trusted JSON and the actual PHP catalogue reader expose identical renderer metadata', () => {
  const mirror = readJSON('../../assets/visualiser-catalogue.json');
  assert.deepEqual(mirror, VISUALISER_CATALOGUE);
  const php = spawnSync('php', ['-r', `
    define('ABSPATH', __DIR__);
    function add_action(...$args) {}
    function add_filter(...$args) {}
    function add_shortcode(...$args) {}
    require $argv[1];
    echo json_encode(array('views'=>array_values(dance_moves_visualiser_catalogue()),
      'rudiments'=>array_keys(dance_moves_visualiser_rudiments())), JSON_THROW_ON_ERROR);
  `, fileURLToPath(new URL('../../dance-moves-visualisers.php', import.meta.url))], {encoding: 'utf8'});
  assert.equal(php.error, undefined, php.error?.message); assert.equal(php.status, 0, php.stderr);
  const returned = JSON.parse(php.stdout);
  assert.deepEqual(returned.views, VISUALISER_CATALOGUE);
  assert.deepEqual(returned.rudiments, VISUALISER_RUDIMENTS);
});

test('all 15 generic native names match the pinned manifest without adding recording payloads', () => {
  const manifest = readJSON('../../assets/vendor/dancerudiments/build-manifest.json');
  assert.ok(Object.isFrozen(VISUALISER_RUDIMENTS)); assert.equal(VISUALISER_RUDIMENTS.length, 15);
  assert.equal(new Set(VISUALISER_RUDIMENTS).size, 15); assert.equal(manifest.selectedCount, 15);
  assert.deepEqual(VISUALISER_RUDIMENTS, manifest.upstream.selection);
  assert.deepEqual(VISUALISER_RUDIMENTS, ['bounce', 'sway', 'circle', 'figure_eight', 'step_touch', 'box_step', 'helix',
    'clay_background', 'single_stroke_roll', 'double_stroke_roll', 'multiple_bounce_roll', 'single_paradiddle', 'flam', 'drag', 'five_stroke_roll']);
});

test('style dispatch preserves independent family units, defaults and rejection rules', () => {
  for (const renderer of VISUALISER_RENDERERS) assert.ok(Object.isFrozen(validateVisualiserStyle(renderer)), renderer);
  const legacyInput = {hold_seconds: .7, gap: 3, labels: false, peak_count: 4};
  for (const renderer of SPECTRUM_RENDERERS) assert.deepEqual(validateVisualiserStyle(renderer, legacyInput), validateSpectrumStyle(legacyInput));
  assert.equal(validateVisualiserStyle('bars', {gap: 2}).gap, 2);
  assert.equal(validateVisualiserStyle('spectrum-cityscape', {gap: .8}).gap, .8);
  assert.throws(() => validateVisualiserStyle('spectrum-cityscape', {gap: 2}));
  assert.equal(validateVisualiserStyle('spectrum-annular-bars', {bar_gap: .8, peak_count: 64}).peak_count, 64);
  assert.throws(() => validateVisualiserStyle('spectrum-annular-bars', {gap: .8}));
  assert.throws(() => validateVisualiserStyle('spectrum', {peak_count: 64}));
  assert.equal(validateVisualiserStyle('waveform', {line_width: 64}).line_width, 64);
  assert.throws(() => validateVisualiserStyle('waveform-area', {line_width: 64}));
  assert.equal(validateVisualiserStyle('spectrogram-linear').history_limit, 96);
  assert.equal(validateVisualiserStyle('spectrogram-annular-time').history_limit, 40);
  assert.equal(validateVisualiserStyle('spectrogram-pixel-mosaic').history_limit, 48);
  assert.equal(validateVisualiserStyle('spatial-sphere').geometry, 'sphere');
  for (const [name, input] of [['waveform', {floor_db: -60}], ['particles', {grid: true}], ['path', {gain: 2}],
    ['spectrum-log', {hold_seconds: 1}], ['spatial-torus', {history_limit: 8}], ['spectrogram-linear', {foo: 1}]])
    assert.throws(() => validateVisualiserStyle(name, input));
  assert.throws(() => validateVisualiserStyle('missing'), /Unknown/);
  const input = {colours: ['#123456', 'red'], padding: 10};
  const style = validateVisualiserStyle('spectrum-annular-dots', input); input.colours[0] = 'blue';
  assert.equal(style.colours[0], '#123456'); assert.ok(Object.isFrozen(style.colours));
});

function canvasTrace() {
  let path = [], state = {globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineJoin: 'miter', lineCap: 'butt', clip: null};
  const marks = [], clears = [], clips = [], stack = [];
  const finite = args => assert.ok(args.every(Number.isFinite), 'Projected Canvas coordinates remain finite');
  const point = (name, args) => {finite(args); path.push([name, ...args]);};
  const mark = kind => {assert.ok(state.globalAlpha >= 0 && state.globalAlpha <= 1);
    marks.push({kind, path: structuredClone(path), colour: state[kind === 'fill' ? 'fillStyle' : 'strokeStyle'],
      alpha: state.globalAlpha, width: kind === 'stroke' ? state.lineWidth : null, clip: structuredClone(state.clip)});};
  const ctx = {save() {stack.push(structuredClone(state));}, restore() {assert.ok(stack.length); state = stack.pop();},
    clearRect(...args) {finite(args); clears.push(args);},
    fillRect(...args) {finite(args);}, beginPath() {path = [];}, closePath() {path.push(['close']);},
    moveTo(...args) {point('move', args);}, lineTo(...args) {point('line', args);},
    rect(...args) {point('rect', args);}, ellipse(...args) {assert.ok(args[2] >= 0 && args[3] >= 0); point('ellipse', args);},
    quadraticCurveTo(...args) {point('curve', args);},
    clip() {state.clip = structuredClone(path); clips.push(state.clip);}, fill() {mark('fill');}, stroke() {mark('stroke');}};
  for (const key of ['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap'])
    Object.defineProperty(ctx, key, {get: () => state[key], set: value => {state[key] = value;}});
  return {ctx, marks, clears, clips, depth: () => stack.length, state: () => structuredClone(state)};
}
const frame = (values = [.35, -.2], sourceSeconds = 0) => ({values, sourceSeconds, pip: 0, dimensions: values.map((_, index) => `axis_${index}`)});
function renderWire(renderer, native = frame(), input = {}, width = 400, height = 240, routed = false) {
  const canvas = canvasTrace(), before = canvas.state(), style = validateWireStyle({rings: 5, segments: 8, glow: 0, ...input}, renderer);
  (routed ? drawVisualiser : drawWire)(canvas.ctx, width, height, native, renderer, style);
  assert.equal(canvas.depth(), 0); assert.deepEqual(canvas.state(), before);
  return canvas;
}

test('each projected wire geometry uses native motion and source time deterministically', () => {
  const shapes = [];
  for (const renderer of WIRE_RENDERERS) {
    const native = frame(), before = structuredClone(native), result = renderWire(renderer, native);
    assert.equal(result.marks.length, 93, '5 by 8 mesh has its exact bounded edge count');
    assert.ok(result.marks.some(mark => mark.alpha > 0));
    assert.deepEqual(renderWire(renderer, native, {}, 400, 240, true).marks, result.marks, 'shared dispatch selects the real wire renderer');
    assert.notDeepEqual(renderWire(renderer, frame([-.35, -.2])).marks, result.marks, 'first native axis changes yaw and amplitude');
    assert.notDeepEqual(renderWire(renderer, frame([.35, .6])).marks, result.marks, 'second native axis changes pitch');
    assert.notDeepEqual(renderWire(renderer, frame(undefined, .5)).marks, result.marks, 'source-clock orbit changes geometry');
    renderWire(renderer, frame([.8, .8], 10));
    assert.deepEqual(renderWire(renderer, native).marks, result.marks, 'a backward seek does not retain future state');
    assert.deepEqual(renderWire(renderer, frame(undefined, 3), {orbit: 0}).marks,
      renderWire(renderer, frame(undefined, 0), {orbit: 0}).marks);
    assert.deepEqual(native, before); shapes.push(result.marks);
  }
  assert.notDeepEqual(shapes[0], shapes[1]); assert.notDeepEqual(shapes[1], shapes[2]); assert.notDeepEqual(shapes[0], shapes[2]);
});

test('wire meshes accept one native axis and reuse it for pitch without invented dimensions', () => {
  for (const renderer of WIRE_RENDERERS) {
    assert.deepEqual(renderWire(renderer, frame([.6])).marks, renderWire(renderer, frame([.6, .6])).marks);
    assert.deepEqual(renderWire(renderer, frame([.6], null)).marks, renderWire(renderer, frame([.6], 0)).marks);
    for (const values of [[], [NaN], [Infinity], [1.01], [-1.01]]) assert.throws(() => renderWire(renderer, frame(values)), /normalized/);
  }
});

test('wire camera, mesh, colour and geometry options have bounded strict validation', () => {
  const defaults = validateWireStyle();
  assert.equal(defaults.geometry, 'torus'); assert.equal(defaults.camera_distance, 4.8); assert.equal(defaults.fov, 55);
  assert.equal(defaults.orbit, 35); assert.equal(defaults.rings, 13); assert.equal(defaults.segments, 30);
  assert.equal(defaults.background, '#101b2e'); assert.equal(defaults.padding, 8);
  assert.ok(Object.isFrozen(defaults)); assert.ok(Object.isFrozen(defaults.colours));
  for (const invalid of [{camera_distance: 2.49}, {camera_distance: 30.01}, {fov: 19}, {fov: 111},
    {rotation: 361}, {orbit: -361}, {depth: 2.01}, {fog: 1.01}, {glow: -.01}, {rings: 2}, {rings: 49},
    {segments: 5}, {segments: 97}, {line_width: 0}, {line_width: 25}, {padding: .5},
    {colours: Array(17).fill('red')}, {material: 'metal'}, {camera_distance: '4.8'}])
    assert.throws(() => validateWireStyle(invalid), JSON.stringify(invalid));
  assert.throws(() => validateWireStyle({geometry: 'torus'}, 'spatial-sphere'), /match/);
  assert.throws(() => validateWireStyle({}, 'spatial-solid-torus'), /Unknown/);
  assert.equal(validateWireStyle({camera_distance: 30, fov: 110, depth: 2, rings: 48, segments: 96}).segments, 96);
  const maximum = renderWire('spatial-terrain', frame(), {rings: 48, segments: 96});
  assert.equal(maximum.marks.length, 48 * 97 + 49 * 96);
});

test('extreme perspective remains finite and every wire stroke is clipped to the viewport', () => {
  const rendered = renderWire('spatial-torus', frame([1, 1]), {camera_distance: 2.5, fov: 20, depth: 2, glow: 1});
  assert.deepEqual(rendered.clips, [[['rect', 8, 8, 384, 224]]]);
  assert.ok(rendered.marks.every(mark => JSON.stringify(mark.clip) === JSON.stringify(rendered.clips[0])));
  const projected = rendered.marks.flatMap(mark => mark.path.filter(command => ['move', 'line'].includes(command[0])));
  assert.ok(projected.some(([, x, y]) => x < 8 || x > 392 || y < 8 || y > 232), 'the test actually exercises clipping');
  assert.equal(renderWire('spatial-sphere', frame(), {}, 8, 8).marks.length, 0);
});

test('wire glow adds bounded strokes and fog attenuates ink without changing its projected mesh', () => {
  const native = frame(), clear = renderWire('spatial-terrain', native, {fog: 0}).marks;
  const fog = renderWire('spatial-terrain', native, {fog: 1}).marks;
  assert.deepEqual(clear.map(mark => mark.path), fog.map(mark => mark.path));
  assert.ok(fog.every((mark, index) => mark.alpha <= clear[index].alpha));
  const glow = renderWire('spatial-terrain', native, {fog: 0, glow: .5}).marks;
  assert.equal(glow.length, clear.length * 2);
  assert.deepEqual(glow.slice(clear.length), clear);
  glow.slice(0, clear.length).forEach((mark, index) => {
    assert.deepEqual(mark.path, clear[index].path); assert.equal(mark.width, clear[index].width * 4);
    close(mark.alpha, clear[index].alpha * .5 * .3);
  });
});
