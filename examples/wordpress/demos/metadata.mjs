// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  ctx.readout('Metadata → browser configuration',{stored:ctx.meta,localised:ctx.config});
  ctx.readout('What the core does not store',{audioUrl:'Page audio/source markup',rudiment:'JavaScript animate() options',
    orientation:'Built-in Page-ID mapping, not a metadata selector',diagnostics:'Boot configuration; not editor metadata',
    masterDuration:'Hidden advanced key; not exposed by wp/v2/pages meta'});
  ctx.button('Inspect simulated revision state',async()=>ctx.readout('Local state',await ctx.json(ctx.base+'api/page/'+ctx.feature.id)));
  ctx.button('Show real REST-visible fields',()=>ctx.readout('wp/v2/pages meta fields',Object.fromEntries(Object.entries(ctx.meta).filter(([k])=>k!=='_dance_moves_master_duration_ms'))));
  return {snapshot:()=>({meta:ctx.meta,config:ctx.config})};
}
