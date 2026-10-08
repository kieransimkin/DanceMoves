import installers from './runtime/index.mjs';
import {createScope} from './scope.mjs';
import {validatePageConfig} from './config.mjs';
import {createOrientationController} from './orientation.mjs';
import {createMotionRecorder} from './recorder.mjs';
import {VERSION} from './version.mjs';
export {validatePageConfig, fromWordPressMeta, PAGE_META_KEYS, createMemoryPageStore} from './config.mjs';
export {VERSION};
const mounted = new WeakMap();
export const ORIENTATION_ADAPTERS = Object.freeze(['light-will-win','dying-for-a-diagnosis','presents-and-chocolate','fully-nocturnal','amnesty-honestly','walk-with-me','dmitri-my-talisman','clay-stars','california-screamin','a-whole-new-christmas']);
/** Importing this module never reads window/document. Mount only after a DOM root exists. */
export function createDanceMoves(options = {}) {
  const root = options.root;
  if (!root || root.nodeType !== 1 || !root.ownerDocument?.defaultView) throw new TypeError('createDanceMoves requires a browser root Element');
  const ownerDocument = root.ownerDocument;
  const owners = mounted.get(ownerDocument) || new Set();
  for (const owner of owners) if (owner === root || owner.contains(root) || root.contains(owner)) throw new Error('DanceMoves roots must not overlap; destroy the existing mount first');
  const orientation = options.orientation || {};
  if (orientation.adapter && !ORIENTATION_ADAPTERS.includes(orientation.adapter)) throw new RangeError('Unknown orientation adapter');
  const config = {...validatePageConfig(options), version: VERSION};
  const scope = createScope(root, config, options);
  owners.add(root); mounted.set(ownerDocument,owners);
  let api;
  const w = scope.window;
  function destroy() {
    if (scope.disposed) return;
    const errors = [];
    for (const [value,method] of [[w.__ksEpkOrientationRuntime,'teardown'],[w.DanceMovesPaperDreams,'teardown'],[w.DanceMovesClayStars,'teardown'],[w.DanceMovesRudiments,'destroyAll'],[w.DanceMovesEffects,'teardownAll']]) {
      try {value?.[method]?.();} catch (error) {errors.push(error);}
    }
    scope.dispose(); owners.delete(root);
    // Cleanup errors are observable without preventing React StrictMode remounts.
    if (errors.length) options.onError?.(new AggregateError(errors,'DanceMoves cleanup errors'));
  }
  try {
    installers.core(scope);
    installers.effects(scope);
    installers.orientationCore(scope);
    installers.native(scope);
    installers.rudiments(scope);
    if (options.catalogue === true) installers.catalogue(scope);
    if (options.clay === true) installers.clay(scope);
    if (config.effect === 'paper-planes') {
      if (!options.paperPlanes?.atlasUrl) throw new TypeError('paperPlanes.atlasUrl must point to the shipped plane atlas');
      installers.planes(scope);
    }
    if (orientation.adapter) installers.orientation(scope);
    api = w.DanceMoves;
    Object.assign(api, {
      root, config, effects: w.DanceMovesEffects, rudiments: w.DanceMovesRudiments,
      orientationCore: w.KSEpkOrientationCore,
      getOrientation: () => w.__ksEpkOrientationRuntime || null,
      getClay: () => w.DanceMovesClayStars || null,
      getPaperPlanes: () => w.DanceMovesPaperDreams || null,
      createRecorder: settings => createMotionRecorder(scope, settings),
      createOrientation: settings => createOrientationController(scope, settings), destroy,
      resources: () => scope.snapshot(),
      on(type, callback) {scope.listen(scope.document,type,callback); return () => scope.unlisten(scope.document,type,callback);}
    });
    Object.defineProperty(api,'destroyed',{get:() => scope.disposed});
    api.ready = Promise.resolve(api.ready).then(() => {
      if (!scope.disposed) scope.document.dispatchEvent(new w.CustomEvent('dance-moves-ready', {
        bubbles: true, detail: {runtime: api, version: VERSION}
      }));
      return api;
    });
    api.ready.catch(error => {if (!scope.disposed) options.onError?.(error);});
    return api;
  } catch (error) {destroy(); throw error;}
}
