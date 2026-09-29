// Educational Arcadians example; no live WordPress mutations.
export async function mount(ctx) {
  const r=window.DanceMoves.rudiments;await r.ready();let handle=null;
  const mount=name=>{handle?.destroy();handle=r.animate({id:'arcadians:rudiment-gallery',root:ctx.root,target:ctx.target,rudiment:name,
    clock:'audio',audio:ctx.audio,amplitude:{x:60,y:42,z:12},rate:1,offscreen:true});
    handle.ready.catch(e=>ctx.log('native-load-error',e.message));ctx.readout('Description and integer samples',{pattern:r.describe(name),negative:r.sample(name,-1),zero:r.sample(name,0),
      oneTickPips:r.pipsFromTicks(1),oneSecondPips:r.pipsFromSeconds(1,ctx.motion.bpm)});};
  ctx.select('Pattern',r.catalogue().map(x=>[x.name,`${x.name} (${x.periodPips} pips)`]),mount,'clay_background');
  ctx.button('Pause controller',()=>handle?.pause());ctx.button('Resume',()=>handle?.resume());ctx.button('Disable',()=>handle?.setEnabled(false));ctx.button('Enable',()=>handle?.setEnabled(true));
  ctx.button('Reset origin',()=>handle?.reset());ctx.button('Refresh current pose',()=>handle?.refresh());
  ctx.button('Controller and service snapshots',()=>ctx.readout('Snapshots',{controller:r.get('arcadians:rudiment-gallery')?.snapshot(),service:r.snapshot()}));
  ctx.button('Destroy controller',()=>{handle?.destroy();handle=null;});ctx.button('Destroy all demo rudiments',()=>{r.destroyAll();handle=null;});
  ctx.onCleanup(()=>handle?.teardown());
  ctx.readout('Native catalogue',r.catalogue());mount('clay_background');return {snapshot:()=>r.snapshot(),mount};
}
