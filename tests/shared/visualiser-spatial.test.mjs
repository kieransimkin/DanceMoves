import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SOLID_RENDERERS,validateSolidStyle,drawSolid,createSpatialSurface} from '../../src/visualiser-solid.mjs';
import {MUSIC_RENDERERS,validateMusicStyle,musicNeedsSpectrum,drawMusic,musicMesh} from '../../src/visualiser-music.mjs';
import {rasterTriangle,applyFog,normalize} from '../../src/visualiser-raster.mjs';
import {spectrumProfile,terrainField,thermal,fbm} from '../../src/visualiser-terrain.mjs';
import {validateSpectrumBands} from '../../src/spectrum-analysis.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

// The rasterizer produces genuine RGBA/depth arrays. This deliberately small
// Canvas double only copies those arrays for presentation; browser QA owns
// real Canvas compositing, CSS colour decoding and mount lifecycle evidence.
function drawingFixture() {
  const canvases=[];let output=null,saves=0,colourReads=0;
  function createCanvas() {
    let width=300,height=150,pixels=null;const stack=[];
    const canvas={get width(){return width;},set width(value){width=value;pixels=null;},
      get height(){return height;},set height(value){height=value;pixels=null;},
      get pixels(){return pixels;},getContext:()=>context};
    const context={fillStyle:'#000',save(){stack.push(this.fillStyle);},restore(){this.fillStyle=stack.pop();},
      clearRect(){},fillRect(){},
      createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
      putImageData(image){pixels=image.data.slice();},
      getImageData(){colourReads++;assert.equal(this.fillStyle,'tomato');return {data:new Uint8ClampedArray([255,99,71,255])};}};
    canvases.push(canvas);return canvas;
  }
  const context={save(){saves++;},restore(){saves--;},clearRect(){output=null;},
    drawImage(canvas,_x,_y,width,height){output={width,height,rasterWidth:canvas.width,rasterHeight:canvas.height,pixels:canvas.pixels.slice()};}};
  return {context,canvases,createCanvas,surface:createSpatialSurface(createCanvas),
    output:()=>output,saves:()=>saves,colourReads:()=>colourReads};
}
function frame(seconds=2,values=[.42,-.32,.2]) {
  return Object.freeze({sourceSeconds:seconds,pip:Math.floor(seconds*128),values:Object.freeze([...values])});
}
function spectralFrame(ages=[12,9,6,3,0],span=12) {
  const recording=createSpectrumRecording({count:ages.length}),bands=validateSpectrumBands(recording);
  const history=ages.map((agePips,row)=>Object.freeze({pip:100-agePips,agePips,ageSeconds:agePips/128,
    values:Object.freeze(bands.map((band,index)=>band.silent?0:(2*(.03+.02*((row+index*2)%8))/band.divisor-1)*band.gain))}));
  return Object.freeze({sourceSeconds:100/128,pip:100,values:history.at(-1).values,history:Object.freeze(history),historySpanPips:span,bands});
}
const quality={rings:6,segments:10,raster_size:64,fog:0,glow:0};
const digest=value=>createHash('sha256').update(value).digest('hex');
const almost=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
function draw(renderer,input={},source=frame(),owner=drawingFixture(),width=96,height=64) {
  const music=renderer.startsWith('spatial-music-'),style=(music?validateMusicStyle:validateSolidStyle)({...quality,...input},renderer);
  const report=(music?drawMusic:drawSolid)(owner.context,width,height,source,renderer,style,owner.surface);
  assert.equal(owner.saves(),0,'presentation restores the destination Canvas context');
  return {owner,style,report,...owner.output()};
}

test('solid and music families expose exactly six unique native-compatible modes without importing a DOM',()=>{
  assert.equal(typeof globalThis.document,'undefined');
  assert.equal(new Set([...SOLID_RENDERERS,...MUSIC_RENDERERS]).size,6);
  assert.ok(Object.isFrozen(SOLID_RENDERERS));assert.ok(Object.isFrozen(MUSIC_RENDERERS));
  const owner=drawingFixture();assert.equal(owner.canvases.length,0,'per-view pixel allocation is lazy');
  owner.surface.destroy();assert.equal(owner.canvases.length,0);
});

for (const renderer of [...SOLID_RENDERERS,...MUSIC_RENDERERS]) test(renderer+' renders actual solid pixels and deterministic source-clock seeks',()=>{
  const owner=drawingFixture(),source=frame(),before=JSON.stringify(source),a=draw(renderer,{},source,owner);
  assert.equal(a.report.backend,'cpu');assert.match(a.report.depthBuffer,/per-pixel reciprocal/);
  assert.ok(a.report.triangles>=100);assert.ok(a.report.coveredPixels>20);
  assert.ok(a.pixels.some((value,index)=>index%4!==3&&value!==a.pixels[index%4]));
  assert.equal(a.pixels.length,a.rasterWidth*a.rasterHeight*4);
  assert.ok(Object.isFrozen(a.report));assert.ok(Object.isFrozen(a.report.sourcePips));
  assert.notEqual(digest(draw(renderer,{},frame(1),owner).pixels),digest(a.pixels));
  assert.equal(digest(draw(renderer,{},source,owner).pixels),digest(a.pixels));
  assert.notEqual(digest(draw(renderer,{},frame(2,[-.8,.6,-.4]),owner).pixels),digest(a.pixels));
  assert.equal(JSON.stringify(source),before,'rendering never changes native source data');
  owner.surface.destroy();
});

test('all six meshes have distinct filled geometry or material pixels',()=>{
  const hashes=[...SOLID_RENDERERS,...MUSIC_RENDERERS].map(renderer=>{const result=draw(renderer);result.owner.surface.destroy();return digest(result.pixels);});
  assert.equal(new Set(hashes).size,6);
});

function target(width=32,height=28,background=[0,0,0,0]) {
  const pixels=new Uint8ClampedArray(width*height*4),depths=new Float32Array(width*height);depths.fill(Infinity);
  for (let i=0;i<pixels.length;i++) pixels[i]=background[i%4];
  return {width,height,pixels,depths};
}
test('per-pixel depth resolves crossing triangles independently of draw order',()=>{
  const a=[[3,3,1],[29,3,8],[3,25,8]],b=[[3,3,5],[29,3,2],[3,25,2]];
  const first=target(),second=target();
  rasterTriangle(first,a,[255,0,0,255]);rasterTriangle(first,b,[0,0,255,255]);
  rasterTriangle(second,b,[0,0,255,255]);rasterTriangle(second,a,[255,0,0,255]);
  assert.deepEqual(first.pixels,second.pixels);assert.deepEqual(first.depths,second.depths);
  const colour=(x,y)=>[...first.pixels.slice((y*32+x)*4,(y*32+x)*4+4)];
  assert.deepEqual(colour(4,4),[255,0,0,255]);assert.deepEqual(colour(23,4),[0,0,255,255]);
});
test('triangle depth uses reciprocal interpolation rather than interpolating camera distance linearly',()=>{
  const buffer=target(4,4);
  rasterTriangle(buffer,[[0,0,1],[4,0,4],[0,4,4]],[100,50,25,255]);
  // Pixel centre (.5,.5) has barycentric weights .75,.125,.125.
  almost(buffer.depths[0],1/(.75/1+.125/4+.125/4));
  assert.notEqual(buffer.depths[0],.75*1+.125*4+.125*4);
  assert.equal(rasterTriangle(buffer,[[0,0,1],[1,1,1],[2,2,1]],[255,0,0,255]),0);
});

test('depth-terminated volume fog is weaker in front of a nearby occluder',()=>{
  const buffer=target(24,12,[17,34,51,255]);buffer.depths[5*24+8]=1;
  const style=validateSolidStyle({camera_distance:4,fog:.95,fog_steps:8,fog_resolution:64});
  applyFog(buffer,style,[220,230,255],0);
  assert.ok(buffer.pixels[(5*24+8)*4]<buffer.pixels[(5*24+9)*4]);
  const empty=target(4,4);applyFog(empty,{...style,fog:0},[255,255,255],0);
  assert.ok(empty.pixels.every(value=>value===0));
});

test('transparent surfaces preserve empty alpha while solid geometry remains opaque',()=>{
  const result=draw('spatial-solid-torus',{background:'#00000000'});
  assert.equal(result.pixels[3],0);assert.ok(result.pixels.some((v,i)=>i%4===3&&v===255));
  result.owner.surface.destroy();
});

test('solid camera, native displacement, GGX material, light, palette and fog controls affect pixels',()=>{
  const base=draw('spatial-solid-torus'),reference=digest(base.pixels);
  for (const controls of [{camera_distance:3.3},{fov:35},{depth:1.8},{roughness:.1},{metallic:1},
    {ambient:.8},{light_direction:[1,0,1]},{light_colour:'#ff0000'},{colours:['#f0dd11']},
    {fog:.5},{fog:.5,fog_colour:'#884411'},{glow:.8}]) {
    const result=draw('spatial-solid-torus',controls);assert.notEqual(digest(result.pixels),reference,JSON.stringify(controls));result.owner.surface.destroy();
  }
  base.owner.surface.destroy();
});

test('music changes actual vertices independently of camera rotation, and inherited depth is meaningful',()=>{
  for (const renderer of MUSIC_RENDERERS) {
    const style=validateMusicStyle({...quality,orbit:0},renderer),source=frame(2,[.2,-.4,.6]);
    const before=musicMesh(source,style),after=musicMesh(frame(2,[-.7,.5,-.4]),style);
    assert.notDeepEqual(before.positions,after.positions,renderer+' deforms its native geometry');
    assert.notDeepEqual(musicMesh(source,validateMusicStyle({...quality,depth:0},renderer)).positions,before.positions);
    assert.deepEqual(before,musicMesh(source,style),'procedural terrain never integrates prior frames');
  }
});

test('music geologic material controls, neutral tint and direct lighting have real effects',()=>{
  const renderer='spatial-music-terrain',base=draw(renderer),reference=digest(base.pixels);
  assert.deepEqual(base.style.colours,['#ffffff']);
  for (const controls of [{normal_strength:3},{texture_scale:12},{texture_octaves:1},{seed:800},
    {weathering:1,thermal_erosion:1,hydraulic_erosion:1,glaciation:1},{snowline:-1,ice_coverage:1},
    {light_power:0},{light_power:8},{light_azimuth:80,light_elevation:15},{camera_pitch:20},
    {colours:['#ff8080']},{audio_displacement:1},{mesh_gain:3},{audio_twist:2},{terrain_height:2}]) {
    const result=draw(renderer,controls);assert.notEqual(digest(result.pixels),reference,JSON.stringify(controls));result.owner.surface.destroy();
  }
  base.owner.surface.destroy();
});

test('music spectral features use existing calibrated RMS, logarithmic band positions and signed gains',()=>{
  const recording=createSpectrumRecording({count:1}),bands=validateSpectrumBands(recording);
  const source={bands},style=validateMusicStyle({spectral_deform:true});
  const profile=spectrumProfile(source,recording.samples[0],33,style);
  almost(profile[0],(-20-style.fft_floor_db)/-style.fft_floor_db);
  assert.equal(profile.at(-1),0,'declared silent axes remain zero instead of calibrating neutral into energy');
  assert.ok(profile.some(value=>value>profile[0]),'the observed .45 RMS band retains its greater magnitude');
  assert.ok(profile.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
  const two={bands:bands.slice(0,2)};
  assert.throws(()=>spectrumProfile(two,recording.samples[0].slice(0,2),10,style),/three calibrated/);
  assert.throws(()=>spectrumProfile({bands:bands.map((band,i)=>i===1?{...band,sourceSha256:'ff'.repeat(32)}:band)},recording.samples[0],10,style),/share/);
  assert.throws(()=>spectrumProfile({bands:[...bands].reverse()},[...recording.samples[0]].reverse(),10,style),/ascending/);
});

test('FFT terrain preserves real pip spacing and leaves missing startup history unpopulated',()=>{
  const style=validateMusicStyle({...quality,terrain_source:'fft',weathering:0,thermal_erosion:0,hydraulic_erosion:0,glaciation:0},'spatial-music-terrain');
  const partial=spectralFrame([6,2,0],20),terrain=terrainField(partial,style);
  assert.deepEqual(terrain.sourcePips,[94,98,100]);assert.equal(terrain.sourceSha256,'ab'.repeat(32));
  [.7,.9,1].forEach((value,i)=>almost(terrain.positions[i],value));
  assert.equal(terrain.heights.length,3,'unobserved rows are not filled with repeated old samples');
  const single=terrainField(spectralFrame([0],100),style);
  assert.deepEqual(single.sourcePips,[100]);almost(single.positions[0],.995);almost(single.positions[1],1);
  assert.equal(single.heights.length,2,'one measured row has two narrowly bounded display-cell edges');
  const many=spectralFrame(Array.from({length:80},(_,i)=>79-i),79),selected=terrainField(many,style);
  assert.equal(selected.sourcePips.length,style.rings+1);assert.equal(selected.sourcePips[0],21);assert.equal(selected.sourcePips.at(-1),100);
  assert.ok(selected.positions.every((value,index)=>index===0||value>selected.positions[index-1]));
});

test('spectral terrain and current-band deformation are source-clock seekable and report only actual source pips',()=>{
  const source=spectralFrame(),before=JSON.stringify(source);
  for (const renderer of MUSIC_RENDERERS) {
    const controls=renderer.endsWith('terrain')?{terrain_source:'fft'}:{spectral_deform:true};
    const result=draw(renderer,controls,source);
    assert.equal(result.report.sourceSha256,'ab'.repeat(32));
    assert.deepEqual(result.report.sourcePips,renderer.endsWith('terrain')?source.history.map(row=>row.pip):[source.pip]);
    const changed={...source,values:source.history[0].values,history:source.history.map(row=>({...row,values:source.history[0].values}))};
    assert.notEqual(digest(draw(renderer,controls,changed,result.owner).pixels),digest(result.pixels));
    assert.equal(digest(draw(renderer,controls,source,result.owner).pixels),digest(result.pixels));
    result.owner.surface.destroy();
  }
  assert.equal(JSON.stringify(source),before);
  const currentOnly=draw('spatial-music-terrain',{spectral_deform:true},source);
  assert.deepEqual(currentOnly.report.sourcePips,[source.pip]);assert.equal(currentOnly.report.sourceSha256,'ab'.repeat(32));
  currentOnly.owner.surface.destroy();
  const procedural=draw('spatial-music-terrain',{},frame());
  assert.deepEqual(procedural.report.sourcePips,[frame().pip]);assert.equal(procedural.report.sourceSha256,null);
  procedural.owner.surface.destroy();
});

test('procedural noise and erosion are deterministic display operations, not accumulating source state',()=>{
  almost(fbm(.2,.3,7),fbm(.2,.3,7));assert.notEqual(fbm(.2,.3,7),fbm(.2,.3,8));
  const grid=[[0,0,0],[0,1,0],[0,0,0]],sum=rows=>rows.flat().reduce((a,b)=>a+b,0);
  const eroded=thermal(grid,.7,4);almost(sum(eroded),1);assert.ok(eroded[1][1]<1);
  assert.deepEqual(grid,[[0,0,0],[0,1,0],[0,0,0]]);
  const source=frame(),base=validateMusicStyle(quality,'spatial-music-terrain');
  const a=terrainField(source,base),b=terrainField(source,validateMusicStyle({...quality,weathering:.8,hydraulic_erosion:.8,thermal_erosion:.75,glaciation:.85},'spatial-music-terrain'));
  assert.notDeepEqual(a.heights,b.heights);assert.deepEqual(a,terrainField(source,base));
  assert.ok(b.heights.flat().every(value=>Number.isFinite(value)&&value>=0));
});

test('all spatial variants accept a single native channel, with spectral provenance required only when requested',()=>{
  for (const renderer of [...SOLID_RENDERERS,...MUSIC_RENDERERS]) {
    const result=draw(renderer,{},frame(1,[.5]));assert.ok(result.report.coveredPixels>0);result.owner.surface.destroy();
  }
  assert.equal(musicNeedsSpectrum(validateMusicStyle()),false);
  assert.equal(musicNeedsSpectrum(validateMusicStyle({spectral_deform:true})),true);
  assert.equal(musicNeedsSpectrum(validateMusicStyle({terrain_source:'fft'},'spatial-music-terrain')),true);
  assert.throws(()=>draw('spatial-music-sphere',{spectral_deform:true}),/calibrated/);
  assert.throws(()=>draw('spatial-music-terrain',{terrain_source:'fft'}),/history/);
});

test('style bounds reject unsupported GPU promises, wrong types and unavailable geometry',()=>{
  for (const input of [null,[],3,{unknown:1},{geometry:'cube'},{geometry:'sphere'},{roughness:0},{roughness:NaN},
    {rings:2},{rings:49},{segments:73},{segments:6.5},{ambient:-1},{metallic:2},{fov:180},
    {fog_steps:1},{fog_resolution:721},{raster_size:63},{raster_size:1025},{raster_size:256.5},
    {light_direction:[0,0,0]},{light_direction:[1,'x',0]},{light_direction:[Infinity,0,0]},
    {light_colour:null},{colours:[]},{line_width:2}]) assert.throws(()=>validateSolidStyle(input),undefined,JSON.stringify(input));
  for (const input of [{backend:'gpu'},{backend:'vulkan'},{terrain_source:'fft'},{spectral_deform:1},
    {fft_floor_db:-121},{fft_floor_db:0},{audio_frequency:0},{audio_twist:5},{texture_octaves:9},
    {erosion_iterations:25},{seed:-1},{snowline:5},{light_power:17},{camera_pitch:66},
    {light_azimuth:361},{light_elevation:90},{shadow_strength:.1},{shadow_map_size:512},
    {volumetric_steps:12},{scattering_density:.1},{absorption_density:.1},{anisotropy:.5}])
    assert.throws(()=>validateMusicStyle(input),undefined,JSON.stringify(input));
  assert.throws(()=>validateMusicStyle({backend:'gpu'}),/GPU.*unsupported/);
  for (const renderer of [...SOLID_RENDERERS,...MUSIC_RENDERERS]) {
    const auto=draw(renderer,{backend:'auto'});
    assert.equal(auto.report.backend,'cpu');assert.match(auto.report.fallbackReason,/CPU.*OpenGL/);auto.owner.surface.destroy();
  }
  assert.throws(()=>validateSolidStyle({backend:'gpu'}),/GPU.*unsupported/);
  const direction=validateSolidStyle({light_direction:[Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE]}).light_direction;
  almost(Math.hypot(...direction),1);assert.ok(Object.isFrozen(direction));
  assert.deepEqual(normalize([0,0,0]),[0,0,1]);
});

test('invalid native values, clock and history fail before a spatial buffer is allocated',()=>{
  for (const source of [{values:[],sourceSeconds:0},{values:[NaN],sourceSeconds:0},{values:[2],sourceSeconds:0},
    {values:[.5],sourceSeconds:Infinity},{values:[.5],sourceSeconds:-1}]) {
    const owner=drawingFixture();assert.throws(()=>draw('spatial-solid-sphere',{},source,owner),/native|seconds/);assert.equal(owner.canvases.length,0);
  }
  const source=spectralFrame();
  for (const invalid of [{...source,history:[]},{...source,historySpanPips:NaN},
    {...source,history:source.history.map((row,i)=>({...row,agePips:i}))}])
    assert.throws(()=>draw('spatial-music-terrain',{terrain_source:'fft'},invalid),/history/);
});

test('raster size preserves aspect ratio, resize stays bounded, and destruction clears buffers and palette',()=>{
  const owner=drawingFixture();
  const small=draw('spatial-solid-torus',{raster_size:64},frame(),owner,100000,50000);
  assert.equal(small.rasterWidth,64);assert.equal(small.rasterHeight,32);
  assert.equal(owner.surface.snapshot().bytes,64*32*12);
  const portrait=draw('spatial-solid-torus',{raster_size:64,colours:['tomato']},frame(),owner,80,160);
  assert.equal(portrait.rasterWidth,32);assert.equal(portrait.rasterHeight,64);assert.equal(owner.colourReads(),1);
  draw('spatial-solid-torus',{raster_size:64,colours:['tomato']},frame(),owner,80,160);assert.equal(owner.colourReads(),1,'palette decoding is bounded and reused');
  const canvas=owner.canvases[0];owner.surface.destroy();owner.surface.destroy();
  assert.equal(canvas.width,1);assert.equal(canvas.height,1);
  assert.deepEqual(owner.surface.snapshot(),{destroyed:true,width:0,height:0,bytes:0,paletteEntries:0});
  assert.throws(()=>draw('spatial-solid-torus',{},frame(),owner),/destroyed/);
});

test('extreme overlapping meshes retain all clipped faces within a deterministic raster work budget',()=>{
  const controls={rings:48,segments:72,raster_size:1024,camera_distance:2.5,fov:20,depth:2,
    audio_displacement:2,mesh_gain:4,audio_frequency:32,audio_twist:4,glow:0,fog:0};
  const result=draw('spatial-music-torus',controls,frame(1,[1,1,1]),undefined,1024,768);
  assert.ok(result.report.rasterLimited,'pathologically overlapping full-size triangle boxes trigger the cap');
  assert.ok(result.report.rasterWidth<1024);assert.ok(result.report.rasterPixelTests<=8388608);
  assert.ok(result.report.coveredPixels>0);assert.ok(result.report.triangles>1000&&result.report.triangles<=48*72*4);
  assert.ok(Math.abs(result.report.rasterWidth/result.report.rasterHeight-4/3)<=1/result.report.rasterHeight);
  const repeated=draw('spatial-music-torus',controls,frame(1,[1,1,1]),result.owner,1024,768);
  assert.deepEqual(repeated.report,result.report);assert.equal(digest(repeated.pixels),digest(result.pixels));
  const low=draw('spatial-music-torus',{...controls,raster_size:64},frame(1,[1,1,1]),result.owner,1024,768);
  assert.equal(low.report.triangles,result.report.triangles,'the work cap changes resolution, never drops clipped faces');
  assert.ok(low.report.rasterPixelTests<=8388608);result.owner.surface.destroy();
  const ordinary=draw('spatial-solid-sphere',{raster_size:64});
  assert.equal(ordinary.report.rasterLimited,false);assert.equal(ordinary.report.rasterWidth,64);ordinary.owner.surface.destroy();
});

test('zero-sized spatial views report the same metadata contract without allocating raster buffers',()=>{
  const result=draw('spatial-solid-sphere',{backend:'auto'},frame(),undefined,0,180);
  assert.equal(result.owner.canvases.length,0);
  assert.equal(result.report.geometry,'sphere');assert.equal(result.report.rasterWidth,0);assert.equal(result.report.rasterHeight,0);
  assert.equal(result.report.rasterPixelTests,0);assert.equal(result.report.rasterLimited,false);
  assert.deepEqual(result.report.sourcePips,[]);assert.equal(result.report.sourceSha256,null);
  assert.equal(result.report.shading,'linear-light Cook-Torrance GGX');assert.match(result.report.fallbackReason,/CPU/);
  result.owner.surface.destroy();
});

test('retained destroyed spatial surfaces release every owned typed buffer',async()=>{
  if (typeof global.gc!=='function') {
    const result=spawnSync(process.execPath,['--expose-gc','--test',
      '--test-name-pattern=^retained destroyed spatial surfaces release every owned typed buffer$',import.meta.filename],{encoding:'utf8',timeout:20000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+'\n'+result.stderr);return;
  }
  const owner=drawingFixture();draw('spatial-solid-torus',{},frame(),owner);
  const refs=(()=>{const target=owner.surface.begin(64,42,[0,0,0,0]);return [target.pixels,target.depths,target.blur].map(value=>new WeakRef(value));})();
  owner.surface.destroy();
  for (let attempt=0;attempt<12;attempt++) {
    await new Promise(resolve=>setImmediate(resolve));global.gc();
    if (refs.every(ref=>ref.deref()===undefined)) {assert.equal(owner.surface.snapshot().destroyed,true);return;}
  }
  assert.fail('A retained destroyed surface still holds a typed raster buffer');
});
