// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  let timeline=ctx.effects.cueTimeline({id:'demo:timeline',root:ctx.root,audio:ctx.audio,cues:ctx.sections,
    fireOnSeekLanding:true,seekLandingTolerance:.05,maxCrossingGap:1.25,
    onCue:d=>ctx.log('timeline cue',{id:d.cue.id,reason:d.reason,generation:d.generation}),
    render:s=>{
      const current=s.active[0];ctx.root.classList.toggle('interval-active',s.playing&&Boolean(current?.id.includes('drop')));
      ctx.readout('Restored state',{time:s.time,reason:s.reason,playing:s.playing,active:s.active.map(c=>c.id),generation:s.generation});
    }});
  ctx.onCleanup(()=>timeline?.teardown());
  ctx.button('Restore from currentTime',()=>timeline?.restore('manual-restore'));
  ctx.button('Stop timeline (not audio)',()=>timeline?.stop('manual-stop'));
  ctx.button('Start timeline',()=>timeline?.start('manual-start'));
  ctx.button('Snapshot',()=>ctx.readout('Snapshot',timeline?.snapshot()));
  ctx.button('Teardown',()=>{timeline?.teardown();timeline=null;ctx.root.classList.remove('interval-active');});
  ctx.readout('Core versus timeline','Timeline onCue is separate from the file-cue event bus. Seek landings here are opt-in and fire only during playback; paused exact landings are not armed for later play.');
  return {snapshot:()=>timeline?.snapshot()};
}
