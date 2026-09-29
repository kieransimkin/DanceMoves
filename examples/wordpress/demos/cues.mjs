// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const m=ctx.motion;
  // The catalogue adopts the entire EPK by default. Remove that one scope so
  // this demonstration can show a narrow, explicit scope. It is not a CSS undo.
  m.removeCatalogueAnimationScope?.();
  const spin=ctx.element('div',undefined,ctx.stage,'owned-spin');
  ctx.onCleanup(m.registerAnimationScope(ctx.root,['.owned-spin']));
  ctx.onCleanup(m.onCue('DROP 1',d=>ctx.log('named DROP 1 handler',d),{id:'demo:drop-one'}));
  ctx.onCleanup(m.onCue('*',d=>ctx.log('wildcard handler',d),{id:'demo:all-cues'}));
  for(const name of ['dance-moves-cue','kieran-epk-cue'])ctx.listen(document,name,e=>ctx.log(name,e.detail));
  ctx.button('Fire DROP 1 manually',()=>m.fireCue({name:'DROP 1',type:'SECTION',time:104.01}));
  ctx.button('Reset only owned animations',()=>ctx.readout('Reset count',m.resetRunningAnimations(ctx.audio)));
  ctx.button('Exact paused cue landing',()=>{ctx.audio.pause();ctx.audio.currentTime=104.01;ctx.log('landing','Press Play to dispatch the armed core cue.');});
  ctx.readout('Parsers',{normalised:m.normaliseCueName('Drop-1!'),
    cue:m.parseTimingFile('[01:44.01][SECTION: DROP 1]'),
    lyrics:m.parseLyricTimingFile('[00:02.89]No crown, no concrete\n[00:07.76]'),
    legacyAlias:window.KieranEpkMotion===m});
  return {snapshot:()=>({ownedTime:spin.getAnimations()[0]?.currentTime})};
}
