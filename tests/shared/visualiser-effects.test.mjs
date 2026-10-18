import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EFFECT_RENDERERS, validateEffectStyle, drawEffects} from '../../src/visualiser-effects.mjs';

// Geometric command evidence only; the compiled gallery covers real Canvas.
function canvas() {
  let state = {fillStyle:'#000',strokeStyle:'#000',globalAlpha:1,lineWidth:1,
    lineJoin:'miter',lineCap:'butt',transform:[1,0,0,1,0,0]},path=[];
  const stack=[],marks=[];
  function finite(values) {for (const value of values) assert.ok(Number.isFinite(value),'Finite Canvas geometry');}
  function point(name, values) {finite(values);path.push([name,...values]);}
  function mark(kind) {
    assert.ok(state.globalAlpha >= 0 && state.globalAlpha <= 1);
    assert.ok(state.lineWidth > 0 && Number.isFinite(state.lineWidth));
    marks.push({kind,path:structuredClone(path),colour:state[kind==='fill'?'fillStyle':'strokeStyle'],
      alpha:state.globalAlpha,width:kind==='stroke'?state.lineWidth:null,transform:[...state.transform]});
  }
  const ctx={
    save(){stack.push(structuredClone(state));},restore(){assert.ok(stack.length,'Balanced Canvas save/restore');state=stack.pop();},
    clearRect(...values){finite(values);},fillRect(...values){point('rect',values);mark('fill');},
    beginPath(){path=[];},moveTo(...values){point('move',values);},lineTo(...values){point('line',values);},
    rect(...values){point('rect',values);},ellipse(...values){assert.ok(values[2]>=0&&values[3]>=0);point('ellipse',values);},
    quadraticCurveTo(...values){point('curve',values);},closePath(){path.push(['close']);},
    fill(){mark('fill');},stroke(){mark('stroke');},clip(){},
    translate(x,y){finite([x,y]);state.transform[4]+=state.transform[0]*x;state.transform[5]+=state.transform[3]*y;},
    scale(x,y){finite([x,y]);state.transform[0]*=x;state.transform[3]*=y;}
  };
  for (const key of ['fillStyle','strokeStyle','globalAlpha','lineWidth','lineJoin','lineCap'])
    Object.defineProperty(ctx,key,{get:()=>state[key],set:value=>{state[key]=value;}});
  return {ctx,marks,depth:()=>stack.length,state:()=>structuredClone(state)};
}
function freeze(value) {
  if (value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
function fixture({phase=0,count=32,axes=4}={}) {
  const history=Array.from({length:count},(_,i)=>({pip:100+i,agePips:count-i-1,ageSeconds:(count-i-1)/128,
    values:Array.from({length:axes},(_,axis)=>Math.sin((i+phase)*.31+axis*.83)*.83)}));
  return freeze({values:history.at(-1).values,dimensions:Array.from({length:axes},(_,i)=>'axis_'+i),history,
    pip:100+count-1,sourceSeconds:(100+count-1)/128,historySpanPips:count-1,
    bands:Array.from({length:axes},(_,i)=>({index:i,name:'axis_'+i,lowHz:i*100,highHz:(i+1)*100,divisor:1,gain:1,silent:false}))});
}
function timedFixture(ages, span, values = [.4,.3]) {
  const base = fixture({count:ages.length,axes:values.length});
  return freeze({...base,values:[...values],pip:100,historySpanPips:span,
    history:ages.map(agePips=>({pip:100-agePips,agePips,ageSeconds:agePips/128,values:[...values]}))});
}
function render(renderer,frame=fixture(),input={},width=400,height=220) {
  const c=canvas(),before=c.state();
  drawEffects(c.ctx,width,height,frame,renderer,validateEffectStyle(input));
  assert.equal(c.depth(),0);assert.deepEqual(c.state(),before,'Renderer restores Canvas state');
  return c.marks.filter(mark=>mark.colour!=='transparent');
}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} should equal ${expected}`);
function coordinates(marks, axis = 0) {
  return marks.flatMap(mark=>mark.path.flatMap(command=>{
    if (['move','line','ellipse'].includes(command[0])) return [command[axis+1]];
    if (command[0]==='rect') return [command[axis+1],command[axis+1]+command[axis+3]];
    return [];
  }));
}
// These controls produce the explicit test viewport x=1..399, y=1..219.
const timeStyle={padding:0,bead_radius:1,line_width:2};

test('effect catalogue contains the complete frozen 24 + 18 + 18 mode families',()=>{
  assert.equal(EFFECT_RENDERERS.length,60);assert.equal(new Set(EFFECT_RENDERERS).size,60);
  assert.equal(EFFECT_RENDERERS.filter(name=>name.startsWith('spectrum-')).length,24);
  assert.equal(EFFECT_RENDERERS.filter(name=>name.startsWith('spectrogram-')).length,18);
  assert.equal(EFFECT_RENDERERS.filter(name=>name.startsWith('waveform-')).length,18);
  assert.equal(Object.isFrozen(EFFECT_RENDERERS),true);
});
for (const renderer of EFFECT_RENDERERS) test(renderer+' draws observed, deterministic, finite geometry',()=>{
  const frame=fixture(),before=JSON.stringify(frame),drawn=render(renderer,frame);
  assert.ok(drawn.some(mark=>mark.alpha>0),renderer+' has visible geometric marks');
  assert.deepEqual(render(renderer,frame),drawn,'Same sampled frame gives the same drawing');
  assert.notDeepEqual(render(renderer,fixture({phase:3})),drawn,'Changing observed values changes the display');
  assert.equal(JSON.stringify(frame),before,'Drawing never mutates source history');
});
test('the sixty default modes have distinct drawing geometry or ink',()=>{
  const hashes=EFFECT_RENDERERS.map(renderer=>[renderer,hash(render(renderer))]);
  const byHash=new Map();for (const [renderer,digest] of hashes) {
    assert.equal(byHash.has(digest),false,renderer+' duplicates '+byHash.get(digest));byHash.set(digest,renderer);
  }
});
test('effect family styles reject unsupported fields, coercion and bounds violations',()=>{
  for (const value of [null,[],2,'style']) assert.throws(()=>validateEffectStyle(value));
  for (const input of [
    {unknown:1},{line_width:0},{line_width:1.5},{line_width:33},{floor_db:-241},{floor_db:1},
    {floor_db:-12,ceiling_db:-12},{ceiling_db:61},{gain:-1},{gain:9},{gain:'1'},
    {history_limit:3},{history_limit:257},{axis:-1},{axis:256},{segments:1},{segments:65},
    {quantize:65},{gap:1},{fill_alpha:256},{decay:1.01},{bead_radius:.1},{bead_radius:21},
    {perspective:-1},{perspective:1.1},{smoothing:17},{threshold:2},{stride:0},{stride:17},
    {amplitude_curve:'invented'},{colour_map:'invented'},{mirror:1},{reverse:'false'},
    {grid:null},{baseline:undefined},{line_width:Infinity},{threshold:NaN}
  ]) assert.throws(()=>validateEffectStyle(input),JSON.stringify(input));
  const style=validateEffectStyle({floor_db:-240,ceiling_db:60,gain:8,history_limit:256,
    axis:255,segments:64,quantize:64,gap:.95,fill_alpha:255,decay:1,bead_radius:20,
    perspective:1,smoothing:16,threshold:1,stride:16,amplitude_curve:'ease',colour_map:'rainbow'});
  assert.equal(style.gain,8);assert.equal(Object.isFrozen(style),true);
});
test('spectral effects fail closed without calibrated axes; ordinary motion needs none',()=>{
  const frame={...fixture(),bands:undefined};
  for (const renderer of EFFECT_RENDERERS.filter(name=>!name.startsWith('waveform-')))
    assert.throws(()=>render(renderer,frame),/calibrated/);
  assert.ok(render('waveform-phosphor',frame).length);
  assert.throws(()=>render('waveform-phase-trails',fixture({axes:1})),/two Rudiment axes/);
  assert.throws(()=>render('waveform-sample-beads',fixture(),{axis:4}),/axis is unavailable/);
  assert.throws(()=>render('waveform-phosphor',{...frame,history:[]}),/observed source-clocked/);
  assert.throws(()=>render('waveform-phosphor',{...frame,history:[{values:[0]}]}),/dimensions/);
});
test('stride preserves the newest spectrum and history point',()=>{
  const frame=fixture({count:8});
  assert.deepEqual(render('spectrum-capsules',frame,{stride:3}),render('spectrum-capsules',frame));
  const one=freeze({values:[1],dimensions:['x'],history:Array.from({length:8},(_,i)=>({pip:i,agePips:7-i,ageSeconds:(7-i)/128,values:[i===7?1:-1]})),pip:7,sourceSeconds:7/128,historySpanPips:7});
  const marks=render('waveform-sample-beads',one,{stride:3});
  const last=marks.at(-1).path.find(command=>command[0]==='ellipse');
  assert.ok(last[1]>380,'Newest sample keeps the right endpoint');
  assert.ok(last[2]<30,'Newest value is observed +1, not the preceding -1');
});
test('single-sample Cartesian effects keep absent capture time clear at the current edge',()=>{
  const frame=timedFixture([0],100);
  const waveform=EFFECT_RENDERERS.filter(name=>name.startsWith('waveform-')&&
    !['waveform-vertical-scope','waveform-phase-trails','waveform-polar-radar','waveform-spiral-trace'].includes(name));
  const spectrogram=EFFECT_RENDERERS.filter(name=>name.startsWith('spectrogram-')&&
    !['spectrogram-tunnel','spectrogram-record-grooves'].includes(name));
  for (const renderer of [...waveform,...spectrogram]) {
    const normal=coordinates(render(renderer,frame,timeStyle));
    assert.ok(normal.length,renderer+' draws its observed current row');
    assert.ok(normal.every(x=>x>=396&&x<=401),renderer+' does not stretch one sample over missing history');
    const reversed=coordinates(render(renderer,frame,{...timeStyle,reverse:true}));
    assert.ok(reversed.every(x=>x>=0&&x<=4),renderer+' reverses the actual time interval without filling an invented past');
  }
  for (const reverse of [false,true]) {
    const point=render('waveform-sample-beads',frame,{...timeStyle,reverse})[0].path[0];
    close(point[1],reverse?1:399);
    const vertical=render('waveform-vertical-scope',frame,{...timeStyle,reverse})[0].path[0];
    close(vertical[2],reverse?1:219);
  }
});
test('partial and irregular waveform histories preserve native ages and observed fill bounds',()=>{
  const frame=timedFixture([6,2,0],20);
  const expected=[279.6,359.2,399];
  render('waveform-sample-beads',frame,timeStyle).forEach((mark,i)=>close(mark.path[0][1],expected[i]));
  const reversed=[1,40.8,120.4];
  render('waveform-sample-beads',frame,{...timeStyle,reverse:true}).forEach((mark,i)=>close(mark.path[0][1],reversed[i]));
  const vertical=coordinates(render('waveform-vertical-scope',frame,timeStyle),1);
  [153.6,197.2,219].forEach((value,i)=>close(vertical[i],value));
  const fill=render('waveform-heat-ribbon',frame,timeStyle).filter(mark=>mark.kind==='fill');
  assert.ok(coordinates(fill).every(x=>x>=279.6-1e-9),'ribbon fill starts at the first observed sample, not the viewport boundary');
  const strided=timedFixture([12,10,5,2,0],20);
  render('waveform-sample-beads',strided,{...timeStyle,stride:3}).forEach((mark,i)=>close(mark.path[0][1],[160.2,359.2,399][i]));
  assert.notDeepEqual(render('waveform-sample-beads',frame,timeStyle),render('waveform-sample-beads',{...frame,historySpanPips:6},timeStyle));
});
test('spectrogram and meter cells meet at real time midpoints after partial history and stride reduction',()=>{
  const frame=timedFixture([6,2,0],20,[.4]), expected=[[239.8,319.4],[319.4,379.1],[379.1,399]];
  for (const renderer of ['spectrogram-pixel-mosaic','waveform-block-meter']) {
    const marks=render(renderer,frame,{...timeStyle,gap:0});
    assert.equal(marks.length,3);
    marks.forEach((mark,i)=>{
      const rectangle=mark.path[0];assert.equal(rectangle[0],'rect');
      close(rectangle[1],expected[i][0]);close(rectangle[1]+rectangle[3],expected[i][1]);
    });
    const reversed=render(renderer,frame,{...timeStyle,gap:0,reverse:true});
    reversed.forEach((mark,i)=>{
      const rectangle=mark.path[0],opposite=expected[2-i];
      close(rectangle[1],400-opposite[1]);close(rectangle[1]+rectangle[3],400-opposite[0]);
    });
  }
  render('waveform-quantised',frame,timeStyle).forEach((mark,i)=>{
    const width=expected[i][1]-expected[i][0];
    close(mark.path[0][1],expected[i][0]+width*.225);
    close(mark.path[1][1],expected[i][1]-width*.225);
  });
  const single=render('spectrogram-pixel-mosaic',timedFixture([0],100,[.4]),timeStyle)[0].path[0];
  close(single[1],397.01);close(single[3],1.99);
  const strided=render('spectrogram-pixel-mosaic',timedFixture([12,10,5,2,0],20,[.4]),{...timeStyle,stride:3});
  const cells=[[60.7,259.7],[259.7,379.1],[379.1,399]];
  strided.forEach((mark,i)=>{close(mark.path[0][1],cells[i][0]);close(mark.path[0][1]+mark.path[0][3],cells[i][1]);});
});
test('trigger alignment is explicit, preserves relative native times, and mirrors with reverse',()=>{
  const base=timedFixture([7,6,2,0],100,[.4]);
  const frame=freeze({...base,history:base.history.map((row,i)=>({...row,values:[[-.4,.1,.8,.4][i]]}))});
  const ordinary=coordinates(render('waveform-sample-beads',frame,timeStyle));
  assert.ok(ordinary.every(x=>x>370),'the trigger input occupies only its observed part of the window');
  const normal=coordinates(render('waveform-triggered',frame,timeStyle));
  [1,1+398*2/3,399].forEach((x,i)=>close(normal[i],x));
  const reversed=coordinates(render('waveform-triggered',frame,{...timeStyle,reverse:true}));
  normal.forEach((x,i)=>close(reversed[i],400-x));
  const noCrossing=timedFixture([6,2,0],20,[.4]);
  const currentTimes=coordinates(render('waveform-triggered',noCrossing,timeStyle));
  [279.6,359.2,399].forEach((x,i)=>close(currentTimes[i],x));
  const oneTail=timedFixture([1,0],20,[.4]);
  const lastCrossing={...oneTail,history:oneTail.history.map((row,i)=>({...row,values:[i ? .4 : -.4]}))};
  close(coordinates(render('waveform-triggered',lastCrossing,timeStyle))[0],399);
});
test('time effects reject invalid native ages and spans instead of inventing time-axis positions',()=>{
  const frame=timedFixture([6,2,0],20);
  for (const invalid of [
    {...frame,historySpanPips:Infinity},{...frame,historySpanPips:-1},{...frame,historySpanPips:undefined},
    {...frame,history:frame.history.map((row,i)=>({...row,agePips:i===1?7:row.agePips}))},
    {...frame,history:frame.history.map((row,i)=>({...row,agePips:i===1?NaN:row.agePips}))},
    {...frame,history:frame.history.map((row,i)=>({...row,agePips:i===1?-2:row.agePips}))}
  ]) assert.throws(()=>render('waveform-sample-beads',invalid),/finite pip span.*chronological/);
});
test('stationary smoothed spectra have zero band delta',()=>{
  const frame=timedFixture([2,1,0],2,[-1,1,-1]);
  for (const reverse of [false,true]) {
    const marks=render('spectrum-band-delta',frame,{smoothing:1,reverse});
    assert.equal(marks.length,3);
    for (const mark of marks) assert.equal(mark.path[0][4],0,'identical histories cannot acquire movement from unequal smoothing');
  }
});
test('paired waveform gain clamps both selected channels before mapping to the viewport',()=>{
  const frame=timedFixture([3,2,1,0],3,[.8,-.8]);
  for (const renderer of ['waveform-channel-braid','waveform-butterfly','waveform-dna-helix']) {
    const y=coordinates(render(renderer,frame,{...timeStyle,gain:8}),1);
    assert.ok(y.length);assert.ok(y.every(value=>value>=1&&value<=219),renderer+' clamps the paired channel as well as its first channel');
  }
});
test('history reduction retains endpoints and bounds the number of sampled marks',()=>{
  const frame=fixture({count:512}),marks=render('waveform-sample-beads',frame,{history_limit:4,stride:16});
  assert.equal(marks.length,4);
  const centres=marks.map(mark=>mark.path.find(command=>command[0]==='ellipse').slice(1,3));
  assert.ok(centres[0][0]<10);assert.ok(centres.at(-1)[0]>390);
  const huge=render('spectrum-cityscape',fixture(),{},100000000,100000000);
  assert.ok(huge.length<=4*(64+1),'Skyline detail remains bounded at enormous CSS dimensions');
});
test('vertical scope centres correctly on rectangular viewports and spiral uses sampled amplitude',()=>{
  const base=fixture({axes:1,count:4});
  const zero=freeze({...base,values:[0],history:base.history.map(row=>({...row,values:[0]}))});
  const commands=render('waveform-vertical-scope',zero).flatMap(mark=>mark.path).filter(command=>['move','line'].includes(command[0]));
  assert.ok(commands.length>1);assert.ok(commands.every(command=>command[1]===200));
  const changed=freeze({...zero,values:[1],history:zero.history.map(row=>({...row,values:[1]}))});
  assert.notDeepEqual(render('waveform-spiral-trace',changed),render('waveform-spiral-trace',zero));
});
test('one observed row renders without synthesising history, and null frames clear cleanly',()=>{
  for (const renderer of EFFECT_RENDERERS) {
    render(renderer,fixture({count:1}));
    assert.deepEqual(render(renderer,null),[]);
    assert.deepEqual(render(renderer,fixture(),{},0,0),[]);
  }
  assert.throws(()=>render('spectrum-not-a-mode'),/Unknown effect renderer/);
});
test('display controls change ink and geometry without changing sampled history',()=>{
  const frame=fixture(),base=render('spectrum-capsules',frame);
  for (const controls of [{gain:.4},{amplitude_curve:'sqrt'},{quantize:3},{colour_map:'rainbow'},
    {colour_map:'level'},{colour_map:'alternating'},{colour_map:'mono'},
    {reverse:true},{mirror:true},{fill_alpha:10},{smoothing:2},{grid:true}])
    assert.notDeepEqual(render('spectrum-capsules',frame,controls),base,JSON.stringify(controls));
  assert.notDeepEqual(render('waveform-pulse-train',frame,{baseline:true}),render('waveform-pulse-train',frame));
  assert.notDeepEqual(render('spectrogram-pixel-mosaic',frame,{colour_map:'time'}),render('spectrogram-pixel-mosaic',frame));
  assert.ok(render('spectrogram-record-grooves',frame,{colour_map:'time',reverse:true}).length);
});
