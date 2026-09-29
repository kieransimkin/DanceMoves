/** Per-mount ownership for the canonical browser modules. No global monkey patches. */
let serial = 0;
const boundMethods = new Set(['getComputedStyle','atob','btoa','matchMedia','scrollTo','scrollBy','requestIdleCallback','cancelIdleCallback']);
export function createScope(root, config, {legacyGlobals = false, nonce, orientation = {}, paperPlanes = {}, catalogue = false, clayPerformance} = {}) {
  const host = root?.ownerDocument?.defaultView;
  if (!host || root.nodeType !== 1) throw new TypeError('root must be an attached browser Element');
  const nativeDocument = host.document;
  const id = `dm${++serial}`;
  const frames = new Set(), timers = new Set(), observers = new Set(), created = new Set(), events = new Set();
  const styles = new Map(), attributes = new Map(), globals = new Map();
  const abort = new host.AbortController();
  const cleanups = new Set();
  let disposed = false;
  const local = Object.create(null);
  const queryAll = selector => {
    if (disposed) return [];
    return [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  };
  const timer = (callback, delay, ...args) => {
    if (disposed) return 0;
    if (typeof callback !== 'function') throw new TypeError('String timers are not supported');
    const token = host.setTimeout(() => { timers.delete(token); if (!disposed) callback(...args); }, delay);
    timers.add(token); return token;
  };
  const clearTimer = token => { timers.delete(token); host.clearTimeout(token); };
  const requestFrame = callback => {
    if (disposed) return 0;
    const token = host.requestAnimationFrame(time => { frames.delete(token); if (!disposed) callback(time); });
    frames.add(token); return token;
  };
  const cancelFrame = token => { frames.delete(token); host.cancelAnimationFrame(token); };
  const trackedObserver = Constructor => Constructor && class extends Constructor {
    constructor(callback, options) { super((...args) => { if (!disposed) callback(...args); }, options); observers.add(this); }
    observe(...args) { if (disposed) return; observers.add(this); return super.observe(...args); }
    disconnect() { observers.delete(this); return super.disconnect(); }
  };
  const overrides = {
    danceMovesConfig: config,
    danceMovesClayPerformanceConfig: clayPerformance || (legacyGlobals ? host.danceMovesClayPerformanceConfig : undefined) || {},
    ksEpkOrientationConfig: {...orientation, pageId: config.pageId, bpm: config.bpm, ticksPerBeat: 16, version: config.version},
    danceMovesPaperDreamsConfig: {...paperPlanes, effect: config.effect, bpm: config.bpm},
    setTimeout: timer, clearTimeout: clearTimer, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame,
    MutationObserver: trackedObserver(host.MutationObserver), ResizeObserver: trackedObserver(host.ResizeObserver),
    IntersectionObserver: trackedObserver(host.IntersectionObserver),
    fetch: (input, options = {}) => {
      if (disposed) return Promise.reject(new Error('DanceMoves mount was destroyed'));
      // All internally owned requests can be cancelled when a React route unmounts.
      const signal = options.signal && host.AbortSignal?.any ? host.AbortSignal.any([abort.signal, options.signal]) : abort.signal;
      return host.fetch(input, {...options, signal});
    }
  };
  Object.assign(local, overrides);
  const ownedGlobal = key => /^(?:DanceMoves|KieranEpkMotion|KSEpkOrientationCore|__ksEpkOrientationRuntime|danceMovesRudimentsNative)/.test(String(key));
  const window = new Proxy(local, {
    has(target, property) {return Object.hasOwn(target, property) || (!ownedGlobal(property) && property in host);},
    get(target, property) {
      if (property === 'window' || property === 'self') return window;
      if (property === 'document') return document;
      if (property === 'addEventListener') return (...args) => host.addEventListener(...args);
      if (property === 'removeEventListener') return (...args) => host.removeEventListener(...args);
      if (property === 'dispatchEvent') return (...args) => host.dispatchEvent(...args);
      if (Object.prototype.hasOwnProperty.call(target, property)) return target[property];
      // Another mounted root's globals must never influence this instance.
      if (ownedGlobal(property)) return undefined;
      const value = host[property];
      return typeof value === 'function' && boundMethods.has(property) ? value.bind(host) : value;
    },
    set(target, property, value) {
      if (disposed) return true;
      target[property] = value;
      if (legacyGlobals && ownedGlobal(property)) {
        if (!globals.has(property)) globals.set(property, {had: Object.hasOwn(host, property), original: host[property]});
        globals.get(property).last = value; host[property] = value;
      }
      return true;
    },
    deleteProperty(target, property) {
      if (legacyGlobals && host[property] === target[property]) delete host[property];
      delete target[property]; return true;
    }
  });
  const document = new Proxy(nativeDocument, {
    get(target, property) {
      if (property === 'documentElement') return legacyGlobals ? target.documentElement : root;
      if (property === 'body') return legacyGlobals ? target.body : root;
      if (property === 'readyState') return 'complete';
      if (property === 'defaultView') return window;
      // Scoped adoption writes computed timings inside this root, never shared stylesheet rules.
      if (property === 'styleSheets' && !legacyGlobals) return [];
      if (property === 'querySelectorAll') return queryAll;
      if (property === 'querySelector') return selector => queryAll(selector)[0] || null;
      if (property === 'getElementById') return wanted => {
        if (disposed) return null;
        if (root.id === wanted) return root;
        return Array.from(root.querySelectorAll('[id]')).find(node => node.id === wanted)
          || [...created].find(node => node.id === wanted) || null;
      };
      if (property === 'createElement' || property === 'createElementNS') return (...args) => {
        if (disposed) throw new Error('DanceMoves mount is destroyed');
        const node = target[property](...args); created.add(node);
        if (nonce && String(node.tagName).toLowerCase() === 'style') node.setAttribute('nonce', nonce);
        return node;
      };
      if (property === 'addEventListener' || property === 'removeEventListener') return (name, ...args) => {
        const eventTarget = !legacyGlobals && /^(?:dance-moves|kieran-epk)/.test(name) ? root : target;
        return eventTarget[property](name, ...args);
      };
      if (property === 'dispatchEvent') return event => disposed ? false : (legacyGlobals ? target : root).dispatchEvent(event);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  function listen(target, type, listener, options) {
    if (disposed || !target?.addEventListener || !listener) return;
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    if ([...events].some(item => item.target === target && item.type === type && item.listener === listener && item.capture === capture)) return;
    let record;
    const expire = () => { if (options && typeof options === 'object' && options.once) events.delete(record); };
    const wrapped = typeof listener === 'function' ? function (...args) { expire(); if (!disposed) return listener.apply(this, args); }
      : {handleEvent(...args) { expire(); if (!disposed) listener.handleEvent(...args); }};
    record = {target,type,listener,wrapped,capture,options}; events.add(record); target.addEventListener(type, wrapped, options);
  }
  function unlisten(target, type, listener, options) {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    for (const record of events) if (record.target === target && record.type === type && record.listener === listener && record.capture === capture) {
      target.removeEventListener(type, record.wrapped, capture); events.delete(record);
    }
  }
  function setAttribute(target, name, value) {
    if (disposed || !target) return;
    let map = attributes.get(target); if (!map) attributes.set(target, map = new Map());
    if (!map.has(name)) map.set(name, {original: target.getAttribute(name)});
    map.get(name).last = value === null ? null : String(value);
    value === null ? target.removeAttribute(name) : target.setAttribute(name, String(value));
  }
  const cssName = name => name.startsWith('--') ? name : name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
  function setStyle(style, name, value, priority = '') {
    if (disposed || !style) return;
    name = cssName(name);
    let map = styles.get(style); if (!map) styles.set(style, map = new Map());
    if (!map.has(name)) map.set(name, {original: style.getPropertyValue(name), priority: style.getPropertyPriority(name)});
    if (value === null || value === undefined) style.removeProperty(name); else style.setProperty(name, String(value), priority);
    map.get(name).last = style.getPropertyValue(name); map.get(name).lastPriority = style.getPropertyPriority(name);
  }
  const api = {
    id, window, document, get disposed() {return disposed;}, get config() {return config;},
    listen, unlisten,
    onDispose(fn) { if (disposed) {fn(); return () => {};} cleanups.add(fn); return () => cleanups.delete(fn); },
    chain(promise, method, ...callbacks) {
      return promise[method](...callbacks.map(callback => typeof callback === 'function' ? (...args) => disposed ? undefined : callback(...args) : callback));
    },
    addMediaListener(target, listener) { if (target?.addEventListener) listen(target, 'change', listener); else if (!disposed && target?.addListener) {target.addListener(listener); events.add({media:true,target,listener});} },
    removeMediaListener(target, listener) { if (target?.removeEventListener) unlisten(target,'change',listener); else {target?.removeListener?.(listener); for (const e of events) if (e.media && e.target === target && e.listener === listener) events.delete(e);} },
    setStyle, removeStyle(style, name) {const old = style?.getPropertyValue(name) || ''; setStyle(style, name, null); return old;},
    setAttribute, removeAttribute(target,name) {setAttribute(target,name,null);},
    dataset(target, name, value) {setAttribute(target, 'data-' + name.replace(/[A-Z]/g, l => '-' + l.toLowerCase()), value);},
    classes(target, operation, ...names) {
      if (disposed || !target) return false;
      const before = target.getAttribute('class');
      let map = attributes.get(target); if (!map) attributes.set(target, map = new Map());
      if (!map.has('class')) map.set('class', {original: before});
      const result = target.classList[operation](...names);
      map.get('class').last = target.getAttribute('class');
      return result;
    },
    snapshot() {return {id,disposed,listeners:events.size,timers:timers.size,frames:frames.size,observers:observers.size,created:created.size};},
    dispose() {
      if (disposed) return;
      disposed = true; abort.abort();
      for (const cleanup of cleanups) {try {cleanup();} catch { /* Complete other cleanup even after a consumer error. */ }}
      cleanups.clear();
      for (const f of frames) host.cancelAnimationFrame(f);
      for (const t of timers) host.clearTimeout(t);
      for (const observer of observers) observer.disconnect();
      for (const e of events) e.media ? e.target.removeListener(e.listener) : e.target.removeEventListener(e.type,e.wrapped,e.capture);
      frames.clear(); timers.clear(); observers.clear(); events.clear();
      for (const [style,map] of styles) for (const [name,r] of map) if (style.getPropertyValue(name) === r.last && style.getPropertyPriority(name) === r.lastPriority) {
        r.original ? style.setProperty(name,r.original,r.priority) : style.removeProperty(name);
      }
      for (const [target,map] of attributes) for (const [name,r] of map) if (target.getAttribute(name) === r.last) {
        r.original === null ? target.removeAttribute(name) : target.setAttribute(name,r.original);
      }
      for (const node of created) node.remove();
      for (const [name,r] of globals) if (host[name] === r.last) {if (r.had) host[name] = r.original; else delete host[name];}
      created.clear(); styles.clear(); attributes.clear(); globals.clear();
    }
  };
  api.setAttribute(root, 'data-dancemoves-scope', id);
  if (!root.classList.contains('ks-epk')) api.classes(root,'add','ks-epk');
  return api;
}
