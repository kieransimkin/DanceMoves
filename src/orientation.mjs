/** Generic phone input composed from the existing mapper and frame scheduler. */
export function createOrientationController(scope,{render,windowMilliseconds=2000,minimumSpanDegrees=1.5,smoothingTimeConstantMilliseconds=32}={}) {
  if (scope.disposed) throw new Error('DanceMoves mount is destroyed');
  if(typeof render!=='function')throw new TypeError('render callback is required');
  for(const [name,value] of Object.entries({windowMilliseconds,minimumSpanDegrees,smoothingTimeConstantMilliseconds}))if(!Number.isFinite(value)||value<=0)throw new RangeError(name);
  const w=scope.window,core=w.KSEpkOrientationCore;
  let enabled=false,listening=false,destroyed=false,pending=false;
  const reduced=w.matchMedia('(prefers-reduced-motion: reduce)'),forced=w.matchMedia('(forced-colors: active)');
  const scheduler=core.createLatestSampleRafScheduler({requestFrame:w.requestAnimationFrame,cancelFrame:w.cancelAnimationFrame,
    now:()=>w.performance.now(),mapper:core.createRollingMapper(windowMilliseconds,minimumSpanDegrees),smoothingTimeConstantMilliseconds,
    commit:(x,y,detail)=>{if(!destroyed)render({x,y,...detail});}});
  const receive=event=>scheduler.receive(event,core.screenAngle(w),w.performance.now());
  const reset=()=>{scheduler.reset();if(!destroyed)render({x:0,y:0,reason:'reset'});};
  const reconcile=()=>{
    const active=enabled&&!destroyed&&!scope.disposed&&!scope.document.hidden&&!reduced.matches&&!forced.matches;
    if(active&&!listening){scope.listen(w,'deviceorientation',receive,{passive:true});listening=true;}
    if(!active&&listening){scope.unlisten(w,'deviceorientation',receive);listening=false;reset();}
  };
  const disposers=[
    ()=>scope.unlisten(scope.document,'visibilitychange',reconcile),
    ()=>scope.unlisten(reduced,'change',reconcile),()=>scope.unlisten(forced,'change',reconcile),
    ()=>scope.unlisten(w,'orientationchange',reset)
  ];
  scope.listen(scope.document,'visibilitychange',reconcile);scope.listen(reduced,'change',reconcile);scope.listen(forced,'change',reconcile);scope.listen(w,'orientationchange',reset);
  function destroy(){if(destroyed)return;enabled=false;reconcile();destroyed=true;pending=false;scheduler.teardown();disposers.forEach(fn=>fn());removeDispose();}
  const removeDispose=scope.onDispose(destroy);
  return Object.freeze({
    async enable(){
      if(destroyed||scope.disposed)throw new Error('Orientation controller is destroyed');
      if(pending)throw new Error('Permission request is pending');
      if(!core.sensorSupported(w))throw new Error('Device orientation is unavailable in this browser or insecure context');
      pending=true;
      try{
        if(core.permissionRequired(w)&&await w.DeviceOrientationEvent.requestPermission()!=='granted')throw new Error('Motion permission denied');
        if(destroyed||scope.disposed)throw new Error('Orientation controller is destroyed');
        enabled=true;reconcile();return true;
      }finally{pending=false;}
    },
    disable(){enabled=false;reconcile();},reset,destroy,
    snapshot:()=>({enabled,listening,destroyed,pending,reducedMotion:reduced.matches,forcedColors:forced.matches,framePending:scheduler.pending()})
  });
}
