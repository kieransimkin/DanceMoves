import {describeVisualiser} from './visualiser-catalogue.mjs';
import {validateSpectrumStyle} from './spectrum-analysis.mjs';
import {drawSpectrum} from './spectrum.mjs';
import {validateCoreStyle, drawCore} from './visualiser-core.mjs';
import {validateCircularStyle, drawCircular} from './visualiser-circular.mjs';
import {validateEffectStyle, drawEffects} from './visualiser-effects.mjs';
import {validateWireStyle, drawWire} from './visualiser-wire.mjs';
import {validateSpriteStyle, drawSprites} from './visualiser-sprites.mjs';
import {validateSolidStyle, drawSolid} from './visualiser-solid.mjs';
import {validateMusicStyle, drawMusic, musicNeedsSpectrum} from './visualiser-music.mjs';

export function validateVisualiserStyle(renderer, style = {}) {
  const view = describeVisualiser(renderer);
  if (!view) throw new RangeError(`Unknown visualiser renderer: ${String(renderer)}`);
  if (view.styleFamily === 'spectrum') return validateSpectrumStyle(style);
  if (view.styleFamily === 'circular') return validateCircularStyle(style);
  if (view.styleFamily === 'effects') return validateEffectStyle(style);
  if (view.styleFamily === 'wire') return validateWireStyle(style, renderer);
  if (view.styleFamily === 'sprites') return validateSpriteStyle(style, renderer);
  if (view.styleFamily === 'solid') return validateSolidStyle(style, renderer);
  if (view.styleFamily === 'music') return validateMusicStyle(style, renderer);
  return validateCoreStyle(style, renderer);
}
export function visualiserNeedsSpectrum(renderer, style) {
  const view = describeVisualiser(renderer);
  if (!view) throw new RangeError('Unknown visualiser renderer');
  return view.requiresSpectrum || view.styleFamily === 'music' && musicNeedsSpectrum(style);
}
export function drawVisualiser(context, width, height, frame, renderer, style) {
  const view = describeVisualiser(renderer);
  if (!view) throw new RangeError('Unknown visualiser renderer');
  if (frame.values.length < view.minDimensions) throw new RangeError(`${renderer} requires ${view.minDimensions} selected axes`);
  if (view.styleFamily === 'spectrum') return drawSpectrum(context, width, height, frame.report, renderer, style);
  if (view.styleFamily === 'circular') return drawCircular(context, width, height, frame, renderer, style);
  if (view.styleFamily === 'effects') return drawEffects(context, width, height, frame, renderer, style);
  if (view.styleFamily === 'wire') return drawWire(context, width, height, frame, renderer, style);
  if (view.styleFamily === 'sprites') return drawSprites(context, width, height, frame, renderer, style);
  if (view.styleFamily === 'solid') return drawSolid(context, width, height, frame, renderer, style, frame.assets?.spatial);
  if (view.styleFamily === 'music') return drawMusic(context, width, height, frame, renderer, style, frame.assets?.spatial);
  return drawCore(context, width, height, frame, renderer, style);
}
