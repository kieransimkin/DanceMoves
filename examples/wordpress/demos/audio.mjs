// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const second=ctx.element('audio',undefined,ctx.root);second.controls=true;second.preload='metadata';second.src=ctx.audio.src;
  const report=()=>ctx.readout('Duration-based discovery',[ctx.audio,second,...ctx.root.querySelectorAll('audio[data-demo-excerpt]')].map(a=>({duration:a.duration,bound:a.dataset.danceMovesTiming||'not bound',paused:a.paused})));
  ctx.listen(second,'loadedmetadata',()=>{ctx.motion.discoverAudio();report();});
  ctx.listen(ctx.audio,'loadedmetadata',()=>{ctx.motion.discoverAudio();report();});
  ctx.button('Discover newly inserted audio',()=>{ctx.motion.discoverAudio();report();});
  let made=false;
  ctx.button('Create an 8-second Arcadians excerpt',async()=>{
    if(made)return;
    const response=await fetch(ctx.audio.src);if(!response.ok)throw new Error('Prepare the Arcadians MP3 first.');
    const ac=new AudioContext();let buffer;
    try{buffer=await ac.decodeAudioData(await response.arrayBuffer());}finally{await ac.close();}
    const frames=Math.min(buffer.length,Math.floor(buffer.sampleRate*8)),channels=buffer.numberOfChannels;
    const bytes=new ArrayBuffer(44+frames*channels*2),v=new DataView(bytes);const text=(o,t)=>[...t].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
    text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,frames*channels*2,true);
    const samples=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
    for(let i=0;i<frames;i++)for(let c=0;c<channels;c++)v.setInt16(44+(i*channels+c)*2,Math.max(-32768,Math.min(32767,Math.round(samples[c][i]*32767))),true);
    const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));ctx.onCleanup(()=>URL.revokeObjectURL(url));
    const short=ctx.element('audio',undefined,ctx.root);short.controls=true;short.dataset.demoExcerpt='true';ctx.listen(short,'loadedmetadata',()=>{ctx.motion.discoverAudio();report();});short.src=url;made=true;
  });
  report();return {snapshot:report};
}
