// Educational Arcadians example; no live WordPress mutations.
export async function mount(ctx) {
  const r=window.DanceMovesRudiments;await r.ready();
  const handle=ctx.own(r.animate({id:'arcadians:a11y',root:ctx.root,target:ctx.target,rudiment:'sway',clock:'auto',audio:ctx.audio,amplitude:60,offscreen:true}));
  await handle.ready;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),forced=matchMedia('(forced-colors: active)');
  const inspect=()=>ctx.readout('Lifecycle',{hidden:document.hidden,reducedMotion:reduced.matches,forcedColors:forced.matches,controller:handle.snapshot()});
  for(const q of [reduced,forced])ctx.listen(q,'change',inspect);ctx.listen(document,'visibilitychange',inspect);
  ctx.button('Disable decoration',()=>{handle.setEnabled(false);inspect();});ctx.button('Re-enable',()=>{handle.setEnabled(true);inspect();});
  ctx.button('Pause controller',()=>{handle.pause();inspect();});ctx.button('Resume controller',()=>{handle.resume();inspect();});
  ctx.button('Inspect actual preferences',inspect);ctx.button('Destroy',()=>{handle.destroy();inspect();});
  ctx.element('p','Scroll past this space to test offscreen suspension; inspect again after returning.',ctx.root,'spacer');
  inspect();return {snapshot:()=>handle.snapshot()};
}
