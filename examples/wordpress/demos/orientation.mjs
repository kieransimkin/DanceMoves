// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  ctx.select('Adapter',Object.keys(ctx.adapters),key=>{location.search='?adapter='+encodeURIComponent(key);},ctx.adapter);
  const form=ctx.element('section',undefined,ctx.root,'panel');
  const controls={};
  for(const [name,min,max,value]of [['beta',-40,40,0],['gamma',-40,40,0],['angle',0,270,0]]){
    const l=ctx.element('label',name+' ',form);const input=ctx.element('input',undefined,l);input.type='range';input.min=min;input.max=max;input.step=name==='angle'?90:1;input.value=value;controls[name]=input;
    ctx.listen(input,'input',()=>{
      if(!ctx.accessible())return;
      window.ksHarnessScreenAngle=Number(controls.angle.value);
      const event=new Event('deviceorientation');Object.defineProperties(event,{alpha:{value:0},beta:{value:Number(controls.beta.value)},gamma:{value:Number(controls.gamma.value)},absolute:{value:false}});
      window.dispatchEvent(event);ctx.log('synthetic sensor',{isTrusted:event.isTrusted,beta:event.beta,gamma:event.gamma,screenAngle:window.ksHarnessScreenAngle});
      requestAnimationFrame(()=>requestAnimationFrame(inspect));
    });
  }
  function inspect(){ctx.readout('Production wrapper',window.__ksEpkOrientationRuntime?.snapshot()||{available:false,note:'Real phone support/permission or local harness eligibility is required.'});
    ctx.readout('Published CSS targets',[ctx.root,ctx.root.querySelector('.epk-cover-wrap')].map(e=>({selector:e.className,style:e.getAttribute('style'),state:e.dataset.ksOrientation})));}
  ctx.button('Inspect',inspect);ctx.button('Reset runtime',()=>{window.__ksEpkOrientationRuntime?.reset();inspect();});
  ctx.button('Teardown runtime',()=>{window.__ksEpkOrientationRuntime?.teardown();inspect();});
  ctx.onCleanup(()=>window.__ksEpkOrientationRuntime?.teardown());
  ctx.readout('Production setup',{adapter:ctx.adapter,productionPageId:ctx.adapters[ctx.adapter],
    warning:'The local harness selects a mapping explicitly. A new production Page ID is NOT enabled by copying this number into metadata; the PHP map and required release DOM must be extended deliberately.'});inspect();
  return {snapshot:()=>window.__ksEpkOrientationRuntime?.snapshot()};
}
