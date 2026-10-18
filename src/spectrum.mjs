/** Canvas views of saved StemLab Fourier evidence, sampled by DanceRudiments/WASM. */
import {createRecordingSampler} from './recordings.mjs';
import {SPECTRUM_RENDERERS, validateSpectrumBands, validateSpectrumStyle, analyseSpectrum} from './spectrum-analysis.mjs';

const neutralReasons = new Set(['disabled', 'reduced-motion', 'forced-colors']);
const bounded = (value, fallback, min, max, name, integer = false) => {
  const result = value === undefined ? fallback : value;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < min || result > max || integer && !Number.isInteger(result))
    throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}in [${min}, ${max}]`);
  return result;
};
const frequency = hz => hz >= 1000 ? `${Number((hz / 1000).toFixed(1))}k` : String(Math.round(hz));

/** Drawing uses CSS pixels; the controller owns a bounded high-DPI backing buffer. */
export function drawSpectrum(context, width, height, report, renderer, style) {
  context.clearRect(0, 0, width, height);
  if (style.background) {context.fillStyle = style.background; context.fillRect(0, 0, width, height);}
  if (!report || width < 24 || height < 24) return;
  const radial = ['spectrum-radial', 'spectrum-ring', 'spectrum-spiral'].includes(renderer);
  const labels = style.labels && width >= 180 && height >= 90;
  const left = style.padding + (labels && !radial ? 38 : 0);
  const top = style.padding + (labels ? 12 : 0);
  const right = width - style.padding, bottom = height - style.padding - (labels ? 22 : 0);
  if (left >= right || top >= bottom) return;
  const w = Math.max(1, right - left), h = Math.max(1, bottom - top);
  const n = report.bands.length, step = w / n;
  const level = db => Math.max(0, Math.min(1, (db - style.floor_db) / (style.ceiling_db - style.floor_db)));
  const colour = i => style.colours[i % style.colours.length];
  const y = db => bottom - level(db) * h;
  const lowHz = report.bands[0].low_hz, hzSpan = report.bands[n - 1].high_hz - lowHz;
  const points = report.bands.map((band, i) => [renderer === 'spectrum' ? left + (i + .5) * step :
    left + ((band.low_hz + band.high_hz) / 2 - lowHz) / hzSpan * w, y(band.display_dbfs)]);
  context.lineWidth = style.line_width;
  context.lineJoin = 'round'; context.lineCap = 'round';
  context.font = '11px system-ui, sans-serif';
  if (!radial) {
    for (let row = 0; row <= 3; row++) {
      const db = style.floor_db + (style.ceiling_db - style.floor_db) * row / 3;
      context.strokeStyle = style.label_colour; context.globalAlpha = .15;
      context.beginPath(); context.moveTo(left, y(db)); context.lineTo(right, y(db)); context.stroke();
      context.globalAlpha = 1;
      if (labels) {context.fillStyle = style.label_colour; context.textAlign = 'right'; context.fillText(String(Math.round(db)), left - 7, y(db) + 4);}
    }
    if (labels) {
      context.fillStyle = style.label_colour; context.textAlign = 'left'; context.fillText('dBFS', left, Math.max(11, top - 3));
      context.textAlign = 'center';
      let lastLabel = -Infinity;
      report.bands.forEach((band, i) => {if (points[i][0] - lastLabel >= 65) {context.fillText(`${frequency(band.low_hz)}–${frequency(band.high_hz)}`, points[i][0], bottom + 16);lastLabel = points[i][0];}});
    }
  }
  if (radial) {
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const radius = Math.max(1, Math.min(w, h) / 2 - style.line_width - style.point_radius);
    context.strokeStyle = style.label_colour; context.globalAlpha = .2;
    for (const fraction of [.25, .5, .75, 1]) {context.beginPath();context.arc(cx, cy, radius * fraction, 0, Math.PI * 2);context.stroke();}
    context.globalAlpha = 1;
    const radialPoints = report.bands.map((band, i) => {
      const angle = -Math.PI / 2 + (renderer === 'spectrum-spiral' ? 5 * Math.PI * i / Math.max(1, n - 1) : 2 * Math.PI * i / n);
      const base = renderer === 'spectrum-spiral' ? .12 + i / Math.max(1, n - 1) * .58 : .24;
      const r = radius * (base + level(band.display_dbfs) * (renderer === 'spectrum-spiral' ? .22 : .72));
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, angle, base];
    });
    if (renderer === 'spectrum-radial') radialPoints.forEach(([x, yy, angle, base], i) => {
      context.strokeStyle = colour(i); context.beginPath();context.moveTo(cx + Math.cos(angle) * radius * base, cy + Math.sin(angle) * radius * base);context.lineTo(x, yy);context.stroke();
    });
    else {
      context.strokeStyle = colour(0); context.beginPath();
      radialPoints.forEach(([x, yy], i) => i ? context.lineTo(x, yy) : context.moveTo(x, yy));
      if (renderer === 'spectrum-ring' && n > 2) {context.closePath();context.globalAlpha = .33;context.fillStyle = colour(0);context.fill();context.globalAlpha = 1;}
      context.stroke();
      if (renderer === 'spectrum-spiral' || n === 1) radialPoints.forEach(([x, yy], i) => {context.fillStyle = colour(i);context.beginPath();context.arc(x, yy, 2, 0, Math.PI * 2);context.fill();});
    }
    if (labels) {context.fillStyle = style.label_colour;context.textAlign = 'center';context.fillText(`${frequency(report.bands[0].low_hz)}–${frequency(report.bands[n - 1].high_hz)} Hz · RMS dBFS`, width / 2, height - style.padding - 3);}
  } else if (renderer === 'spectrum') {
    const barWidth = Math.max(.5, step - Math.min(style.gap, step * .8));
    report.bands.forEach((band, i) => {
      const amount = level(band.display_dbfs) * h;
      context.fillStyle = colour(i);
      context.fillRect(points[i][0] - barWidth / 2, bottom - amount, barWidth, amount);
      if (band.held_dbfs > style.floor_db) {
        context.strokeStyle = style.peak_colour; context.lineWidth = 1.5;
        context.beginPath();context.moveTo(points[i][0] - barWidth / 2, y(band.held_dbfs));context.lineTo(points[i][0] + barWidth / 2, y(band.held_dbfs));context.stroke();
      }
    });
  } else if (renderer === 'spectrum-mirror') {
    const mid = (top + bottom) / 2;
    context.lineWidth = style.line_width + 1;
    points.forEach(([x], i) => {const length = level(report.bands[i].display_dbfs) * h / 2;context.strokeStyle = colour(i);context.beginPath();context.moveTo(x, mid - length);context.lineTo(x, mid + length);context.stroke();});
  } else if (renderer === 'spectrum-dots' || renderer === 'spectrum-stems') {
    points.forEach(([x, yy], i) => {
      context.strokeStyle = context.fillStyle = colour(i);
      if (renderer === 'spectrum-stems') {context.beginPath();context.moveTo(x, bottom);context.lineTo(x, yy);context.stroke();}
      context.beginPath();context.arc(x, yy, Math.min(style.point_radius, step * .45), 0, Math.PI * 2);context.fill();
    });
  } else if (renderer === 'spectrum-steps') {
    context.strokeStyle = colour(0);context.beginPath();
    points.forEach(([x, yy], i) => {
      const x0 = i ? (points[i - 1][0] + x) / 2 : left, x1 = i === n - 1 ? right : (x + points[i + 1][0]) / 2;
      if (!i) context.moveTo(x0, yy);else context.lineTo(x0, yy);
      context.lineTo(x1, yy);
    });context.stroke();
  } else {
    context.strokeStyle = context.fillStyle = colour(0); context.beginPath();
    points.forEach(([x, yy], i) => {
      if (!i) context.moveTo(x, yy);
      else context.lineTo(x, yy);
    });
    context.stroke();
    if (renderer === 'spectrum-area') {context.lineTo(points[n - 1][0], bottom);context.lineTo(points[0][0], bottom);context.closePath();context.globalAlpha = .3;context.fill();context.globalAlpha = 1;}
    if (n === 1) {context.beginPath();context.arc(points[0][0], points[0][1], style.point_radius, 0, Math.PI * 2);context.fill();}
  }
  if (!radial && renderer !== 'spectrum-mirror') {
    context.fillStyle = style.peak_colour;
    report.peaks.forEach(peak => {const [x, yy] = points[peak.index];context.beginPath();context.arc(x, yy, 3, 0, Math.PI * 2);context.fill();});
  }
}

/** Per-mount acquisition: no recording requests or song samples at package import. */
export function createSpectrumService(scope, runtime, config) {
  const handles = new Map(), sources = new Map(), targets = new Map();
  let removalObserver = null;
  const host = scope.root.ownerDocument.defaultView;
  function resolveElement(value, name) {
    const element = typeof value === 'string' ? (scope.root.matches(value) ? scope.root : scope.root.querySelector(value)) : value;
    if (!element || element.nodeType !== 1 || element !== scope.root && !scope.root.contains(element)) throw new TypeError(`${name} must belong to this DanceMoves root`);
    return element;
  }
  function recordingUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u001f]/.test(value)) throw new TypeError('recordingUrl must be a bounded HTTP(S) URL');
    const result = new URL(value, host.location.href);
    if (!['http:', 'https:'].includes(result.protocol) || result.username || result.password) throw new TypeError('recordingUrl must be HTTP(S) without credentials');
    result.hash = '';
    return result.href;
  }
  async function prepare(input) {
    const recording = {format: input?.format, schema_version: input?.schema_version,
      pips_per_beat: input?.pips_per_beat, sample_dtype: input?.sample_dtype,
      dimensions: Array.isArray(input?.dimensions) ? [...input.dimensions] : input?.dimensions,
      provenance: typeof input?.provenance === 'string' ? input.provenance : structuredClone(input?.provenance)};
    const sampler = await createRecordingSampler(input);
    // Retain metadata and the native table, not another large JSON sample array.
    return {sampler, recording, samples: new Map(), reports: new Map()};
  }
  function acquire(url) {
    let entry = sources.get(url);
    if (!entry) {
      entry = {refs: 0, abort: new host.AbortController(), promise: null};
      entry.promise = runtime.recordings.load(url, {signal: entry.abort.signal}).then(prepare);
      sources.set(url, entry);
    }
    entry.refs++;
    let released = false;
    return {promise: entry.promise, release() {
      if (released) return;released = true;
      if (--entry.refs === 0) {entry.abort.abort();if (sources.get(url) === entry) sources.delete(url);}
    }};
  }
  function animate(options = {}) {
    if (scope.disposed) throw new Error('DanceMoves mount is destroyed');
    const id = typeof options.id === 'string' ? options.id.trim() : '';
    for (const key of ['clock', 'bpm', 'rate', 'phasePips']) if (Object.hasOwn(options, key)) throw new TypeError('Spectrum clock, rate and origin come from its capture');
    if (handles.get(id)?.snapshot().status === 'error') handles.get(id).destroy();
    if (!id || id.length > 160 || handles.has(id) || runtime.rudiments.get(id)) throw new TypeError('Spectrum requires a unique id of 1..160 characters');
    const target = resolveElement(options.target, 'Spectrum canvas');
    if (target.tagName.toLowerCase() !== 'canvas' || typeof target.getContext !== 'function') throw new TypeError('Spectrum target must be a canvas');
    if (targets.get(target)?.snapshot().status === 'error') targets.get(target).destroy();
    if (targets.has(target)) throw new Error('Spectrum canvas already has an owner');
    const context = target.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    const audio = typeof options.audio === 'string' ? resolveElement(options.audio, 'Spectrum player') : options.audio;
    if (!audio) throw new TypeError('Spectrum requires an audio/player source');
    const renderer = options.renderer ?? 'spectrum';
    if (!SPECTRUM_RENDERERS.includes(renderer)) throw new RangeError('Unknown spectrum renderer');
    const style = validateSpectrumStyle(options.style);
    const historyPips = bounded(options.historyPips, 256, 1, 512, 'historyPips', true);
    const historyStride = bounded(options.historyStride, 1, 1, 120, 'historyStride', true);
    const pixelRatio = bounded(options.pixelRatio, Math.min(3, Math.max(1, host.devicePixelRatio || 1)), .5, 4, 'pixelRatio');
    for (const key of ['enabled', 'offscreen']) if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new TypeError('enabled and offscreen must be boolean');
    if (options.onFrame !== undefined && typeof options.onFrame !== 'function') throw new TypeError('onFrame must be a function');
    let onFrame = options.onFrame;
    const offscreen = options.offscreen !== false;
    if (options.axes !== undefined && (!Array.isArray(options.axes) || !options.axes.length || options.axes.length > 64 ||
      options.axes.some(axis => typeof axis !== 'string' && (!Number.isInteger(axis) || axis < 0 || axis > 63)))) throw new TypeError('axes must be an array of 1..64 dimension names or indexes');
    const axes = options.axes === undefined ? undefined : [...options.axes];
    const reportKey = JSON.stringify([axes ?? null, style, historyPips, historyStride]);
    if ((options.recording !== undefined) === (options.recordingUrl !== undefined)) throw new TypeError('Supply exactly one recording or recordingUrl');
    const url = options.recordingUrl === undefined ? null : recordingUrl(options.recordingUrl);
    let destroyed = false, inner = null, activeData = null, bands = null, observer = null;
    let enabled = options.enabled !== false, paused = false, status = 'loading', error = null, last = null;
    let width = 0, height = 0, scale = 1, revision = 0, drawn = '';
    const attributes = new Map();
    function attribute(name, value) {
      if (!attributes.has(name)) attributes.set(name, {original: target.getAttribute(name)});
      const row = attributes.get(name); row.last = String(value);
      if (target.getAttribute(name) !== row.last) target.setAttribute(name, row.last);
    }
    attribute('role', 'img');
    if (!target.hasAttribute('aria-label')) attribute('aria-label', 'Recorded frequency spectrum');
    attribute('data-dance-moves-spectrum-state', 'loading');
    const figure = target.closest('[data-dance-moves-spectrum-figure]');
    const statusElement = figure && (figure === scope.root || scope.root.contains(figure)) ? figure.querySelector('[data-dance-moves-spectrum-status]') : null;
    const originalStatus = statusElement?.textContent;
    const intrinsicStyles = new Map();
    let lastStatus;
    function state(reason) {
      status = reason; attribute('data-dance-moves-spectrum-state', reason);
      const messages = {loading:'Loading spectrum…',error:'Spectrum unavailable. Check the recording for this song.',destroyed:'Spectrum stopped.',disabled:'Spectrum disabled.', 'reduced-motion':'Spectrum paused for reduced motion.', 'forced-colors':'Spectrum paused for forced colours.', 'outside-recording':'No spectrum data at this position.', 'source-mismatch':'Spectrum source changed. Select the matching song.'};
      const message = messages[reason] || 'Recorded spectrum ready.';
      if (statusElement && message !== lastStatus) {statusElement.textContent = message;lastStatus = message;}
    }
    function resize() {
      const rect = target.getBoundingClientRect();
      width = Math.max(0, rect.width); height = Math.max(0, rect.height);
      scale = Math.min(pixelRatio, Math.sqrt(4194304 / Math.max(1, width * height)));
      attribute('width', Math.max(1, Math.floor(width * scale)));
      attribute('height', Math.max(1, Math.floor(height * scale)));
      // A bare canvas gets its CSS size from its attributes. Preserve that
      // initial layout when enlarging its buffer; independently sized responsive
      // canvases keep their author's CSS and continue following container resizes.
      const after = target.getBoundingClientRect();
      for (const [name, before, actual] of [['width', width, after.width], ['height', height, after.height]]) if (Math.abs(before - actual) > 1) {
        if (!intrinsicStyles.has(name)) intrinsicStyles.set(name, {original: target.style.getPropertyValue(name), priority: target.style.getPropertyPriority(name)});
        const row = intrinsicStyles.get(name);row.last = `${before}px`;target.style.setProperty(name, row.last);
      }
      context.setTransform(scale, 0, 0, scale, 0, 0); revision++; drawn = '';
      inner?.refresh();
    }
    function clear(reason, pip = null, sourceSeconds = null) {
      state(reason); context.clearRect(0, 0, width, height); drawn = '';
      last = {id, renderer, pip, sourceSeconds, reason, report: null}; onFrame?.(last);
    }
    function cleanup() {
      if (destroyed) return;
      destroyed = true; inner?.destroy();inner = null;observer?.disconnect();
      scope.unlisten(host, 'resize', resize);
      acquired?.release();acquired = null;activeData = null;bands = null;last = null;onFrame = null;
      context.clearRect(0, 0, width, height);status = 'destroyed';
      for (const [name, row] of attributes) if (target.getAttribute(name) === row.last) row.original === null ? target.removeAttribute(name) : target.setAttribute(name, row.original);
      for (const [name, row] of intrinsicStyles) if (target.style.getPropertyValue(name) === row.last) row.original ? target.style.setProperty(name, row.original, row.priority) : target.style.removeProperty(name);
      if (statusElement && statusElement.textContent === lastStatus) statusElement.textContent = originalStatus;
      handles.delete(id);targets.delete(target);
      if (!targets.size) {removalObserver?.disconnect();removalObserver = null;}
    }
    const handle = {id, ready: null, destroy: cleanup, teardown: cleanup,
      setEnabled(value) {if (typeof value !== 'boolean') throw new TypeError('enabled must be boolean');if (!destroyed) {enabled = value;inner?.setEnabled(value);}},
      pause() {if (!destroyed) {paused = true;inner?.pause();}},
      resume() {if (!destroyed) {paused = false;inner?.resume();}},
      refresh() {if (!destroyed) inner?.refresh();},
      snapshot() {return {id, type: 'spectrum', renderer, recordingUrl: url, status: destroyed ? 'destroyed' : inner?.snapshot().status === 'error' ? 'error' : ['hidden','offscreen','paused','seeking'].includes(inner?.snapshot().status) ? inner.snapshot().status : status,
        error: error || inner?.snapshot().error || null, destroyed, enabled, paused, pip: last?.pip ?? null, sourceSeconds: last?.sourceSeconds ?? null, report: last?.report ?? null,
        historyPips, historyStride, canvasWidth: target.width, canvasHeight: target.height};}
    };
    let acquired = url ? acquire(url) : null;
    handles.set(id, handle);targets.set(target, handle);
    if (!removalObserver && scope.window.MutationObserver) {
      removalObserver = new scope.window.MutationObserver(() => {
        for (const [canvas, owner] of targets) if (!scope.root.isConnected || !canvas.isConnected || canvas !== scope.root && !scope.root.contains(canvas)) owner.destroy();
      });
      removalObserver.observe(scope.root.ownerDocument.documentElement, {childList: true, subtree: true});
    }
    state('loading');resize();
    if (scope.window.ResizeObserver) {observer = new scope.window.ResizeObserver(resize);observer.observe(target);}
    else scope.listen(host, 'resize', resize);
    handle.ready = (acquired?.promise || prepare(options.recording)).then(data => {
      if (destroyed || scope.disposed) return handle;
      activeData = data;bands = validateSpectrumBands(data.recording, axes);
      const source = runtime.playbackSource(audio);
      const identity = () => JSON.stringify([source.masterSourceUrl || source.currentSrc || source.src || source.element?.currentSrc || source.element?.src || '', source.masterId || '']);
      const initialSource = identity();
      inner = runtime.rudiments.animate({id, root: target, target, audio, clock: 'audio', rudiment: 'circle', amplitude: 0, css: false,
        renderEveryFrame: true, enabled, offscreen,
        render(frame) {
          if (destroyed || !activeData) return;
          // Even a retained native controller must release the song table when
          // its spectrum owner is destroyed; callbacks retain only this slot.
          const capture = activeData.sampler;
          const seconds = Number(frame.audio?.currentTime);
          const pip = Math.floor((seconds - capture.clock.beat_zero_seconds) * capture.clock.bpm / 60 * 64 + 1e-8);
          if (neutralReasons.has(frame.reason)) return clear(frame.reason, pip, seconds);
          if (identity() !== initialSource) return clear('source-mismatch', pip, seconds);
          if (!Number.isFinite(seconds) || pip < capture.clock.start_pip || pip >= capture.clock.start_pip + capture.count) return clear('outside-recording', pip, seconds);
          state(frame.reason);
          const key = `${pip}:${revision}`;
          if (drawn === key) return;
          const cachedKey = `${pip}:${reportKey}`;
          let report = activeData.reports.get(cachedKey);
          if (!report) {
            const selected = position => {
              let values = activeData.samples.get(position);
              if (!values) {values = capture.sample(position);activeData.samples.set(position, values);if (activeData.samples.size > 2048) activeData.samples.delete(activeData.samples.keys().next().value);}
              return bands.map(band => values[band.index]);
            };
            const history = [];
            for (let offset = historyStride; offset < historyPips * historyStride && pip - offset >= capture.clock.start_pip; offset += historyStride)
              history.push({ageSeconds: offset * 60 / (capture.clock.bpm * 64), values: selected(pip - offset)});
            report = analyseSpectrum(bands, selected(pip), history, style);
            for (const band of report.bands) Object.freeze(band);
            for (const peak of report.peaks) Object.freeze(peak);
            Object.freeze(report.bands);Object.freeze(report.peaks);if (report.dominant) Object.freeze(report.dominant);Object.freeze(report);
            activeData.reports.set(cachedKey, report);if (activeData.reports.size > 32) activeData.reports.delete(activeData.reports.keys().next().value);
          }
          drawSpectrum(context, width, height, report, renderer, style);
          drawn = key;last = {id, renderer, pip, sourceSeconds: seconds, reason: frame.reason, report};onFrame?.(last);
        }});
      if (paused) inner.pause();
      return inner.ready.then(() => handle);
    }).catch(failure => {
      if (destroyed || scope.disposed) return handle;
      error = String(failure.message || failure);inner?.destroy();inner = null;activeData = null;bands = null;onFrame = null;
      acquired?.release();acquired = null;
      observer?.disconnect();scope.unlisten(host, 'resize', resize);
      state('error');context.clearRect(0, 0, width, height);
      throw failure;
    });
    handle.ready.catch(() => {});
    return Object.freeze(handle);
  }
  function mountPage() {
    if (!config.spectrumRecordingUrl) return [];
    const canvases = [...(scope.root.matches('canvas[data-dance-moves-spectrum]') ? [scope.root] : []), ...scope.root.querySelectorAll('canvas[data-dance-moves-spectrum]')];
    return canvases.map((target, i) => {
      const audioSelector = target.getAttribute('data-dance-moves-spectrum-audio');
      const audio = audioSelector ? resolveElement(audioSelector, 'Spectrum player') : scope.root.querySelector('audio[data-dance-moves-master]') || scope.root.querySelector('audio,video');
      return animate({id: `${scope.id}:spectrum:${i}`, target, audio, recordingUrl: config.spectrumRecordingUrl,
        renderer: target.getAttribute('data-dance-moves-spectrum-renderer') || target.getAttribute('data-dance-moves-spectrum') || config.spectrumRenderer || 'spectrum'});
    });
  }
  function destroyAll() {for (const handle of [...handles.values()]) handle.destroy();}
  scope.onDispose(destroyAll);
  return Object.freeze({animate, mountPage, get: id => handles.get(id) || null, destroyAll,
    snapshot: () => ({renderers: SPECTRUM_RENDERERS, sources: sources.size, instances: [...handles.values()].map(handle => handle.snapshot())})});
}
