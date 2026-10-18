// Canvas adaptations of FrameRudiments effect_renderers.py at
// c8d1c9a75630a88324e49a1446820392514092dd.
// Copyright (c) 2026 Kieran Simkin. MIT licensed; the complete permission and
// warranty notice is retained in the imported visualiser-helpers.mjs.
import {clamp, reduceRows, normaliseBaseStyle, numberStyle, booleanStyle,
  enumStyle, ink, bandLevels, withViewport} from './visualiser-helpers.mjs';

const spectrumModes = ['cityscape','led-matrix','capsules','outline-blocks','peak-ladder',
  'staircase','eq-curve','ribbon-stack','peak-trails','gel-bars','lollipop-grid','mountain-range',
  'band-delta','band-variance','energy-tiles','semi-circle','fan-meter','braided-lines',
  'rain-bars','bead-stacks','dash-grid','thermometer','wave-fence','partition'];
const spectrogramModes = ['pixel-mosaic','isometric-terrain','voxel-city','frequency-stripes',
  'dot-cloud','isobands','negative','tape','slit-scan','trails','hex-cells','bead-grid','tunnel',
  'record-grooves','quilt','crosshatch','triangle-tiles','pixel-rain'];
const waveformModes = ['phosphor','echo','sample-beads','channel-braid','pulse-train','quantised',
  'triggered','spiral-trace','butterfly','horizon','heat-ribbon','dotted-envelope','vertical-scope',
  'phase-trails','polar-radar','dna-helix','block-meter','signal-staircase'];
export const EFFECT_RENDERERS = Object.freeze([
  ...spectrumModes.map(name => 'spectrum-' + name),
  ...spectrogramModes.map(name => 'spectrogram-' + name),
  ...waveformModes.map(name => 'waveform-' + name)
]);
const rendererNames = new Set(EFFECT_RENDERERS);
const styleKeys = ['line_width','floor_db','ceiling_db','gain','history_limit','axis','segments',
  'quantize','gap','fill_alpha','decay','bead_radius','perspective','smoothing','threshold','stride',
  'amplitude_curve','colour_map','mirror','reverse','grid','baseline'];

/** Display-only controls; no field introduces a new analysis or sample clock. */
export function validateEffectStyle(input = {}) {
  const style = normaliseBaseStyle(input, styleKeys, {padding: 4});
  style.line_width = numberStyle(input, 'line_width', 2, 1, 32, true);
  style.floor_db = numberStyle(input, 'floor_db', -72, -240, 0);
  style.ceiling_db = numberStyle(input, 'ceiling_db', 0, style.floor_db + .01, 60);
  style.gain = numberStyle(input, 'gain', 1, 0, 8);
  style.history_limit = numberStyle(input, 'history_limit', 48, 4, 256, true);
  style.axis = numberStyle(input, 'axis', 0, 0, 255, true);
  style.segments = numberStyle(input, 'segments', 14, 2, 64, true);
  style.quantize = numberStyle(input, 'quantize', 0, 0, 64, true);
  style.gap = numberStyle(input, 'gap', .14, 0, .95);
  style.fill_alpha = numberStyle(input, 'fill_alpha', 175, 0, 255, true);
  style.decay = numberStyle(input, 'decay', .72, 0, 1);
  style.bead_radius = numberStyle(input, 'bead_radius', 3.5, .5, 20);
  style.perspective = numberStyle(input, 'perspective', .46, 0, 1);
  style.smoothing = numberStyle(input, 'smoothing', 0, 0, 16, true);
  style.threshold = numberStyle(input, 'threshold', .06, 0, 1);
  style.stride = numberStyle(input, 'stride', 1, 1, 16, true);
  style.amplitude_curve = enumStyle(input, 'amplitude_curve', 'linear', ['linear','sqrt','square','log','ease']);
  style.colour_map = enumStyle(input, 'colour_map', 'axis', ['axis','level','time','alternating','mono','rainbow']);
  for (const key of ['mirror','reverse','grid','baseline']) style[key] = booleanStyle(input, key, false);
  return Object.freeze(style);
}

function amplitude(value, style) {
  let level = clamp(value);
  if (style.amplitude_curve === 'sqrt') level = Math.sqrt(level);
  else if (style.amplitude_curve === 'square') level *= level;
  else if (style.amplitude_curve === 'log') level = Math.log1p(9 * level) / Math.log(10);
  else if (style.amplitude_curve === 'ease') level = level * level * (3 - 2 * level);
  if (style.quantize > 1) level = Math.round(level * (style.quantize - 1)) / (style.quantize - 1);
  return clamp(level);
}
function effectInk(style, index, level = 1, age = 0, alpha = 255) {
  let selected = index;
  if (style.colour_map === 'mono') selected = 0;
  else if (style.colour_map === 'alternating') selected = Math.floor(index / 2);
  else if (style.colour_map === 'time') selected += age;
  else if (style.colour_map === 'level') selected = Math.min(style.colours.length - 1, Math.floor(clamp(level) * style.colours.length));
  const result = ink(style, selected, alpha * style.fill_alpha / 255);
  if (style.colour_map === 'rainbow') {
    // The upstream display palette is HSV(h, .83, .97), not signal analysis.
    const hue = ((index / 64 + level * .25) % 1 + 1) % 1;
    const sector = hue * 6, fraction = sector % 1, v = .97;
    const p = v * .17, q = v * (1 - .83 * fraction), t = v * (1 - .83 * (1 - fraction));
    const rgb = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][Math.floor(sector)];
    result.colour = `rgb(${rgb.map(channel => Math.round(channel * 255)).join(' ')})`;
  }
  return result;
}
function observedHistory(frame, style) {
  if (!Array.isArray(frame.values) || !frame.values.length || frame.values.length > 64 ||
      frame.values.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1))
    throw new TypeError('Effect visualisers need finite normalized Rudiment channels');
  if (!Array.isArray(frame.history) || !frame.history.length)
    throw new TypeError('Effect visualisers need observed source-clocked history');
  // Preserve the observed current row when stride does not divide its index.
  const rows = reduceRows(frame.history.filter((_, index, all) => index % style.stride === 0 || index === all.length - 1), style.history_limit);
  for (const row of rows) if (!Array.isArray(row.values) || row.values.length !== frame.values.length ||
      row.values.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1))
    throw new TypeError('Effect history sample dimensions or values are invalid');
  if (typeof frame.historySpanPips !== 'number' || !Number.isFinite(frame.historySpanPips) || frame.historySpanPips < 0 ||
      frame.history.some((row, index) => typeof row.agePips !== 'number' || !Number.isFinite(row.agePips) || row.agePips < 0 ||
        index > 0 && row.agePips > frame.history[index - 1].agePips))
    throw new TypeError('Effect time histories need a finite pip span and chronological native sample ages');
  return rows;
}
function timeFraction(frame, row, reverse = false) {
  const fraction = clamp(1 - row.agePips / Math.max(1, frame.historySpanPips));
  return reverse ? 1 - fraction : fraction;
}
function timeCells(frame, rows, reverse = false) {
  const centres = rows.map(row => timeFraction(frame, row, reverse));
  const nativeStep = 1 / Math.max(1, frame.historySpanPips);
  // Neighbouring observed times meet at their midpoint. Extend the first/last
  // by only half a local step, so an incomplete capture leaves missing time
  // clear. A single current sample owns only its half-native-pip edge cell.
  return centres.map((centre, index) => {
    const previous = index ? centres[index - 1] : centre - (centres[1] - centre || nativeStep);
    const next = index + 1 < centres.length ? centres[index + 1] : centre + (centre - centres[index - 1] || nativeStep);
    return [clamp((previous + centre) / 2), clamp((centre + next) / 2)];
  });
}
function spectralRows(frame, history, style) {
  return history.map(row => bandLevels(frame, row, style).map(value => amplitude(value, style)));
}
function smooth(row, amount) {
  if (!amount) return row;
  return row.map((_, index) => {
    const start = Math.max(0, index - amount), end = Math.min(row.length, index + amount + 1);
    let sum = 0;for (let i = start; i < end; i++) sum += row[i];
    return sum / (end - start);
  });
}
function grid(draw, area, style) {
  if (!style.grid) return;
  const colour = {colour: '#40546a', alpha: 100 / 255};
  for (let j = 0; j <= 4; j++) {
    const x = area.left + area.width * j / 4, y = area.top + area.height * j / 4;
    draw.line([x,area.top,x,area.bottom], colour);
    draw.line([area.left,y,area.right,y], colour);
  }
}

function spectrum(draw, frame, area, mode, style, history) {
  let rows = spectralRows(frame, history, style), levels = smooth(rows.at(-1), style.smoothing);
  if (style.reverse) {levels = [...levels].reverse();rows = rows.map(row => [...row].reverse());}
  const {left,top:t,right:r,bottom:b,width:w,height:h} = area;
  const n = levels.length, cell = w / n, mid = (left + r) / 2;
  const points = levels.map((value, i) => [left + (i + .5) * cell, b - value * h]);
  const colour = (i, level = 1, alpha = 255) => effectInk(style, i, level, 0, alpha);
  grid(draw, area, style);
  if (['cityscape','capsules','outline-blocks','gel-bars','thermometer','partition'].includes(mode)) {
    levels.forEach((value, i) => {
      const x0 = left + i * cell + style.gap * cell / 2, x1 = left + (i + 1) * cell - style.gap * cell / 2;
      const y = b - h * value, fill = colour(i, value);
      if (mode === 'cityscape') {
        const roof = (i % 5) * h * .012;
        draw.polygon([[x0,b],[x0,y + roof],[(x0 + x1) / 2,y - roof],[x1,y + roof],[x1,b]], fill);
        // CSS sizes can be enormous even with a capped backing buffer. Bound
        // decorative windows independently of viewport dimensions.
        const windows = Math.min(64, Math.max(0, Math.ceil((b - y - 10) / 12)));
        const spacing = windows < 64 ? 12 : Math.max(12, (b - y - 10) / windows);
        for (let j = 0; j < windows; j++) draw.line([x0 + 1,y + 10 + j * spacing,x1 - 1,y + 10 + j * spacing], colour(i + 1, value, 90));
      } else if (mode === 'capsules') draw.roundedRectangle([x0,y,x1,b], Math.max(1, Math.min(cell / 2, h * value / 2)), fill);
      else if (mode === 'outline-blocks') draw.rectangle([x0,y,x1,b], null, fill, style.line_width);
      else if (mode === 'gel-bars') {
        draw.rectangle([x0,y,x1,b], colour(i, value, 145));
        draw.line([x0 + 1,y + 2,x0 + 1,b - 2], colour(i + 1, value, 230));
      } else if (mode === 'thermometer') draw.rectangle([x0,t,x1,b], colour(i, value, Math.round(255 * value)));
      else {
        const split = x0 + (x1 - x0) * value;
        draw.rectangle([x0,t,split,b], fill);draw.rectangle([split,t,x1,b], colour(i + 1, value, 35));
      }
    });
  } else if (['led-matrix','bead-stacks','dash-grid'].includes(mode)) {
    levels.forEach((value, i) => {
      const x = left + (i + .5) * cell;
      for (let j = 0; j < style.segments; j++) {
        const dim = (j + .5) / style.segments > value;
        if (dim && mode !== 'led-matrix') continue;
        const fill = dim ? colour(i, value, 30) : colour(i + j, value);
        const y0 = b - h * (j + 1) / style.segments, y1 = b - h * j / style.segments;
        if (mode === 'bead-stacks') {
          const radius = Math.min(style.bead_radius, cell * .43, (y1 - y0) * .43), yc = (y0 + y1) / 2;
          draw.ellipse([x - radius,yc - radius,x + radius,yc + radius], fill);
        } else {
          const gap = mode === 'dash-grid' ? .15 : .05;
          draw.rectangle([x - cell * .43,y0 + (y1 - y0) * gap,x + cell * .43,y1 - (y1 - y0) * gap], fill);
        }
      }
    });
  } else if (['peak-ladder','staircase','lollipop-grid','eq-curve'].includes(mode)) {
    if (mode === 'eq-curve') draw.line(points, colour(0), style.line_width + 1);
    points.forEach(([x,y], i) => {
      const fill = colour(i, levels[i]);
      if (mode === 'peak-ladder') draw.line([x - cell * .45,y,x + cell * .45,y], fill, style.line_width + 1);
      else if (mode === 'staircase') {
        draw.line([x - cell * .5,y,x + cell * .5,y], fill, style.line_width);
        if (i) draw.line([x - cell * .5,points[i - 1][1],x - cell * .5,y], fill, style.line_width);
      } else if (mode === 'lollipop-grid') {
        draw.line([x,b,x,y], fill, style.line_width);
        const radius = Math.min(style.bead_radius, cell * .48);
        draw.ellipse([x - radius,y - radius,x + radius,y + radius], colour(i + 1, levels[i]));
      }
    });
  } else if (['ribbon-stack','mountain-range','braided-lines','wave-fence','rain-bars','peak-trails'].includes(mode)) {
    // These are layered frequency/amplitude drawings, not Cartesian time
    // axes. Their bounded stacking depth and ink ordering remain index based.
    const previous = reduceRows(rows, Math.min(24, style.history_limit));
    previous.forEach((row, j) => {
      const fraction = (j + 1) / previous.length, alpha = Math.round(255 * ((1 - style.decay) + style.decay * fraction));
      const pts = row.map((value, i) => [left + (i + .5) * cell,
        b - h * (mode === 'wave-fence' ? .8 : 1) * value - (1 - fraction) * h * style.perspective * .5]);
      if (mode === 'mountain-range') draw.polygon([[left,b],...pts,[r,b]], colour(j, .5, Math.round(alpha * .35)));
      else if (mode === 'ribbon-stack') draw.line(pts, colour(j, 1, alpha), style.line_width);
      else if (mode === 'braided-lines') {
        if (pts.length === 1) draw.line(pts, colour(j, row[0], alpha), style.line_width);
        for (let i = 1; i < pts.length; i++) draw.line([pts[i - 1],pts[i]], colour(i + j, row[i], alpha), style.line_width);
      } else if (mode === 'wave-fence') {
        draw.line(pts, colour(j, 1, alpha), style.line_width);
        for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 18))) draw.line([pts[i],[pts[i][0],b]], colour(i, .5, Math.round(alpha * .5)));
      } else pts.forEach(([x,y], i) => {
        if (row[i] < style.threshold) return;
        if (mode === 'rain-bars') draw.line([x - cell * .33,y,x + cell * .33,y], colour(i, row[i], alpha));
        else {
          const radius = Math.min(style.bead_radius, cell * .48);
          draw.ellipse([x - radius,y - radius,x + radius,y + radius], colour(i, row[i], alpha));
        }
      });
    });
  } else if (['band-delta','band-variance','energy-tiles'].includes(mode)) {
    const previous = smooth(rows.length > 1 ? rows.at(-2) : rows.at(-1), style.smoothing);
    levels.forEach((value, i) => {
      const x0 = left + i * cell + style.gap * cell / 2, x1 = left + (i + 1) * cell - style.gap * cell / 2;
      if (mode === 'band-delta') {
        const delta = value - previous[i], y = (t + b) / 2;
        draw.rectangle([x0,Math.min(y,y - delta * h * .48),x1,Math.max(y,y - delta * h * .48)], colour(i, Math.abs(delta)));
      } else if (mode === 'band-variance') {
        const mean = rows.reduce((sum,row) => sum + row[i], 0) / rows.length;
        const variance = rows.reduce((sum,row) => sum + (row[i] - mean) ** 2, 0) / rows.length;
        draw.rectangle([x0,b - h * clamp(Math.sqrt(variance) * 2),x1,b], colour(i, variance));
      } else {
        // Preserve actual tile geometry rather than duplicate thermometer's
        // full-height columns (the upstream two branches were identical).
        const side = Math.min(x1 - x0, h), cx = (x0 + x1) / 2, cy = (t + b) / 2;
        draw.rectangle([cx - side / 2,cy - side / 2,cx + side / 2,cy + side / 2], colour(i, value, Math.round(255 * value)));
      }
    });
  } else if (mode === 'semi-circle' || mode === 'fan-meter') {
    const radius = Math.min(w * .48, h * .93);
    levels.forEach((value, i) => {
      const angle = Math.PI * (1 - i / Math.max(1, n - 1)), fill = colour(i, value);
      if (mode === 'semi-circle') draw.line([
        mid + radius * .33 * Math.cos(angle),b - radius * .33 * Math.sin(angle),
        mid + radius * (.33 + .67 * value) * Math.cos(angle),b - radius * (.33 + .67 * value) * Math.sin(angle)
      ], fill, Math.max(1, Math.round(cell * .45)));
      else {
        const a1 = angle - Math.PI / n * .36, a2 = angle + Math.PI / n * .36;
        draw.polygon([[a1,.3],[a1,.33 + .67 * value],[a2,.33 + .67 * value],[a2,.3]]
          .map(([a,rr]) => [mid + radius * rr * Math.cos(a),b - radius * rr * Math.sin(a)]), fill);
      }
    });
  }
}

function spectrogram(draw, frame, area, mode, style, history) {
  const ordered = style.reverse ? [...history].reverse() : history;
  const rows = spectralRows(frame, ordered, style), cells = timeCells(frame, ordered, style.reverse);
  const {left,top:t,right:r,bottom:b,width:w,height:h} = area;
  const nt = rows.length, nf = rows.at(-1).length, cellh = h / nf;
  rows.forEach((row, time) => {
    const [start, end] = cells[time], x0 = left + start * w, x1 = left + end * w, cellw = x1 - x0;
    row.forEach((value, band) => {
      if (value < style.threshold && !['negative','quilt','isobands'].includes(mode)) return;
      const y0 = b - (band + 1) * cellh, y1 = b - band * cellh, xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
      const colour = (index = band, level = value, alpha = Math.round(45 + 210 * value), age = time) => effectInk(style, index, level, age, alpha);
      if (mode === 'pixel-mosaic') draw.rectangle([x0,y0,x1,y1], colour());
      else if (mode === 'isometric-terrain') {
        if (band % 3 === 0) {const y = y1 - value * cellh * 2;draw.line([x0,y,x1 + cellw * .4,y - cellh * .4], colour(), style.line_width);}
      } else if (mode === 'voxel-city') {
        if (band % 2 === 0) {
          const lift = cellh * Math.max(1, value * 3);
          draw.polygon([[x0,y1],[x0,y1 - lift],[x1,y1 - lift - cellh * .35],[x1,y1 - cellh * .35]], colour());
        }
      } else if (mode === 'frequency-stripes') draw.rectangle([x0,y0,x1,y1], band % 2 ? colour(band + 1, value, Math.round(90 + 165 * value)) : colour());
      else if (mode === 'dot-cloud' || mode === 'bead-grid') {
        const radius = Math.min(cellw, cellh) * (mode === 'dot-cloud' ? .12 + .38 * value : .43);
        draw.ellipse([xc - radius,yc - radius,xc + radius,yc + radius], colour());
      } else if (mode === 'isobands') {
        const grade = Math.round(value * style.segments) / style.segments;
        draw.rectangle([x0,y0,x1,y1], colour(band, grade, Math.round(32 + 223 * grade)));
      } else if (mode === 'negative') draw.rectangle([x0,y0,x1,y1], colour(band, 1 - value, Math.round(255 * (1 - value))));
      else if (mode === 'tape') draw.line([x0,yc,x1,yc], colour(), Math.max(1, Math.round(cellh * .76)));
      else if (mode === 'slit-scan') draw.line([xc,y0,xc,y1], colour(), Math.max(1, Math.round(cellw * .75)));
      else if (mode === 'trails') draw.line([x0,y1,x1,y0 - value * cellh], colour(), style.line_width);
      else if (mode === 'hex-cells') {
        const radius = Math.min(cellw, cellh) * .47;
        draw.polygon(Array.from({length:6}, (_,j) => [xc + radius * Math.cos(Math.PI * j / 3),yc + radius * Math.sin(Math.PI * j / 3)]), colour());
      } else if (mode === 'tunnel') {
        // Tunnel depth and record-groove radius are artistic spatial layouts;
        // their sample index is not a Cartesian elapsed-time coordinate.
        if (band % 3 === 0 && time % 2 === 0) {
          const shrink = (1 - time / nt) * w * .36;
          draw.rectangle([left + shrink,t + shrink * h / Math.max(1,w),r - shrink,b - shrink * h / Math.max(1,w)], null, colour(), style.line_width);
        }
      } else if (mode === 'record-grooves') {
        if (band % 2 === 0) {
          const cx = (left + r) / 2, cy = (t + b) / 2, radius = Math.min(w,h) * (.1 + .4 * time / Math.max(1,nt - 1));
          const start = band * 5 * Math.PI / 180, span = Math.max(10, 120 * value) * Math.PI / 180;
          const points = Array.from({length:25}, (_,j) => [cx + radius * Math.cos(start + span * j / 24),cy + radius * Math.sin(start + span * j / 24)]);
          draw.line(points, colour(), style.line_width);
        }
      } else if (mode === 'quilt') {
        // Axis-only palettes otherwise hide every magnitude change in this
        // branch. Keep the alternating patches, with observed energy in alpha.
        draw.rectangle([x0,y0,x1,y1], colour(band + Math.floor(time / 2) * 2, value, Math.round(45 + 175 * value), 0));
      }
      else if (mode === 'crosshatch') {
        draw.line([x0,y0,x1,y1], colour());
        if (value > .42) draw.line([x0,y1,x1,y0], colour());
      } else if (mode === 'triangle-tiles') draw.polygon((time + band) % 2 ? [[x0,y1],[x1,y1],[xc,y0]] : [[x0,y0],[x1,y0],[xc,y1]], colour());
      else if (mode === 'pixel-rain') draw.rectangle([xc - cellw * .28,y0,xc + cellw * .28,y1], colour());
    });
  });
  grid(draw, area, style);
}

function waveform(draw, frame, area, mode, style, history) {
  if (style.axis >= frame.values.length) throw new RangeError('Selected effect axis is unavailable');
  if (mode === 'phase-trails' && frame.values.length < 2) throw new RangeError('Phase trails require two Rudiment axes');
  const {left,top:t,right:r,bottom:b,width:w,height:h} = area;
  const rows = style.reverse ? [...history].reverse() : history;
  const n = rows.length, mid = (t + b) / 2, colour = (i, level = 1, alpha = 255) => effectInk(style, i, level, 0, alpha);
  const fractions = rows.map(row => timeFraction(frame, row, style.reverse));
  const cells = timeCells(frame, rows, style.reverse).map(([start,end]) => [left + w * start,left + w * end]);
  let values = rows.map(row => clamp(row.values[style.axis] * style.gain, -1, 1));
  if (style.quantize > 1) values = values.map(value => Math.round(value * (style.quantize - 1)) / (style.quantize - 1));
  const points = values.map((value,i) => [left + w * fractions[i],mid - value * h * .46]);
  grid(draw, area, style);
  if (style.baseline) draw.line([left,mid,r,mid], {colour:'#6e84a2',alpha:140 / 255});
  if (['phosphor','echo','horizon','heat-ribbon','channel-braid','butterfly','dna-helix'].includes(mode)) {
    const other = rows.map(row => clamp(row.values[(style.axis + 1) % frame.values.length] * style.gain, -1, 1));
    const second = other.map((value,i) => [left + w * fractions[i],mid - value * h * .42]);
    if (mode === 'phosphor') {
      if (n === 1) draw.line(points, colour(0, Math.abs(values[0])), style.line_width);
      for (let j = 1; j < n; j++) draw.line([points[j - 1],points[j]], colour(j, Math.abs(values[j]), Math.round(255 * ((1 - style.decay) + style.decay * j / n))), style.line_width);
    } else if (mode === 'echo') {
      for (let echo = 4; echo > 0; echo--) draw.line(points.map(([x,y]) => [x,y + echo * h * .035]), colour(echo, 1, Math.round(180 / (echo + 1))), style.line_width);
      draw.line(points, colour(0), style.line_width);
    } else if (mode === 'horizon') {
      for (let echo = 0; echo < 4; echo++) draw.line(points.map(([x,y]) => [x,y + echo * h * .1]), colour(echo, 1, 190 - echo * 38), style.line_width);
    } else if (mode === 'heat-ribbon') {
      draw.polygon([[points[0][0],mid],...points,[points.at(-1)[0],mid]], colour(0, 1, 110));
      if (n === 1) draw.line(points, colour(0, Math.abs(values[0])), style.line_width);
      for (let j = 1; j < n; j++) draw.line([points[j - 1],points[j]], colour(j, Math.abs(values[j])), style.line_width);
    } else if (mode === 'channel-braid') {
      draw.polygon([...points,...[...second].reverse()], colour(2, 1, 70));
      draw.line(points, colour(0), style.line_width);draw.line(second, colour(1), style.line_width);
    } else {
      const reflected = second.map(([x,y]) => [x,2 * mid - y]);
      if (mode === 'butterfly') draw.polygon([...points,...[...reflected].reverse()], colour(0, 1, 110));
      draw.line(points, colour(0), style.line_width);draw.line(reflected, colour(1), style.line_width);
      if (mode === 'dna-helix') for (let j = 0; j < n; j += Math.max(1, Math.floor(n / 20))) draw.line([points[j],reflected[j]], colour(j, 1, 100));
    }
  } else if (['sample-beads','pulse-train','quantised','triggered','dotted-envelope','vertical-scope','block-meter','signal-staircase'].includes(mode)) {
    if (mode === 'triggered') {
      const chronological = style.reverse ? [...values].reverse() : values;
      const crossing = chronological.findIndex((value,i) => i > 0 && chronological[i - 1] < 0 && value >= 0);
      if (crossing < 0) draw.line(points, colour(0), style.line_width);
      else {
        // Explicit oscilloscope trigger alignment is the one Cartesian view
        // that expands its detected crossing-to-current tail. Preserve relative
        // native times within that tail, and reverse only its display direction.
        const trail = chronological.slice(crossing), observed = history.slice(crossing);
        const oldest = observed[0].agePips, span = oldest - observed.at(-1).agePips;
        draw.line(trail.map((value,i) => {
          const fraction = span ? (oldest - observed[i].agePips) / span : 1;
          return [left + w * (style.reverse ? 1 - fraction : fraction),mid - value * h * .46];
        }), colour(0), style.line_width);
      }
    } else if (mode === 'vertical-scope') {
      // Horizontal amplitude is centred in the horizontal viewport; upstream
      // accidentally used its vertical midpoint on rectangular canvases.
      draw.line(values.map((value,i) => [(left + r) / 2 + value * w * .46,t + h * fractions[i]]), colour(0), style.line_width);
    } else if (mode === 'signal-staircase') {
      if (n === 1) draw.line(points, colour(0), style.line_width);
      for (let i = 1; i < n; i++) draw.line([points[i - 1],[points[i][0],points[i - 1][1]],points[i]], colour(i), style.line_width);
    } else points.forEach(([x,y], i) => {
      const value = values[i], fill = colour(i, Math.abs(value)), radius = Math.min(style.bead_radius, w / n * .5);
      const [x0,x1] = cells[i], cellw = x1 - x0;
      if (mode === 'sample-beads') draw.ellipse([x - radius,y - radius,x + radius,y + radius], fill);
      else if (mode === 'pulse-train') draw.line([x,mid,x,y], fill, style.line_width);
      else if (mode === 'quantised') draw.line([x0 + cellw * .225,y,x1 - cellw * .225,y], fill, style.line_width + 1);
      else if (mode === 'dotted-envelope') {
        const distance = Math.abs(value) * h * .46;
        draw.ellipse([x - radius,mid - distance - radius,x + radius,mid - distance + radius], fill);
        draw.ellipse([x - radius,mid + distance - radius,x + radius,mid + distance + radius], fill);
      } else {
        draw.rectangle([x0 + cellw * style.gap / 2,Math.min(mid,y),x1 - cellw * style.gap / 2,Math.max(mid,y)], fill);
      }
    });
  } else if (mode === 'spiral-trace' || mode === 'polar-radar') {
    // Polar/spiral and phase-trail positions are artistic spatial mappings,
    // not Cartesian time axes. Their angle/index layout intentionally remains.
    const cx = (left + r) / 2, cy = (t + b) / 2, outer = Math.min(w,h) * .48;
    const points = values.map((value,i) => {
      const fraction = i / Math.max(1,n - 1), angle = -Math.PI / 2 + fraction * Math.PI * 2 * (mode === 'spiral-trace' ? 2.8 : 1);
      // Retain the spiral's observed amplitude modulation promised by its name;
      // upstream's spiral radius ignored the input values entirely.
      const radius = outer * (mode === 'spiral-trace' ? .12 + .7 * fraction + .12 * value : .48 + .42 * value);
      return [cx + Math.cos(angle) * radius,cy + Math.sin(angle) * radius];
    });
    draw.line(points, colour(0), style.line_width);
    if (mode === 'polar-radar') for (let i = 0; i < n; i += Math.max(1,Math.floor(n / 20))) draw.line([[cx,cy],points[i]], colour(i, 1, Math.round(130 * i / n)));
  } else if (mode === 'phase-trails') {
    rows.forEach((row,i) => {
      const x = left + w * (row.values[0] + 1) / 2, y = t + h * (1 - row.values[1]) / 2, radius = Math.min(style.bead_radius, 3);
      draw.ellipse([x - radius,y - radius,x + radius,y + radius], colour(i, 1, Math.round(255 * ((1 - style.decay) + style.decay * (i + 1) / n))));
    });
  }
}

/** Pure rendering of observed rows: repeated frames produce identical drawing. */
export function drawEffects(context, width, height, frame, renderer, style = validateEffectStyle()) {
  if (!rendererNames.has(renderer)) throw new RangeError('Unknown effect renderer: ' + renderer);
  context.save();
  try {
    if (style.mirror) {context.translate(width, 0);context.scale(-1, 1);}
    withViewport(context, width, height, style, Math.max(style.line_width / 2, style.bead_radius), (area, draw) => {
      if (!frame) return;
      const history = observedHistory(frame, style);
      if (renderer.startsWith('spectrogram-')) spectrogram(draw, frame, area, renderer.slice(12), style, history);
      else if (renderer.startsWith('spectrum-')) spectrum(draw, frame, area, renderer.slice(9), style, history);
      else waveform(draw, frame, area, renderer.slice(9), style, history);
    });
  } finally {context.restore();}
}
