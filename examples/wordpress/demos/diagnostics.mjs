// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const m=ctx.motion;const records=[];
  m.setDiagnosticsSink(record=>{records.push(record);if(records.length>50)records.shift();});
  ctx.onCleanup(()=>m.setDiagnosticsSink(null));
  ctx.onCleanup(m.onCue('DROP 1',()=>ctx.log('named-handler','diagnostic span'),{id:'arcadians:diagnostic-drop'}));
  ctx.onCleanup(m.onLyric(d=>ctx.log('lyric',{index:d.index,time:d.time}),{id:'arcadians:diagnostic-lyric'}));
  ctx.button('Fire instrumented cue',()=>m.fireCue({name:'DROP 1',time:104.01}));
  ctx.button('Schedule attributed callback',()=>ctx.onCleanup(m.scheduleAtInterval(16,()=>{}, {clock:'page',id:'arcadians:diagnostic-start'})));
  ctx.button('Inspect bounded records',()=>ctx.readout('Records',{enabled:m.diagnosticsEnabled(),records}));
  ctx.button('Disable diagnostics sink',()=>{m.setDiagnosticsSink(null);ctx.readout('Enabled',m.diagnosticsEnabled());});
  ctx.readout('Boot-only option',{diagnostics:ctx.config.diagnostics,note:'Set danceMovesConfig.diagnostics before the core executes, in a development harness only. No page-meta key enables this.'});
  return {snapshot:()=>({enabled:m.diagnosticsEnabled(),records:[...records]})};
}
