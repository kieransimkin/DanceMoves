// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const {root,audio,effects,readout}=ctx;
  // Adapted from tools/stage-central-effects-migrations.js, NOT a claim that
  // this markup or every API below is deployed on the public Arcadians page.
  const setSection=time=>{
    const s=ctx.sections.find(s=>time>=s.time&&time<s.end)||ctx.sections[0];
    root.dataset.era=s.data.era;root.dataset.arcSection=s.id;
    readout('Journey state',{section:s.data.label,era:s.data.era,time});
  };
  const pointer=ctx.own(effects.pointer({id:'arcadians:demo:pointer',root,bounds:ctx.stage,target:ctx.stage,
    render:({x,y})=>{root.style.setProperty('--arc-x',x.toFixed(3));root.style.setProperty('--arc-y',y.toFixed(3));}}));
  ctx.own(effects.playbackPulse({id:'arcadians:demo:pulse',root,audio,ticks:64,className:'is-playing',propertyPrefix:'--arc-pulse',
    render:({audio:player})=>setSection(player.currentTime)}));
  ctx.own(effects.quality({id:'arcadians:demo:quality',root,tiers:['full','reduced','minimal'],sampleMilliseconds:1500,
    render:s=>{root.dataset.arcQuality=s.tier;if(s.tier==='minimal')pointer.reset('quality-minimal');}}));
  ctx.button('Inspect real-page-style instances',()=>readout('Shared effects',effects.snapshot()));
  setSection(audio.currentTime);
  return {setSection,snapshot:()=>effects.snapshot()};
}
