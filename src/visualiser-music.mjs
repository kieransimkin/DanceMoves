// FrameRudiments music_spatial_renderers.py CPU port, c8d1c9a (MIT).
// Copyright (c) 2026 Kieran Simkin. Full licence: visualiser-helpers.mjs.
import {clamp,numberStyle,booleanStyle,enumStyle} from './visualiser-helpers.mjs';
import {normaliseSolidStyle} from './visualiser-solid.mjs';
import {normalize,vertex,meshTriangles,checkSpatialFrame,shade,renderMesh} from './visualiser-raster.mjs';
import {fbm,spectrumProfile,terrainField} from './visualiser-terrain.mjs';

export const MUSIC_RENDERERS=Object.freeze(['spatial-music-torus','spatial-music-sphere','spatial-music-terrain']);
const musicFields=['terrain_source','terrain_height','fft_floor_db','fft_gain','mesh_gain','audio_displacement','audio_frequency',
  'audio_twist','audio_ripple_speed','texture_scale','texture_octaves','bump_strength','normal_strength','weathering','thermal_erosion',
  'hydraulic_erosion','glaciation','erosion_iterations','seed','snowline','ice_coverage','light_power','light_azimuth','light_elevation',
  'camera_pitch','spectral_deform','spectral_gain'];
export const musicNeedsSpectrum=style=>style.terrain_source==='fft'||style.spectral_deform===true;
export function validateMusicStyle(input={},renderer='spatial-music-torus') {
  if (!MUSIC_RENDERERS.includes(renderer)) throw new RangeError('Unknown music spatial renderer');
  // White is a neutral tint for the upstream procedural rock/snow material.
  // Authored colours now multiply that material instead of being ignored.
  const style=normaliseSolidStyle(input,renderer,musicFields,{colours:['#ffffff']});
  style.terrain_source=enumStyle(input,'terrain_source','procedural',['procedural','fft']);
  if (style.terrain_source==='fft'&&style.geometry!=='terrain') throw new RangeError('FFT terrain_source requires the terrain geometry');
  style.spectral_deform=booleanStyle(input,'spectral_deform',false);
  const numbers={spectral_gain:[.5,0,4],terrain_height:[1,0,5],fft_floor_db:[-72,-120,-6],fft_gain:[1,0,8],mesh_gain:[1,0,4],
    audio_displacement:[.18,0,2],audio_frequency:[4,.1,32],audio_twist:[.2,-4,4],audio_ripple_speed:[.4,0,12],
    texture_scale:[3,.01,64],texture_octaves:[4,1,8,true],bump_strength:[.24,0,4],normal_strength:[.45,0,4],
    weathering:[.3,0,1],thermal_erosion:[.2,0,1],hydraulic_erosion:[.15,0,1],glaciation:[.25,0,1],
    erosion_iterations:[4,0,24,true],seed:[17,0,2147483647,true],snowline:[.55,-2,4],ice_coverage:[.35,0,1],
    light_power:[2,0,16],camera_pitch:[0,-65,65]};
  for (const [key,args] of Object.entries(numbers)) style[key]=numberStyle(input,key,...args);
  if (Object.hasOwn(input,'light_azimuth')||Object.hasOwn(input,'light_elevation')) {
    style.light_azimuth=numberStyle(input,'light_azimuth',-125,-360,360);style.light_elevation=numberStyle(input,'light_elevation',45,-85,85);
    const a=style.light_azimuth*Math.PI/180,e=style.light_elevation*Math.PI/180;
    style.light_direction=Object.freeze(normalize([Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)]));
  }
  return Object.freeze(style);
}
export function musicMesh(frame,style) {
  checkSpatialFrame(frame);
  const time=frame.sourceSeconds,terrain=style.geometry==='terrain'?terrainField(frame,style):null;
  const profile=style.spectral_deform?spectrumProfile(frame,frame.values,style.segments+1,style):null;
  const rowPositions=terrain?.positions??Array.from({length:style.rings+1},(_,row)=>row/style.rings);
  const motion=[frame.values[0],frame.values[1]??0,frame.values[2]??0],positions=[];
  for (let row=0;row<rowPositions.length;row++) for (let col=0;col<=style.segments;col++) {
    const u=col/style.segments,v=rowPositions[row];let point;
    if (terrain) {
      point=[2.7*(u-.5),2.2*(v-.5),terrain.heights[row][col]-.32];
      if (style.terrain_source!=='fft') point[2]+=.065*motion[1]*Math.cos(u*10+time*style.audio_ripple_speed);
    } else point=vertex(style.geometry,u,v,1,time);
    const angle=style.audio_twist*motion[1]*(v-.5),c=Math.cos(angle),s=Math.sin(angle);
    point=[point[0]*c-point[1]*s,point[0]*s+point[1]*c,point[2]];
    const drive=motion[0]*Math.sin(2*Math.PI*style.audio_frequency*u-time*style.audio_ripple_speed)+
      .6*motion[1]*Math.cos(2*Math.PI*style.audio_frequency*v)+.35*motion[2]*Math.sin(2*Math.PI*(u+v));
    // The inherited depth control is neutral at its original .7 default and
    // now scales actual deformation instead of being accepted without effect.
    let delta=style.audio_displacement*style.mesh_gain*drive;
    if (profile) delta+=style.spectral_gain*.18*profile[col];
    delta*=style.depth/.7;
    if (terrain) point[2]+=delta;
    else {const normal=normalize(point);point=point.map((value,index)=>value+delta*normal[index]);}
    point[2]+=.025*style.bump_strength*fbm(u*style.texture_scale*5,v*style.texture_scale*5,style.seed);
    positions.push([...point,u,v]);
  }
  return {positions,triangles:meshTriangles(rowPositions.length,style.segments+1),
    ...(terrain&&style.terrain_source==='fft'?{sourcePips:terrain.sourcePips,sourceSha256:terrain.sourceSha256}:profile?{
      sourcePips:Number.isSafeInteger(frame.pip)?[frame.pip]:[],sourceSha256:frame.bands[0].sourceSha256}:{})};
}
function material(center,normal,style,tint) {
  const n=fbm(center[0]*style.texture_scale,center[1]*style.texture_scale,style.seed,style.texture_octaves);
  const slope=1-Math.abs(normal[2]),age=Math.max(0,style.weathering*(.5+.5*n));
  const ice=clamp(style.ice_coverage*style.glaciation*Math.max(0,(center[2]-style.snowline+.15)*1.8));
  const rock=[106+54*n,94+45*n,91+50*n],moss=[51+30*n,101+34*n,70+22*n],snow=[200+20*n,220+14*n,231+10*n];
  const blend=clamp((.5-slope)*(1-age)),snowCover=clamp((center[2]-style.snowline)*1.8+style.glaciation*.12);
  return rock.map((value,index)=>{
    const base=(value*(1-blend)+moss[index]*blend)*(1-snowCover)+snow[index]*snowCover;
    return clamp((base*(1-ice)+[146,214,232][index]*ice)*tint[index]/255,0,255);
  });
}
export function drawMusic(context,width,height,frame,renderer,style=validateMusicStyle({},renderer),surface) {
  if (!MUSIC_RENDERERS.includes(renderer)) throw new RangeError('Unknown music spatial renderer');
  const mesh=musicMesh(frame,style);
  const lighting={...style,ambient:style.ambient*style.light_power};
  return renderMesh(context,width,height,frame,style,surface,mesh,(indices,normal,center,palette,light)=>{
    const u=indices.reduce((sum,index)=>sum+mesh.positions[index][3],0)/3,v=indices.reduce((sum,index)=>sum+mesh.positions[index][4],0)/3,e=.02;
    const nx=fbm((u+e)*style.texture_scale,v*style.texture_scale,style.seed)-fbm((u-e)*style.texture_scale,v*style.texture_scale,style.seed);
    const ny=fbm(u*style.texture_scale,(v+e)*style.texture_scale,style.seed)-fbm(u*style.texture_scale,(v-e)*style.texture_scale,style.seed);
    const perturbed=normalize([normal[0]-nx*style.normal_strength*.5,normal[1]-ny*style.normal_strength*.5,normal[2]]);
    const tint=palette[Math.min(palette.length-1,Math.floor(v*palette.length))],base=material(center,perturbed,style,tint);
    return shade(perturbed,center,base,lighting,light,style.light_power/2);
  });
}
