/* DanceMoves rudiment animation API 1.0.0. Movement samples are C++/WASM-owned. */
(function (window, document) {
  'use strict';
  if (!window.DanceMoves || window.DanceMovesRudiments) return;
  const motion = window.DanceMoves;
  const data = window.danceMovesRudimentsNative;
  const catalogue = Object.freeze((data && data.catalogue || []).map((row, index) =>
    Object.freeze({ name: row.name, description: row.description, periodPips: row.periodPips,
      dimensions: row.dimensions, index })));
  const names = new Map(catalogue.map(row => [row.name, row]));
  const instances = new Map();
  const runners = new Set();
  const owners = new WeakMap();
  let native = null, view = null, loading = null, loadError = null;
  let frame = 0, serial = 0, styleElement = null, removalObserver = null, pageHidden = false;

  function emit(name, detail) {
    document.dispatchEvent(new window.CustomEvent(name, { bubbles: true, detail }));
  }
  function number(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(label + ' must be a finite number');
    return value;
  }
  function integer(value, label) {
    number(value, label);
    if (!Number.isSafeInteger(value)) throw new RangeError(label + ' must be a safe integer');
    return value;
  }
  function floorPips(value) { return integer(Math.floor(value + 1e-9), 'pip position'); }
  function bpm(value) {
    const n = number(value === undefined ? motion.bpm : value, 'bpm');
    if (n < 20 || n > 400) throw new RangeError('bpm must be in [20, 400]');
    return n;
  }
  function modulo(value, period) { return ((value % period) + period) % period; }
  function describe(name) { return names.get(name) || null; }
  function info(name) {
    const row = describe(name);
    if (!row) throw new RangeError('Unknown DanceRudiments name: ' + String(name));
    return row;
  }
  function sample(name, pip) {
    const row = info(name);
    integer(pip, 'pip');
    if (!native) throw new Error('DanceMoves rudiments are not ready; await ready() first');
    // Reduce before the i32 boundary; the upstream core uses signed int pips.
    const pointer = native.dr_sample(row.index, modulo(pip, row.periodPips));
    if (!pointer) throw new Error('DanceRudiments native sample failed');
    return { x: view.getFloat64(pointer, true), y: view.getFloat64(pointer + 8, true), z: view.getFloat64(pointer + 16, true) };
  }
  function ready() {
    if (loading) return loading;
    loading = Promise.resolve().then(async () => {
      if (!data || data.schema !== 1 || data.pipsPerBeat !== 64 || !catalogue.length) throw new Error('Missing or incompatible native rudiment bundle');
      if (!window.WebAssembly) throw new Error('WebAssembly is unavailable');
      const binary = window.atob(data.wasmBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const result = await window.WebAssembly.instantiate(bytes, {});
      const ex = result.instance.exports;
      if (ex.dr_abi() !== 1 || ex.dr_count() !== catalogue.length) throw new Error('DanceRudiments WASM ABI mismatch');
      catalogue.forEach(row => {
        if (ex.dr_period(row.index) !== row.periodPips) throw new Error('DanceRudiments period mismatch');
      });
      view = new DataView(ex.memory.buffer);
      native = ex;
      emit('dance-moves-rudiments-ready', { api, version: api.version, upstreamVersion: data.version, upstreamCommit: data.commit });
      return api;
    }).catch(error => {
      loadError = error;
      emit('dance-moves-rudiments-error', { id: null, message: String(error.message || error) });
      throw error;
    });
    return loading;
  }
  function schedule() {
    if (!frame && runners.size) frame = window.requestAnimationFrame(tick);
  }
  function tick() {
    frame = 0;
    Array.from(runners).forEach(run => run());
    schedule();
  }
  function removeRunner(run) {
    runners.delete(run);
    if (!runners.size && frame) { window.cancelAnimationFrame(frame); frame = 0; }
  }
  function element(value, label) {
    const result = typeof value === 'string' ? document.querySelector(value) : value;
    if (!result || result.nodeType !== 1) throw new TypeError(label + ' must resolve to an element');
    return result;
  }
  function listen(target, name, handler, disposers) {
    target.addEventListener(name, handler);
    disposers.push(() => target.removeEventListener(name, handler));
  }
  function preference(query, changed, disposers) {
    const result = window.matchMedia(query);
    if (typeof result.addEventListener === 'function') listen(result, 'change', changed, disposers);
    else { result.addListener(changed); disposers.push(() => result.removeListener(changed)); }
    return result;
  }
  function cssOutput(target, prefix) {
    if (owners.has(target) || target.hasAttribute('data-dance-moves-rudiment-owner')) throw new Error('Target already has a rudiment CSS owner');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'dance-moves-rudiment-values';
      document.head.appendChild(styleElement);
    }
    const sheet = styleElement.sheet;
    if (!sheet) { styleElement.remove(); styleElement = null; throw new Error('Rudiment stylesheet blocked; check style-src CSP'); }
    const token = String(++serial);
    const index = sheet.insertRule('[data-dance-moves-rudiment-owner="' + token + '"]{}', sheet.cssRules.length);
    const rule = sheet.cssRules[index];
    target.setAttribute('data-dance-moves-rudiment-owner', token);
    owners.set(target, rule);
    const previous = {};
    return {
      write(position) {
        ['x', 'y', 'z'].forEach(axis => {
          const value = position[axis].toFixed(6) + 'px';
          if (previous[axis] === value) return;
          // CSSOM, NOT target.style: avoids catalogue's subtree style-attribute observer.
          rule.style.setProperty(prefix + '-' + axis, value, 'important');
          previous[axis] = value;
        });
      },
      destroy() {
        const idx = Array.from(sheet.cssRules).indexOf(rule);
        if (idx >= 0) sheet.deleteRule(idx);
        if (target.getAttribute('data-dance-moves-rudiment-owner') === token) target.removeAttribute('data-dance-moves-rudiment-owner');
        if (owners.get(target) === rule) owners.delete(target);
        if (!sheet.cssRules.length) { styleElement.remove(); styleElement = null; }
      }
    };
  }
  function watchRemoval() {
    if (removalObserver || !window.MutationObserver) return;
    removalObserver = new window.MutationObserver(() => {
      Array.from(instances.values()).forEach(record => {
        if (record.root.isConnected === false || record.target.isConnected === false) record.handle.destroy();
      });
    });
    removalObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  function animate(options) {
    if (!options || typeof options !== 'object') throw new TypeError('animate requires options');
    options = { ...options }; // Registration is immutable even if the caller reuses its object.
    const id = typeof options.id === 'string' ? options.id.trim() : '';
    if (!id || id.length > 160) throw new TypeError('id must contain 1..160 characters');
    if (instances.has(id)) throw new Error('Duplicate rudiment id: ' + id + '; destroy its owner before remounting');
    const row = info(options.rudiment);
    const target = element(options.target, 'target');
    const root = options.root === undefined ? target : element(options.root, 'root');
    if (root !== target && !root.contains(target)) throw new TypeError('target must be inside root');
    const clock = options.clock === undefined ? 'page' : options.clock;
    if (!['page', 'audio', 'auto'].includes(clock)) throw new TypeError('clock must be page, audio or auto');
    const audio = clock === 'page' ? null : element(options.audio, 'audio');
    if (audio && String(audio.tagName).toLowerCase() !== 'audio') throw new TypeError('audio must be an HTMLAudioElement');
    const rate = options.rate === undefined ? 1 : number(options.rate, 'rate');
    if (rate <= 0 || rate > 64) throw new RangeError('rate must be in (0, 64]');
    const phasePips = options.phasePips === undefined ? 0 : integer(options.phasePips, 'phasePips');
    const input = options.amplitude === undefined ? 1 : options.amplitude;
    const amplitude = {};
    ['x', 'y', 'z'].forEach(axis => {
      amplitude[axis] = number(typeof input === 'number' ? input : input && input[axis] === undefined ? 0 : input && input[axis], 'amplitude.' + axis);
      if (Math.abs(amplitude[axis]) > 10000) throw new RangeError('amplitude must stay within +/-10000 pixels');
    });
    const prefix = options.cssPrefix === undefined ? '--dance-moves-rudiment' : options.cssPrefix;
    if (typeof prefix !== 'string' || !/^--[A-Za-z][A-Za-z0-9_-]{0,75}$/.test(prefix)) throw new TypeError('Invalid cssPrefix');
    if (options.render !== undefined && typeof options.render !== 'function') throw new TypeError('render must be a function');
    ['css', 'enabled', 'offscreen', 'renderEveryFrame'].forEach(key => {
      if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new TypeError(key + ' must be boolean');
    });
    if (options.resetOnCue !== undefined && typeof options.resetOnCue !== 'boolean' && typeof options.resetOnCue !== 'string') throw new TypeError('resetOnCue must be boolean or a cue name');
    const useCss = options.css !== false;
    if (useCss && (owners.has(target) || Array.from(instances.values()).some(r => r.target === target && r.useCss))) throw new Error('Target already has a rudiment CSS owner');
    const disposers = [];
    let destroyed = false, enabled = options.enabled !== false, manualPaused = false, visible = true;
    let loaded = false, status = 'loading', error = null, output = null, last = null, updates = 0, publishing = false;
    let anchor = 0, seenAudio = Boolean(audio && !audio.paused), lastClock = null;
    let seekPending = false;
    const reduced = preference('(prefers-reduced-motion: reduce)', () => refresh(), disposers);
    const forced = preference('(forced-colors: active)', () => refresh(), disposers);
    function source() {
      if (audio && !audio.paused) seenAudio = true;
      const useAudio = clock === 'audio' || (clock === 'auto' && seenAudio);
      const mode = useAudio ? 'audio' : 'page';
      if (lastClock !== null && lastClock !== mode) anchor = 0;
      lastClock = mode;
      const tempo = bpm();
      const beats = useAudio ? Math.max(0, Number.isFinite(audio.currentTime) ? audio.currentTime : 0) * tempo / 60
        : motion.currentTick({ clock: 'page' }) / 16;
      return { beats, mode, tempo };
    }
    function blocked() {
      if (!enabled) return 'disabled';
      if (reduced.matches) return 'reduced-motion';
      if (forced.matches) return 'forced-colors';
      if (document.hidden || pageHidden) return 'hidden';
      if (!visible) return 'offscreen';
      if (manualPaused) return 'paused';
      const s = source();
      if (s.mode === 'audio' && (seekPending || audio.seeking)) return 'seeking';
      if (s.mode === 'audio' && (audio.paused || audio.ended)) return audio.ended ? 'ended' : 'audio-paused';
      return null;
    }
    function publish(reason, neutral, force) {
      const s = source();
      const precise = (s.beats - anchor) * 64 * rate + phasePips;
      const positionPips = floorPips(precise);
      const pip = modulo(positionPips, row.periodPips);
      if (!force && !options.renderEveryFrame && last && last.pip === pip && last.clock === s.mode && !neutral) return;
      const offset = neutral ? { x: 0, y: 0, z: 0 } : sample(row.name, pip);
      const position = { x: offset.x * amplitude.x, y: offset.y * amplitude.y, z: offset.z * amplitude.z };
      const detail = {
        id, root, target, audio: s.mode === 'audio' ? audio : null, rudiment: row.name,
        clock: s.mode, sourceBeats: s.beats, bpm: s.tempo, rate,
        pip: neutral ? null : pip, positionPips: neutral ? null : positionPips,
        loopProgress: neutral ? 0 : modulo(precise, row.periodPips) / row.periodPips,
        durationMilliseconds: row.periodPips / 64 / rate * 60000 / s.tempo,
        offset, position, reason
      };
      if (output) output.write(position);
      last = detail; updates++;
      if (options.render) {
        publishing = true;
        try { options.render(detail); } finally { publishing = false; }
      }
    }
    function fail(failure) {
      if (destroyed || status === 'error') return;
      error = String(failure && failure.message || failure); status = 'error';
      removeRunner(run);
      if (output) { output.destroy(); output = null; }
      emit('dance-moves-rudiments-error', { id, message: error });
    }
    function reconcile(force) {
      if (destroyed || !loaded || error) return;
      if (root.isConnected === false || target.isConnected === false) return destroy();
      const reason = blocked();
      const previous = status;
      status = reason || 'running';
      if (reason) removeRunner(run); else { runners.add(run); schedule(); }
      // A seeking cursor can be intermediate: freeze until seeked.
      if (reason === 'seeking' || reason === 'hidden' || reason === 'offscreen' || reason === 'paused') return;
      const neutral = ['disabled', 'reduced-motion', 'forced-colors'].includes(reason);
      if (force || previous !== status || !last) publish(status, neutral, true);
    }
    function refresh() { if (publishing) return; try { reconcile(true); } catch (failure) { fail(failure); } }
    function run() {
      if (destroyed || error) return removeRunner(run);
      try { reconcile(false); if (status === 'running') publish('frame', false, false); }
      catch (failure) { fail(failure); }
    }
    function reset() {
      if (destroyed) return;
      anchor = source().beats;
      refresh();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; status = 'destroyed'; removeRunner(run);
      disposers.splice(0).forEach(dispose => dispose());
      if (output) { output.destroy(); output = null; }
      if (instances.get(id) && instances.get(id).handle === handle) instances.delete(id);
      if (!instances.size && removalObserver) { removalObserver.disconnect(); removalObserver = null; }
    }
    const handle = {
      id,
      ready: null,
      pause() { if (!destroyed) { manualPaused = true; refresh(); } },
      resume() { if (!destroyed) { manualPaused = false; refresh(); } },
      setEnabled(value) { if (typeof value !== 'boolean') throw new TypeError('enabled must be boolean'); if (!destroyed) { enabled = value; refresh(); } },
      reset, refresh, destroy, teardown: destroy,
      snapshot() {
        return { id, rudiment: row.name, status, enabled, clock, rate, phasePips, destroyed, loaded,
          error, updates, pip: last ? last.pip : null, sourceClock: last ? last.clock : null,
          position: last ? { ...last.position } : null, framePending: runners.has(run) && Boolean(frame) };
      }
    };
    instances.set(id, { root, target, handle, useCss, refresh });
    watchRemoval();
    if (audio) {
      ['play', 'playing'].forEach(name => listen(audio, name, () => { seenAudio = true; refresh(); }, disposers));
      ['pause', 'ended', 'ratechange', 'loadedmetadata', 'timeupdate'].forEach(name => listen(audio, name, refresh, disposers));
      listen(audio, 'seeking', () => { seekPending = true; anchor = 0; refresh(); }, disposers);
      listen(audio, 'seeked', () => { seekPending = false; refresh(); }, disposers);
    }
    if (options.resetOnCue) disposers.push(motion.onCue(typeof options.resetOnCue === 'string' ? options.resetOnCue : '*', detail => {
      if (!detail.audio || !audio || detail.audio === audio) reset();
    }, { id: id + ':cue-reset' }));
    if (options.offscreen !== false && window.IntersectionObserver) {
      const observer = new window.IntersectionObserver(entries => { visible = Boolean(entries[0] && entries[0].isIntersecting); refresh(); });
      observer.observe(root); disposers.push(() => observer.disconnect());
    }
    handle.ready = ready().then(() => {
      if (destroyed) return handle;
      try {
        if (useCss) output = cssOutput(target, prefix);
        loaded = true;
        refresh();
        if (error) throw new Error(error);
        return handle;
      } catch (failure) { fail(failure); throw failure; }
    }, failure => { if (!destroyed) fail(failure); throw failure; });
    // Mark rejection handled even for fire-and-forget mounts; callers can still await and catch it.
    handle.ready.catch(() => {});
    return Object.freeze(handle);
  }
  function refreshAll() { Array.from(instances.values()).forEach(record => record.refresh()); }
  document.addEventListener('visibilitychange', refreshAll);
  window.addEventListener('pagehide', () => { pageHidden = true; refreshAll(); });
  window.addEventListener('pageshow', () => { pageHidden = false; refreshAll(); });
  const api = Object.freeze({
    version: '1.0.0', upstreamVersion: data ? data.version : '', upstreamCommit: data ? data.commit : '',
    pipsPerBeat: 64, ticksPerBeat: 16, pipsPerTick: 4,
    ready, catalogue: () => catalogue, describe, sample,
    pipsFromTicks: ticks => floorPips(number(ticks, 'ticks') * 4),
    pipsFromSeconds: (seconds, tempo) => floorPips(number(seconds, 'seconds') * bpm(tempo) * 64 / 60),
    animate,
    get: id => instances.has(id) ? instances.get(id).handle : null,
    snapshot: () => ({ version: '1.0.0', upstreamVersion: data ? data.version : '',
      loaded: Boolean(native), error: loadError ? String(loadError.message || loadError) : null,
      framePending: Boolean(frame), instances: Array.from(instances.values(), record => record.handle.snapshot()) }),
    destroyAll: () => Array.from(instances.values()).forEach(record => record.handle.destroy())
  });
  window.DanceMovesRudiments = api;
  motion.rudiments = api;
}(window, document));
