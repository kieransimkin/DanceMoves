// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  let pulse=ctx.effects.playbackPulse({id:'demo:pulse',root:ctx.root,audio:ctx.audio,ticks:64,className:'pulse-enabled',propertyPrefix:'--demo-pulse',
    render:d=>ctx.readout('Pulse',{durationSeconds:d.duration,delaySeconds:d.delay,ticks:d.ticks,rate:d.audio.playbackRate})});
  ctx.onCleanup(()=>pulse?.teardown());
  ctx.button('Synchronise phase now',()=>pulse?.sync());ctx.button('Pulse snapshot',()=>ctx.readout('Snapshot',pulse?.snapshot()));
  ctx.button('Teardown pulse',()=>{pulse?.teardown();pulse=null;});
  return {snapshot:()=>pulse?.snapshot()};
}
