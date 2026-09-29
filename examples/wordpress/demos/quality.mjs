// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  let quality=ctx.effects.quality({id:'demo:quality',root:ctx.root,tiers:['full','constrained','minimal'],initial:0,
    sampleMilliseconds:1600,poorWindows:2,healthyWindows:5,downgradeRatio:.72,recoveryRatio:.9,
    downgradeCooldownMilliseconds:5000,recoveryCooldownMilliseconds:12000,
    render:s=>ctx.readout('Quality output',{tier:s.tier,reason:s.reason,sample:s.sample})});
  ctx.onCleanup(()=>quality?.teardown());
  for(const [n,name]of ['full','constrained','minimal'].entries())ctx.button(`Manual ${name}`,()=>quality?.setTier(n,'manual-demo-not-measurement'));
  ctx.button('Registry get',()=>ctx.readout('Registry instance',ctx.effects.get('demo:quality')?.snapshot()));
  ctx.button('All registry snapshots',()=>ctx.readout('Registry',ctx.effects.snapshot()));
  ctx.button('Registry teardown',()=>{ctx.effects.teardown('demo:quality');quality=null;});
  ctx.button('Teardown all demo-owned effects',()=>{ctx.effects.teardownAll();quality=null;});
  ctx.readout('Measurement limits','Generic quality uses a cadence reference capped at 60 FPS, not Clay’s probation/backoff policy. Media queries remain authoritative; setTier is not a permanent quality lock.');
  return {snapshot:()=>quality?.snapshot()};
}
