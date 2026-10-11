import {createOrientationController} from './orientation.mjs';
const connections=new WeakMap();

/** One opt-in sensor owner fans out to page-owned appearance callbacks and pointers. */
export function connectPhoneMotion(scope, {render=()=>{}, pointers=[], enabled=()=>true, controlParent=scope.document.body, watchAttributes=['class'], windowMilliseconds=10000}={}) {
  if(scope.disposed)throw new Error('DanceMoves mount is destroyed');
  if(connections.has(scope))throw new Error('Phone motion is already connected on this mount');
  if(typeof render!=='function'||typeof enabled!=='function')throw new TypeError('Phone motion callbacks must be functions');
  if(!Array.isArray(pointers)||!Array.isArray(watchAttributes))throw new TypeError('Phone motion lists must be arrays');
  const w=scope.window, core=w.KSEpkOrientationCore;
  let destroyed=false, sensorActive=false, pageHidden=false, button=null, timer=0, pending=false, observer=null, source=null, unsubscribe=null;
  const reduced=w.matchMedia('(prefers-reduced-motion: reduce)'),forced=w.matchMedia('(forced-colors: active)');
  const eligible=()=>core.isMobileDevice(w)&&core.sensorSupported(w);
  if(!eligible()){
    const dispose=()=>{destroyed=true;connections.delete(scope);};
    scope.onDispose(dispose);
    const unavailable=Object.freeze({enable:async()=>false,reconcile:()=>{},destroy:dispose,snapshot:()=>({eligible:false,allowed:false,sensorActive:false,destroyed:destroyed||scope.disposed,source:'unavailable',orientation:null})});
    connections.set(scope,unavailable);return unavailable;
  }
  const allowed=()=>eligible()&&!destroyed&&!scope.disposed&&!pageHidden&&!scope.document.hidden&&!reduced.matches&&!forced.matches&&enabled();
  function apply(point) {
    const live=allowed()&&point.reason!=='reset'&&point.reason!=='teardown';
    const x=live?core.clamp(point.x,-1,1):0,y=live?core.clamp(point.y,-1,1):0;
    for(const id of pointers){const pointer=w.DanceMovesEffects.get(id);if(pointer){live?pointer.set(x,y,'phone'):pointer.reset('phone-reset');}}
    render({x,y,reason:live?'phone':'reset'});
    if(live){sensorActive=true;removeButton();}
    else sensorActive=false;
  }
  function removeButton(){if(timer)w.clearTimeout(timer);timer=0;if(button){scope.unlisten(button,'click',enable);button.remove();button=null;}}
  function unavailable(){timer=0;if(!button||sensorActive)return;button.disabled=false;button.textContent=core.permissionRequired(w)?'Use phone motion':'Phone motion unavailable';}
  function makeButton(){if(button||!allowed()||source?.subscribe)return;button=scope.document.createElement('button');button.type='button';button.className='ks-epk-orientation-control';button.textContent='Use phone motion';button.setAttribute('aria-live','polite');scope.listen(button,'click',enable);controlParent.append(button);}
  async function enable(){
    if(!allowed()||pending||!source)return false;
    pending=true;makeButton();if(button){button.disabled=true;button.textContent='Checking motion…';}
    try{await source.enable();if(destroyed)return false;if(button){button.textContent='Move phone to enable…';button.disabled=false;}if(timer)w.clearTimeout(timer);timer=w.setTimeout(unavailable,3500);return true;}
    catch(error){if(button){button.disabled=false;button.textContent=/denied/i.test(error.message)?'Phone motion blocked':'Use phone motion';}return false;}
    finally{pending=false;}
  }
  function reconcile(){
    if(destroyed)return;
    if(source?.subscribe){source.suspend?.(!allowed());if(!allowed())apply({x:0,y:0,reason:'reset'});return;}
    source?.setActive(allowed());
    if(!allowed()){removeButton();apply({x:0,y:0,reason:'reset'});return;}
    if(!sensorActive)makeButton();
    const state=source?.snapshot();
    if(state?.listening&&!timer&&!sensorActive)timer=w.setTimeout(unavailable,3500);
    if(source&&!core.permissionRequired(w)&&core.createOrientationPreference(w).read()!=='disabled'&&!state.enabled)void enable();
  }
  const hide=()=>{pageHidden=true;reconcile();};
  const show=()=>{pageHidden=false;reconcile();};
  const signals=[[scope.document,'visibilitychange',reconcile],[reduced,'change',reconcile],[forced,'change',reconcile],[w,'pagehide',hide],[w,'pageshow',show]];
  signals.forEach(([target,type,handler])=>scope.listen(target,type,handler));
  if(eligible()){
    const existing=w.DanceMoves?.getOrientation?.();
    if(existing?.subscribe){source=existing;unsubscribe=existing.subscribe(apply);}
    else source=createOrientationController(scope,{render:apply,windowMilliseconds});
  }
  if(w.MutationObserver){observer=new w.MutationObserver(records=>{if(w.DanceMoves.root.isConnected===false){destroy();return;}if(records.some(r=>r.type==='attributes'))reconcile();});observer.observe(scope.window.DanceMoves.root,{attributes:true,attributeFilter:watchAttributes});if(scope.document.body!==w.DanceMoves.root)observer.observe(scope.document.body,{attributes:true,attributeFilter:watchAttributes});observer.observe(scope.document.documentElement,{childList:true,subtree:true});}
  function destroy(){if(destroyed)return;removeButton();apply({x:0,y:0,reason:'teardown'});destroyed=true;unsubscribe?.();if(!source?.subscribe)source?.destroy();observer?.disconnect();signals.forEach(([target,type,handler])=>scope.unlisten(target,type,handler));removeDispose();connections.delete(scope);}
  const removeDispose=scope.onDispose(destroy);
  reconcile();
  const connection=Object.freeze({enable,reconcile,destroy,snapshot:()=>({eligible:eligible(),allowed:allowed(),sensorActive,destroyed,pending,source:source?.subscribe?'existing':'generic',orientation:source?.snapshot()||null})});
  connections.set(scope,connection);return connection;
}
