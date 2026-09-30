#!/usr/bin/env node
import { bindNative, catalogue, sample } from '@kieransimkin/dance-rudiments';
import createDanceRudiments from '@kieransimkin/dance-rudiments/wasm';

// DanceMoves keeps its established compact browser surface. The official
// DanceRudiments package remains the only movement authority used to generate
// every shipped sample; the other upstream defaults stay available to direct
// DanceRudiments consumers without adding a 25 MB WASM payload to every EPK.
const selectedNames = Object.freeze([
  'bounce', 'sway', 'circle', 'figure_eight', 'step_touch', 'box_step',
  'helix', 'clay_background', 'single_stroke_roll', 'double_stroke_roll',
  'multiple_bounce_roll', 'single_paradiddle', 'flam', 'drag',
  'five_stroke_roll'
]);

const native = await createDanceRudiments();
bindNative(native);
const byName = new Map(catalogue.map(item => [item.name, item]));
const selected = selectedNames.map(name => {
  const info = byName.get(name);
  if (!info) throw new Error(`DanceRudiments catalogue is missing ${name}`);
  const samples = Array.from({ length: info.periodPips }, (_, pip) => {
    const value = sample(name, pip);
    const wrapped = sample(name, pip - info.periodPips);
    for (const axis of ['x', 'y', 'z']) {
      if (!Number.isFinite(value[axis]) || Math.abs(value[axis]) > 1.00000001 || value[axis] !== wrapped[axis]) {
        throw new Error(`${name} has an invalid or non-periodic ${axis} sample at pip ${pip}`);
      }
    }
    return [value.x, value.y, value.z];
  });
  return {
    name: info.name,
    description: info.description,
    periodPips: info.periodPips,
    dimensions: info.dimensions,
    samples
  };
});

process.stdout.write(JSON.stringify({ sourceCatalogueCount: catalogue.length, selected }));
