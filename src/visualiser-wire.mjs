// Canvas adaptation of FrameRudiments spatial_renderers.py (c8d1c9a, MIT).
// Copyright (c) 2026 Kieran Simkin. Full upstream licence: visualiser-helpers.mjs.
import {clamp, normaliseBaseStyle, numberStyle, ink, withViewport} from './visualiser-helpers.mjs';

export const WIRE_RENDERERS = Object.freeze(['spatial-torus', 'spatial-sphere', 'spatial-terrain']);
export function validateWireStyle(input = {}, renderer = 'spatial-torus') {
  if (!WIRE_RENDERERS.includes(renderer)) throw new RangeError('Unknown spatial wire renderer');
  const allowed = ['geometry','camera_distance','fov','rotation','orbit','depth','line_width','fog','glow','rings','segments'];
  const style = normaliseBaseStyle(input, allowed, {padding: 8, background: '#101b2e', colours: ['#68d9f4','#fa7dbb']});
  if (style.colours.length > 16) throw new RangeError('Wire colours must contain 1..16 CSS colours');
  style.geometry = renderer.slice(8);
  if (Object.hasOwn(input, 'geometry') && input.geometry !== style.geometry) throw new RangeError('Wire geometry must match its renderer');
  const fields = {camera_distance:[4.8,2.5,30], fov:[55,20,110], rotation:[0,-360,360], orbit:[35,-360,360],
    depth:[.7,0,2], line_width:[2,1,24,true], fog:[.22,0,1], glow:[.35,0,1], rings:[13,3,48,true], segments:[30,6,96,true], padding:[8,0,256,true]};
  for (const [key, args] of Object.entries(fields)) style[key] = numberStyle(input, key, ...args);
  return Object.freeze(style);
}
function point(kind, u, v) {
  const a = 2 * Math.PI * u, b = 2 * Math.PI * v;
  if (kind === 'torus') {const r = 1.15 + .42 * Math.cos(b);return [r * Math.cos(a), r * Math.sin(a), .42 * Math.sin(b)];}
  if (kind === 'sphere') return [Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)];
  return [2 * (u - .5), 2 * (v - .5), .24 * Math.sin(a * 2) * Math.cos(b * 2)];
}
export function drawWire(context, width, height, frame, renderer, style) {
  if (!WIRE_RENDERERS.includes(renderer)) throw new RangeError('Unknown spatial wire renderer');
  if (!frame.values.length || frame.values.some(value => !Number.isFinite(value) || Math.abs(value) > 1)) throw new TypeError('Wire views require normalized native values');
  withViewport(context, width, height, style, style.line_width / 2, (area, draw) => {
    const time = frame.sourceSeconds ?? 0;
    const yaw = (style.rotation + style.orbit * time + frame.values[0] * 45) * Math.PI / 180;
    const pitch = .27 + (frame.values[1] ?? frame.values[0]) * .3;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const amplitude = 1 + style.depth * Math.abs(frame.values[0]) * .3;
    const focal = .5 * Math.min(area.width, area.height) / Math.tan(style.fov * Math.PI / 360);
    const points = [], edges = [];
    const columns = style.segments + 1;
    for (let a = 0; a <= style.rings; a++) for (let b = 0; b <= style.segments; b++) {
      const raw = point(renderer.slice(8), a / style.rings, b / style.segments).map(value => value * amplitude);
      const x = raw[0] * cy + raw[2] * sy, z0 = -raw[0] * sy + raw[2] * cy;
      const y = raw[1] * cp - z0 * sp, z = raw[1] * sp + z0 * cp;
      const distance = style.camera_distance - z;
      points.push(distance <= .01 ? null : [width / 2 + focal * x / distance, height / 2 - focal * y / distance, z]);
    }
    for (let a = 0; a <= style.rings; a++) for (let b = 0; b <= style.segments; b++) {
      const p = points[a * columns + b];
      if (!p) continue;
      for (const q of [a < style.rings ? points[(a + 1) * columns + b] : null, b < style.segments ? points[a * columns + b + 1] : null]) {
        if (!q) continue;
        const z = (p[2] + q[2]) / 2;
        const attenuation = 1 - style.fog * clamp((style.camera_distance - z) / style.camera_distance);
        edges.push({p, q, z, colour: ink(style, Math.floor(a * style.colours.length / (style.rings + 1)), 210 * attenuation)});
      }
    }
    edges.sort((a, b) => a.z - b.z);
    // Layered bounded strokes approximate the offline Gaussian glow without
    // pixel reads, extra backing buffers or a GPU/depth-buffer dependency.
    if (style.glow) for (const edge of edges) draw.line([edge.p, edge.q], {...edge.colour, alpha: edge.colour.alpha * style.glow * .3}, style.line_width * 4);
    for (const edge of edges) draw.line([edge.p, edge.q], edge.colour, style.line_width);
  });
}
