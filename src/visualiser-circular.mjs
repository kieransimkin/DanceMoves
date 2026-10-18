// Canvas adaptation of FrameRudiments circular_renderers.py at
// c8d1c9a75630a88324e49a1446820392514092dd; native samples only, no audio DSP.
/*!
 * FrameRudiments annular visualisers — MIT License
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
  enumStyle, ink, bandLevels, peakIndices, withViewport} from './visualiser-helpers.mjs';

export const CIRCULAR_RENDERERS = Object.freeze([
  ...['bars', 'bars-inward', 'bars-bipolar', 'bars-mirror', 'split', 'sunburst',
    'fan', 'petals', 'led', 'led-inward', 'ticks', 'arc', 'dial', 'dots',
    'lollipop', 'orbit', 'caterpillar', 'peaks', 'area', 'line', 'ribbon', 'halo',
    'rose', 'concentric', 'sectors', 'layers', 'gauge', 'spiral', 'helix']
    .map(name => `spectrum-annular-${name}`),
  ...['time', 'rings', 'heatmap', 'stripes', 'contour', 'frequency', 'sweep', 'spiral']
    .map(name => `spectrogram-annular-${name}`),
  ...['line', 'fill', 'area', 'envelope', 'halo', 'rose', 'pulse', 'mirror', 'ribbon',
    'rings', 'bands', 'bars', 'spokes', 'led', 'petals', 'sectors', 'arc', 'dots',
    'radar', 'trails', 'spiral', 'helix'].map(name => `waveform-annular-${name}`),
  'phase-annular-portrait'
]);
const rendererNames = new Set(CIRCULAR_RENDERERS), approvedStyles = new WeakSet();
const numericOptions = {
  inner_radius: [.27, 0, .95], outer_radius: [.96, .05, 1],
  start_angle: [0, -36000, 36000], sweep_angle: [360, 5, 360],
  line_width: [3, 1, 64, true], bar_gap: [.16, 0, .9], bar_width: [1, .1, 1],
  gain: [1, 0, 8], floor_db: [-72, -240, 0],
  fill_alpha: [170, 0, 255, true], led_segments: [16, 2, 64, true],
  rings: [4, 1, 12, true], history_limit: [40, 4, 256, true],
  axis: [0, 0, 255, true], twists: [2, .2, 12], cap_radius: [2.5, .5, 20],
  peak_threshold: [.18, 0, 1], peak_count: [16, 1, 64, true], decay: [.65, 0, 1]
};
const allowedOptions = [...Object.keys(numericOptions), 'ceiling_db', 'clockwise',
  'mirror', 'grid', 'frequency_scale'];

/** Strict FrameRudiments annular style; gain is a display multiplier. */
export function validateCircularStyle(input = {}) {
  if (approvedStyles.has(input)) return input;
  const style = normaliseBaseStyle(input, allowedOptions);
  for (const [key, bounds] of Object.entries(numericOptions)) style[key] = numberStyle(input, key, ...bounds);
  if (style.inner_radius >= style.outer_radius) throw new RangeError('inner_radius must be smaller than outer_radius');
  style.ceiling_db = numberStyle(input, 'ceiling_db', 0, style.floor_db + .01, 60);
  style.clockwise = booleanStyle(input, 'clockwise', true);
  style.mirror = booleanStyle(input, 'mirror', false);
  style.grid = booleanStyle(input, 'grid', false);
  style.frequency_scale = enumStyle(input, 'frequency_scale', 'equal', ['equal', 'linear', 'log', 'mel', 'bark', 'erb']);
  Object.freeze(style.colours); Object.freeze(style); approvedStyles.add(style);
  return style;
}

function valuesValid(values, dimensions) {
  return (Array.isArray(values) || ArrayBuffer.isView(values) && !(values instanceof DataView)) && values.length === dimensions &&
    values.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1.00001);
}

function checkedFrame(frame, needsHistory) {
  const dimensions = frame?.values?.length;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 64 || !valuesValid(frame.values, dimensions))
    throw new TypeError('Annular views require 1..64 finite normalized selected Rudiment values');
  if (needsHistory && (!Array.isArray(frame.history) || !frame.history.length || frame.history.length > 512 ||
      frame.history.some(row => !valuesValid(row?.values, dimensions))))
    throw new TypeError('Annular history must contain 1..512 observed samples of the selected Rudiment axes');
}

function slots(count) {
  return Array.from({length: count}, (_, index) => [index / count, (index + 1) / count, (index + .5) / count]);
}

function bandPositions(frame, scale) {
  if (scale === 'equal') return slots(frame.values.length);
  const bands = frame.bands;
  const start = frequency(bands[0].lowHz, scale), end = frequency(bands[bands.length - 1].highHz, scale);
  const span = Math.max(1e-10, end - start);
  return bands.map(band => [frequency(band.lowHz, scale), frequency(band.highHz, scale),
    frequency((band.lowHz + band.highHz) / 2, scale)].map(position => (position - start) / span));
}

function geometry(area, draw, style) {
  const cx = (area.left + area.right) / 2, cy = (area.top + area.bottom) / 2;
  const radius = Math.max(2, Math.min(area.width, area.height) / 2);
  const r0 = radius * style.inner_radius, r1 = radius * style.outer_radius;
  const span = r1 - r0, mid = (r0 + r1) / 2;
  const colour = (index, alpha = 255) => ink(style, index, alpha);
  const point = (fraction, r) => {
    const angle = (style.start_angle - 90 + (style.clockwise ? 1 : -1) * style.sweep_angle * fraction) * Math.PI / 180;
    // Upstream validated mirror without applying it; the Canvas adaptation
    // mirrors all geometry about the viewport centre, including partial arcs.
    return [cx + (style.mirror ? -1 : 1) * Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };
  const dot = (fraction, r, fill, size = style.cap_radius) => {
    const [x, y] = point(fraction, r); draw.ellipse([x - size, y - size, x + size, y + size], fill);
  };
  const line = (fraction, a, b, fill, width = style.line_width) => draw.line([point(fraction, a), point(fraction, b)], fill, width);
  const arc = (r, a, b, fill, width = style.line_width) => {
    const count = Math.max(2, Math.ceil(Math.abs(b - a) * 250));
    draw.line(Array.from({length: count}, (_, j) => point(a + (b - a) * j / (count - 1), r)), fill, width);
  };
  const sector = (a, b, inner, outer, fill) => {
    const steps = Math.max(2, Math.ceil(Math.abs(b - a) * 180));
    const points = Array.from({length: steps + 1}, (_, j) => point(a + (b - a) * j / steps, outer));
    for (let j = 0; j <= steps; j++) points.push(point(b - (b - a) * j / steps, inner));
    draw.polygon(points, fill);
  };
  const bar = (slot, inner, outer, fill) => {
    const [a, b, centre] = slot;
    const width = (b - a) * (1 - style.bar_gap) * style.bar_width;
    if (width * Math.min(r1, r0 + 8) * style.sweep_angle * Math.PI / 180 <= .65)
      line(centre, inner, outer, fill, Math.max(1, Math.round(style.line_width / 2)));
    else sector(centre - width / 2, centre + width / 2, inner, outer, fill);
  };
  const plot = (levels, positions = slots(levels.length), options = {}) => {
    const {close = false, fill = false, alpha = style.fill_alpha, radii = [r0, r1]} = options;
    const [inner, outer] = radii;
    const points = levels.map((level, index) => point(positions[index][2], inner + clamp(level) * (outer - inner)));
    if (points.length > 1) {
      if (fill) draw.polygon([...points, ...[...positions].reverse().map(slot => point(slot[2], inner))], colour(0, alpha));
      draw.line(close && style.sweep_angle === 360 ? [...points, points[0]] : points,
        colour(fill ? 1 : 0), style.line_width);
    } else if (points.length) dot(positions[0][2], inner + clamp(levels[0]) * (outer - inner), colour(0));
    return points;
  };
  return {point, dot, line, arc, sector, bar, plot, colour, r0, r1, span, mid};
}

function drawSpectrum(draw, frame, mode, style, g) {
  const levels = bandLevels(frame, frame, style), positions = bandPositions(frame, style.frequency_scale);
  const {r0, r1, span, mid, colour, dot, line, arc, bar, sector, plot, point} = g;
  if (['bars', 'bars-inward', 'bars-bipolar', 'bars-mirror', 'split', 'sunburst', 'fan', 'petals'].includes(mode)) {
    positions.forEach((slot, index) => {
      const [a, b, centre] = slot, level = levels[index];
      let inner = r0, outer = r0 + span * level;
      if (mode === 'bars-inward') {inner = r1 - span * level; outer = r1;}
      else if (mode === 'bars-bipolar' || mode === 'bars-mirror') {inner = mid - span * level / 2; outer = mid + span * level / 2;}
      else if (mode === 'split' && index % 2) {inner = r1 - span * level; outer = r1;}
      else if (mode === 'sunburst' && index % 2) outer = r0 + span * level / 2;
      if (mode === 'petals') sector(a + (b - a) * .44, b - (b - a) * .44, inner, outer, colour(index, style.fill_alpha));
      else if (mode === 'fan') sector(a, b, inner, outer, colour(index, style.fill_alpha));
      else {
        bar(slot, inner, outer, colour(index));
        if (mode === 'bars-mirror') dot(centre, outer, colour(index), style.cap_radius * .7);
      }
    });
  } else if (['led', 'led-inward', 'ticks', 'arc', 'dial'].includes(mode)) {
    positions.forEach((slot, index) => {
      const [a, b, centre] = slot, level = levels[index];
      if (mode === 'ticks') {
        const r = r0 + span * level;
        line(centre, r - style.line_width * 1.5, r + style.line_width * 1.5, colour(index));
      } else if (mode === 'arc') arc(r0 + span * index / Math.max(1, positions.length - 1), a, a + (b - a) * level * (1 - style.bar_gap), colour(index));
      else if (mode === 'dial') {line(centre, r0, r0 + span * level, colour(index)); dot(centre, r0 + span * level, '#ffffff');}
      else for (let j = 0; j < style.led_segments && j / style.led_segments < level; j++) {
        const lo = j / style.led_segments, hi = (j + .7) / style.led_segments;
        bar(slot, mode === 'led-inward' ? r1 - hi * span : r0 + lo * span,
          mode === 'led-inward' ? r1 - lo * span : r0 + hi * span, colour(index));
      }
    });
  } else if (['dots', 'lollipop', 'orbit', 'caterpillar', 'peaks'].includes(mode)) {
    // This threshold is a linear display level, not the report's dB threshold.
    const chosen = mode === 'peaks' ? new Set(peakIndices(levels, style.peak_threshold, .04, 2, style.peak_count)) : null;
    positions.forEach((slot, index) => {
      if (chosen && !chosen.has(index)) return;
      const angle = slot[2] + (mode === 'orbit' ? (levels[index] - .5) / levels.length : 0);
      const r = r0 + span * levels[index];
      if (mode === 'lollipop' || mode === 'peaks') line(angle, r0, r, colour(index));
      dot(angle, r, colour(index), style.cap_radius * (mode === 'caterpillar' ? 1.5 : 1));
    });
  } else if (['area', 'line', 'ribbon', 'halo', 'rose', 'concentric'].includes(mode)) {
    if (mode === 'rose') plot(levels.map((level, index) => level * (index % 2 ? .4 : 1)), positions, {close: true, fill: true});
    else if (mode === 'concentric') for (let ring = 0; ring < style.rings; ring++) {
      const fraction = (ring + 1) / (style.rings + 1);
      plot(levels.map(level => level * (.25 + fraction * .75)), positions, {close: true,
        radii: [r0 + span * fraction * .12, r0 + span * (.28 + .67 * fraction)]});
    } else {
      plot(levels, positions, {close: true, fill: ['area', 'ribbon', 'halo'].includes(mode), alpha: mode === 'halo' ? 75 : style.fill_alpha});
      if (mode === 'ribbon') plot(levels.map(level => level * .65), positions, {close: true});
      if (mode === 'halo') for (let i = 0; i < 2; i++) plot(levels.map(level => level * (1 - .12 * (i + 1))), positions, {close: true});
    }
  } else if (mode === 'gauge') {
    const average = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    sector(0, average, r0, r1, colour(0, style.fill_alpha));
    arc(mid, 0, average, colour(1), Math.max(3, style.line_width * 2));
  } else if (mode === 'sectors' || mode === 'layers') positions.forEach(([a, b], index) => {
    if (mode === 'sectors') sector(a, a + (b - a) * (1 - style.bar_gap), r0, r0 + span * Math.max(.1, levels[index]), colour(index, style.fill_alpha));
    else {
      const inner = r0 + span * (index % style.rings) / style.rings;
      sector(a, b - (b - a) * style.bar_gap, inner, inner + span / style.rings * levels[index], colour(index));
    }
  });
  else if (mode === 'spiral' || mode === 'helix') {
    const points = levels.map((level, index) => {
      const fraction = index / Math.max(1, levels.length - 1);
      // Upstream shares these branches. A bounded radial oscillation makes
      // the helix a distinct multi-turn trace without adding synthetic input.
      const modulation = mode === 'helix' ? .08 * Math.sin(fraction * style.twists * Math.PI * 2) : 0;
      return point(fraction * style.twists % 1, r0 + span * clamp(.1 + .7 * fraction + .2 * level + modulation));
    });
    if (points.length > 1) draw.line(points, colour(0), style.line_width);
    points.forEach(([x, y], index) => {
      const r = style.cap_radius * .6; draw.ellipse([x - r, y - r, x + r, y + r], colour(index));
    });
  }
}

function drawSpectrogram(draw, frame, mode, style, g) {
  // The history cap is independent of the source recording length. Every cell
  // is a calibrated recorded band/sample, including silent and negative gains.
  const history = reduceRows(frame.history, Math.min(style.history_limit, 80));
  const rows = history.map(row => bandLevels(frame, row, style));
  const positions = bandPositions(frame, style.frequency_scale);
  const {r0, span, colour, sector, point} = g;
  if (mode === 'spiral') {
    const points = rows.map((levels, index) => {
      const fraction = index / Math.max(1, rows.length - 1);
      const maximum = Math.max(...levels);
      return point(fraction * style.twists % 1, r0 + span * (.12 + .72 * fraction + .12 * maximum));
    });
    if (points.length > 1) draw.line(points, colour(0), style.line_width);
    else if (points.length) g.dot(0, r0 + span * (.12 + .12 * Math.max(...rows[0])), colour(0));
    return;
  }
  rows.forEach((levels, index) => {
    const t0 = index / rows.length, t1 = (index + 1) / rows.length;
    levels.forEach((value, band) => {
      const [b0, b1] = positions[band];
      let level = value;
      if (mode === 'contour') level = Math.round(level * 6) / 6;
      if (mode === 'stripes' && (Math.floor(index / 2) + Math.floor(band / 2)) % 2) level *= .55;
      // Decay was accepted but unused upstream. It now controls deterministic
      // oldest-to-newest attenuation, with the current sample at full opacity.
      if (mode === 'sweep') level *= 1 - style.decay + style.decay * t1;
      if (level <= .005) return;
      const radialTime = ['time', 'rings', 'heatmap', 'stripes', 'contour'].includes(mode);
      const inner = r0 + span * (radialTime ? t0 : b0);
      let outer = r0 + span * (radialTime ? t1 : b1);
      if (mode === 'rings') outer = inner + (outer - inner) * .72;
      // The upstream time/heatmap alias is separated by intensity colour:
      // time keeps frequency colours; heatmap uses the selected level palette.
      const colourIndex = mode === 'heatmap' ? Math.min(style.colours.length - 1, Math.floor(level * style.colours.length)) : band;
      sector(radialTime ? b0 : t0, radialTime ? b1 : t1, inner, outer, colour(colourIndex, Math.round(level * style.fill_alpha)));
    });
  });
}

function drawMotion(draw, frame, mode, style, g) {
  if (style.axis >= frame.values.length) throw new RangeError('Annular motion axis must be a selected Rudiment dimension');
  if ((mode === 'ribbon' || mode === 'bands') && frame.values.length < 2)
    throw new RangeError('Annular ribbon/bands need two selected Rudiment dimensions');
  const history = reduceRows(frame.history, Math.min(style.history_limit * 3, 240));
  const values = history.map(row => clamp(row.values[style.axis], -1, 1)), positions = slots(values.length);
  const {r0, r1, span, mid, colour, point, dot, line, sector, arc, bar} = g;
  if (['line', 'fill', 'area', 'envelope', 'halo', 'rose', 'pulse'].includes(mode)) {
    const transformed = values.map((value, index) => mode === 'envelope' ? Math.abs(value) :
      mode === 'rose' ? Math.abs(value) * (index % 2 ? .5 : 1) : mode === 'pulse' ? .5 + .35 * Math.abs(value) : .5 + .46 * value);
    const points = transformed.map((value, index) => point(positions[index][2], r0 + clamp(value) * span));
    if (points.length > 1) {
      if (['fill', 'area', 'halo', 'pulse', 'rose'].includes(mode)) {
        const inner = [...positions].reverse().map(slot => point(slot[2], mode === 'fill' || mode === 'pulse' ? mid : r0));
        draw.polygon([...points, ...inner], colour(0, mode === 'halo' ? 65 : style.fill_alpha));
      }
      draw.line(style.sweep_angle === 360 ? [...points, points[0]] : points, colour(mode === 'line' ? 0 : 1), style.line_width);
      if (mode === 'pulse') values.forEach((value, index) => dot(positions[index][2], mid, colour(1, Math.round(120 * Math.abs(value)))));
    } else dot(positions[0][2], r0 + transformed[0] * span, colour(0));
  } else if (mode === 'rings') {
    // The catalogue promises independent motion channels. Upstream reused the
    // first channel's dots in every ring; sample each selected channel here.
    const count = Math.min(style.rings, frame.values.length);
    for (let axis = 0; axis < count; axis++) {
      const inner = r0 + span * axis / count, outer = r0 + span * (axis + 1) / count;
      const points = history.map((row, index) => point(positions[index][2], inner + (outer - inner) * (.5 + .45 * clamp(row.values[axis], -1, 1))));
      if (points.length > 1) draw.line(style.sweep_angle === 360 ? [...points, points[0]] : points, colour(axis), style.line_width);
      else dot(positions[0][2], inner + (outer - inner) * (.5 + .45 * clamp(history[0].values[axis], -1, 1)), colour(axis));
    }
  } else if (mode === 'mirror' || mode === 'ribbon' || mode === 'bands') {
    const second = mode === 'mirror' ? values : history.map(row => clamp(row.values[1], -1, 1));
    const outer = values.map((value, index) => point(positions[index][2], mid + .45 * span * Math.abs(value)));
    const inner = second.map((value, index) => point(positions[index][2], mid - .45 * span * Math.abs(value)));
    if (outer.length > 1) {
      draw.polygon([...outer, ...inner.slice().reverse()], colour(0, style.fill_alpha));
      draw.line(outer, colour(0), style.line_width); draw.line(inner, colour(1), style.line_width);
      if (mode === 'bands') for (let axis = 0; axis < Math.min(style.rings, frame.values.length); axis++) {
        const radius = r0 + span * axis / Math.min(style.rings, frame.values.length);
        history.forEach((row, index) => dot(positions[index][2], radius + Math.max(0, row.values[axis]) * span / (style.rings + 1), colour(axis, 160), style.cap_radius * .4));
      }
    } else {
      dot(positions[0][2], mid + .45 * span * Math.abs(values[0]), colour(0));
      dot(positions[0][2], mid - .45 * span * Math.abs(second[0]), colour(1));
    }
  } else if (['bars', 'spokes', 'led', 'petals', 'sectors', 'arc', 'dots', 'radar', 'trails'].includes(mode)) {
    values.forEach((value, index) => {
      const slot = positions[index], [a, b, centre] = slot;
      const level = clamp(Math.abs(value) * style.gain);
      const r = ['bars', 'spokes', 'dots', 'trails', 'radar'].includes(mode) ? mid + value * span * .45 : r0 + span * level;
      const fill = colour(index);
      if (mode === 'bars') {
        // Preserve centred bipolar bars, with angular width; spokes remain
        // discrete sample stems instead of the identical upstream branch.
        bar(slot, Math.min(mid, r), Math.max(mid, r), fill);
      } else if (mode === 'spokes' || mode === 'radar') line(centre, mid, r, fill);
      else if (mode === 'led') for (let j = 0; j < style.led_segments && (j + 1) / style.led_segments <= level; j++)
        bar(slot, r0 + span * j / style.led_segments, r0 + span * (j + .7) / style.led_segments, fill);
      else if (mode === 'petals') sector(a + .35 * (b - a), b - .35 * (b - a), r0, r, colour(index, style.fill_alpha));
      else if (mode === 'sectors') sector(a, a + (b - a) * level, r0, r1, colour(index, style.fill_alpha));
      else if (mode === 'arc') arc(r0 + span * index / Math.max(1, values.length - 1), a, b, colour(index, Math.round(255 * (.2 + .8 * level))));
      else if (mode === 'dots' || mode === 'trails') {
        const ageFraction = (index + 1) / values.length;
        const alpha = mode === 'trails' ? (1 - style.decay + style.decay * ageFraction) ** 2 : .15 + .85 * ageFraction;
        dot(centre, r, colour(index, Math.round(255 * alpha)));
      }
      if (mode === 'radar') dot(centre, r, fill, style.cap_radius * .55);
    });
  } else if (mode === 'spiral' || mode === 'helix') {
    const points = values.map((value, index) => {
      const fraction = index / Math.max(1, values.length - 1);
      const drift = .65 * fraction + .25 * (.5 + .5 * value) + (mode === 'helix' ? .1 * Math.sin(fraction * style.twists * Math.PI * 2) : 0);
      return point(fraction * style.twists % 1, r0 + span * clamp(drift));
    });
    if (points.length > 1) draw.line(points, colour(0), style.line_width);
    else if (points.length) dot(0, r0 + span * clamp(.25 * (.5 + .5 * values[0])), colour(0));
  }
}

function drawPhase(draw, frame, style, g) {
  if (frame.values.length < 2) throw new RangeError('Annular phase plot needs two selected Rudiment dimensions');
  const history = reduceRows(frame.history, Math.min(256, style.history_limit * 4));
  const points = history.map(row => g.point(clamp((row.values[0] + 1) / 2), g.r0 + clamp((row.values[1] + 1) / 2) * g.span));
  if (points.length > 1) draw.line(points, g.colour(0), style.line_width);
  points.forEach(([x, y], index) => draw.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], g.colour(index)));
}

/** Pure drawing: clearing, clipping and geometry depend only on this frame. */
export function drawCircular(ctx, width, height, frame, renderer, inputStyle) {
  if (!rendererNames.has(renderer)) throw new RangeError('Unknown annular renderer');
  const style = validateCircularStyle(inputStyle);
  const spectral = renderer.startsWith('spectrum-annular-');
  if (frame) checkedFrame(frame, !spectral);
  return withViewport(ctx, width, height, style, Math.max(2, style.line_width / 2, style.cap_radius), (area, draw) => {
    if (!frame) return;
    const g = geometry(area, draw, style);
    if (style.grid) for (const radius of [g.r0, g.mid, g.r1]) g.arc(radius, 0, 1, {colour: '#4b5e79', alpha: 150 / 255}, 1);
    if (spectral) drawSpectrum(draw, frame, renderer.slice('spectrum-annular-'.length), style, g);
    else if (renderer.startsWith('spectrogram-annular-')) drawSpectrogram(draw, frame, renderer.slice('spectrogram-annular-'.length), style, g);
    else if (renderer.startsWith('waveform-annular-')) drawMotion(draw, frame, renderer.slice('waveform-annular-'.length), style, g);
    else drawPhase(draw, frame, style, g);
  });
}
