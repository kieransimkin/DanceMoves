// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const c=window.KSEpkOrientationCore,event={beta:12,gamma:-5};
  const mapper=c.createRollingMapper(2000,1.5);mapper.push({x:-5,y:12},0);mapper.pushBatch({count:2,sumX:10,sumY:4,minX:3,maxX:7,minY:0,maxY:4},100);
  ctx.readout('All scalar/helper APIs',{clamp:c.clamp(2,-1,1),hasMotionData:c.hasMotionData(event),
    mobile:c.isMobileDevice(window),supported:c.sensorSupported(window),permissionRequired:c.permissionRequired(window),
    angle:c.screenAngle(window),aligned:c.screenAligned(event,90),normalised:c.normalise(event,{beta:0,gamma:0},0,20),
    windowPoint:c.mapPointToWindow({x:1,y:2},{minX:-5,maxX:5,minY:-5,maxY:5},1.5),
    smooth:c.smooth({x:0,y:0},{x:1,y:1},.18),timeSmooth:c.smoothTimeBased({x:0,y:0},{x:1,y:1},16,32),mapperSize:mapper.size()});
  const targets=c.createTransitionTargetScheduler({now:()=>performance.now(),intervalMilliseconds:ctx.motion.durationMilliseconds(2),minimumDelta:.02,
    schedule:(fn,ms)=>setTimeout(fn,ms),cancel:id=>clearTimeout(id),commit:(x,y,d)=>ctx.readout('Rate-limited target',{x,y,...d})});
  const raf=c.createLatestSampleRafScheduler({requestFrame:fn=>requestAnimationFrame(fn),cancelFrame:id=>cancelAnimationFrame(id),now:()=>performance.now(),
    mapper:c.createRollingMapper(2000,1.5),commit:(x,y,d)=>targets.receive(x,y,d)});
  ctx.onCleanup(()=>{raf.teardown();targets.teardown();});let n=0;
  ctx.button('Send one bounded input',()=>{n++;raf.receive({beta:n%2?10:-10,gamma:n%2?5:-5},0,performance.now());});
  ctx.button('Inspect schedulers',()=>ctx.readout('Schedulers',{rafPending:raf.pending(),rafCommits:raf.commitCount(),targetPending:targets.pending(),targetCommits:targets.commitCount()}));
  ctx.button('Reset helpers',()=>{mapper.reset();raf.reset();targets.reset();ctx.readout('Mapper size',mapper.size());});
  ctx.button('Stop schedulers',()=>{raf.teardown();targets.teardown();});
  return {snapshot:()=>({mapperSize:mapper.size(),commits:raf.commitCount()})};
}
