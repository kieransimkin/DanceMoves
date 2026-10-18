// FrameRudiments terrain_field.py visual terrain port, c8d1c9a (MIT).
// Copyright (c) 2026 Kieran Simkin. Full licence: visualiser-helpers.mjs.
// This transforms existing native values for display; it performs no audio DSP.
import {clamp,reduceRows,bandLevels} from './visualiser-helpers.mjs';

function hash(x,y,seed) {
  let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,1442695041))>>>0;
  n=Math.imul(n^(n>>>13),1274126177)>>>0;
  return ((n^(n>>>16))>>>0)/4294967295;
}
function noise(x,y,seed) {
  const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;
  u=u*u*(3-2*u);v=v*v*(3-2*v);
  const a=hash(ix,iy,seed)*(1-u)+hash(ix+1,iy,seed)*u;
  const b=hash(ix,iy+1,seed)*(1-u)+hash(ix+1,iy+1,seed)*u;
  return 2*(a*(1-v)+b*v)-1;
}
export function fbm(x,y,seed=7,octaves=5) {
  let value=0,amplitude=.5,total=0;
  for (let i=0;i<octaves;i++) {value+=amplitude*noise(x,y,seed+i*31);total+=amplitude;amplitude*=.5;x*=2.02;y*=2.02;}
  return value/total;
}
export function spectrumProfile(frame,values,columns,style) {
  const bands=frame.bands;
  if (!Array.isArray(bands)||bands.length<3||bands.length!==values.length)
    throw new TypeError('Music spectral geometry requires at least three calibrated Fourier bands');
  const first=bands[0];
  if (!/^[a-f0-9]{64}$/i.test(first.sourceSha256)||!Number.isInteger(first.sampleRate)||!Number.isInteger(first.fftSize)||
      bands.some(band=>band.sourceSha256!==first.sourceSha256||band.sampleRate!==first.sampleRate||band.fftSize!==first.fftSize))
    throw new TypeError('Music Fourier bands must share a validated source, sample rate and FFT size');
  const centres=bands.map(band=>Math.log(Math.sqrt(Math.max(1,band.lowHz)*band.highHz)));
  if (centres.some((value,index)=>!Number.isFinite(value)||index>0&&value<=centres[index-1]))
    throw new RangeError('Music Fourier bands need ascending frequency centres');
  const energy=bandLevels(frame,{values},{floor_db:style.fft_floor_db,ceiling_db:0,gain:1});
  const result=[];let band=0;
  for (let column=0;column<columns;column++) {
    const frequency=centres[0]+(centres.at(-1)-centres[0])*column/Math.max(1,columns-1);
    while (band+1<bands.length-1&&centres[band+1]<frequency) band++;
    const fraction=clamp((frequency-centres[band])/(centres[band+1]-centres[band]));
    result.push(clamp(((1-fraction)*energy[band]+fraction*energy[band+1])*style.fft_gain));
  }
  return result;
}
const zeros=(height,width)=>Array.from({length:height},()=>Array(width).fill(0));
function neighbours(y,x,height,width) {
  return [[y+1,x],[y-1,x],[y,x+1],[y,x-1]].filter(([yy,xx])=>yy>=0&&yy<height&&xx>=0&&xx<width);
}
export function thermal(grid,amount,iterations) {
  if (!amount||!iterations) return grid;
  const h=grid.length,w=grid[0].length;
  for (let iteration=0;iteration<iterations;iteration++) {
    const delta=zeros(h,w);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const candidates=neighbours(y,x,h,w).map(([yy,xx])=>[yy,xx,grid[y][x]-grid[yy][xx]-.035]).filter(row=>row[2]>0);
      const total=candidates.reduce((sum,row)=>sum+row[2],0);
      if (!total) continue;
      const transfer=Math.min(total*amount*.18,Math.max(0,grid[y][x])*.12);
      delta[y][x]-=transfer;
      for (const [yy,xx,difference] of candidates) delta[yy][xx]+=transfer*difference/total;
    }
    grid=grid.map((row,y)=>row.map((value,x)=>Math.max(0,value+delta[y][x])));
  }
  return grid;
}
function hydraulic(grid,amount,iterations) {
  if (!amount||!iterations) return grid;
  const h=grid.length,w=grid[0].length,water=zeros(h,w),sediment=zeros(h,w);
  for (let iteration=0;iteration<iterations;iteration++) {
    const dw=zeros(h,w),ds=zeros(h,w);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      water[y][x]+=.06*amount;
      const surface=grid[y][x]+water[y][x];
      const candidates=neighbours(y,x,h,w).map(([yy,xx])=>[yy,xx,surface-grid[yy][xx]-water[yy][xx]]).filter(row=>row[2]>0);
      const total=candidates.reduce((sum,row)=>sum+row[2],0);
      if (!total) continue;
      const flow=Math.min(water[y][x]*.45,total*.1),transported=Math.min(sediment[y][x],flow*.5);
      dw[y][x]-=flow;ds[y][x]-=transported;
      for (const [yy,xx,difference] of candidates) {dw[yy][xx]+=flow*difference/total;ds[yy][xx]+=transported*difference/total;}
      const capacity=flow*(.4+amount),eroded=Math.min(Math.max(0,grid[y][x])*.015,Math.max(0,capacity-sediment[y][x])*amount*.06);
      grid[y][x]-=eroded;sediment[y][x]+=eroded;
    }
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      water[y][x]=Math.max(0,(water[y][x]+dw[y][x])*.68);sediment[y][x]=Math.max(0,sediment[y][x]+ds[y][x]);
      const deposited=sediment[y][x]*.18;sediment[y][x]-=deposited;grid[y][x]+=deposited;
    }
  }
  return grid;
}
function glacial(grid,amount,iterations) {
  if (!amount||!iterations) return grid;
  const h=grid.length,w=grid[0].length;
  for (let iteration=0;iteration<iterations;iteration++) {
    const next=grid.map(row=>[...row]);
    for (let y=0;y<h;y++) {
      const drift=.13*Math.sin(y/Math.max(1,h-1)*Math.PI*1.2);
      for (let x=1;x<w-1;x++) {
        const coordinate=x/Math.max(1,w-1)-.5-drift,valley=Math.max(0,1-(Math.abs(coordinate)/.23)**4);
        const shoulder=Math.exp(-(((Math.abs(coordinate)-.3)/.075)**2)),filtered=.25*grid[y][x-1]+.5*grid[y][x]+.25*grid[y][x+1];
        next[y][x]=Math.max(0,grid[y][x]-amount*valley*.014+amount*shoulder*.002+amount*valley*.08*(filtered-grid[y][x]));
      }
    }
    grid=next;
  }
  return grid;
}
export function terrainField(frame,style) {
  const columns=style.segments+1;let positions,grid,sourcePips=[],sourceSha256=null;
  if (style.terrain_source==='fft') {
    if (!Array.isArray(frame.history)||!frame.history.length||frame.history.length>512||
        typeof frame.historySpanPips!=='number'||!Number.isFinite(frame.historySpanPips)||frame.historySpanPips<0||
        frame.history.some((row,index)=>!Number.isSafeInteger(row.pip)||typeof row.agePips!=='number'||!Number.isFinite(row.agePips)||row.agePips<0||
          index>0&&row.agePips>frame.history[index-1].agePips||!Array.isArray(row.values)||row.values.length!==frame.values.length||
          row.values.some(value=>!Number.isFinite(value)||Math.abs(value)>1.00001)))
      throw new TypeError('FFT terrain requires bounded chronological native source history');
    const rows=reduceRows(frame.history,style.rings+1);
    positions=rows.map(row=>clamp(1-row.agePips/Math.max(1,frame.historySpanPips)));
    sourcePips=rows.map(row=>row.pip);sourceSha256=frame.bands?.[0]?.sourceSha256??null;
    grid=rows.map(row=>spectrumProfile(frame,row.values,columns,style).map(value=>value*style.terrain_height));
    if (grid.length===1) {
      // One measured row forms a half-native-pip display cell at its actual
      // location. Its two geometric boundaries are not two recorded samples.
      const center=positions[0],half=.5/Math.max(1,frame.historySpanPips);
      positions=[clamp(center-half),clamp(center+half)];grid=[grid[0].slice(),grid[0].slice()];
    }
  } else {
    positions=Array.from({length:style.rings+1},(_,row)=>row/style.rings);
    grid=positions.map(v=>Array.from({length:columns},(_,column)=>{
      const u=column/(columns-1),ridges=Math.abs(fbm(u*4.2,v*4.2,style.seed));
      const base=.38*Math.sin(u*8.5+frame.sourceSeconds*.12)*Math.cos(v*7-frame.sourceSeconds*.06)+.35*(1-ridges)+.1*fbm(u*16,v*16,style.seed+40);
      return Math.max(0,base*style.terrain_height+.25);
    }));
  }
  if (style.weathering) for (let row=0;row<grid.length;row++) for (let col=0;col<columns;col++) {
    const edge=Math.abs(grid[row][Math.min(columns-1,col+1)]-grid[row][Math.max(0,col-1)]);
    grid[row][col]=Math.max(0,grid[row][col]+style.weathering*.035*fbm(col/(columns-1)*34,positions[row]*34,style.seed+7)*(1+Math.min(1,edge*4)));
  }
  grid=thermal(grid,style.thermal_erosion,style.erosion_iterations);
  grid=hydraulic(grid,style.hydraulic_erosion,style.erosion_iterations);
  grid=glacial(grid,style.glaciation,style.erosion_iterations);
  return {heights:grid,positions,sourcePips,sourceSha256};
}
