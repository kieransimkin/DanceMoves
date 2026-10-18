import test from 'node:test';
import assert from 'node:assert/strict';
import {SPRITE_RENDERERS, SPRITE_LIMITS, validateSpriteStyle, createSpriteBank,
  drawSprites, processSpritePixels} from '../../src/visualiser-sprites.mjs';
import {validateSpectrumBands} from '../../src/spectrum-analysis.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

const digest = 'ab'.repeat(32), close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' differs from ' + expected);
function contextTrace() {
  const calls = [], stack = [];
  const fields = ['globalAlpha','globalCompositeOperation','fillStyle','strokeStyle','lineWidth','lineCap','lineJoin',
    'imageSmoothingEnabled','imageSmoothingQuality','filter'];
  const context = {globalAlpha:.3,globalCompositeOperation:'source-over',fillStyle:'#000000',strokeStyle:'#ffffff',
    lineWidth:7,lineCap:'butt',lineJoin:'miter',imageSmoothingEnabled:true,imageSmoothingQuality:'low',filter:'none',
    save() {stack.push(Object.fromEntries(fields.map(key => [key,this[key]])));calls.push(['save']);},
    restore() {assert.ok(stack.length);Object.assign(this,stack.pop());calls.push(['restore']);}
  };
  for (const name of ['clearRect','fillRect','beginPath','rect','clip','translate','rotate','transform','drawImage']) {
    context[name] = (...args) => {
      if (name !== 'drawImage') assert.ok(args.every(Number.isFinite),name + ' must receive finite geometry');
      calls.push([name,...args]);
    };
  }
  return {context,calls,stack};
}
function fakeBank(custom = false, columns = 8, rows = 8) {
  const stamps = [];
  const bank = {width:768,height:768,columns,rows,custom,sha256:digest,
    stamp(context,{style,...settings}) {
      assert.ok(Object.isFrozen(style));
      assert.ok(['x','y','width','height','angle','opacity'].every(key => Number.isFinite(settings[key])));
      assert.ok(settings.index >= 0 && settings.index < columns * rows);
      assert.ok(settings.width >= 1 && settings.width <= 1024 && settings.height >= 1 && settings.height <= 1024);
      assert.ok(settings.opacity >= 0 && settings.opacity <= 1);
      stamps.push(settings);
    }
  };
  return {bank,stamps};
}
function motionFrame(count = 48, dimensions = 2) {
  const history = Array.from({length:count},(_,index) => ({pip:index,agePips:count - index - 1,ageSeconds:null,
    values:Array.from({length:dimensions},(_,axis) => Math.sin(index * (.23 + axis * .11) + axis) * .85)}));
  return {values:history.at(-1).values,history,historySpanPips:Math.max(1,count - 1),pip:count - 1,
    spriteFrame:95,sourceSeconds:95/60,dimensions:Array.from({length:dimensions},(_,axis) => 'axis_' + axis)};
}
function spectralFrame(count = 48) {
  const recording = createSpectrumRecording({count});
  const history = recording.samples.map((values,pip) => ({values,pip,agePips:count - pip - 1,ageSeconds:(count - pip - 1)/128}));
  return {values:history.at(-1).values,history,pip:count - 1,sourceSeconds:95/60,spriteFrame:95,
    historySpanPips:Math.max(1,count - 1),dimensions:recording.dimensions,bands:validateSpectrumBands(recording)};
}
function render(renderer, frame, input = {}, {width = 360,height = 280,custom = false,columns = 8,rows = 8} = {}) {
  const trace = contextTrace(), fake = fakeBank(custom,columns,rows), style = validateSpriteStyle(input,renderer);
  const report = drawSprites(trace.context,width,height,{...frame,assets:{sprite:fake.bank}},renderer,style);
  assert.equal(trace.stack.length,0);assert.equal(trace.context.globalAlpha,.3);assert.equal(trace.context.lineWidth,7);
  return {...trace,...fake,report,style};
}

test('sprite catalogue has exactly 52 frozen independent names and strict original defaults', () => {
  assert.equal(SPRITE_RENDERERS.length,52);assert.equal(new Set(SPRITE_RENDERERS).size,52);
  assert.ok(Object.isFrozen(SPRITE_RENDERERS));
  for (const [prefix,count] of [['sprite-spectrum-',20],['sprite-spectrogram-',12],['sprite-waveform-',12],['sprite-motion-',8]])
    assert.equal(SPRITE_RENDERERS.filter(name => name.startsWith(prefix)).length,count);
  const s = validateSpriteStyle();
  assert.equal(s.sprite_theme,'lcd');assert.equal(s.shape,'segment');assert.equal(s.sprite_index,0);
  assert.equal(s.segment_count,12);assert.equal(s.sprite_size,12);assert.equal(s.sprite_opacity,1);
  assert.equal(s.animation_frames,1);assert.equal(s.animation_stride,6);assert.equal(s.sprite_spin,0);
  assert.equal(s.history_limit,64);assert.equal(s.max_stamps,8000);assert.equal(s.padding,4);
  assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.colours));assert.equal(validateSpriteStyle(s),s);
  assert.equal(validateSpriteStyle({},'sprite-spectrum-led-radial').sprite_theme,'generated-neon');
  assert.equal(validateSpriteStyle({},'sprite-motion-icon-grid').sprite_theme,'arcade');
  assert.equal(validateSpriteStyle({},'sprite-motion-icon-grid').pixelated,true);
  const palette = ['red','blue'], checked = validateSpriteStyle({colours:palette});
  palette[0] = 'black';assert.equal(checked.colours[0],'red');
  const rounded = validateSpriteStyle({sprite_posterize:2.5,sprite_pixel_size:3.5,sprite_outline:1.5,sprite_palette_shift:-1.5});
  assert.equal(rounded.sprite_posterize,2);assert.equal(rounded.sprite_pixel_size,4);assert.equal(rounded.sprite_outline,2);assert.equal(rounded.sprite_palette_shift,-2);
});

test('sprite styles reject unsupported and invalid controls, assets, grids and colours', () => {
  for (const input of [null,[],{fake:1},{gain:2},{sprite_theme:'unknown'},{shape:'fake'},
    {sprite_colour:'rainbow'},{sprite_blend:'copy'},{orientation:'diagonal'},{mirror:1},{pixelated:'false'},
    {sprite_asset:'unhashed.png'},{sprite_asset:{url:'/atlas.png',sha256:'bad'}},
    {sprite_asset:{url:'javascript:alert(1)',sha256:digest}},
    {sprite_columns:33},{sprite_rows:0},{sprite_columns:4},{sprite_rows:4},{sprite_index:64},{sprite_size:1},{sprite_size:2.5},
    {animation_frames:9},{animation_stride:0},{segment_count:65},{max_stamps:25001},
    {inner_radius:.8,outer_radius:.7},{floor_db:-30,ceiling_db:-30},
    {sprite_outline_colour:'url(https://example.invalid)'},{sprite_tint_colour:'var(--colour)'},
    {sprite_shadow_opacity:NaN},{sprite_spin:91},{sprite_scale:0},{sprite_shear_x:.81},
    {sprite_hue_shift:Infinity},{sprite_gamma:.01},{sprite_visible_fraction:-1}])
    assert.throws(() => validateSpriteStyle(input));
  const custom = validateSpriteStyle({sprite_asset:{path:'/atlas.png',sha256:digest},sprite_columns:2,sprite_rows:2,sprite_index:3});
  assert.deepEqual(custom.sprite_asset,{url:'/atlas.png',sha256:digest});assert.ok(Object.isFrozen(custom.sprite_asset));
  assert.throws(() => validateSpriteStyle({sprite_asset:custom.sprite_asset,sprite_columns:2,sprite_rows:2,sprite_index:4}),/outside/);
  assert.throws(() => validateSpriteStyle({},'sprite-missing'),/Unknown/);
});

test('all sprite modes draw source-bound finite image stamps and small frozen reports', () => {
  for (const renderer of SPRITE_RENDERERS) {
    const frame = renderer.startsWith('sprite-spectrum-') || renderer.startsWith('sprite-spectrogram-') ? spectralFrame() : motionFrame();
    const result = render(renderer,frame);
    assert.ok(result.stamps.length > 0,renderer + ' must paint observed samples');
    assert.equal(result.calls.filter(call => call[0] === 'clip').length,1);
    assert.deepEqual(result.calls.find(call => call[0] === 'clearRect'),['clearRect',0,0,360,280]);
    assert.equal(result.report.drawn_stamps,result.stamps.length);
    assert.ok(result.report.stamps <= 8000);assert.equal(result.report.animation_frame,95);
    assert.equal(result.report.atlas.sha256,digest);assert.ok(Object.isFrozen(result.report));assert.ok(Object.isFrozen(result.report.atlas));
    assert.ok(JSON.stringify(result.report).length < 500);
    const changed = structuredClone(frame);
    changed.values = changed.values.map(value => value * -.6);
    changed.history = changed.history.map(row => ({...row,values:row.values.map(value => value * -.6)}));
    assert.notDeepEqual(result.stamps,render(renderer,changed).stamps,renderer + ' must consume its source values');
    assert.deepEqual(result.stamps,render(renderer,frame).stamps,renderer + ' must be deterministic');
  }
});

test('spectral stamps recover calibration, negative capture gain and declared silence', () => {
  const frame = spectralFrame(1);
  const result = render('sprite-spectrum-lcd',frame,{segment_count:12,off_opacity:0});
  const counts = Array.from({length:4},(_,band) => result.stamps.filter(stamp => stamp.index === band).length);
  const levels = [.1,.45,.02,0].map(rms => rms ? (20 * Math.log10(rms) + 72) / 72 : 0);
  assert.deepEqual(counts,levels.map(level => Array.from({length:12},(_,i) => (i + .5)/12).filter(value => value <= level).length));
  assert.equal(counts[3],0);
  const bad = {...frame,bands:null};
  assert.throws(() => render('sprite-spectrum-led',bad),/calibrated/);
  assert.throws(() => render('sprite-spectrogram-led',bad),/calibrated/);
  const silent = {...frame,bands:frame.bands.map(band => ({...band,silent:true}))};
  assert.equal(render('sprite-spectrum-gauge',silent,{off_opacity:0}).stamps.length,0);
});

test('mode families preserve distinct meter, glyph, ring, history and native geometry', () => {
  const spectral = spectralFrame(), motion = motionFrame();
  for (const [a,b,frame] of [
    ['sprite-spectrum-lcd','sprite-spectrum-lcd-horizontal',spectral],
    ['sprite-spectrum-lcd','sprite-spectrum-lcd-mirrored',spectral],
    ['sprite-spectrum-lcd','sprite-spectrum-retro',spectral],
    ['sprite-spectrum-mosaic','sprite-spectrum-city',spectral],
    ['sprite-spectrum-vfd','sprite-spectrum-neon',spectral],
    ['sprite-spectrum-led-radial','sprite-spectrum-spokes',spectral],
    ['sprite-spectrum-petals','sprite-spectrum-ring',spectral],
    ['sprite-spectrogram-pixels','sprite-spectrogram-blocks',spectral],
    ['sprite-spectrogram-radial','sprite-spectrogram-spiral',spectral],
    ['sprite-waveform-led','sprite-waveform-dots',motion],
    ['sprite-waveform-ribbon','sprite-waveform-bars',motion],
    ['sprite-waveform-annular','sprite-waveform-spiral',motion],
    ['sprite-motion-path','sprite-motion-orbit',motion],
    ['sprite-motion-cloud','sprite-motion-particles',motion],
    ['sprite-motion-constellation','sprite-motion-trails',motion],
    ['sprite-motion-xy','sprite-motion-icon-grid',motion]
  ]) assert.notDeepEqual(render(a,frame).stamps,render(b,frame).stamps,a + ' and ' + b);
});

test('native motion padding and selected axes are explicit, including the independent icon grid', () => {
  const one = motionFrame(16,1);
  for (const renderer of SPRITE_RENDERERS.filter(name => name.startsWith('sprite-waveform-') || name.startsWith('sprite-motion-')))
    assert.ok(render(renderer,one).stamps.length,renderer + ' supports one native channel');
  const two = motionFrame(24,2), changed = structuredClone(two);
  changed.history = changed.history.map(row => ({...row,values:[row.values[0],row.values[1] * -.25]}));
  changed.values = changed.history.at(-1).values;
  assert.deepEqual(render('sprite-waveform-dots',two).stamps,render('sprite-waveform-dots',changed).stamps);
  assert.notDeepEqual(render('sprite-waveform-dots',two,{axis:1}).stamps,render('sprite-waveform-dots',changed,{axis:1}).stamps);
  assert.notDeepEqual(render('sprite-motion-icon-grid',two).stamps,render('sprite-motion-icon-grid',changed).stamps);
  assert.notDeepEqual(render('sprite-motion-orbit',one).stamps,
    render('sprite-motion-orbit',{...one,history:one.history.map(row => ({...row,values:[0]})),values:[0]}).stamps);
  assert.throws(() => render('sprite-waveform-dots',two,{axis:2}),/axis/);
  assert.throws(() => render('sprite-motion-path',two,{axis:2}),/axis/);
});

test('native history retains actual time positions and endpoints through display subsampling', () => {
  const first = motionFrame(1);first.historySpanPips = 255;
  const current = render('sprite-waveform-dots',first).stamps;
  assert.equal(current.length,1);close(current[0].x,355);
  const spectrum = spectralFrame(1);spectrum.historySpanPips = 255;
  assert.ok(render('sprite-spectrogram-led',spectrum).stamps.every(stamp => stamp.x === 355));
  const many = motionFrame(512);
  const reduced = render('sprite-waveform-dots',many,{history_limit:6,sample_stride:4,spacing:10});
  close(reduced.stamps[0].x,5);close(reduced.stamps.at(-1).x,355);assert.ok(reduced.stamps.length <= 3);
  const bad = structuredClone(many);bad.history[0].agePips = -1;
  assert.throws(() => render('sprite-waveform-dots',bad),/chronological/);
  assert.throws(() => render('sprite-waveform-dots',{...many,history:many.history.slice().reverse()}),/chronological/);
  assert.throws(() => render('sprite-waveform-dots',{...many,history:[]}),/history/);
});

test('atlas animation follows absolute source-frame time and wraps builtin and custom cells', () => {
  const frame = motionFrame(1);
  const settings = {animation_frames:4,animation_stride:6};
  const a = render('sprite-waveform-dots',{...frame,spriteFrame:12},settings).stamps[0];
  const b = render('sprite-waveform-dots',{...frame,spriteFrame:18},settings).stamps[0];
  assert.equal(a.index,10);assert.equal(b.index,11);
  assert.deepEqual(a,render('sprite-waveform-dots',{...frame,spriteFrame:12,pip:999,sourceSeconds:10000},settings).stamps[0]);
  const negative = render('sprite-waveform-dots',{...frame,spriteFrame:-6},settings).stamps[0];
  assert.equal(negative.index,11);
  assert.equal(render('sprite-waveform-dots',frame,{sprite_index:63,animation_frames:8,animation_stride:1}).stamps[0].index,(63 + 95 % 8) % 64);
  const asset = {url:'/custom.png',sha256:digest};
  const custom = {sprite_asset:asset,sprite_columns:2,sprite_rows:2,sprite_index:3,
    sprite_palette_shift:-2,animation_frames:4,animation_stride:6};
  const result = render('sprite-waveform-dots',{...frame,spriteFrame:-6},custom,{custom:true,columns:2,rows:2});
  assert.equal(result.stamps[0].index,0);
  assert.throws(() => render('sprite-waveform-dots',frame,custom),/source\/grid/);
  assert.throws(() => render('sprite-waveform-dots',{...frame,spriteFrame:undefined}),/source-clock/);
});

test('sprite appearance placement, density, spin and colours are deterministic and active', () => {
  const frame = motionFrame(24), renderer = 'sprite-waveform-dots', original = render(renderer,frame).stamps;
  const controls = {sprite_scale:1.5,sprite_scale_x:1.5,sprite_scale_y:1.5,sprite_rotation:45,sprite_spin:2,
    sprite_offset_x:20,sprite_offset_y:20,sprite_layout_rotation:45,sprite_spread:.5,
    sprite_jitter:5,sprite_angle_jitter:30,sprite_visible_fraction:.5,sprite_palette_shift:3};
  for (const [key,value] of Object.entries(controls)) {
    const actual = render(renderer,frame,{[key]:value}).stamps;
    assert.notDeepEqual(actual,original,key + ' changes stamps');
    assert.deepEqual(actual,render(renderer,frame,{[key]:value}).stamps);
  }
  assert.equal(render(renderer,frame,{sprite_visible_fraction:0}).stamps.length,0);
  assert.equal(render(renderer,frame,{sprite_opacity:0}).stamps.length,0);
  assert.ok(render(renderer,frame,{sprite_colour:'tint'}).stamps.every(stamp => typeof stamp.tint === 'string'));
  assert.ok(render(renderer,frame,{sprite_tint_colour:'#123456'}).stamps.every(stamp => stamp.tint === '#123456'));
  const spun = render(renderer,{...frame,spriteFrame:12},{sprite_spin:2,sprite_rotation:5}).stamps;
  assert.ok(spun.every(stamp => stamp.angle === 29));
});

test('stamp budgets and tile bounds fail explicitly and restore the viewport', () => {
  const trace = contextTrace(), fake = fakeBank(), frame = {...spectralFrame(),assets:{sprite:fake.bank}};
  assert.throws(() => drawSprites(trace.context,360,280,frame,'sprite-spectrum-lcd',{max_stamps:3}),/stamp limit/);
  assert.equal(trace.stack.length,0);assert.equal(fake.stamps.length,3);
  assert.throws(() => render('sprite-waveform-dots',motionFrame(),{sprite_size:256,sprite_scale:8}),/1024-pixel/);
  const tiny = render('sprite-waveform-dots',motionFrame(),{}, {width:1,height:1});
  assert.equal(tiny.stamps.length,0);assert.equal(tiny.report.stamps,0);
});

function pixelFixture() {
  const width = 7, height = 7, data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([(i * 43 + 17)%256,(i * 19 + 70)%256,(i * 31 + 120)%256,i === 0 ? 0 : 210],i * 4);
  return {width,height,data};
}
test('all per-cell colour and pixel controls alter actual bounded pixels without changing the source', () => {
  const source = pixelFixture(), before = source.data.slice(), normal = validateSpriteStyle();
  assert.deepEqual(processSpritePixels(source,normal).data,source.data);
  const controls = {sprite_hue_shift:85,sprite_saturation:.2,sprite_brightness:.6,sprite_contrast:1.7,
    sprite_gamma:2,sprite_temperature:.7,sprite_red:.2,sprite_green:.2,sprite_blue:.2,
    sprite_posterize:3,sprite_pixel_size:3,sprite_scanlines:.7,sprite_grain:.8,sprite_sharpen:2};
  for (const [key,value] of Object.entries(controls)) {
    const style = validateSpriteStyle({[key]:value}), actual = processSpritePixels(source,style).data;
    assert.notDeepEqual(actual,source.data,key + ' must alter cell pixels');
    assert.deepEqual(actual,processSpritePixels(source,style).data);
    if (key !== 'sprite_pixel_size') for (let i = 3; i < actual.length; i += 4) assert.equal(actual[i],source.data[i]);
  }
  const tinted = processSpritePixels(source,normal,[255,0,0,255]).data;
  assert.ok(tinted[5] === 0 && tinted[6] === 0);
  assert.deepEqual(processSpritePixels(source,validateSpriteStyle({tint_strength:0}),[255,0,0,255]).data,source.data);
  assert.deepEqual(source.data,before);
  assert.throws(() => processSpritePixels({width:1025,height:1,data:new Uint8ClampedArray(4100)},normal),/bounded/);
});

function canvasFactory() {
  const canvases = [], drawCalls = [], operations = [];
  function factory(width,height) {
    const canvas = {width,height}, trace = contextTrace(), context = trace.context;
    context.canvas = canvas;
    context.drawImage = (...args) => {drawCalls.push(args);operations.push({kind:'draw',filter:context.filter,composite:context.globalCompositeOperation,args});};
    context.fillRect = (...args) => operations.push({kind:'fill',colour:context.fillStyle,composite:context.globalCompositeOperation,args});
    context.getImageData = (x,y,w,h) => {
      const data = new Uint8ClampedArray(w*h*4);
      for (let at = 0; at < data.length; at += 4) data.set([80,140,210,at % 12 ? 210 : 0],at);
      if (w === 1 && h === 1) data.set([255,100,30,255]);
      return {width:w,height:h,data};
    };
    context.putImageData = value => operations.push({kind:'pixels',width:value.width,height:value.height});
    canvas.getContext = () => context;canvas.trace = trace;canvases.push(canvas);return canvas;
  }
  return {factory,canvases,drawCalls,operations};
}
function realBank(options = {}) {
  const fake = canvasFactory();let closes = 0;
  const image = {width:768,height:768,close(){closes++;}};
  const bank = createSpriteBank({image,width:768,height:768,columns:8,rows:8,custom:false,sha256:digest,...options},fake.factory);
  return {...fake,bank,image,closes:() => closes};
}
function stampSettings(style = validateSpriteStyle(), overrides = {}) {
  return {index:10,x:80,y:90,width:16,height:12,opacity:.7,angle:30,tint:null,style,...overrides};
}

test('the image bank crops real atlas cells and scopes transforms, blending, anchors and opacity', () => {
  const {bank,image,canvases} = realBank(), trace = contextTrace();
  const style = validateSpriteStyle({sprite_blend:'screen',sprite_shear_x:.4,sprite_shear_y:-.2,sprite_anchor_x:1,sprite_anchor_y:-1,pixelated:true});
  bank.stamp(trace.context,stampSettings(style));
  const draw = trace.calls.find(call => call[0] === 'drawImage');
  assert.deepEqual(draw,['drawImage',image,192,96,96,96,-16,-0,16,12]);
  assert.ok(trace.calls.some(call => call[0] === 'translate' && call[1] === 80 && call[2] === 90));
  assert.ok(trace.calls.some(call => call[0] === 'transform' && call[2] === -.2 && call[3] === .4));
  assert.equal(trace.stack.length,0);assert.equal(trace.context.globalAlpha,.3);assert.equal(trace.context.globalCompositeOperation,'source-over');
  assert.equal(canvases.length,0,'default pixels use direct source rectangles, no generated substitutes');
  bank.destroy();
});

test('blur, glow, outline and shadow process actual cells and stay bounded without rotation cache growth', () => {
  const result = realBank(), trace = contextTrace();
  for (const key of ['sprite_blur','sprite_glow','sprite_outline','sprite_shadow']) {
    const style = validateSpriteStyle({[key]:3,sprite_shadow_x:7,sprite_shadow_y:-5});
    const before = result.operations.length;
    result.bank.stamp(trace.context,stampSettings(style));
    const operations = result.operations.slice(before);
    assert.ok(operations.some(operation => operation.kind === 'pixels'),key + ' grades actual cell pixels');
    if (key !== 'sprite_outline') assert.ok(operations.some(operation => operation.filter === 'blur(3px)'),key + ' applies its blur');
    else assert.ok(operations.filter(operation => operation.kind === 'pixels').length >= 2,'outline builds the alpha border');
    const cached = result.bank.snapshot().cachedTiles;
    for (let angle = 0; angle < 360; angle += 17) result.bank.stamp(trace.context,stampSettings(style,{angle}));
    assert.equal(result.bank.snapshot().cachedTiles,cached,'rotations reuse the same processed cell');
  }
  assert.ok(result.operations.some(operation => operation.composite === 'source-in'),'shadow uses the source alpha mask');
  result.bank.destroy();assert.equal(result.closes(),1);
  assert.ok(result.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});

test('sprite bank cache has both entry and pixel caps, and last-owner destruction releases every resource', () => {
  const result = realBank(), trace = contextTrace(), style = validateSpriteStyle({sprite_brightness:.7});
  for (let width = 1; width <= SPRITE_LIMITS.cacheEntries + 5; width++)
    result.bank.stamp(trace.context,stampSettings(style,{width,height:2}));
  assert.equal(result.bank.snapshot().cachedTiles,SPRITE_LIMITS.cacheEntries);
  for (let index = 0; index < 36; index++)
    result.bank.stamp(trace.context,stampSettings(style,{index,width:512,height:512}));
  const snapshot = result.bank.snapshot();
  assert.ok(snapshot.cachedPixels <= SPRITE_LIMITS.cachePixels);
  assert.ok(snapshot.cachedTiles < SPRITE_LIMITS.cacheEntries,'pixel limit evicts before entry limit');
  assert.ok(result.canvases.some(canvas => canvas.width === 0),'evicted cell buffers are released');
  result.bank.destroy();result.bank.destroy();
  assert.equal(result.bank.snapshot().cachedTiles,0);assert.equal(result.bank.snapshot().cachedPixels,0);assert.equal(result.bank.snapshot().destroyed,true);
  assert.equal(result.closes(),1);assert.ok(result.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  assert.throws(() => result.bank.stamp(trace.context,stampSettings(style)),/destroyed/);
  assert.ok(!JSON.stringify(result.bank.snapshot()).includes('image'));
});

test('invalid atlas shapes and effective cell limits fail before drawing', () => {
  const factory = canvasFactory().factory;
  const base = {image:{},width:768,height:768,columns:8,rows:8,custom:false,sha256:digest};
  for (const changes of [{image:null},{width:769},{columns:0},{rows:33},{width:4097},{width:8192,height:8192},
    {custom:'yes'},{sha256:'bad'},{columns:4}])
    assert.throws(() => createSpriteBank({...base,...changes},factory));
  const result = realBank(), trace = contextTrace();
  assert.throws(() => result.bank.stamp(trace.context,stampSettings(undefined,{index:64})),/index/);
  assert.throws(() => result.bank.stamp(trace.context,stampSettings(undefined,{width:1025})),/1024/);
  assert.throws(() => result.bank.stamp(trace.context,stampSettings(undefined,{x:Infinity})),/coordinates/);
  result.bank.destroy();
});
