// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  let latest=null;
  const current=ctx.element('p','Press Play for the current line',ctx.root,'panel');
  const next=ctx.element('p','',ctx.root,'next-lyric');
  const render=d=>{
    latest=d;current.textContent=d.text||'— lyric clear —';
    next.textContent=d.nextVisibleTime===null?'No later sung line':`Next sung line at ${d.nextVisibleTime}s: ${d.nextVisibleText}`;
    ctx.readout('onLyric payload',{time:d.time,text:d.text,index:d.index,nextTime:d.nextTime,nextText:d.nextText,
      nextIndex:d.nextIndex,nextVisibleTime:d.nextVisibleTime,nextVisibleText:d.nextVisibleText,nextVisibleIndex:d.nextVisibleIndex});
  };
  ctx.onCleanup(ctx.motion.onLyric(render,{id:'demo:canonical-lyrics'}));
  ctx.listen(document,'dance-moves-lyric',e=>ctx.log('dance-moves-lyric',{index:e.detail.index,time:e.detail.time}));
  // Core hides its built-in renderer on pause/end but does not send an empty lyric event.
  const hide=()=>{current.hidden=true;next.hidden=true;};
  const show=()=>{current.hidden=false;next.hidden=false;};
  for(const name of ['pause','ended'])ctx.listen(ctx.audio,name,hide);
  ctx.listen(ctx.audio,'play',show);ctx.listen(ctx.audio,'seeking',hide);ctx.listen(ctx.audio,'seeked',()=>{if(!ctx.audio.paused)show();});
  for(const time of [2.89,7.76,7.81,104.01,246.59])ctx.button(`Seek ${time}s`,()=>{ctx.audio.currentTime=time;});
  ctx.readout('Accessible text','The complete readable lyric section remains available. Do not make every sung line an aria-live announcement.');
  return {snapshot:()=>latest};
}
