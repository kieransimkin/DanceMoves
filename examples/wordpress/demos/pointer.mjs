// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  let pointer=ctx.effects.pointer({id:'demo:pointer',root:ctx.root,target:ctx.stage,bounds:ctx.stage,
    render:d=>ctx.readout('Pointer',{x:d.x,y:d.y,reason:d.reason})});
  ctx.onCleanup(()=>pointer?.teardown());
  const manual=(x,y)=>{if(pointer&&ctx.accessible())pointer.set(x,y,'manual-demo');};
  ctx.button('Manual upper-left',()=>manual(-1,-1));ctx.button('Manual lower-right',()=>manual(1,1));
  ctx.button('Reset',()=>pointer?.reset('manual-reset'));
  ctx.button('Snapshot',()=>ctx.readout('Pointer snapshot',pointer?.snapshot()||{destroyed:true}));
  ctx.button('Teardown',()=>{pointer?.teardown();pointer=null;});
  ctx.readout('Bounds note','Native pointer handlers honour accessibility; direct set() bypasses those gates, so this manual control checks them first. Remount after position-only layout changes.');
  return {snapshot:()=>pointer?.snapshot()};
}
