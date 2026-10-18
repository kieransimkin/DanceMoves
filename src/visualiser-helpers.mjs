// Canvas adaptations of FrameRudiments at c8d1c9a75630a88324e49a1446820392514092dd.
/*!
 * FrameRudiments visualiser geometry — MIT License
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
import {validateSpectrumStyle} from './spectrum-analysis.mjs';

export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export function reduceRows(rows, limit) {
  if (rows.length <= limit) return rows;
  if (limit === 1) return [rows.at(-1)];
  return Array.from({length: limit}, (_, i) => rows[Math.round(i * (rows.length - 1) / (limit - 1))]);
}
export function frequency(hz, scale) {
  if (scale === 'log' || scale === 'third-octave') return Math.log2(Math.max(1, hz));
  if (scale === 'mel') return 2595 * Math.log10(1 + hz / 700);
  if (scale === 'bark') return 13 * Math.atan(.00076 * hz) + 3.5 * Math.atan((hz / 7500) ** 2);
  if (scale === 'erb') return 21.4 * Math.log10(1 + .00437 * hz);
  return hz;
}
export function numberStyle(input, key, fallback, min, max, integer = false) {
  const value = Object.hasOwn(input, key) ? input[key] : fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value))
    throw new RangeError(`${key} must be ${integer ? 'an integer ' : ''}in [${min}, ${max}]`);
  return value;
}
export function booleanStyle(input, key, fallback) {
  const value = Object.hasOwn(input, key) ? input[key] : fallback;
  if (typeof value !== 'boolean') throw new TypeError(`${key} must be boolean`);
  return value;
}
export function enumStyle(input, key, fallback, choices) {
  const value = Object.hasOwn(input, key) ? input[key] : fallback;
  if (!choices.includes(value)) throw new RangeError(`${key} must be one of ${choices.join(', ')}`);
  return value;
}
export function normaliseBaseStyle(input, allowedKeys, defaults = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new TypeError('Visualiser style must be an object');
  const allowed = new Set(['colours', 'padding', 'background', ...allowedKeys]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new TypeError(`Unsupported visualiser style field: ${key}`);
  const base = {};
  for (const key of ['colours', 'padding', 'background']) {
    if (Object.hasOwn(input, key)) base[key] = input[key];
    else if (Object.hasOwn(defaults, key)) base[key] = defaults[key];
  }
  const checked = validateSpectrumStyle(base);
  return {...input, colours: checked.colours, padding: checked.padding, background: checked.background};
}
export const colourStyle = value => validateSpectrumStyle({colours: [value]}).colours[0];
export const ink = (style, index, alpha = 255) => ({colour: style.colours[((index % style.colours.length) + style.colours.length) % style.colours.length], alpha: clamp(alpha / 255)});
// Compositing a palette colour onto this opaque base gives a deterministic
// heatmap gradient for every supported CSS colour, including named colours.
export const heatInk = (style, index, amount) => ({...ink(style, index, 255 * clamp(amount)), base: '#0a1122'});
export function bandLevels(frame, row, style) {
  if (!frame.bands?.length || frame.bands.length !== row.values.length) throw new TypeError('Visualiser requires calibrated selected Fourier bands');
  return frame.bands.map((band, index) => {
    const rms = band.silent ? 0 : Math.max(0, (row.values[index] / band.gain + 1) / 2 * band.divisor);
    const db = rms > 0 ? 20 * Math.log10(rms) : style.floor_db;
    return clamp((db - style.floor_db) / (style.ceiling_db - style.floor_db) * (style.gain ?? 1));
  });
}
export function peakIndices(levels, threshold = .12, contrast = .04, distance = 1, count = 32) {
  const candidates = [];
  for (let start = 0; start < levels.length;) {
    let end = start;
    while (end + 1 < levels.length && Math.abs(levels[end + 1] - levels[start]) <= 1e-9) end++;
    const around = Math.max(start ? levels[start - 1] : 0, end + 1 < levels.length ? levels[end + 1] : 0);
    if (levels[start] >= threshold && levels[start] > around && levels[start] - around >= contrast)
      candidates.push(Math.floor((start + end) / 2));
    start = end + 1;
  }
  candidates.sort((a, b) => levels[b] - levels[a] || a - b);
  const selected = [];
  for (const index of candidates) if (selected.every(previous => Math.abs(previous - index) >= distance)) {
    selected.push(index);if (selected.length >= count) break;
  }
  return selected;
}

/** Small Canvas painter; scoped alpha never leaks into another renderer. */
export function canvasPainter(context) {
  function paint(colour, stroke, width) {
    if (colour === null || colour === undefined) return;
    const value = typeof colour === 'string' ? {colour, alpha: 1} : colour;
    context.save();
    const apply = (css, alpha) => {
      context.globalAlpha = alpha;
      if (stroke) {context.strokeStyle = css;context.lineWidth = width;context.stroke();}
      else {context.fillStyle = css;context.fill();}
    };
    if (value.base) apply(value.base, 1);
    apply(value.colour, value.alpha ?? 1);
    context.restore();
  }
  function path(points, close) {
    if (!points.length) return false;
    context.beginPath();context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) context.lineTo(points[i][0], points[i][1]);
    if (close) context.closePath();
    return true;
  }
  const painter = {
    line(points, colour, width = 1) {
      if (!points.length) return;
      if (typeof points[0] === 'number') points = Array.from({length: points.length / 2}, (_, i) => [points[i * 2], points[i * 2 + 1]]);
      if (points.length === 1 || points.every(point => point[0] === points[0][0] && point[1] === points[0][1])) {
        const [x, y] = points[0], radius = Math.max(.5, width / 2);
        return painter.ellipse([x - radius, y - radius, x + radius, y + radius], colour);
      }
      if (path(points, false)) paint(colour, true, width);
    },
    polygon(points, fill, outline = null, width = 1) {
      if (path(points, true)) {paint(fill, false);paint(outline, true, width);}
    },
    rectangle([x0, y0, x1, y1], fill, outline = null, width = 1) {
      context.beginPath();context.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      paint(fill, false);paint(outline, true, width);
    },
    ellipse([x0, y0, x1, y1], fill, outline = null, width = 1) {
      context.beginPath();context.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 2 * Math.PI);
      paint(fill, false);paint(outline, true, width);
    },
    roundedRectangle([x0, y0, x1, y1], radius, fill, outline = null, width = 1) {
      const left = Math.min(x0, x1), right = Math.max(x0, x1), top = Math.min(y0, y1), bottom = Math.max(y0, y1);
      const r = Math.min(Math.max(0, radius), (right - left) / 2, (bottom - top) / 2);
      context.beginPath();context.moveTo(left + r, top);context.lineTo(right - r, top);
      context.quadraticCurveTo(right, top, right, top + r);context.lineTo(right, bottom - r);
      context.quadraticCurveTo(right, bottom, right - r, bottom);context.lineTo(left + r, bottom);
      context.quadraticCurveTo(left, bottom, left, bottom - r);context.lineTo(left, top + r);
      context.quadraticCurveTo(left, top, left + r, top);context.closePath();
      paint(fill, false);paint(outline, true, width);
    }
  };
  return painter;
}
export function withViewport(context, width, height, style, margin, callback) {
  context.save();
  try {
    context.clearRect(0, 0, width, height);
    if (style.background) {context.fillStyle = style.background;context.fillRect(0, 0, width, height);}
    // A responsive canvas can temporarily collapse. Do not turn that normal
    // layout state into a failed controller or allocate an oversized viewport.
    const inset = style.padding + margin;
    if (inset * 2 + 1 >= Math.min(width, height)) return;
    context.beginPath();context.rect(style.padding, style.padding, width - style.padding * 2, height - style.padding * 2);context.clip();
    context.lineJoin = 'round';context.lineCap = 'round';
    callback({left: inset, top: inset, right: width - inset, bottom: height - inset,
      width: width - inset * 2, height: height - inset * 2}, canvasPainter(context));
  } finally {context.restore();}
}
