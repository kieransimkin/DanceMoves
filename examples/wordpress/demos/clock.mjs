// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const m=ctx.motion;
  ctx.readout('Units',{bpm:m.bpm,bpmSource:m.bpmSource,ticksPerBeat:m.ticksPerBeat,
    oneTickMs:m.durationMilliseconds(1),oneBeatMs:m.durationMilliseconds(16),fourBeatBarMs:m.durationMilliseconds(64),
    longQuantisation:[16,17,23,24,32,48].map(n=>({input:n,quantised:m.quantizeTicks(n),ms:m.durationMilliseconds(n)})),
    nextBoundary:m.nextIntervalTick(16,17,true)});
  const inspect=()=>ctx.readout('Clock comparison',{page:m.currentTick({clock:'page'}),
    audioOrPageFallback:m.currentTick({clock:'audio',audio:ctx.audio}),
    strictAudioTicks:ctx.audio.currentTime*m.bpm*16/60,
    note:'Core currentTick(audio) falls back to page time while paused; use media.currentTime for a frozen playhead.'});
  ctx.button('Read clocks',inspect);ctx.listen(ctx.audio,'timeupdate',inspect);inspect();
  return {snapshot:inspect};
}
