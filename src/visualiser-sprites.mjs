// Canvas adaptation of FrameRudiments sprite_renderers.py at
// c8d1c9a75630a88324e49a1446820392514092dd.
// Copyright (c) 2026 Kieran Simkin. MIT licensed; the full permission and
// warranty notice is retained in the imported visualiser-helpers.mjs.
import {clamp, reduceRows, normaliseBaseStyle, numberStyle, booleanStyle,
  enumStyle, colourStyle, bandLevels, withViewport} from './visualiser-helpers.mjs';
import {SPRITE_THEMES, validateSpriteAsset} from './visualiser-sprite-catalogue.mjs';

const spectrumModes = ['lcd','lcd-horizontal','lcd-mirrored','led','led-radial','vfd',
  'retro','neon','crystal','fire','ice','icons','petals','ring','halo','mosaic','city',
  'gauge','spokes','orbits'];
const spectrogramModes = ['lcd','led','pixels','heatmap','icons','neon','crystal','fire',
  'radial','spiral','rain','blocks'];
const waveformModes = ['lcd','led','dots','icons','neon','ribbon','bars','mirrored',
  'annular','spiral','sparks','crystal'];
const motionModes = ['path','orbit','cloud','constellation','trails','particles','xy','icon-grid'];
export const SPRITE_RENDERERS = Object.freeze([
  ...spectrumModes.map(name => 'sprite-spectrum-' + name),
  ...spectrogramModes.map(name => 'sprite-spectrogram-' + name),
  ...waveformModes.map(name => 'sprite-waveform-' + name),
  ...motionModes.map(name => 'sprite-motion-' + name)
]);
export const SPRITE_LIMITS = Object.freeze({
  cacheEntries: 128, cachePixels: 8388608, tileDimension: 1024,
  atlasDimension: 4096, atlasPixels: 16777216
});
const names = new Set(SPRITE_RENDERERS);
const shapes = Object.freeze({segment:0,dot:1,tube:2,crystal:3,icon:4,spark:5,block:6,flame:7});
const approved = new WeakMap(), appearanceKeys = new WeakMap();
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const radians = value => value * Math.PI / 180;
const round = value => {
  const lower = Math.floor(value);
  return value - lower === .5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(value);
};
// [default, minimum, maximum, integer]. The four rounded controls deliberately
// accept finite fractional values, as upstream's per-cell style does.
const extraNumbers = Object.freeze({
  sprite_scale:[1,.05,8],sprite_scale_x:[1,.05,8],sprite_scale_y:[1,.05,8],
  sprite_rotation:[0,-3600,3600],sprite_spin:[0,-90,90],
  sprite_offset_x:[0,-1024,1024],sprite_offset_y:[0,-1024,1024],
  sprite_layout_rotation:[0,-360,360],sprite_spread:[1,0,4],
  sprite_anchor_x:[0,-1,1],sprite_anchor_y:[0,-1,1],
  sprite_shear_x:[0,-.8,.8],sprite_shear_y:[0,-.8,.8],
  sprite_jitter:[0,0,48],sprite_angle_jitter:[0,0,180],sprite_visible_fraction:[1,0,1],
  sprite_palette_shift:[0,-64,64],sprite_animation_rate:[1,0,16],
  sprite_animation_phase:[0,-10000,10000],sprite_hue_shift:[0,-3600,3600],
  sprite_saturation:[1,0,4],sprite_brightness:[1,0,4],sprite_contrast:[1,0,4],
  sprite_gamma:[1,.1,5],sprite_temperature:[0,-1,1],
  sprite_red:[1,0,4],sprite_green:[1,0,4],sprite_blue:[1,0,4],
  sprite_posterize:[0,0,16],sprite_pixel_size:[1,1,16],sprite_blur:[0,0,16],
  sprite_glow:[0,0,20],sprite_outline:[0,0,10],sprite_shadow:[0,0,20],
  sprite_shadow_x:[2,-64,64],sprite_shadow_y:[3,-64,64],sprite_shadow_opacity:[.6,0,1],
  sprite_scanlines:[0,0,1],sprite_grain:[0,0,1],sprite_sharpen:[0,0,4]
});
const baseNumbers = Object.freeze({
  sprite_columns:[8,1,32,true],sprite_rows:[8,1,32,true],
  sprite_size:[12,2,256,true],sprite_opacity:[1,0,1],tint_strength:[1,0,1],
  segment_count:[12,2,64,true],segment_gap:[.18,0,.8],off_opacity:[.1,0,1],
  bar_gap:[.16,0,.9],start_angle:[-90,-3600,3600],sweep_angle:[360,5,360],
  inner_radius:[.28,0,.9],outer_radius:[.93,.1,1],history_limit:[64,2,512,true],
  bin_stride:[1,1,64,true],sample_stride:[1,1,32,true],spacing:[5,1,64,true],
  threshold:[.035,0,1],floor_db:[-72,-240,0],animation_frames:[1,1,8,true],
  animation_stride:[6,1,240,true],axis:[0,0,255,true],rings:[3,1,16,true],
  twists:[2,.1,20],seed:[0,0,4294967295,true],max_stamps:[8000,1,25000,true]
});
const allowed = [...Object.keys(extraNumbers),...Object.keys(baseNumbers),
  'sprite_theme','sprite_asset','shape','sprite_index','sprite_colour','orientation',
  'ceiling_db','mirror','pixelated','sprite_blend','sprite_tint_colour','sprite_outline_colour'];

function modeDefaults(renderer) {
  if (renderer.startsWith('sprite-spectrum-lcd')) return ['lcd','segment'];
  const suffix = renderer.split('-').at(-1);
  if (['lcd','blocks','mosaic','pixels','retro','city','gauge'].includes(suffix)) return ['lcd','segment'];
  if (['led','dots','particles','orbits','cloud','constellation','sparks','halo'].includes(suffix)) return ['led','dot'];
  if (['crystal','ice'].includes(suffix)) return [suffix,'crystal'];
  if (suffix === 'fire') return ['fire','flame'];
  if (['icons','petals','icon-grid','path','trails','xy','orbit'].includes(suffix)) return ['generated-neon','icon'];
  if (['vfd','neon','ring','spokes','annular'].includes(suffix)) return ['vfd','tube'];
  if (['pixel','heatmap'].includes(suffix)) return ['pixel','block'];
  if (['ribbon','spiral','radial'].includes(suffix)) return ['generated-neon','spark'];
  return ['arcade','block'];
}


function checkedFrame(frame) {
  const values = frame?.values;
  const valid = input => Array.isArray(input) && input.length === values.length &&
    input.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1);
  if (!Array.isArray(values) || !values.length || values.length > 64 || !valid(values))
    throw new TypeError('Sprite visualisers require 1..64 finite normalized native channels');
  if (!Number.isSafeInteger(frame.spriteFrame))
    throw new TypeError('Sprite animation requires an integer source-clock frame at 60 fps');
  if (!Array.isArray(frame.history) || !frame.history.length || frame.history.length > 512 ||
      !Number.isFinite(frame.historySpanPips) || frame.historySpanPips < 0 ||
      frame.history.some((row, index) => !valid(row?.values) || !Number.isFinite(row.agePips) || row.agePips < 0 ||
        index > 0 && row.agePips > frame.history[index - 1].agePips) ||
      frame.history.at(-1).agePips !== 0)
    throw new TypeError('Sprite history requires bounded chronological native samples including the current row');
  const bank = frame.assets?.sprite;
  if (!bank || typeof bank.stamp !== 'function' || !Number.isInteger(bank.columns) || !Number.isInteger(bank.rows))
    throw new TypeError('Sprite visualiser requires its prepared atlas bank');
  if (bank.snapshot?.().destroyed) throw new Error('Sprite atlas bank is destroyed');
  return bank;
}
function observedRows(frame, style, motion) {
  // Preserve both endpoints of native history. Upstream selected encoded-frame
  // array slices; Canvas has an explicit pip span, including partial captures.
  let rows = reduceRows(frame.history, style.history_limit);
  rows = rows.filter((_, index) => index % style.sample_stride === 0 || index === rows.length - 1);
  if (motion && style.spacing !== 5) {
    const step = Math.max(1, round(style.spacing / 5));
    rows = rows.filter((_, index) => index % step === 0 || index === rows.length - 1);
  }
  return rows;
}
const timeFraction = (frame, row) => clamp(1 - row.agePips / Math.max(1, frame.historySpanPips));
const polarPoint = (width, height, angle, radius) => [width / 2 + Math.cos(radians(angle)) * radius, height / 2 + Math.sin(radians(angle)) * radius];

function stampMaker(context, width, height, frame, style, bank) {
  const meta = approved.get(style);
  let attempts = 0, painted = 0;
  const position = Math.floor((frame.spriteFrame * style.sprite_animation_rate + style.sprite_animation_phase) / style.animation_stride);
  function stamp(x, y, {row = null, column = 0, size = style.sprite_size, width:requestedWidth, height:requestedHeight,
    opacity = 1, angle = 0, level = 1} = {}) {
    attempts++;
    if (attempts > style.max_stamps) throw new RangeError('Sprite stamp limit exceeded; reduce history, bins or segments');
    if (style.sprite_visible_fraction < 1) {
      const visible = ((attempts % 10007) * (2246822519 % 10007) + (style.seed % 10007) * (3266489917 % 10007)) % 10007 / 10007;
      if (visible >= style.sprite_visible_fraction) return;
    }
    const alpha = opacity * style.sprite_opacity;
    if (alpha <= 0) return;
    column += style.sprite_palette_shift;
    let index;
    if (bank.custom) index = modulo(style.sprite_index + style.sprite_palette_shift + modulo(position, style.animation_frames), bank.columns * bank.rows);
    else if (meta.indexOverride) index = modulo(style.sprite_index + modulo(position, style.animation_frames), 64);
    else {
      const selectedRow = meta.shapeOverride || row === null ? shapes[style.shape] : row;
      index = selectedRow * 8 + (style.animation_frames > 1 ? modulo(column + position, Math.min(style.animation_frames, 8)) : modulo(column, 8));
    }
    const side = Math.max(1, round(size));
    const tw = Math.max(1, round((requestedWidth ?? side) * style.sprite_scale * style.sprite_scale_x));
    const th = Math.max(1, round((requestedHeight ?? side) * style.sprite_scale * style.sprite_scale_y));
    if (tw > SPRITE_LIMITS.tileDimension || th > SPRITE_LIMITS.tileDimension)
      throw new RangeError('Effective sprite tile exceeds the 1024-pixel safety limit');
    let tint = null;
    if (style.sprite_colour !== 'original') {
      const colourIndex = style.sprite_colour === 'level' ? Math.min(style.colours.length - 1, Math.floor(clamp(level) * style.colours.length)) : modulo(column, style.colours.length);
      tint = style.colours[colourIndex];
    }
    if (style.sprite_tint_colour !== null) tint = style.sprite_tint_colour;
    if (style.sprite_jitter) {
      x += style.sprite_jitter * Math.sin(attempts * 16.17 + frame.spriteFrame * .31 + style.seed);
      y += style.sprite_jitter * Math.cos(attempts * 11.83 + frame.spriteFrame * .17 + style.seed);
    }
    const dx = (x - width / 2) * style.sprite_spread, dy = (y - height / 2) * style.sprite_spread;
    const theta = radians(style.sprite_layout_rotation);
    x = width / 2 + dx * Math.cos(theta) - dy * Math.sin(theta) + style.sprite_offset_x;
    y = height / 2 + dx * Math.sin(theta) + dy * Math.cos(theta) + style.sprite_offset_y;
    const glyphAngle = angle + style.sprite_rotation + frame.spriteFrame * style.sprite_spin +
      style.sprite_angle_jitter * Math.sin(attempts * 13.03 + style.seed);
    bank.stamp(context, {index,x,y,width:tw,height:th,opacity:alpha,angle:glyphAngle,tint,style});
    painted++;
  }
  return {stamp, report:() => Object.freeze({kind:'sprite-rudiment',stamps:attempts,drawn_stamps:painted,
    animation_frame:frame.spriteFrame,atlas:Object.freeze({sha256:bank.sha256,width:bank.width,height:bank.height,
      columns:bank.columns,rows:bank.rows,custom:bank.custom})})};
}
function radii(width, height, style) {
  const radius = Math.max(0, Math.min(width, height) / 2 - style.padding - style.sprite_size / 2 - 2);
  return [radius * style.inner_radius, radius * style.outer_radius];
}

function drawSpriteSpectrum(area, frame, mode, style, stamp, width, height) {
  const levels = bandLevels(frame, {values:frame.values}, style);
  const bands = levels.map((level,index) => ({level,index})).filter((_,index) => index % style.bin_stride === 0);
  const n = bands.length, {left,top,right,bottom} = area;
  const [r0,r1] = radii(width,height,style), point = (angle,radius) => polarPoint(width,height,angle,radius);
  if (mode === 'gauge') {
    const aggregate = levels.reduce((sum,value) => sum + value, 0) / levels.length;
    const dominant = levels.indexOf(Math.max(...levels)), count = Math.max(12,n);
    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1,count - 1), angle = style.start_angle + progress * style.sweep_angle;
      stamp(...point(angle,(r0 + r1) / 2),{row:0,column:i % 8,size:style.sprite_size * 1.1,
        opacity:aggregate > 0 && progress <= aggregate ? 1 : style.off_opacity,angle,level:aggregate});
    }
    // An empty/silent spectrum has no dominant band. Do not light a false peak.
    if (levels[dominant] > 0) stamp(...point(style.start_angle + style.sweep_angle * dominant / Math.max(1,levels.length - 1),r1),
      {row:5,column:dominant % 8,size:style.sprite_size * 1.8,level:levels[dominant]});
    return;
  }
  if (['led-radial','petals','ring','halo','spokes','orbits'].includes(mode)) {
    bands.forEach(({level,index},j) => {
      const angle = style.start_angle + j * style.sweep_angle / n;
      if (['petals','ring','halo','orbits'].includes(mode)) {
        let radius = r0 + (r1 - r0) * level;
        if (mode === 'ring') {
          radius = r0 + (r1 - r0) * level / 2;
          for (let ring = 0; ring < style.rings; ring++) stamp(...point(angle,r0 + (radius - r0) * (ring + 1) / style.rings),
            {row:1,column:(index + ring) % 8,opacity:.25 + .75 * level,level});
        } else if (mode === 'halo') stamp(...point(angle,radius),
          {row:5,column:index % 8,size:style.sprite_size * 2,opacity:.35 + .6 * level,level});
        else stamp(...point(angle,radius),{row:mode === 'petals' ? 4 : 1,column:index % 8,
          size:style.sprite_size * (1 + .75 * level),opacity:.35 + .6 * level,angle,level});
      } else for (let segment = 0; segment < style.segment_count; segment++) {
        if (mode === 'spokes' && segment % 2) continue;
        const progress = (segment + .5) / style.segment_count;
        stamp(...point(angle,r0 + (r1 - r0) * progress),{row:mode === 'spokes' ? 0 : 1,column:index % 8,
          angle:angle + 90,opacity:progress <= level ? 1 : style.off_opacity,level});
      }
    });
    return;
  }
  const horizontal = mode === 'lcd-horizontal' || style.orientation === 'horizontal';
  const mirrored = mode === 'lcd-mirrored' || style.mirror;
  const slot = (horizontal ? area.height : area.width) / n;
  const length = horizontal ? area.width : area.height;
  bands.forEach(({level,index},j) => {
    for (let segment = 0; segment < style.segment_count; segment++) {
      const progress = (segment + .5) / style.segment_count, opacity = progress <= level ? 1 : style.off_opacity;
      if (!opacity) continue;
      let row = mode.includes('lcd') ? 0 : mode === 'led' ? 1 : ['vfd','neon'].includes(mode) ? 2 :
        ['crystal','ice'].includes(mode) ? 3 : mode === 'fire' ? 7 : mode === 'icons' ? 4 : 6;
      let tw = horizontal ? length / style.segment_count * (1 - style.segment_gap) : slot * (1 - style.bar_gap);
      let th = horizontal ? slot * (1 - style.bar_gap) : length / style.segment_count * (1 - style.segment_gap);
      let column = index % 8;
      // Closely related upstream aliases get their advertised cell geometry:
      // round LED nodes, square arcade blocks, tiled mosaics and narrowed roofs.
      if (mode === 'led') tw = th = Math.min(style.sprite_size,tw,th);
      if (mode === 'retro') tw = th = Math.min(tw,th);
      if (mode === 'mosaic') column = (index + segment) % 8;
      if (mode === 'city') {
        column = (index + Math.floor(segment / 3)) % 8;
        if (progress <= level && (segment + 1.5) / style.segment_count > level) tw *= .65;
      }
      const midX = (left + right) / 2, midY = (top + bottom) / 2;
      const x = horizontal ? (mirrored ? midX + progress * area.width / 2 : left + progress * area.width) : left + (j + .5) * slot;
      const y = horizontal ? top + (j + .5) * slot : (mirrored ? midY - progress * area.height / 2 : bottom - progress * area.height);
      const settings = {row,column,width:tw,height:th,opacity,level};
      stamp(x,y,settings);
      if (mirrored) stamp(horizontal ? left + right - x : x, horizontal ? y : top + bottom - y, settings);
      if (mode === 'neon' && progress <= level) {
        // A narrow secondary image stamp supplies the glossy tube reflection.
        stamp(x + tw * .23,y,{...settings,width:tw * .24,opacity:opacity * .42,column:(column + 1) % 8});
      }
    }
  });
}

function drawSpriteSpectrogram(area, frame, mode, style, stamp, width, height) {
  const history = observedRows(frame, style, false);
  const rows = history.map(row => bandLevels(frame,row,style).filter((_,index) => index % style.bin_stride === 0));
  const count = rows.length, bands = rows[0].length, [r0,r1] = radii(width,height,style);
  const size = Math.min(style.sprite_size,area.width / count * 1.5,area.height / bands * 1.5);
  rows.forEach((values,j) => {
    const time = timeFraction(frame,history[j]);
    values.forEach((level,index) => {
      if (level < style.threshold) return;
      if (mode === 'radial' || mode === 'spiral') {
        const band = index / Math.max(1,bands - 1);
        const angle = style.start_angle + (mode === 'spiral' ? style.twists * 360 : style.sweep_angle) * time;
        const radius = r0 + (r1 - r0) * (mode === 'spiral' ? .55 * time + .45 * band : band);
        stamp(...polarPoint(width,height,angle,radius),{row:mode === 'radial' ? 1 : 3,column:index % 8,
          level,size:Math.max(2,style.sprite_size * level),opacity:Math.max(.12,level)});
        return;
      }
      const x = area.left + time * area.width;
      let y = area.bottom - (index + .5) * area.height / bands;
      if (mode === 'rain') y += (1 - level) * style.sprite_size;
      const row = {lcd:0,led:1,pixels:6,heatmap:6,icons:4,neon:2,crystal:3,fire:7,rain:5,blocks:6}[mode];
      const settings = {row,column:mode === 'heatmap' ? Math.min(7,Math.floor(level * 8)) : index % 8,
        level,size:Math.max(1,size * (.5 + level)),opacity:Math.max(.1,level)};
      if (mode === 'blocks') {
        settings.width = Math.max(1,Math.min(style.sprite_size * 2,area.width / count * (1 - style.bar_gap)));
        settings.height = Math.max(1,Math.min(style.sprite_size * 2,area.height / bands * (1 - style.segment_gap)));
      }
      stamp(x,y,settings);
    });
  });
}

function drawSpriteWaveform(area, frame, mode, style, stamp, width, height) {
  if (style.axis >= frame.values.length) throw new RangeError('Selected sprite waveform axis does not exist');
  const history = observedRows(frame,style,true), [r0,r1] = radii(width,height,style);
  history.forEach((sample,index) => {
    const value = sample.values[style.axis], time = timeFraction(frame,sample);
    let x, y;
    if (mode === 'annular' || mode === 'spiral') {
      const angle = style.start_angle + (mode === 'spiral' ? style.twists * 360 : style.sweep_angle) * time;
      const radius = r0 + (r1 - r0) * (mode === 'spiral' ? .65 * time + .3 * (.5 + .5 * value) : .5 + value * .5);
      [x,y] = polarPoint(width,height,angle,radius);
    } else {x = area.left + time * area.width;y = area.top + (1 - value) * area.height / 2;}
    const middle = (area.top + area.bottom) / 2;
    if (mode === 'bars') {
      const length = Math.abs(y - middle), step = Math.max(style.sprite_size * .75,2);
      for (let at = 0; at <= Math.floor(length / step); at++) {
        const yy = middle + (y > middle ? 1 : -1) * at * step;
        const settings = {row:0,column:index % 8,size:style.sprite_size * .8,opacity:.4 + .5 * Math.abs(value),level:Math.abs(value)};
        stamp(x,yy,settings);if (style.mirror) stamp(x,area.top + area.bottom - yy,settings);
      }
      return;
    }
    const row = {lcd:0,led:1,dots:1,icons:4,neon:2,ribbon:6,mirrored:1,annular:3,spiral:5,sparks:5,crystal:3}[mode];
    let size = style.sprite_size * (['ribbon','crystal'].includes(mode) ? 1.5 : 1);
    // LED lamps remain consistently lit; individual dots retain sample magnitude.
    if (mode === 'led') size *= .8;
    const settings = {row,column:index % 8,level:Math.abs(value),size,
      opacity:mode === 'led' ? 1 : .5 + .5 * Math.abs(value)};
    if (mode === 'ribbon') settings.width = Math.max(size,Math.min(style.sprite_size * 4,area.width / history.length * 1.25));
    stamp(x,y,settings);
    if (mode === 'mirrored' || style.mirror) stamp(x,area.top + area.bottom - y,settings);
  });
}

function drawSpriteMotion(area, frame, mode, style, stamp, width, height) {
  if (style.axis >= frame.values.length) throw new RangeError('Selected sprite motion axis does not exist');
  const history = observedRows(frame,style,true), dimensions = frame.values.length;
  history.forEach((sample,index) => {
    const xvalue = sample.values[style.axis];
    const yvalue = dimensions > 1 ? sample.values[(style.axis + 1) % dimensions] : 0;
    let x = area.left + (xvalue + 1) * area.width / 2, y = area.top + (1 - yvalue) * area.height / 2;
    let level = Math.abs(xvalue), size = style.sprite_size;
    if (mode === 'icon-grid') {
      x = area.left + (index % 12 + .5) * area.width / 12;
      y = area.top + (Math.floor(index / 12) + .5) * area.height / Math.max(1,Math.ceil(history.length / 12));
      // Each cell can read an independent selected channel, as the catalogue
      // promises, instead of drawing copies of only the first channel.
      level = Math.abs(sample.values[(style.axis + index) % dimensions]);size *= .5 + .5 * level;
    } else if (mode === 'orbit') {
      const angle = style.start_angle + style.sweep_angle * timeFraction(frame,sample) + xvalue * 30;
      const radius = Math.min(area.width,area.height) * (.2 + .25 * (1 + (dimensions > 1 ? yvalue : xvalue)) / 2);
      [x,y] = polarPoint(width,height,angle,radius);
    } else if (['cloud','particles','constellation'].includes(mode)) {
      x += Math.sin(index * 19.19 + style.seed) * style.sprite_size * 1.5;
      y += Math.cos(index * 10.17 + style.seed) * style.sprite_size * 1.5;
    }
    const age = timeFraction(frame,sample);
    let opacity = mode === 'trails' ? age : .4 + .6 * age;
    if (mode === 'cloud' && index % 2) opacity *= .6;
    if (mode === 'constellation' && index % 2) return;
    const row = ['path','orbit','icon-grid'].includes(mode) ? 4 : mode === 'constellation' ? 5 : 1;
    const settings = {row,column:index % 8,level,size,opacity};
    stamp(x,y,settings);
    if (style.mirror) stamp(x,area.top + area.bottom - y,settings);
  });
}

/** Pure source-addressed sprite layout; assets are prepared and owned elsewhere. */
export function drawSprites(context, width, height, frame, renderer, inputStyle = {}) {
  const style = validateSpriteStyle(inputStyle,renderer), bank = checkedFrame(frame);
  if (bank.custom !== Boolean(style.sprite_asset) ||
      bank.custom && (bank.columns !== style.sprite_columns || bank.rows !== style.sprite_rows))
    throw new TypeError('Prepared sprite atlas does not match the selected source/grid');
  const painter = stampMaker(context,width,height,frame,style,bank);
  withViewport(context,width,height,style,1,area => {
    if (renderer.startsWith('sprite-spectrum-')) drawSpriteSpectrum(area,frame,renderer.slice(16),style,painter.stamp,width,height);
    else if (renderer.startsWith('sprite-spectrogram-')) drawSpriteSpectrogram(area,frame,renderer.slice(19),style,painter.stamp,width,height);
    else if (renderer.startsWith('sprite-waveform-')) drawSpriteWaveform(area,frame,renderer.slice(16),style,painter.stamp,width,height);
    else drawSpriteMotion(area,frame,renderer.slice(14),style,painter.stamp,width,height);
  });
  return painter.report();
}

export function validateSpriteStyle(input = {}, renderer = 'sprite-spectrum-lcd') {
  if (!names.has(renderer)) throw new RangeError('Unknown sprite renderer');
  if (approved.get(input)?.renderer === renderer) return input;
  const style = normaliseBaseStyle(input, allowed);
  for (const [key, args] of Object.entries({...baseNumbers,...extraNumbers}))
    style[key] = numberStyle(input, key, ...args);
  for (const key of ['sprite_palette_shift','sprite_posterize','sprite_pixel_size','sprite_outline'])
    style[key] = round(style[key]);
  const [theme, shape] = modeDefaults(renderer);
  style.sprite_theme = enumStyle(input, 'sprite_theme', theme, SPRITE_THEMES);
  style.shape = enumStyle(input, 'shape', shape, Object.keys(shapes));
  style.sprite_asset = input.sprite_asset == null ? null : validateSpriteAsset(input.sprite_asset);
  if (!style.sprite_asset && (style.sprite_columns !== 8 || style.sprite_rows !== 8))
    throw new RangeError('Custom sprite_columns/rows require sprite_asset; built-in atlases use an 8-by-8 grid');
  style.sprite_index = numberStyle(input, 'sprite_index', style.sprite_asset ? 0 : shapes[style.shape] * 8, 0, 1023, true);
  if (style.sprite_index >= (style.sprite_asset ? style.sprite_columns * style.sprite_rows : 64))
    throw new RangeError('sprite_index falls outside the selected atlas');
  style.sprite_colour = enumStyle(input, 'sprite_colour', 'original', ['original','tint','level']);
  style.orientation = enumStyle(input, 'orientation', 'vertical', ['vertical','horizontal']);
  style.sprite_blend = enumStyle(input, 'sprite_blend', 'normal', ['normal','add','screen','multiply','lighten','difference']);
  style.ceiling_db = numberStyle(input, 'ceiling_db', 0, style.floor_db + .01, 60);
  if (style.inner_radius >= style.outer_radius) throw new RangeError('Sprite inner_radius must be less than outer_radius');
  style.mirror = booleanStyle(input, 'mirror', false);
  style.pixelated = booleanStyle(input, 'pixelated', ['arcade','pixel'].includes(style.sprite_theme));
  style.sprite_tint_colour = input.sprite_tint_colour == null ? null : colourStyle(input.sprite_tint_colour);
  style.sprite_outline_colour = colourStyle(Object.hasOwn(input, 'sprite_outline_colour') ? input.sprite_outline_colour : '#ffffff');
  Object.freeze(style);
  approved.set(style, {renderer, shapeOverride:Object.hasOwn(input,'shape'), indexOverride:Object.hasOwn(input,'sprite_index')});
  return style;
}

function hsv(red, green, blue) {
  const maximum = Math.max(red, green, blue), minimum = Math.min(red, green, blue), difference = maximum - minimum;
  let hue = 0;
  if (difference) {
    if (maximum === red) hue = modulo((green - blue) / difference, 6);
    else if (maximum === green) hue = (blue - red) / difference + 2;
    else hue = (red - green) / difference + 4;
    hue /= 6;
  }
  return [hue, maximum ? difference / maximum : 0, maximum];
}
function rgb(hue, saturation, value) {
  const h = modulo(hue, 1) * 6, section = Math.floor(h), fraction = h - section;
  const p = value * (1 - saturation), q = value * (1 - saturation * fraction), t = value * (1 - saturation * (1 - fraction));
  return [[value,t,p],[q,value,p],[p,value,t],[p,q,value],[t,p,value],[value,p,q]][section];
}

/** Pure, bounded pixel grading of one resampled atlas cell. No source mutation. */
export function processSpritePixels(input, style, tint = null) {
  const {width, height, data} = input;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > SPRITE_LIMITS.tileDimension || height > SPRITE_LIMITS.tileDimension ||
      !data || data.length !== width * height * 4) throw new RangeError('Invalid bounded sprite cell pixels');
  const pixels = new Uint8ClampedArray(data);
  const tintMix = round(clamp(style.tint_strength) * 32) / 32;
  const gain = [style.sprite_red * (1 + Math.max(0, style.sprite_temperature)),
    style.sprite_green, style.sprite_blue * (1 + Math.max(0, -style.sprite_temperature))];
  for (let at = 0, i = 0; at < pixels.length; at += 4, i++) {
    if (!pixels[at + 3]) continue;
    let channels = [pixels[at], pixels[at + 1], pixels[at + 2]];
    if (tint && tintMix) {
      const light = round(channels[0] * .299 + channels[1] * .587 + channels[2] * .114);
      channels = channels.map((channel, j) => round(channel * (1 - tintMix) + light * tint[j] / 255 * tintMix));
    }
    if (style.sprite_hue_shift || style.sprite_saturation !== 1) {
      const [h, s, v] = hsv(...channels.map(channel => channel / 255));
      channels = rgb(h + style.sprite_hue_shift / 360, clamp(s * style.sprite_saturation), v).map(channel => round(channel * 255));
    }
    const line = 1 - (Math.floor(i / width) % 2 ? style.sprite_scanlines : 0);
    // Reduced modular products preserve the exact integer noise even for a
    // large cell, without a float overflow or a mutable random generator.
    const noise = ((i % 997) * (1103515245 % 997) + ((i + 12345) % 997) * (2654435761 % 997)) % 997 / 996 - .5;
    for (let j = 0; j < 3; j++) {
      let value = clamp(((channels[j] / 255 - .5) * style.sprite_contrast + .5) * style.sprite_brightness * gain[j]);
      value = clamp(value ** (1 / style.sprite_gamma) * line + noise * style.sprite_grain * .35);
      if (style.sprite_posterize >= 2) value = round(value * (style.sprite_posterize - 1)) / (style.sprite_posterize - 1);
      pixels[at + j] = round(value * 255);
    }
  }
  let output = pixels;
  if (style.sprite_pixel_size > 1) {
    const smallWidth = Math.max(1, Math.floor(width / style.sprite_pixel_size));
    const smallHeight = Math.max(1, Math.floor(height / style.sprite_pixel_size));
    output = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sx = Math.min(width - 1, Math.floor((Math.floor(x * smallWidth / width) + .5) * width / smallWidth));
      const sy = Math.min(height - 1, Math.floor((Math.floor(y * smallHeight / height) + .5) * height / smallHeight));
      output.set(pixels.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * width + x) * 4);
    }
  }
  if (style.sprite_sharpen && width > 2 && height > 2) {
    const sharp = new Uint8ClampedArray(output);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let total = output[at + channel] * 4;
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++)
          total += output[((y + yy) * width + x + xx) * 4 + channel];
        sharp[at + channel] = round(clamp((output[at + channel] + style.sprite_sharpen * (output[at + channel] - total / 13)) / 255) * 255);
      }
    }
    output = sharp;
  }
  return {width, height, data:output};
}

// Separable square maximum filter, O(width * height * radius), with radius <=10.
function borderPixels(data, width, height, radius, colour) {
  const horizontal = new Uint8Array(width * height), result = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0;
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++)
      value = Math.max(value, data[(y * width + xx) * 4 + 3]);
    horizontal[y * width + x] = value;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0;
    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++)
      value = Math.max(value, horizontal[yy * width + x]);
    const at = (y * width + x) * 4;
    result[at] = colour[0];result[at + 1] = colour[1];result[at + 2] = colour[2];
    result[at + 3] = round(Math.max(0, value - data[at + 3]) * colour[3] / 255);
  }
  return result;
}
const pixelFields = ['sprite_hue_shift','sprite_saturation','sprite_brightness','sprite_contrast','sprite_gamma',
  'sprite_temperature','sprite_red','sprite_green','sprite_blue','sprite_posterize','sprite_pixel_size',
  'sprite_scanlines','sprite_grain','sprite_sharpen'];
const cachedFields = [...pixelFields,'sprite_blur','sprite_glow','sprite_outline','sprite_shadow',
  'sprite_shadow_x','sprite_shadow_y','sprite_shadow_opacity','sprite_outline_colour','tint_strength','pixelated'];
function appearance(style) {
  let key = appearanceKeys.get(style);
  if (!key) {key = JSON.stringify(cachedFields.map(field => style[field]));appearanceKeys.set(style, key);}
  return key;
}

/**
 * A lazily acquired image owner. The runtime calls destroy() at last release.
 * Angles, placement, shear and opacity are applied while drawing, never cache keys.
 */
export function createSpriteBank(descriptor, createCanvas) {
  if (!descriptor || typeof descriptor !== 'object' || !descriptor.image || typeof createCanvas !== 'function')
    throw new TypeError('Sprite bank requires a decoded image and a canvas factory');
  const width = numberStyle(descriptor, 'width', 0, 1, SPRITE_LIMITS.atlasDimension, true);
  const height = numberStyle(descriptor, 'height', 0, 1, SPRITE_LIMITS.atlasDimension, true);
  const columns = numberStyle(descriptor, 'columns', 8, 1, 32, true), rows = numberStyle(descriptor, 'rows', 8, 1, 32, true);
  if (width * height > SPRITE_LIMITS.atlasPixels || width % columns || height % rows)
    throw new RangeError('Sprite atlas must fit the pixel budget and divide evenly into its columns/rows');
  if (typeof descriptor.custom !== 'boolean' || typeof descriptor.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(descriptor.sha256))
    throw new TypeError('Sprite bank requires custom status and verified SHA-256 metadata');
  if (!descriptor.custom && (columns !== 8 || rows !== 8))
    throw new RangeError('Built-in sprite atlas must use its original 8-by-8 grid');
  let image = descriptor.image, factory = createCanvas, destroyed = false, cachePixels = 0;
  const cache = new Map(), colours = new Map();
  const metadata = Object.freeze({width,height,columns,rows,custom:descriptor.custom,sha256:descriptor.sha256.toLowerCase()});
  descriptor = null;createCanvas = null;
  const discard = canvas => {if (canvas) {canvas.width = 0;canvas.height = 0;}};
  function make(w, h) {
    const canvas = factory(w, h);
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('Sprite canvas factory did not return a Canvas');
    canvas.width = w;canvas.height = h;
    const context = canvas.getContext('2d', {willReadFrequently:true});
    if (!context) {discard(canvas);throw new Error('Sprite cell Canvas 2D is unavailable');}
    return {canvas, context};
  }
  function colour(value) {
    if (colours.has(value)) return colours.get(value);
    const {canvas, context} = make(1, 1);
    try {
      context.clearRect(0, 0, 1, 1);context.fillStyle = value;context.fillRect(0, 0, 1, 1);
      const rgba = Object.freeze(Array.from(context.getImageData(0, 0, 1, 1).data));
      if (colours.size >= 256) colours.delete(colours.keys().next().value);
      colours.set(value, rgba);return rgba;
    } finally {discard(canvas);}
  }
  function evict() {
    const key = cache.keys().next().value, entry = cache.get(key);
    if (!entry) return;
    cache.delete(key);cachePixels -= entry.pixels;discard(entry.canvas);
  }
  function processed(index, tw, th, style, tint) {
    const key = JSON.stringify([index,tw,th,tint,appearance(style)]);
    if (cache.has(key)) {const entry = cache.get(key);cache.delete(key);cache.set(key, entry);return entry;}
    const allocated = [];
    const allocate = (w,h) => {const value = make(w,h);allocated.push(value.canvas);return value;};
    let retained = null;
    try {
      let tile = allocate(tw, th);
      tile.context.imageSmoothingEnabled = !style.pixelated;
      tile.context.imageSmoothingQuality = 'high';
      tile.context.drawImage(image, index % columns * width / columns, Math.floor(index / columns) * height / rows,
        width / columns, height / rows, 0, 0, tw, th);
      // Grade after bounded Canvas resampling. This preserves textured cell
      // luminance without allocating the full-resolution pixels of a huge custom cell.
      const data = tile.context.getImageData(0, 0, tw, th);
      data.data.set(processSpritePixels(data, style, tint ? colour(tint) : null).data);
      tile.context.putImageData(data, 0, 0);
      if (style.sprite_blur) {
        const blurred = allocate(tw, th);
        if (!('filter' in blurred.context)) throw new Error('Sprite blur requires Canvas filter support');
        blurred.context.filter = 'blur(' + style.sprite_blur + 'px)';
        blurred.context.drawImage(tile.canvas, 0, 0);blurred.context.filter = 'none';tile = blurred;
      }
      const glow = style.sprite_glow, outline = style.sprite_outline, shadow = style.sprite_shadow;
      const pad = glow || outline || shadow ? Math.min(80, Math.ceil(Math.max(glow * 2, outline + 2,
        shadow * 2 + Math.abs(style.sprite_shadow_x), shadow * 2 + Math.abs(style.sprite_shadow_y)))) : 0;
      if (pad) {
        const halo = allocate(tw + 2 * pad, th + 2 * pad);
        if ((glow || shadow) && !('filter' in halo.context)) throw new Error('Sprite glow/shadow requires Canvas filter support');
        if (shadow) {
          const mask = allocate(tw, th);
          mask.context.drawImage(tile.canvas, 0, 0);mask.context.globalCompositeOperation = 'source-in';
          mask.context.fillStyle = 'rgba(0,0,0,' + style.sprite_shadow_opacity + ')';mask.context.fillRect(0, 0, tw, th);
          halo.context.filter = 'blur(' + shadow + 'px)';
          halo.context.drawImage(mask.canvas, pad + style.sprite_shadow_x, pad + style.sprite_shadow_y);
          halo.context.filter = 'none';
        }
        if (glow) {
          halo.context.filter = 'blur(' + glow + 'px)';halo.context.drawImage(tile.canvas, pad, pad);halo.context.filter = 'none';
        }
        if (outline) {
          const border = allocate(tw, th), body = tile.context.getImageData(0, 0, tw, th);
          body.data.set(borderPixels(body.data, tw, th, outline, colour(style.sprite_outline_colour)));
          border.context.putImageData(body, 0, 0);halo.context.drawImage(border.canvas, pad, pad);
        }
        halo.context.drawImage(tile.canvas, pad, pad);tile = halo;
      }
      retained = tile.canvas;
      const entry = {canvas:retained,width:retained.width,height:retained.height,pixels:retained.width * retained.height};
      while (cache.size && (cache.size >= SPRITE_LIMITS.cacheEntries || cachePixels + entry.pixels > SPRITE_LIMITS.cachePixels)) evict();
      cache.set(key, entry);cachePixels += entry.pixels;
      return entry;
    } finally {for (const canvas of allocated) if (canvas !== retained) discard(canvas);}
  }
  function stamp(context, settings) {
    if (destroyed) throw new Error('Sprite bank is destroyed');
    const {index, x, y, angle, opacity, tint, style} = settings;
    const tw = numberStyle(settings, 'width', 0, 1, SPRITE_LIMITS.tileDimension, true);
    const th = numberStyle(settings, 'height', 0, 1, SPRITE_LIMITS.tileDimension, true);
    if (!Number.isInteger(index) || index < 0 || index >= columns * rows ||
        ![x,y,angle,opacity].every(Number.isFinite)) throw new RangeError('Invalid sprite stamp coordinates/index');
    const needsPixels = tint || pixelFields.some(field => style[field] !== extraNumbers[field][0]) ||
      style.sprite_blur || style.sprite_glow || style.sprite_outline || style.sprite_shadow;
    const tile = needsPixels ? processed(index, tw, th, style, tint) : null;
    const actualWidth = tile?.width ?? tw, actualHeight = tile?.height ?? th;
    context.save();
    try {
      context.globalAlpha = round(clamp(opacity) * 32) / 32;
      context.globalCompositeOperation = style.sprite_blend === 'normal' ? 'source-over' : style.sprite_blend === 'add' ? 'lighter' : style.sprite_blend;
      context.imageSmoothingEnabled = !style.pixelated;context.imageSmoothingQuality = 'high';
      context.translate(x, y);context.rotate(radians(modulo(angle, 360)));
      context.transform(1, style.sprite_shear_y, style.sprite_shear_x, 1, 0, 0);
      const left = -actualWidth * (.5 + style.sprite_anchor_x / 2), top = -actualHeight * (.5 + style.sprite_anchor_y / 2);
      if (tile) context.drawImage(tile.canvas, left, top, actualWidth, actualHeight);
      else context.drawImage(image, index % columns * width / columns, Math.floor(index / columns) * height / rows,
        width / columns, height / rows, left, top, tw, th);
    } finally {context.restore();}
  }
  return Object.freeze({...metadata, stamp,
    snapshot:() => Object.freeze({...metadata,destroyed,cachedTiles:cache.size,cachedPixels:cachePixels}),
    destroy() {
      if (destroyed) return;destroyed = true;
      while (cache.size) evict();colours.clear();
      try {image?.close?.();} finally {image = null;factory = null;}
    }
  });
}
