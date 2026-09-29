// Educational Arcadians example; no live WordPress mutations.
export async function mount(ctx) {
  const r=window.DanceMovesRudiments;await r.ready();const canvas=ctx.element('canvas',undefined,ctx.stage);canvas.width=480;canvas.height=220;
  ctx.target.hidden=true;const g=canvas.getContext('2d');if(!g)throw new Error('Canvas 2D is unavailable.');
  let handle=null,clock='audio',rate=1,phasePips=0;
  const mount=()=>{handle?.destroy();handle=r.animate({id:'arcadians:canvas',root:ctx.root,target:canvas,rudiment:'helix',clock,audio:ctx.audio,
    rate,phasePips,amplitude:1,css:false,resetOnCue:'DROP 1',renderEveryFrame:false,
    render:d=>{g.clearRect(0,0,480,220);g.beginPath();g.arc(240+d.offset.x*80+d.offset.z*20,110+d.offset.y*65,12+3*d.offset.z,0,Math.PI*2);g.fillStyle='#a9e8c0';g.fill();
      ctx.readout('Native renderer frame',{clock:d.clock,pip:d.pip,sourceBeats:d.sourceBeats,position:d.offset,reason:d.reason});}});handle.ready.catch(e=>ctx.log('error',e.message));};
  ctx.select('Clock',['audio','page','auto'],v=>{clock=v;mount();});
  ctx.select('Pattern rate',['1','0.5','-1'],v=>{rate=Number(v);mount();});
  ctx.select('Phase offset pips',['0','64','-64'],v=>{phasePips=Number(v);mount();});
  ctx.button('Fire DROP 1 reset cue',()=>ctx.motion.fireCue({name:'DROP 1',time:104.01}));
  ctx.button('Snapshot',()=>ctx.readout('Controller',handle.snapshot()));
  ctx.button('Destroy custom renderer',()=>{handle?.destroy();handle=null;g.clearRect(0,0,480,220);});
  ctx.onCleanup(()=>handle?.destroy());mount();return {snapshot:()=>handle?.snapshot()};
}
