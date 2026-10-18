import {createRecordingSampler} from './recordings.mjs';

export function playbackIdentity(source) {
  if (!source) return '';
  return JSON.stringify([source.masterSourceUrl || source.currentSrc || source.src || source.element?.currentSrc || source.element?.src || '',
    source.masterId || '', source.element?.src || source.src || '']);
}

/** One mount owns its recordings and canvases across both public view APIs. */
export function createVisualiserResources(scope, runtime) {
  const sources = new Map(), canvases = new Map(), ids = new Map();
  const host = scope.root.ownerDocument.defaultView;
  let removalObserver = null;
  function resolveElement(value, label) {
    const element = typeof value === 'string' ? (scope.root.matches(value) ? scope.root : scope.root.querySelector(value)) : value;
    if (!element || element.nodeType !== 1 || element !== scope.root && !scope.root.contains(element)) throw new TypeError(`${label} must belong to this DanceMoves root`);
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
    return {sampler, recording, samples: new Map(), reports: new Map(), windows: new Map()};
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
  function assertCanvasAvailable(target) {
    const owner = canvases.get(target);
    if (owner?.snapshot().status === 'error') owner.destroy();
    if (canvases.has(target)) throw new Error('Visualiser canvas already has an owner');
  }
  function assertIdAvailable(id) {
    if (ids.get(id)?.snapshot().status === 'error') ids.get(id).destroy();
    if (ids.has(id)) throw new Error('Visualiser requires a unique id');
  }
  function claimCanvas(target, handle) {
    assertCanvasAvailable(target);assertIdAvailable(handle.id);canvases.set(target, handle);ids.set(handle.id, handle);
    if (!removalObserver && scope.window.MutationObserver) {
      removalObserver = new scope.window.MutationObserver(() => {
        for (const [canvas, owner] of canvases) if (!scope.root.isConnected || !canvas.isConnected || canvas !== scope.root && !scope.root.contains(canvas)) owner.destroy();
      });
      removalObserver.observe(scope.root.ownerDocument.documentElement, {childList: true, subtree: true});
    }
  }
  function releaseCanvas(target) {
    const handle = canvases.get(target);if (handle) ids.delete(handle.id);canvases.delete(target);
    if (!canvases.size) {removalObserver?.disconnect();removalObserver = null;}
  }
  return {prepare, acquire, recordingUrl, resolveElement, assertIdAvailable, assertCanvasAvailable, claimCanvas, releaseCanvas,
    sourceCount: () => sources.size};
}

/** Responsive sizing and authored DOM restoration shared by every Canvas view. */
export function createCanvasSurface(scope, target, context, {type, label, pixelRatio, refresh}) {
  const host = scope.root.ownerDocument.defaultView;
  const attributes = new Map(), intrinsicStyles = new Map();
  const figure = target.closest(`[data-dance-moves-${type}-figure]`);
  const statusElement = figure && (figure === scope.root || scope.root.contains(figure)) ? figure.querySelector(`[data-dance-moves-${type}-status]`) : null;
  const originalStatus = statusElement?.textContent;
  let width = 0, height = 0, revision = 0, observer = null, lastStatus, destroyed = false;
  function attribute(name, value) {
    if (!attributes.has(name)) attributes.set(name, {original: target.getAttribute(name)});
    const row = attributes.get(name);row.last = String(value);
    if (target.getAttribute(name) !== row.last) target.setAttribute(name, row.last);
  }
  attribute('role', 'img');
  if (!target.hasAttribute('aria-label')) attribute('aria-label', label);
  function state(reason) {
    attribute(`data-dance-moves-${type}-state`, reason);
    const noun = type === 'spectrum' ? 'Spectrum' : 'Visualiser';
    const messages = {loading:`Loading ${noun.toLowerCase()}…`,error:`${noun} unavailable. Check the recording or pattern and selected axes.`,
      disabled:`${noun} disabled.`, 'reduced-motion':`${noun} paused for reduced motion.`, 'forced-colors':`${noun} paused for forced colours.`,
      'outside-recording':`No ${noun.toLowerCase()} data at this position.`, 'source-mismatch':`${noun} source changed. Select the matching song.`};
    const message = messages[reason] || (type === 'spectrum' ? 'Recorded spectrum ready.' : 'Rudiment visualiser ready.');
    if (statusElement && message !== lastStatus) {statusElement.textContent = message;lastStatus = message;}
  }
  function resize() {
    if (destroyed) return;
    const rect = target.getBoundingClientRect();
    width = Math.max(0, rect.width);height = Math.max(0, rect.height);
    const scale = Math.min(pixelRatio, Math.sqrt(4194304 / Math.max(1, width * height)));
    attribute('width', Math.max(1, Math.floor(width * scale)));
    attribute('height', Math.max(1, Math.floor(height * scale)));
    const after = target.getBoundingClientRect();
    for (const [name, before, actual] of [['width', width, after.width], ['height', height, after.height]]) if (Math.abs(before - actual) > 1) {
      if (!intrinsicStyles.has(name)) intrinsicStyles.set(name, {original: target.style.getPropertyValue(name), priority: target.style.getPropertyPriority(name)});
      const row = intrinsicStyles.get(name);row.last = `${before}px`;target.style.setProperty(name, row.last);
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);revision++;refresh();
  }
  function stop() {observer?.disconnect();observer = null;scope.unlisten(host, 'resize', resize);}
  const surface = {state, clear() {context.clearRect(0, 0, width, height);}, stop,
    get width() {return width;}, get height() {return height;}, get revision() {return revision;},
    destroy() {
      if (destroyed) return;destroyed = true;stop();surface.clear();
      for (const [name, row] of attributes) if (target.getAttribute(name) === row.last) row.original === null ? target.removeAttribute(name) : target.setAttribute(name, row.original);
      for (const [name, row] of intrinsicStyles) if (target.style.getPropertyValue(name) === row.last) row.original ? target.style.setProperty(name, row.original, row.priority) : target.style.removeProperty(name);
      if (statusElement && statusElement.textContent === lastStatus) statusElement.textContent = originalStatus;
      refresh = () => {};
    }
  };
  state('loading');resize();
  if (scope.window.ResizeObserver) {observer = new scope.window.ResizeObserver(resize);observer.observe(target);}
  else scope.listen(host, 'resize', resize);
  return surface;
}

export function cachedSample(data, pip) {
  let values = data.samples.get(pip);
  if (!values) {
    values = Object.freeze(data.sampler.sample(pip));data.samples.set(pip, values);
    if (data.samples.size > 2048) data.samples.delete(data.samples.keys().next().value);
  }
  return values;
}
export function freezeSpectrumReport(report) {
  for (const row of [...report.bands, ...report.peaks]) Object.freeze(row);
  Object.freeze(report.bands);Object.freeze(report.peaks);if (report.dominant) Object.freeze(report.dominant);
  return Object.freeze(report);
}
