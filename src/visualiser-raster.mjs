// CPU raster adaptation of FrameRudiments solid_spatial_renderers.py, c8d1c9a.
// Copyright (c) 2026 Kieran Simkin. MIT notice: visualiser-helpers.mjs.
import {clamp} from './visualiser-helpers.mjs';

export const normalize = vector => {
  const largest = Math.max(...vector.map(Math.abs));
  if (!largest) return [0,0,1];
  const scaled = vector.map(value => value / largest), length = Math.hypot(...scaled);
  return scaled.map(value => value / length);
};
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a.reduce((sum,value,index) => sum + value*b[index],0);
export function rotate(point,yaw,pitch) {
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const x=point[0]*cy+point[2]*sy,z=-point[0]*sy+point[2]*cy;
  return [x,point[1]*cp-z*sp,point[1]*sp+z*cp];
}
export function vertex(shape,u,v,amplitude=1,wave=0) {
  const a=2*Math.PI*u;
  if (shape==='torus') {
    const b=2*Math.PI*v,r=1.1+.43*Math.cos(b);
    return [r*Math.cos(a)*amplitude,r*Math.sin(a)*amplitude,.43*Math.sin(b)*amplitude];
  }
  if (shape==='sphere') return [Math.sin(Math.PI*v)*Math.cos(a)*amplitude,
    Math.sin(Math.PI*v)*Math.sin(a)*amplitude,Math.cos(Math.PI*v)*amplitude];
  return [2.7*(u-.5),2.2*(v-.5),(.23*Math.sin(4*Math.PI*u+wave)*Math.cos(3*Math.PI*v-wave*.4)+.12*Math.cos(9*u+7*v))*amplitude];
}
export function meshTriangles(rows,columns) {
  const triangles=[];
  for (let row=0;row<rows-1;row++) for (let col=0;col<columns-1;col++) {
    const a=row*columns+col,b=a+columns,c=a+1,d=b+1;
    triangles.push([a,b,c],[b,d,c]);
  }
  return triangles;
}
export function checkSpatialFrame(frame) {
  if (!frame || !Array.isArray(frame.values) || !frame.values.length || frame.values.length>64 ||
      frame.values.some(value=>typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1.00001))
    throw new TypeError('Spatial views require 1..64 finite normalized native values');
  if (typeof frame.sourceSeconds!=='number'||!Number.isFinite(frame.sourceSeconds)||frame.sourceSeconds<0)
    throw new TypeError('Spatial views require finite nonnegative source seconds');
}
export function shade(normal,point,base,style,lightColour,directPower=1) {
  const view=normalize([-point[0],-point[1],style.camera_distance-point[2]]);
  if (dot(normal,view)<0) normal=normal.map(value=>-value);
  const nl=Math.max(0,dot(normal,style.light_direction)),nv=Math.max(1e-4,dot(normal,view));
  const half=normalize(view.map((value,index)=>value+style.light_direction[index]));
  const nh=Math.max(0,dot(normal,half)),vh=Math.max(0,dot(view,half));
  const alpha2=style.roughness**4,distribution=alpha2/(Math.PI*(nh*nh*(alpha2-1)+1)**2+1e-8);
  const k=(style.roughness+1)**2/8,geometry=nv/(nv*(1-k)+k)*nl/(nl*(1-k)+k);
  const linear=byte=>{const v=byte/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
  const srgb=value=>{const v=clamp(value);return Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));};
  return base.slice(0,3).map((channel,index)=>{
    const albedo=linear(channel),lamp=linear(lightColour[index]);
    const f0=.04*(1-style.metallic)+albedo*style.metallic,fresnel=f0+(1-f0)*(1-vh)**5;
    const specular=distribution*geometry*fresnel/Math.max(1e-5,4*nv*Math.max(nl,1e-5));
    const diffuse=(1-fresnel)*(1-style.metallic)*albedo/Math.PI;
    return srgb(albedo*style.ambient*.45+(diffuse+specular)*lamp*nl*3.2*directPower);
  });
}

/** Genuine per-pixel perspective-correct depth; triangle ordering is irrelevant. */
function triangleBounds(width,height,vertices) {
  const [[x0,y0,d0],[x1,y1,d1],[x2,y2,d2]]=vertices;
  const area=(x1-x0)*(y2-y0)-(y1-y0)*(x2-x0);
  if (!Number.isFinite(area)||Math.abs(area)<1e-8||Math.min(d0,d1,d2)<=0) return null;
  const xa=Math.max(0,Math.ceil(Math.min(x0,x1,x2)-.5)),xb=Math.min(width-1,Math.floor(Math.max(x0,x1,x2)-.5));
  const ya=Math.max(0,Math.ceil(Math.min(y0,y1,y2)-.5)),yb=Math.min(height-1,Math.floor(Math.max(y0,y1,y2)-.5));
  return xa>xb||ya>yb?null:{xa,xb,ya,yb,area};
}
export function rasterTriangle(target,vertices,colour) {
  const bounds=triangleBounds(target.width,target.height,vertices);
  if (!bounds) return 0;
  const {xa,xb,ya,yb,area}=bounds,[[x0,y0,d0],[x1,y1,d1],[x2,y2,d2]]=vertices;
  let writes=0;
  for (let y=ya;y<=yb;y++) for (let x=xa;x<=xb;x++) {
    const sx=x+.5,sy=y+.5;
    const a=((x1-sx)*(y2-sy)-(y1-sy)*(x2-sx))/area;
    const b=((x2-sx)*(y0-sy)-(y2-sy)*(x0-sx))/area,c=1-a-b;
    if (Math.min(a,b,c)<-1e-9) continue;
    const depth=1/(a/d0+b/d1+c/d2),index=y*target.width+x;
    if (depth<target.depths[index]) {
      target.depths[index]=depth;
      for (let channel=0;channel<4;channel++) target.pixels[index*4+channel]=colour[channel]??255;
      writes++;
    }
  }
  return writes;
}
function clipNear(points,distance) {
  const result=[];
  for (let index=0;index<points.length;index++) {
    const a=points[index],b=points[(index+1)%points.length],da=distance-a[2]-.12,db=distance-b[2]-.12;
    if (da>=0) result.push(a);
    if ((da>=0)!==(db>=0)) {const f=da/(da-db);result.push(a.map((v,i)=>v+(b[i]-v)*f));}
  }
  return result;
}

function hexColour(value) {
  const match=/^#([a-f\d]{3,8})$/i.exec(value);
  if (!match||![3,4,6,8].includes(match[1].length)) return null;
  const hex=match[1].length<5?[...match[1]].map(c=>c+c).join(''):match[1];
  return [0,2,4,6].map((offset,index)=>index===3&&hex.length===6?255:parseInt(hex.slice(offset,offset+2),16));
}
/** A lazy per-view raster owner. No source frame, history, asset URL or global DOM. */
export function createSpatialSurface(createCanvas) {
  if (typeof createCanvas!=='function') throw new TypeError('Spatial surface needs a canvas factory');
  let canvas=null,context=null,image=null,depths=null,blur=null,width=0,height=0,destroyed=false;
  const colours=new Map();
  function ensureCanvas() {
    if (destroyed) throw new Error('Spatial surface was destroyed');
    if (!canvas) {canvas=createCanvas();context=canvas?.getContext?.('2d',{willReadFrequently:true});}
    if (!context) throw new Error('Canvas 2D is unavailable for spatial rasterization');
  }
  const surface={
    colour(value) {
      if (destroyed) throw new Error('Spatial surface was destroyed');
      if (colours.has(value)) return colours.get(value);
      let rgb=value==='transparent'?[0,0,0,0]:hexColour(value);
      if (!rgb) {
        ensureCanvas();
        context.save();
        try {context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);rgb=Array.from(context.getImageData(0,0,1,1).data);}
        finally {context.restore();}
      }
      rgb=Object.freeze(rgb);colours.set(value,rgb);
      if (colours.size>64) colours.delete(colours.keys().next().value);
      return rgb;
    },
    begin(w,h,background) {
      ensureCanvas();
      if (!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>1048576||Math.max(w,h)>1024)
        throw new RangeError('Spatial raster exceeds its bounded pixel budget');
      if (w!==width||h!==height) {
        canvas.width=w;canvas.height=h;width=w;height=h;
        image=context.createImageData(w,h);depths=new Float32Array(w*h);blur=new Uint8ClampedArray(w*h*4);
      }
      depths.fill(Infinity);
      for (let i=0;i<image.data.length;i++) image.data[i]=background[i%4];
      return {width,height,pixels:image.data,depths,blur};
    },
    present(destination,w,h) {
      if (destroyed||!image) throw new Error('Spatial raster is unavailable');
      context.putImageData(image,0,0);
      destination.save();
      try {destination.clearRect(0,0,w,h);destination.imageSmoothingEnabled=true;destination.drawImage(canvas,0,0,w,h);}
      finally {destination.restore();}
    },
    destroy() {
      if (destroyed) return;destroyed=true;
      if (canvas) {canvas.width=1;canvas.height=1;}
      image=null;depths=null;blur=null;context=null;canvas=null;createCanvas=null;width=0;height=0;colours.clear();
    },
    snapshot:()=>Object.freeze({destroyed,width,height,bytes:width*height*12,paletteEntries:colours.size})
  };
  surface.dispose=surface.destroy;
  return Object.freeze(surface);
}

export function applyFog(target,style,colour,time) {
  if (!style.fog) return;
  // fog_resolution is a grid cap; the overall raster is separately capped.
  const scale=Math.min(1,style.fog_resolution/Math.max(target.width,target.height));
  const fw=Math.max(1,Math.round(target.width*scale)),fh=Math.max(1,Math.round(target.height*scale));
  // Reuse the owned blur scratch space for the low-resolution opacity image.
  const haze=target.blur??new Uint8Array(fw*fh);
  for (let yy=0;yy<fh;yy++) for (let xx=0;xx<fw;xx++) {
    const x=Math.min(target.width-1,Math.floor((xx+.5)*target.width/fw));
    const y=Math.min(target.height-1,Math.floor((yy+.5)*target.height/fh));
    const depth=target.depths[y*target.width+x],far=Number.isFinite(depth)?depth:style.camera_distance*1.9;
    const span=Math.max(0,far-.12),dt=span/style.fog_steps;
    let optical=0;
    for (let step=0;step<style.fog_steps;step++) {
      const travel=(step+.5)*dt,px=(x/target.width-.5)*travel,py=(y/target.height-.5)*travel;
      const density=.72+.16*Math.sin(2.3*px+1.4*travel+time*.6)+.12*Math.cos(2.8*py-travel*.7+time*.4);
      optical+=Math.max(0,density)*dt;
    }
    haze[yy*fw+xx]=Math.round(255*clamp(1-Math.exp(-optical*style.fog/style.camera_distance)));
  }
  // The original CPU pass bilinearly expands its bounded fog grid. Missing
  // geometry still terminates at the far background; no measured rows are made.
  for (let y=0;y<target.height;y++) for (let x=0;x<target.width;x++) {
    const u=clamp((x+.5)*fw/target.width-.5,0,fw-1),v=clamp((y+.5)*fh/target.height-.5,0,fh-1);
    const x0=Math.floor(u),y0=Math.floor(v),x1=Math.min(fw-1,x0+1),y1=Math.min(fh-1,y0+1),fx=u-x0,fy=v-y0;
    const alpha=((1-fy)*((1-fx)*haze[y0*fw+x0]+fx*haze[y0*fw+x1])+fy*((1-fx)*haze[y1*fw+x0]+fx*haze[y1*fw+x1]))/255;
    const offset=(y*target.width+x)*4,oldAlpha=target.pixels[offset+3]/255,nextAlpha=alpha+oldAlpha*(1-alpha);
    if (nextAlpha) for (let channel=0;channel<3;channel++) target.pixels[offset+channel]=
      (colour[channel]*alpha+target.pixels[offset+channel]*oldAlpha*(1-alpha))/nextAlpha;
    target.pixels[offset+3]=nextAlpha*255;
  }
}
function glow(target,amount) {
  if (!amount) return;
  const {width,height,pixels,blur}=target;
  // A bounded separable five-tap soft halo, preserving premultiplied alpha.
  // Scalar accumulation keeps the original tap order and exact output while
  // avoiding two short-lived RGB arrays per raster pixel on every frame.
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    let alpha=0,red=0,green=0,blue=0;
    for (let dx=-2;dx<=2;dx++) {const o=(y*width+clamp(x+dx,0,width-1))*4,a=pixels[o+3]/255;
      alpha+=a;red+=pixels[o]*a;green+=pixels[o+1]*a;blue+=pixels[o+2]*a;}
    const o=(y*width+x)*4;
    blur[o]=alpha?red/alpha:0;blur[o+1]=alpha?green/alpha:0;blur[o+2]=alpha?blue/alpha:0;blur[o+3]=alpha/5*255;
  }
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    let alpha=0,red=0,green=0,blue=0;
    for (let dy=-2;dy<=2;dy++) {const o=(clamp(y+dy,0,height-1)*width+x)*4,a=blur[o+3]/255;
      alpha+=a;red+=blur[o]*a;green+=blur[o+1]*a;blue+=blur[o+2]*a;}
    const o=(y*width+x)*4,mix=amount*.28,oldAlpha=pixels[o+3]/255,softAlpha=alpha/5,a=oldAlpha*(1-mix)+softAlpha*mix;
    pixels[o]=a?(pixels[o]*oldAlpha*(1-mix)+(alpha?red/alpha:0)*softAlpha*mix)/a:0;
    pixels[o+1]=a?(pixels[o+1]*oldAlpha*(1-mix)+(alpha?green/alpha:0)*softAlpha*mix)/a:0;
    pixels[o+2]=a?(pixels[o+2]*oldAlpha*(1-mix)+(alpha?blue/alpha:0)*softAlpha*mix)/a:0;
    pixels[o+3]=a*255;
  }
}

export function renderMesh(context,width,height,frame,style,surface,mesh,material) {
  if (!surface?.begin||!surface?.present) throw new TypeError('Spatial renderer needs its mounted raster surface');
  if (![width,height].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0)) throw new TypeError('Invalid spatial viewport');
  const report=(stats)=>Object.freeze({backend:'cpu',...(style.backend==='auto'?{fallbackReason:'The browser spatial renderer uses the deterministic CPU backend; native OpenGL is not available.'}:{}),
    geometry:style.geometry,depthBuffer:'per-pixel reciprocal camera depth',shading:'linear-light Cook-Torrance GGX',
    fog:style.fog?'depth-terminated bounded fog':'off',shadows:'not calculated by the CPU backend',...stats});
  if (!width||!height) {context.clearRect(0,0,width,height);return report({rasterWidth:0,rasterHeight:0,triangles:0,coveredPixels:0,
    rasterPixelTests:0,rasterLimited:false,sourcePips:Object.freeze([]),sourceSha256:null});}
  let scale=Math.min(1,style.raster_size/Math.max(width,height));
  let rw=Math.max(1,Math.floor(width*scale)),rh=Math.max(1,Math.floor(height*scale));
  const time=frame.sourceSeconds,yaw=(style.rotation+style.orbit*time+frame.values[0]*45)*Math.PI/180;
  const pitch=.32+(frame.values[1]??frame.values[0])*.38+(style.camera_pitch??0)*Math.PI/180;
  const transformed=mesh.positions.map(point=>rotate(point,yaw,pitch));
  const faces=[];
  for (const indices of mesh.triangles) {
    const points=indices.map(index=>transformed[index]);
    const clipped=clipNear(points,style.camera_distance);
    if (clipped.length<3) continue;
    const normal=normalize(cross(points[1].map((value,i)=>value-points[0][i]),points[2].map((value,i)=>value-points[0][i])));
    const center=points[0].map((_,i)=>(points[0][i]+points[1][i]+points[2][i])/3);
    faces.push({indices,normal,center,clipped});
  }
  // Extreme displacement can put many triangle boxes over the whole viewport.
  // Bound real candidate-pixel work, retaining every clipped face and its depth.
  // Resolution depends only on the current source/style/viewport, never timing.
  const pixelBudget=8388608;
  let projectedFaces,rasterPixelTests,rasterLimited=false;
  for (;;) {
    const focal=(Math.min(rw,rh)-2*Math.min(style.padding*scale,Math.min(rw,rh)/4))/(2*Math.tan(style.fov*Math.PI/360));
    rasterPixelTests=0;
    projectedFaces=faces.map(face=>{
      const points=face.clipped.map(point=>{const depth=style.camera_distance-point[2];return [rw/2+focal*point[0]/depth,rh/2-focal*point[1]/depth,depth];});
      const triangles=[];
      for (let index=1;index+1<points.length;index++) {
        const vertices=[points[0],points[index],points[index+1]],bounds=triangleBounds(rw,rh,vertices);
        if (bounds) rasterPixelTests+=(bounds.xb-bounds.xa+1)*(bounds.yb-bounds.ya+1);
        triangles.push(vertices);
      }
      return {face,triangles};
    });
    if (rasterPixelTests<=pixelBudget) break;
    scale*=Math.min(.85,.98*Math.sqrt(pixelBudget/rasterPixelTests));
    rw=Math.max(1,Math.floor(width*scale));rh=Math.max(1,Math.floor(height*scale));rasterLimited=true;
  }
  const target=surface.begin(rw,rh,surface.colour(style.background));
  const light=surface.colour(style.light_colour),palette=style.colours.map(colour=>surface.colour(colour));
  let triangles=0;
  for (const {face,triangles:projected} of projectedFaces) {
    const base=material(face.indices,face.normal,face.center,palette,light);
    for (const vertices of projected) {rasterTriangle(target,vertices,base);triangles++;}
  }
  let coveredPixels=0;for (const depth of target.depths) if (Number.isFinite(depth)) coveredPixels++;
  applyFog(target,style,surface.colour(style.fog_colour),time);glow(target,style.glow);surface.present(context,width,height);
  return report({rasterWidth:rw,rasterHeight:rh,triangles,coveredPixels,rasterPixelTests,rasterLimited,
    sourcePips:Object.freeze([...(mesh.sourcePips??(Number.isSafeInteger(frame.pip)?[frame.pip]:[]))]),sourceSha256:mesh.sourceSha256??null});
}
