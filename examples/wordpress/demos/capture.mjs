// Educational Arcadians example; no live WordPress mutations.
export function mount(ctx) {
  const payload={schema:'ks-epk-motion-recording/v1',durationMilliseconds:1000,processedPairCount:1,
    samples:[{t:0,beta:10,gamma:5,alpha:0,absolute:false,isTrusted:false}],passed:false,
    expectedDifference:'Synthetic demo input only; NOT evidence from physical hardware.'};
  const send=async body=>{const r=await fetch(ctx.base+'api/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    ctx.readout('Local REST simulation',{httpStatus:r.status,response:await r.json()});};
  ctx.readout('Synthetic request',payload);
  ctx.button('Submit synthetic fixture locally',()=>send(payload));
  ctx.button('Reject invalid fixture',()=>send({schema:'wrong',samples:[]}));
  ctx.readout('Privacy boundary','This example does not request phone permissions, contains no production token, and sends only synthetic data to 127.0.0.1. It does not claim WordPress private storage or reproduce production authentication.');
  return {snapshot:()=>({simulated:true,payload})};
}
