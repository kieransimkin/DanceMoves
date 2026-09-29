// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const inspect=()=>ctx.readout('Paper-plane runtime',window.DanceMovesPaperDreams?.snapshot()||{loaded:false,requiredMeta:{_dance_moves_effect:'paper-planes'}});
  ctx.button('Snapshot planes',inspect);ctx.button('Teardown planes',()=>{window.DanceMovesPaperDreams?.teardown();inspect();});
  ctx.onCleanup(()=>window.DanceMovesPaperDreams?.teardown());
  ctx.readout('Required setup',{meta:ctx.meta,markup:'.ks-epk containing a positioned, clipped .epk-hero',
    compact:'Five planes at <=760px or update:slow',note:'The renderer’s own snapshot version remains 2.6.3; use DanceMoves.version for the plugin version. Reload to remount after teardown.'});
  inspect();return {snapshot:inspect};
}
