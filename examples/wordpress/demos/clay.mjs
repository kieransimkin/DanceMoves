// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const clay=window.DanceMovesClayStars;if(!clay)throw new Error('Clay fixture or production Clay asset is missing.');
  const inspect=()=>ctx.readout('Legacy Clay controller',{defaults:clay.defaults,clay:clay.snapshot()});
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
  ctx.button('Teardown Clay',()=>{clay.teardown();inspect();});
  ctx.onCleanup(()=>{clay.teardown();});
  ctx.readout('Boundary',{demoBpm:ctx.motion.bpm,
    note:'Rudiment selection and tuning are deliberately absent from this reusable-package demo; the consuming page owns them.'});inspect();return {snapshot:inspect};
}
