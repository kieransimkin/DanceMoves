/** Explicit, permission-gated sensor capture; no upload until the caller requests one. */
export function createMotionRecorder(scope, {durationMilliseconds = 30000, maxSamples = 500} = {}) {
  if (scope.disposed) throw new Error('DanceMoves mount is destroyed');
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 1000 || durationMilliseconds > 120000) throw new RangeError('durationMilliseconds must be 1000..120000');
  if (!Number.isInteger(maxSamples) || maxSamples < 2 || maxSamples > 500) throw new RangeError('maxSamples must be 2..500');
  const w = scope.window, core = w.KSEpkOrientationCore;
  let started = null, samples = [], processed = 0, timer = 0, last = null, resolveDone = null, state = 'idle', pending = false;
  let elapsed = 0;
  const storageInterval = durationMilliseconds / (maxSamples - 1);
  const now = () => w.performance.now();
  function receive(event) {
    if (state !== 'recording' || !core.hasMotionData(event)) return;
    processed++;
    const sample = {milliseconds: Math.min(120000,Math.max(0,now()-started)),alpha:Number.isFinite(event.alpha)?event.alpha:null,
      beta:event.beta,gamma:event.gamma,absolute:!!event.absolute,screenAngle:core.screenAngle(w),nativeTrusted:event.isTrusted === true,
      simulatedTrusted:false,fieldParity:false,dispatchParity:false,mapperParity:false};
    last = sample;
    if (samples.length < maxSamples - 1 && (!samples.length || sample.milliseconds - samples.at(-1).milliseconds >= storageInterval)) samples.push(sample);
  }
  function result() {
    return {schema:'ks-epk-motion-recording/v1',capturedAt:new Date().toISOString(),userAgent:w.navigator.userAgent,
      screenAngle:core.screenAngle(w),targetDurationMilliseconds:durationMilliseconds,captureDurationMilliseconds:elapsed,
      sampledDurationMilliseconds:samples.at(-1)?.milliseconds || 0,processedPairCount:processed,storedSampleCount:samples.length,
      storageIntervalMilliseconds:storageInterval,sampleStrategy:'time-decimated',fullWindowObserved:elapsed>=durationMilliseconds-100,
      expectedDifference:'This recorder does not claim simulator parity or physical performance certification.',passed:false,
      failureCount:0,failures:[],samples:samples.map(s=>({...s}))};
  }
  function stop(reason='stopped') {
    if (state !== 'recording' && !pending) return result();
    pending = false;
    elapsed = started === null ? 0 : Math.min(120000,Math.max(0,now()-started));
    scope.unlisten(w,'deviceorientation',receive);
    w.clearTimeout(timer); timer = 0;
    if (last && last !== samples.at(-1)) samples.push(last);
    state = reason;
    const output = result(); resolveDone?.(output); resolveDone = null; return output;
  }
  scope.onDispose(() => stop('destroyed'));
  return Object.freeze({
    async start() {
      if (scope.disposed) throw new Error('Mount is destroyed');
      if (pending || state === 'recording') throw new Error('A capture is already running');
      if (!core.sensorSupported(w)) throw new Error('Device orientation requires a supported secure browser');
      pending = true;
      try {
        if (core.permissionRequired(w) && await w.DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('Motion permission denied');
        if (!pending || scope.disposed) throw new Error('Capture was cancelled');
        started=now(); elapsed=0; samples=[]; processed=0; last=null; state='recording'; pending=false;
        const done=new Promise(resolve=>{resolveDone=resolve;});
        scope.listen(w,'deviceorientation',receive,{passive:true}); timer=w.setTimeout(()=>stop('complete'),durationMilliseconds);
        return done;
      } catch(error) {pending=false;state='error';throw error;}
    },stop,
    snapshot: () => ({state,pending,sampleCount:samples.length,processedCount:processed}),
    async upload(endpoint, {headers = {}, signal} = {}) {
      if (state === 'recording' || pending || !samples.length) throw new Error('Finish a non-empty capture before upload');
      const target = new URL(endpoint,w.location.href);
      if (target.origin !== w.location.origin) throw new Error('Capture uploads must be same-origin');
      const response=await w.fetch(target.href,{method:'POST',credentials:'same-origin',signal,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(result())});
      if (!response.ok) throw new Error(`Capture upload failed (${response.status})`);
      return response.json();
    }
  });
}
