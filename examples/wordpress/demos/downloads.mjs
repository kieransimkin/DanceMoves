// Educational Arcadians example; no live WordPress mutations.
export async function mount(ctx) {
  const route=ctx.base+'api/download-url';let url='';
  try {url=(await ctx.json(route)).url;}catch(e){ctx.readout('Server required','Use tools/serve-wordpress-examples.py; a static file server cannot simulate download headers.');}
  if(url){const a=ctx.element('a','Download Arcadians through local signed route',ctx.root,'epk-download');a.href=url;a.setAttribute('download','');}
  ctx.button('Inspect GET download headers',async()=>{const r=await fetch(url);ctx.readout('GET headers',{status:r.status,headers:Object.fromEntries(r.headers)});await r.body?.cancel();});
  ctx.button('Inspect HEAD download headers',async()=>{const r=await fetch(url,{method:'HEAD'});ctx.readout('HEAD headers',{status:r.status,headers:Object.fromEntries(r.headers)});});
  ctx.button('Inspect normal byte-range playback',async()=>{const r=await fetch(ctx.audio.src,{headers:{Range:'bytes=0-63'}});ctx.readout('Direct media range',{status:r.status,headers:Object.fromEntries(r.headers),bytes:(await r.arrayBuffer()).byteLength});});
  ctx.readout('Production contract',{markup:'<a href="/wp-content/uploads/your-arcadians.mp3" download>Download MP3</a>',
    boundary:'WordPress rewrites only eligible download anchors using WP_HTML_Tag_Processor. Audio/source URLs remain direct. The simulator has its own random signing key, not a WordPress salt.'});
  return {snapshot:()=>({url,simulated:true})};
}
