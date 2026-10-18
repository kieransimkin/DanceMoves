// FrameRudiments solid_spatial_renderers.py CPU port, c8d1c9a (MIT).
// Copyright (c) 2026 Kieran Simkin. Full licence: visualiser-helpers.mjs.
import {normaliseBaseStyle,numberStyle,colourStyle,enumStyle} from './visualiser-helpers.mjs';
import {normalize,vertex,meshTriangles,checkSpatialFrame,shade,renderMesh} from './visualiser-raster.mjs';
export {createSpatialSurface} from './visualiser-raster.mjs';

export const SOLID_RENDERERS=Object.freeze(['spatial-solid-torus','spatial-solid-sphere','spatial-solid-terrain']);
export const SOLID_STYLE_FIELDS=Object.freeze(['geometry','backend','camera_distance','fov','rotation','orbit','depth','rings','segments',
  'ambient','roughness','metallic','light_direction','light_colour','fog','fog_colour','fog_steps','fog_resolution','glow','raster_size']);
export function normaliseSolidStyle(input,renderer,extraFields=[],defaults={}) {
  const style=normaliseBaseStyle(input,[...SOLID_STYLE_FIELDS,...extraFields],
    {padding:8,background:'#101b2e',colours:['#5bc9ef','#f6a6c9','#bea9fc'],...defaults});
  style.geometry=renderer.split('-').at(-1);
  if (Object.hasOwn(input,'geometry')&&input.geometry!==style.geometry) throw new RangeError('Spatial geometry must match its renderer');
  style.backend=enumStyle(input,'backend','cpu',['cpu','auto','gpu']);
  if (style.backend==='gpu') throw new TypeError('The GPU spatial backend is unsupported in DanceMoves; select cpu or auto');
  if (style.colours.length>16) throw new RangeError('Spatial colours must contain 1..16 CSS colours');
  const numbers={camera_distance:[4.8,2.5,30],fov:[55,20,110],rotation:[0,-360,360],orbit:[35,-360,360],depth:[.7,0,2],
    rings:[14,3,48,true],segments:[24,6,72,true],padding:[8,0,256,true],ambient:[.26,0,1],roughness:[.42,.06,1],metallic:[.2,0,1],
    fog:[.18,0,1],fog_steps:[6,2,24,true],fog_resolution:[240,64,720,true],glow:[.18,0,1],raster_size:[512,64,1024,true]};
  for (const [key,args] of Object.entries(numbers)) style[key]=numberStyle(input,key,...args);
  style.light_colour=colourStyle(Object.hasOwn(input,'light_colour')?input.light_colour:'#ffffff');
  style.fog_colour=colourStyle(Object.hasOwn(input,'fog_colour')?input.fog_colour:'#597ca3');
  const direction=Object.hasOwn(input,'light_direction')?input.light_direction:[-.45,-.35,.82];
  if (!Array.isArray(direction)||direction.length!==3||direction.some(value=>typeof value!=='number'||!Number.isFinite(value))||!direction.some(value=>value!==0))
    throw new TypeError('light_direction must be a nonzero finite three-dimensional vector');
  style.light_direction=Object.freeze(normalize(direction));
  return style;
}
export function validateSolidStyle(input={},renderer='spatial-solid-torus') {
  if (!SOLID_RENDERERS.includes(renderer)) throw new RangeError('Unknown solid spatial renderer');
  return Object.freeze(normaliseSolidStyle(input,renderer));
}
export function drawSolid(context,width,height,frame,renderer,style=validateSolidStyle({},renderer),surface) {
  if (!SOLID_RENDERERS.includes(renderer)) throw new RangeError('Unknown solid spatial renderer');
  checkSpatialFrame(frame);
  const amplitude=1+style.depth*Math.abs(frame.values[0])*.22,positions=[];
  for (let row=0;row<=style.rings;row++) for (let col=0;col<=style.segments;col++) {
    const u=col/style.segments,v=row/style.rings;
    positions.push([...vertex(style.geometry,u,v,amplitude,frame.sourceSeconds+frame.values[0]),u,v]);
  }
  const mesh={positions,triangles:meshTriangles(style.rings+1,style.segments+1)};
  return renderMesh(context,width,height,frame,style,surface,mesh,(indices,normal,center,palette,light)=>{
    const v=positions[indices[0]][4],base=palette[Math.min(palette.length-1,Math.floor(v*palette.length))];
    return shade(normal,center,base,style,light);
  });
}
