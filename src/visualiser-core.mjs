// Canvas adaptation of FrameRudiments rudiment_renderers.py and
// advanced_renderers.py at c8d1c9a75630a88324e49a1446820392514092dd.
// Motion traces plot native Rudiment values; spectral views read saved bands.
/*!
 * FrameRudiments core visualisers — MIT License
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
import {clamp, reduceRows, frequency, normaliseBaseStyle, numberStyle, booleanStyle,
  enumStyle, colourStyle, ink, heatInk, bandLevels, peakIndices, withViewport} from './visualiser-helpers.mjs';

export const CORE_RENDERERS = Object.freeze([
  'particles', 'bars', 'waveform', 'path',
  ...['horizon', 'waterfall', 'ridgeline', 'peaks', 'log', 'mel', 'third-octave'].map(name => `spectrum-${name}`),
  ...['linear', 'log', 'mel', 'bark', 'erb', 'peaks', 'contours', 'mirror', 'transposed', 'polar'].map(name => `spectrogram-${name}`),
  ...['area', 'mirror', 'dots', 'steps', 'oscilloscope', 'envelope', 'ribbon', 'polar'].map(name => `waveform-${name}`),
  'phase-portrait', 'phase-points'
]);
const rendererNames = new Set(CORE_RENDERERS), primitiveNames = new Set(['particles', 'bars', 'waveform', 'path']);
const historySpectra = new Set(['spectrum-horizon', 'spectrum-waterfall', 'spectrum-ridgeline']);
const approvedStyles = new WeakMap(), anchorCache = new WeakMap();
const familyOf = renderer => primitiveNames.has(renderer) ? renderer :
  renderer.startsWith('spectrum-') || renderer.startsWith('spectrogram-') ? 'spectral' : 'motion';

/** Styles remain specific to their upstream family; old spectra use their own API. */
export function validateCoreStyle(input = {}, renderer) {
  if (!rendererNames.has(renderer)) throw new RangeError('Unknown core visualiser');
  const family = familyOf(renderer);
  if (approvedStyles.get(input) === family) return input;
  const allowed = {
    particles: ['count', 'radius', 'amplitude', 'seed', 'trail', 'lag'],
    bars: ['orientation', 'gap', 'negative_colour', 'baseline_colour'],
    waveform: ['line_width', 'layout', 'baseline_colour'], path: ['line_width', 'radius'],
    spectral: ['floor_db', 'ceiling_db', 'line_width', 'contrast', 'history_limit'],
    motion: ['line_width', 'grid']
  }[family];
  const style = normaliseBaseStyle(input, allowed);
  if (family === 'particles') {
    const fields = {count: [24, 1, 512, true], radius: [3, .5, 256], amplitude: [.7, 0, 1],
      seed: [0, 0, Number.MAX_SAFE_INTEGER, true], trail: [4, 1, 32, true], lag: [1, 0, 32, true]};
    for (const [key, args] of Object.entries(fields)) style[key] = numberStyle(input, key, ...args);
  } else if (family === 'bars') {
    style.orientation = enumStyle(input, 'orientation', 'vertical', ['vertical', 'horizontal']);
    style.gap = numberStyle(input, 'gap', 2, 0, 4096);
    style.negative_colour = colourStyle(Object.hasOwn(input, 'negative_colour') ? input.negative_colour : '#edb56d');
    style.baseline_colour = colourStyle(Object.hasOwn(input, 'baseline_colour') ? input.baseline_colour : '#9ca4bc');
  } else if (family === 'waveform') {
    style.line_width = numberStyle(input, 'line_width', 2, 1, 64, true);
    style.layout = enumStyle(input, 'layout', 'stacked', ['stacked', 'overlay']);
    style.baseline_colour = colourStyle(Object.hasOwn(input, 'baseline_colour') ? input.baseline_colour : '#536078');
  } else if (family === 'path') {
    style.line_width = numberStyle(input, 'line_width', 2, 1, 64, true);
    style.radius = numberStyle(input, 'radius', 3, .5, 256);
  } else if (family === 'spectral') {
    style.floor_db = numberStyle(input, 'floor_db', -72, -240, 0);
    style.ceiling_db = numberStyle(input, 'ceiling_db', 0, style.floor_db + .01, 60);
    style.line_width = numberStyle(input, 'line_width', 2, 1, 24, true);
    style.contrast = numberStyle(input, 'contrast', 1.35, .1, 4);
    style.history_limit = numberStyle(input, 'history_limit', 96, 8, 256, true);
  } else {
    style.line_width = numberStyle(input, 'line_width', 2, 1, 24, true);
    style.grid = booleanStyle(input, 'grid', true);
  }
  Object.freeze(style.colours); Object.freeze(style); approvedStyles.set(style, family);
  return style;
}

function valuesValid(values, count) {
  return (Array.isArray(values) || ArrayBuffer.isView(values) && !(values instanceof DataView)) && values.length === count &&
    values.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1.00001);
}
function checkedFrame(frame, renderer) {
  const count = frame?.values?.length;
  if (!Number.isInteger(count) || count < 1 || count > 64 || !valuesValid(frame.values, count))
    throw new TypeError('Core visualisers require 1..64 finite normalized selected Rudiment values');
  if (['path', 'waveform-ribbon', 'phase-portrait', 'phase-points'].includes(renderer) && count < 2)
    throw new RangeError('This visualiser needs two selected Rudiment dimensions');
  const needsHistory = renderer !== 'bars' && (!renderer.startsWith('spectrum-') || historySpectra.has(renderer));
  if (!needsHistory) return;
  if (!Array.isArray(frame.history) || !frame.history.length || frame.history.length > 512 ||
      frame.history.some(row => !valuesValid(row?.values, count)))
    throw new TypeError('Core history must contain 1..512 observed samples of the selected Rudiment axes');
  if (renderer === 'particles' || renderer === 'path' || renderer.startsWith('phase-')) return;
  if (typeof frame.historySpanPips !== 'number' || !Number.isFinite(frame.historySpanPips) || frame.historySpanPips < 0 ||
      frame.history.some((row, index) => typeof row.agePips !== 'number' || !Number.isFinite(row.agePips) || row.agePips < 0 ||
        index > 0 && row.agePips > frame.history[index - 1].agePips))
    throw new TypeError('Core time histories need a finite pip span and chronological native sample ages');
}

const timeFraction = (frame, row) => clamp(1 - row.agePips / Math.max(1, frame.historySpanPips));
function timeCells(frame, rows) {
  const centres = rows.map(row => timeFraction(frame, row));
  const nativeStep = 1 / Math.max(1, frame.historySpanPips);
  // Only the oldest observed half-cell precedes the first centre. Extending
  // it to zero would paint an invented past after startup or an excerpt seek.
  return centres.map((centre, index) => {
    const previous = index ? centres[index - 1] : centre - (centres[1] - centre || nativeStep);
    const next = index + 1 < centres.length ? centres[index + 1] : centre + (centre - centres[index - 1] || nativeStep);
    return [clamp((previous + centre) / 2), clamp((centre + next) / 2)];
  });
}
function xy(frame, rows, axis, area) {
  return rows.map(row => [area.left + timeFraction(frame, row) * area.width,
    (area.top + area.bottom) / 2 - clamp(row.values[axis], -1, 1) * area.height / 2]);
}
const dot = (draw, x, y, radius, colour) => draw.ellipse([x - radius, y - radius, x + radius, y + radius], colour);

function particleAnchors(style) {
  if (anchorCache.has(style)) return anchorCache.get(style);
  // Mulberry32 with both halves of the safe integer seed. This explicit JS
  // PRNG preserves repeatability and does not claim Python Random pixel parity.
  let state = (style.seed >>> 0) ^ Math.floor(style.seed / 0x100000000);
  const random = () => {
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x100000000;
  };
  const anchors = Array.from({length: style.count}, () => [random(), random()]);
  anchorCache.set(style, anchors);
  return anchors;
}

function drawPrimitive(draw, frame, renderer, style, area) {
  const {left, top, right, bottom, width, height} = area;
  if (renderer === 'particles') {
    particleAnchors(style).forEach((anchor, index) => {
      for (let age = Math.min(style.trail, frame.history.length) - 1; age >= 0; age--) {
        const values = frame.history[Math.max(0, frame.history.length - 1 - index * style.lag - age)].values;
        const vx = clamp(values[index % values.length], -1, 1), vy = clamp(values[(index + 1) % values.length], -1, 1);
        const x = left + width * (anchor[0] * (1 - style.amplitude) + (vx + 1) / 2 * style.amplitude);
        const y = top + height * (anchor[1] * (1 - style.amplitude) + (1 - vy) / 2 * style.amplitude);
        dot(draw, x, y, style.radius, ink(style, index, 255 / (age + 1)));
      }
    });
  } else if (renderer === 'bars') {
    const vertical = style.orientation === 'vertical', slot = (vertical ? width : height) / frame.values.length;
    if (slot - style.gap < 1) throw new RangeError('Too many selected axes or too much bar gap for this viewport');
    frame.values.forEach((nativeValue, index) => {
      const value = clamp(nativeValue, -1, 1), colour = value >= 0 ? ink(style, index) : style.negative_colour;
      if (vertical) {
        const mid = (top + bottom) / 2, end = mid - value * height / 2;
        draw.rectangle([left + index * slot, Math.min(mid, end), left + (index + 1) * slot - style.gap, Math.max(mid, end)], colour);
      } else {
        const mid = (left + right) / 2, end = mid + value * width / 2;
        draw.rectangle([Math.min(mid, end), top + index * slot, Math.max(mid, end), top + (index + 1) * slot - style.gap], colour);
      }
    });
    draw.line(vertical ? [[left, (top + bottom) / 2], [right, (top + bottom) / 2]] :
      [[(left + right) / 2, top], [(left + right) / 2, bottom]], style.baseline_colour);
  } else if (renderer === 'waveform') {
    const lanes = style.layout === 'stacked' ? frame.values.length : 1, laneHeight = height / lanes;
    if (laneHeight < style.line_width + 1) throw new RangeError('Too many waveform axes for this viewport; select axes');
    for (let axis = 0; axis < frame.values.length; axis++) {
      const laneTop = top + (style.layout === 'stacked' ? axis : 0) * laneHeight;
      draw.line([[left, laneTop + laneHeight / 2], [right, laneTop + laneHeight / 2]], style.baseline_colour);
      draw.line(xy(frame, frame.history, axis, {...area, top: laneTop, bottom: laneTop + laneHeight, height: laneHeight}), ink(style, axis), style.line_width);
    }
  } else {
    const points = frame.history.map(row => [left + (clamp(row.values[0], -1, 1) + 1) / 2 * width,
      top + (1 - clamp(row.values[1], -1, 1)) / 2 * height]);
    if (points.length > 1) draw.line(points, ink(style, 0), style.line_width);
    dot(draw, ...points.at(-1), style.radius, ink(style, Math.min(1, style.colours.length - 1)));
  }
}

function frequencyScale(renderer) {
  // The whole suffix matters: upstream rsplit lost "third-" and accidentally
  // used a linear coordinate. This remains a band-axis transform, not a bank.
  for (const scale of ['third-octave', 'log', 'mel', 'bark', 'erb']) if (renderer.endsWith(`-${scale}`)) return scale;
  return 'linear';
}
function frequencyPositions(frame, lo, hi, scale) {
  const start = frequency(frame.bands[0].lowHz, scale), stop = frequency(frame.bands.at(-1).highHz, scale);
  return frame.bands.map(band => lo + (hi - lo) *
    (frequency((band.lowHz + band.highHz) / 2, scale) - start) / Math.max(1e-12, stop - start));
}

function drawSpectrum(draw, frame, renderer, style, area) {
  const {left, top, right, bottom, width, height} = area;
  if (historySpectra.has(renderer)) {
    const rows = reduceRows(frame.history, Math.min(style.history_limit, 40));
    rows.forEach((row, index) => {
      const levels = bandLevels(frame, row, style), fraction = timeFraction(frame, row);
      const offset = Math.min(13, width / 4), coords = frequencyPositions(frame, left + offset * fraction, right - offset * (1 - fraction), 'linear');
      let baseline, amplitude;
      if (renderer === 'spectrum-horizon') {baseline = bottom - fraction * height * .46; amplitude = height * .51;}
      else if (renderer === 'spectrum-ridgeline') {baseline = bottom - fraction * height * .79; amplitude = height * .3;}
      else {baseline = bottom - fraction * height * .63; amplitude = height * (.34 + fraction * .16);}
      draw.line(coords.map((x, band) => [x, Math.max(top, baseline - levels[band] * amplitude)]), ink(style, index), style.line_width);
    });
    return;
  }
  const levels = bandLevels(frame, frame, style), coords = frequencyPositions(frame, left, right, frequencyScale(renderer));
  const points = coords.map((x, band) => [x, bottom - levels[band] * height]);
  if (renderer === 'spectrum-peaks') {
    for (const index of peakIndices(levels, .12, .04, 1, 32)) {
      const [x, y] = points[index];
      draw.line([[x, bottom], [x, y]], ink(style, index), 3); dot(draw, x, y, 3, '#ffffff');
    }
  } else draw.line(points, ink(style, 0), style.line_width);
}

function drawPolarSpectrogram(draw, frame, rows, style, area) {
  const {left, top, right, bottom, width, height} = area;
  rows = reduceRows(rows, 72);
  const cells = timeCells(frame, rows), radius = Math.min(width, height) / 2;
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  const low = frame.bands[0].lowHz, span = Math.max(1, frame.bands.at(-1).highHz - low);
  rows.forEach((row, index) => {
    const [start, end] = cells[index], levels = bandLevels(frame, row, style);
    const steps = Math.max(1, Math.ceil((end - start) * 128));
    const point = (fraction, r) => {const theta = -Math.PI / 2 + Math.PI * 2 * fraction; return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];};
    frame.bands.forEach((band, axis) => {
      const r0 = radius * (.12 + .86 * (band.lowHz - low) / span), r1 = radius * (.12 + .86 * (band.highHz - low) / span);
      const points = Array.from({length: steps + 1}, (_, j) => point(start + (end - start) * j / steps, r1));
      for (let j = 0; j <= steps; j++) points.push(point(end - (end - start) * j / steps, r0));
      draw.polygon(points, heatInk(style, axis, levels[axis] ** (1 / style.contrast)));
    });
  });
}

function drawSpectrogram(draw, frame, renderer, style, area) {
  const rows = reduceRows(frame.history, style.history_limit);
  if (renderer === 'spectrogram-polar') return drawPolarSpectrogram(draw, frame, rows, style, area);
  const {left, top, bottom, width, height} = area, scale = frequencyScale(renderer);
  const start = frequency(frame.bands[0].lowHz, scale), end = frequency(frame.bands.at(-1).highHz, scale), extent = Math.max(1e-12, end - start);
  const ranges = frame.bands.map(band => [top + (1 - (frequency(band.highHz, scale) - start) / extent) * height,
    top + (1 - (frequency(band.lowHz, scale) - start) / extent) * height]);
  const cells = timeCells(frame, rows);
  rows.forEach((row, index) => {
    const [t0, t1] = cells[index], x0 = left + t0 * width, x1 = left + t1 * width;
    const levels = bandLevels(frame, row, style);
    const selected = renderer === 'spectrogram-peaks' ? new Set(peakIndices(levels, .12, .05, 1, levels.length)) : null;
    ranges.forEach(([low, high], band) => {
      if (selected && !selected.has(band)) return;
      const level = renderer === 'spectrogram-contours' ? Math.floor(levels[band] * 7) / 7 : levels[band];
      const colour = heatInk(style, band, level ** (1 / style.contrast));
      if (renderer === 'spectrogram-transposed') {
        const y0 = top + (1 - t1) * height, y1 = top + (1 - t0) * height;
        draw.rectangle([left + (low - top) / height * width, y0, left + (high - top) / height * width, y1], colour);
      } else if (renderer === 'spectrogram-mirror') {
        const mid = (top + bottom) / 2, a = top + (low - top) / 2, b = top + (high - top) / 2;
        draw.rectangle([x0, a, x1, b], colour); draw.rectangle([x0, 2 * mid - b, x1, 2 * mid - a], colour);
      } else draw.rectangle([x0, low, x1, high], colour);
    });
  });
}

function drawMotion(draw, frame, renderer, style, area) {
  const {left, top, right, bottom, width, height} = area, history = frame.history;
  if (renderer.startsWith('phase-')) {
    if (style.grid) {
      draw.line([[left, (top + bottom) / 2], [right, (top + bottom) / 2]], '#30465d');
      draw.line([[(left + right) / 2, top], [(left + right) / 2, bottom]], '#30465d');
    }
    const points = history.map(row => [left + (clamp(row.values[0], -1, 1) + 1) / 2 * width,
      top + (1 - clamp(row.values[1], -1, 1)) / 2 * height]);
    if (renderer === 'phase-portrait') draw.line(points, ink(style, 0), style.line_width);
    points.forEach(([x, y], index) => dot(draw, x, y, renderer === 'phase-portrait' ? 1 : 2, ink(style, index)));
    return;
  }
  if (renderer === 'waveform-polar') {
    const radius = Math.min(width, height) / 2, cx = (left + right) / 2, cy = (top + bottom) / 2;
    const points = history.map(row => {
      const angle = -Math.PI / 2 + 2 * Math.PI * timeFraction(frame, row), r = radius * (.5 + clamp(row.values[0], -1, 1) * .45);
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });
    draw.line(points, ink(style, 0), style.line_width); return;
  }
  if (renderer === 'waveform-ribbon') {
    const a = xy(frame, history, 0, area), b = xy(frame, history, 1, area);
    if (a.length > 1) draw.polygon([...a, ...b.slice().reverse()], ink(style, 0, 95));
    draw.line(a, ink(style, 0), style.line_width); draw.line(b, ink(style, 1), style.line_width); return;
  }
  if (renderer === 'waveform-mirror') {
    const mid = (top + bottom) / 2;
    const upper = history.map(row => [left + timeFraction(frame, row) * width, mid - Math.abs(row.values[0]) * height / 2]);
    const lower = upper.map(([x, y]) => [x, 2 * mid - y]);
    if (upper.length > 1) draw.polygon([...upper, ...lower.slice().reverse()], ink(style, 0, 115));
    draw.line(upper, ink(style, 0), style.line_width); draw.line(lower, ink(style, 0), style.line_width); return;
  }
  const lanes = ['waveform-oscilloscope', 'waveform-envelope'].includes(renderer) ? 1 : frame.values.length;
  if (height / lanes <= 3) throw new RangeError('Too many waveform axes for this viewport; select axes');
  for (let axis = 0; axis < lanes; axis++) {
    const laneTop = top + axis * height / lanes, laneBottom = top + (axis + 1) * height / lanes, mid = (laneTop + laneBottom) / 2;
    if (style.grid) draw.line([[left, mid], [right, mid]], '#30465d');
    const points = xy(frame, history, axis, {...area, top: laneTop, bottom: laneBottom, height: laneBottom - laneTop});
    const colour = ink(style, axis);
    if (renderer === 'waveform-area') {
      if (points.length > 1) draw.polygon([[points[0][0], mid], ...points, [points.at(-1)[0], mid]], ink(style, axis, 110));
      draw.line(points, colour, style.line_width);
    } else if (renderer === 'waveform-dots') points.forEach(([x, y]) => dot(draw, x, y, 2, colour));
    else if (renderer === 'waveform-steps') {
      if (points.length === 1) draw.line(points, colour, style.line_width);
      for (let index = 1; index < points.length; index++) {
        const [px, py] = points[index - 1], [x, y] = points[index];
        draw.line([[px, py], [x, py], [x, y]], colour, style.line_width);
      }
    } else if (renderer === 'waveform-envelope') {
      // Per-pixel min/max of observed native values; never a PCM peak envelope.
      const groups = new Map();
      for (const [x, y] of points) {
        const key = Math.round(x), group = groups.get(key);
        if (group) {group[0] = Math.min(group[0], y); group[1] = Math.max(group[1], y);}
        else groups.set(key, [y, y]);
      }
      for (const [x, [low, high]] of groups) draw.line([[x, low], [x, high]], colour, Math.max(2, style.line_width));
      if (points.length > 1) draw.line(points, colour, 1);
    } else draw.line(points, colour, style.line_width);
  }
}

/** Pure native-sample drawing; the controller owns recording and clock lifetimes. */
export function drawCore(ctx, width, height, frame, renderer, inputStyle) {
  const style = validateCoreStyle(inputStyle, renderer), family = familyOf(renderer);
  if (frame) checkedFrame(frame, renderer);
  let margin = family === 'bars' ? 0 : family === 'particles' ? style.radius : family === 'waveform' ? style.line_width / 2 :
    family === 'path' ? Math.max(style.radius, style.line_width / 2) : renderer.startsWith('spectrogram-') ? 3 : Math.max(2, style.line_width);
  if (renderer === 'spectrum-peaks') margin = Math.max(margin, 3);
  return withViewport(ctx, width, height, style, margin, (area, draw) => {
    if (!frame) return;
    if (family === 'spectral') {
      // Current evidence is checked before either historical or current plots.
      bandLevels(frame, frame, style);
      if (renderer.startsWith('spectrogram-')) drawSpectrogram(draw, frame, renderer, style, area);
      else drawSpectrum(draw, frame, renderer, style, area);
    } else if (primitiveNames.has(renderer)) drawPrimitive(draw, frame, renderer, style, area);
    else drawMotion(draw, frame, renderer, style, area);
  });
}
