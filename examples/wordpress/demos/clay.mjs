// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const clay=window.DanceMovesClayStars;if(!clay)throw new Error('Clay fixture or production Clay asset is missing.');
  const inspect=()=>ctx.readout('Clay + native rudiment',{defaults:clay.defaults,clay:clay.snapshot(),rudiment:window.DanceMovesClayRudiment?.snapshot()});
  ctx.button('Queued motion',()=>{if(ctx.accessible())clay.setMotion({x:.6,y:-.4});});
  ctx.button('Immediate target',()=>{if(ctx.accessible())clay.setMotionTarget({x:-.6,y:.4});});
  ctx.button('Lower visual intensity',()=>{clay.setParameters({masterIntensity:.6,particleReleaseTicks:32});inspect();});
  ctx.button('Disable decoration',()=>{clay.setParameters({enabled:false});inspect();});
  ctx.button('Enable decoration',()=>{clay.setParameters({enabled:true});inspect();});
  ctx.button('Set cue style only',()=>{clay.setCueState({name:'DROP 1',type:'SECTION'});inspect();});
  ctx.button('Reset visual parameters',()=>{clay.reset();inspect();});
  ctx.button('Lifecycle seeking',()=>{clay.lifecycle('seeking');inspect();});
  ctx.button('Lifecycle visible',()=>{clay.lifecycle('visible');inspect();});
  ctx.button('Snapshot',inspect);
  ctx.button('Teardown Clay + rudiment',()=>{window.DanceMovesClayRudiment?.teardown();clay.teardown();inspect();});
  ctx.onCleanup(()=>{window.DanceMovesClayRudiment?.teardown();clay.teardown();});
  ctx.readout('Cadence',{demoBpm:ctx.motion.bpm,nativePatternBeats:4,rate:.5,renderedCycleBeats:8,cycleMs:ctx.motion.durationMilliseconds(128),
    note:'This Arcadians fixture uses 145 BPM. The real Clay page retains its own page BPM. Never copy the demo tempo onto it.'});inspect();return {snapshot:inspect};
}
