// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const m=ctx.motion;let removers=[];
  const callback=d=>ctx.log('musical-boundary',d);
  const own=remove=>{removers.push(remove);return remove;};
  const cancel=()=>{removers.splice(0).forEach(remove=>remove());ctx.log('cancelled','All example registrations removed');};
  ctx.onCleanup(cancel);
  ctx.button('Next page beat',()=>own(m.scheduleAtInterval(16,callback,{clock:'page',id:'demo:page-beat'})));
  ctx.button('Next audio beat',()=>own(m.onNextBeat(callback,{id:'demo:next-beat'})));
  ctx.button('Every audio beat',()=>own(m.onEveryBeat(callback,{id:'demo:every-beat'})));
  ctx.button('Next audio bar',()=>own(m.onNextBar(callback,{id:'demo:next-bar'})));
  ctx.button('Every audio bar',()=>own(m.onEveryBar(callback,{id:'demo:every-bar'})));
  ctx.button('Next 3-beat interval',()=>own(m.onNextInterval(callback,48,{id:'demo:next-three'})));
  ctx.button('Every 3-beat interval',()=>own(m.onEveryInterval(callback,48,{id:'demo:every-three'})));
  ctx.button('Defer an entrance',()=>{
    const e=ctx.element('span','On the next page beat',ctx.stage);
    e.style.animation='demo-enter var(--dance-moves-16t) ease both';
    e.setAttribute('data-dance-moves-start-interval','16');
    own(m.deferStart(e,16,{clock:'page',id:'demo:entrance',start:callback}));
    // Dynamic elements need explicit deferStart: initial declarative scanning has already happened.
  });
  ctx.button('Cancel registrations',cancel);
  ctx.readout('Declarative markup','<div data-dance-moves-start-interval="64" data-dance-moves-start-clock="audio">…</div>');
  return {cancel,snapshot:()=>({registrations:removers.length})};
}
