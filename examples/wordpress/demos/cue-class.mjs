// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  let effect=ctx.effects.cueClass({id:'demo:cue-class',root:ctx.root,cue:'DROP 1',className:'cue-lit',durationTicks:64,
    render:d=>ctx.readout('Finite accent',{count:d.count,durationMilliseconds:d.durationMilliseconds,cue:d.detail})});
  ctx.onCleanup(()=>effect?.teardown());
  ctx.button('Publish named DROP 1',()=>ctx.motion.fireCue({name:'DROP 1',type:'SECTION',time:104.01}));
  ctx.button('Direct finite accent',()=>effect?.fire({name:'DROP 1',demo:true}));
  ctx.button('Clear',()=>effect?.clear('manual'));ctx.button('Snapshot',()=>ctx.readout('Snapshot',effect?.snapshot()));
  ctx.button('Teardown',()=>{effect?.teardown();effect=null;});
  return {snapshot:()=>effect?.snapshot()};
}
