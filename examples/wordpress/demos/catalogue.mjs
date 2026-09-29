// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const m=ctx.motion;
  ctx.button('Insert authored 175ms transition',()=>{const e=ctx.element('button','New timing-owned control',ctx.stage,'epk-button');e.style.transition='transform 175ms ease';e.addEventListener('click',()=>e.style.transform='translateX(12px)');});
  ctx.button('Apply catalogue pass',()=>ctx.readout('Conversion',m.applyCatalogueTiming()));
  ctx.button('Snapshot through both aliases',()=>ctx.readout('Aliases',{core:m.catalogueTimingSnapshot(),standalone:window.DanceMovesCatalogueTiming.snapshot()}));
  ctx.button('Apply through standalone API',()=>ctx.readout('Apply',window.DanceMovesCatalogueTiming.apply()));
  ctx.button('Remove wildcard animation scope',()=>{m.removeCatalogueAnimationScope();ctx.log('scope','Removed only cue-reset ownership; conversion and observer remain.');});
  ctx.readout('Theme boundary','The spinner in the simulated WordPress toolbar is outside .ks-epk. This demo confines custom timing styles to the EPK; do not treat broad mixed CSS selectors as a strict security sandbox.');
  return {snapshot:()=>m.catalogueTimingSnapshot()};
}
