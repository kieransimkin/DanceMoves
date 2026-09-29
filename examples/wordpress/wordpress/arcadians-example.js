(function () {
  'use strict';
  // Footer enqueue dependencies ensure the real plugin APIs exist first.
  const root=document.querySelector('.ks-epk[data-release="arcadians-demo"]');
  if(!root||root.dataset.exampleOwner==='true')return;
  const audio=root.querySelector('audio'),art=root.querySelector('.example-art');
  if(!audio||!art||!window.DanceMovesEffects||!window.DanceMovesRudiments)return;
  root.dataset.exampleOwner='true';
  let owned=null;
  function mount() {
    if(owned)return;
    const effects=window.DanceMovesEffects;
    const pointer=effects.pointer({id:'arcadians-example:pointer',root,bounds:art,target:art});
    const pulse=effects.playbackPulse({id:'arcadians-example:pulse',root,audio,ticks:64,className:'is-playing'});
    // Supplementary example: native circle on an independently owned decoration.
    const subject=root.querySelector('.example-orbit');
    const rudiment=subject?DanceMovesRudiments.animate({id:'arcadians-example:orbit',root,target:subject,rudiment:'circle',audio,clock:'audio',amplitude:14}):null;
    owned={pointer,pulse,rudiment};root.dataset.exampleMounted='true';
    rudiment?.ready.catch(error=>{root.dataset.rudimentFallback='true';console.warn('Decorative native effect unavailable',error.message);});
  }
  function destroy() {
    if(!owned)return;
    owned.pointer.teardown();owned.pulse.teardown();owned.rudiment?.destroy();
    owned=null;delete root.dataset.exampleMounted;
  }
  window.addEventListener('pagehide',destroy);
  window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
  // Normal document and BFCache ownership. An SPA must additionally remove these
  // two listeners when permanently removing this Page root.
  mount();
}());
