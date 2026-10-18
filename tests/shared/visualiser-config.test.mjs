import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PAGE_META_KEYS, validatePageConfig, fromWordPressMeta} from '../../src/config.mjs';
import {readWordPressConfig} from '../../src/wordpress-config.mjs';
import {validateSongCollection, createSongCollection} from '../../src/song-collection.mjs';
import {VISUALISER_CATALOGUE, VISUALISER_RENDERERS, VISUALISER_RUDIMENTS} from '../../src/visualiser-catalogue.mjs';
import {SPRITE_THEMES} from '../../src/visualiser-sprite-catalogue.mjs';

test('generic views are inactive by default and keep recording payloads out of page configuration', () => {
  const config = validatePageConfig({visualiserRecording:{format:'dancerudiments.recording',samples:[[0]]}});
  assert.equal(config.visualiserRecordingUrl, '');
  assert.equal(config.visualiserRudiment, '');
  assert.equal(config.visualiserRenderer, 'waveform');
  assert.deepEqual(config.visualiserAxes, []);
  assert.equal(config.visualiserAssetBaseUrl, '');
  assert.equal(config.visualiserSpriteTheme, '');
  assert.equal(config.visualiserTerrainSource, 'procedural');
  assert.equal(config.visualiserSpectralDeform, false);
  assert.equal(Object.hasOwn(config, 'visualiserRecording'), false);
  assert.equal(Object.isFrozen(config.visualiserAxes), true);
  assert.equal(config.spectrumRecordingUrl, '');
  assert.equal(config.spectrumRenderer, 'spectrum');
});

test('JS and WordPress share all renderer metadata and the existing native pattern selection', () => {
  const catalogue = JSON.parse(fs.readFileSync(new URL('../../assets/visualiser-catalogue.json', import.meta.url)));
  const native = JSON.parse(fs.readFileSync(new URL('../../assets/vendor/dancerudiments/build-manifest.json', import.meta.url)));
  assert.deepEqual(catalogue, VISUALISER_CATALOGUE);
  assert.equal(VISUALISER_RENDERERS.length, 222);
  assert.equal(new Set(VISUALISER_RENDERERS).size, 222);
  assert.deepEqual(VISUALISER_RUDIMENTS, native.upstream.selection);
  for (const visualiserRenderer of VISUALISER_RENDERERS)
    assert.equal(validatePageConfig({visualiserRenderer}).visualiserRenderer, visualiserRenderer);
  for (const visualiserRenderer of ['', {}, false, 'unknown-view'])
    assert.throws(() => validatePageConfig({visualiserRenderer}), /visualiser renderer/);
  assert.throws(() => validatePageConfig({spectrumRenderer:'spatial-sphere'}), /spectrum renderer/);
});

test('each configured generic view has exactly one bounded page source', () => {
  for (const visualiserRudiment of VISUALISER_RUDIMENTS)
    assert.equal(validatePageConfig({visualiserRudiment}).visualiserRudiment, visualiserRudiment);
  for (const visualiserRudiment of ['song_private', false, {}, 7])
    assert.throws(() => validatePageConfig({visualiserRudiment}), /visualiser rudiment/);
  for (const visualiserRecordingUrl of ['/uploads/one.json', '../page/two.json', 'https://media.example.test/song.json'])
    assert.equal(validatePageConfig({visualiserRecordingUrl}).visualiserRecordingUrl, visualiserRecordingUrl);
  for (const visualiserRecordingUrl of ['javascript:alert(1)', 'data:application/json,{}', 'file:///song.json',
    'https://user:pass@example.test/song.json', '/uploads/line\n.json', 'x'.repeat(4097), {}, 42])
    assert.throws(() => validatePageConfig({visualiserRecordingUrl}));
  assert.throws(() => validatePageConfig({visualiserRecordingUrl:'/one.json', visualiserRudiment:'circle'}), /Choose one visualiser source/);
  for (const view of VISUALISER_CATALOGUE) {
    const make = () => validatePageConfig({visualiserRudiment:'circle', visualiserRenderer:view.name});
    if (view.requiresSpectrum) assert.throws(make, /calibrated spectrum recording/);
    else assert.equal(make().visualiserRenderer, view.name);
  }
});

test('axis selection is ordered, immutable and bounded without assuming a recording dimension layout', () => {
  const axes = ['channel_left', 'x', 'band_010'];
  const config = validatePageConfig({visualiserRecordingUrl:'/song.json', visualiserAxes:axes});
  assert.deepEqual(config.visualiserAxes, axes);
  axes.reverse();
  assert.deepEqual(config.visualiserAxes, ['channel_left', 'x', 'band_010']);
  assert.throws(() => config.visualiserAxes.push('z'), TypeError);
  const maximum = Array.from({length:64}, (_, index) => `axis_${index}`);
  assert.deepEqual(validatePageConfig({visualiserAxes:maximum}).visualiserAxes, maximum);
  assert.deepEqual(validatePageConfig({visualiserAxes:['a'.repeat(128)]}).visualiserAxes, ['a'.repeat(128)]);
  for (const visualiserAxes of ['x,y', {}, ['x','x'], [''], ['X'], ['1x'], ['x-y'], ['x\n'], [' x'], ['a'.repeat(129)],
    ['x', 1], new Array(1), [...maximum, 'overflow']])
    assert.throws(() => validatePageConfig({visualiserAxes}), /visualiserAxes/);
});

test('page atlas configuration keeps reusable theme metadata separate from page-owned image references', () => {
  for (const visualiserSpriteTheme of ['', ...SPRITE_THEMES]) {
    const result = validatePageConfig({visualiserSpriteTheme, visualiserRudiment:'circle',
      visualiserRenderer:'sprite-motion-particles', visualiserAssetBaseUrl:'/assets/visualiser-sprites/'});
    assert.equal(result.visualiserSpriteTheme, visualiserSpriteTheme);
    assert.equal(result.visualiserAssetBaseUrl, '/assets/visualiser-sprites/');
    assert.equal(validatePageConfig({visualiserSpriteTheme}).visualiserSpriteTheme, visualiserSpriteTheme,
      'a valid theme survives switching to a non-sprite renderer');
  }
  for (const visualiserAssetBaseUrl of ['javascript:evil()', 'https://user:secret@example.test/', '/atlases/?v=1',
    '/atlases/#fragment', '/line\nbreak/', {}, 'x'.repeat(4097)])
    assert.throws(() => validatePageConfig({visualiserAssetBaseUrl}));
  for (const visualiserSpriteTheme of ['custom', 'unknown', {}, false])
    assert.throws(() => validatePageConfig({visualiserSpriteTheme}), /sprite theme/);
  const config = validatePageConfig({visualiserSpriteAsset:{url:'/song-art.png',sha256:'a'.repeat(64)}});
  assert.equal(Object.hasOwn(config, 'visualiserSpriteAsset'), false, 'custom PNGs are explicit per-view styles');
  assert.equal(Object.hasOwn(PAGE_META_KEYS, 'visualiserAssetBaseUrl'), false, 'the host owns its asset URL');
});

test('music-aware calibration is opt-in and requires a matching renderer and saved recording', () => {
  const music = ['spatial-music-torus','spatial-music-sphere','spatial-music-terrain'];
  for (const visualiserRenderer of music) {
    assert.equal(validatePageConfig({visualiserRenderer, visualiserRudiment:'helix'}).visualiserSpectralDeform, false);
    const config = validatePageConfig({visualiserRenderer, visualiserRecordingUrl:'/song.json', visualiserSpectralDeform:true});
    assert.equal(config.visualiserSpectralDeform, true);
    assert.throws(() => validatePageConfig({...config, visualiserRecordingUrl:'', visualiserRudiment:'helix'}), /calibrated spectrum/);
    assert.equal(validatePageConfig({visualiserRenderer, visualiserSpectralDeform:true}).visualiserRecordingUrl, '', 'an unset source remains inactive');
  }
  const terrain = {visualiserRenderer:'spatial-music-terrain', visualiserTerrainSource:'fft'};
  assert.equal(validatePageConfig({...terrain, visualiserRecordingUrl:'/bands.json'}).visualiserTerrainSource, 'fft');
  assert.throws(() => validatePageConfig({...terrain, visualiserRudiment:'helix'}), /calibrated spectrum/);
  for (const visualiserRenderer of ['waveform','spatial-solid-terrain','spatial-music-torus'])
    assert.throws(() => validatePageConfig({...terrain, visualiserRenderer}), /FFT terrain/);
  assert.throws(() => validatePageConfig({visualiserSpectralDeform:true}), /music-aware/);
  for (const visualiserSpectralDeform of ['1', 1, 'false', null, {}])
    assert.throws(() => validatePageConfig({visualiserSpectralDeform}), /must be boolean/);
  assert.throws(() => validatePageConfig({visualiserTerrainSource:'guessed'}), /procedural or fft/);
});

test('metadata and localized song rows preserve theme and strict music controls', async () => {
  const config = await fromWordPressMeta({[PAGE_META_KEYS.visualiserRecording]:17,
    [PAGE_META_KEYS.visualiserRenderer]:'spatial-music-terrain',
    [PAGE_META_KEYS.visualiserSpriteTheme]:'generated-neon',
    [PAGE_META_KEYS.visualiserTerrainSource]:'fft', [PAGE_META_KEYS.visualiserSpectralDeform]:'1'}, id => `/recordings/${id}.json`);
  assert.equal(config.visualiserSpriteTheme, 'generated-neon');
  assert.equal(config.visualiserTerrainSource, 'fft'); assert.equal(config.visualiserSpectralDeform, true);
  assert.equal(config.visualiserAssetBaseUrl, '');
  await assert.rejects(fromWordPressMeta({[PAGE_META_KEYS.visualiserSpectralDeform]:'yes'}), /must be boolean/);
  const wire = readWordPressConfig({visualiserSpectralDeform:'0', songs:[
    {id:'bands',title:'Bands',bpm:'120',audioSrc:'/tone.wav',visualiserRecordingUrl:'/bands.json',
      visualiserRenderer:'spatial-music-terrain',visualiserTerrainSource:'fft',visualiserSpectralDeform:'1'},
    {id:'sprite',title:'Sprite',bpm:'120',audioSrc:'/tone.wav',visualiserRudiment:'helix',
      visualiserRenderer:'sprite-motion-orbit',visualiserSpriteTheme:'ice',visualiserSpectralDeform:'0'}]});
  assert.equal(wire.visualiserSpectralDeform, false);
  const [bands, sprite] = validateSongCollection(wire.songs);
  assert.equal(bands.visualiserTerrainSource, 'fft'); assert.equal(bands.visualiserSpectralDeform, true);
  assert.equal(sprite.visualiserSpriteTheme, 'ice'); assert.equal(sprite.visualiserSpectralDeform, false);
  assert.equal(sprite.visualiserRecordingUrl, '');
});

test('WordPress metadata resolves only recording IDs and preserves generic source and axes fields', async () => {
  const seen = [];
  const config = await fromWordPressMeta({[PAGE_META_KEYS.visualiserRecording]:'417',
    [PAGE_META_KEYS.visualiserRenderer]:'path', [PAGE_META_KEYS.visualiserAxes]:['left','right']},
    id => { seen.push(id); return `/uploads/${id}.json`; });
  assert.deepEqual(seen, [417]);
  assert.equal(config.visualiserRecordingUrl, '/uploads/417.json');
  assert.equal(config.visualiserRenderer, 'path');
  assert.deepEqual(config.visualiserAxes, ['left','right']);
  assert.equal(config.visualiserRudiment, '');
  const named = await fromWordPressMeta({[PAGE_META_KEYS.visualiserRudiment]:'helix',
    [PAGE_META_KEYS.visualiserRenderer]:'spatial-torus', [PAGE_META_KEYS.visualiserAxes]:['z','x']});
  assert.equal(named.visualiserRecordingUrl, '');
  assert.equal(named.visualiserRudiment, 'helix');
  assert.deepEqual(named.visualiserAxes, ['z','x']);
  assert.equal((await fromWordPressMeta({[PAGE_META_KEYS.visualiserRenderer]:'obsolete'})).visualiserRenderer, 'waveform');
  await assert.rejects(fromWordPressMeta({[PAGE_META_KEYS.visualiserRecording]:1}, () => 'javascript:evil()'));
  await assert.rejects(fromWordPressMeta({[PAGE_META_KEYS.visualiserRecording]:1, [PAGE_META_KEYS.visualiserRudiment]:'circle'}, () => '/song.json'), /Choose one/);
});

test('WordPress wire normalization retains per-song generic source isolation and existing spectrum options', () => {
  const wire = readWordPressConfig({pageId:'42', visualiserRudiment:'bounce', visualiserAxes:['x'],
    songCollectionEnabled:'1', songs:[{id:'one',title:'One',audioSrc:'/one.mp3',bpm:'140',
      visualiserRecordingUrl:'/one.json', visualiserRenderer:'path', visualiserAxes:['left','right'],
      spectrumRecordingUrl:'/one-fft.json', spectrumRenderer:'spectrum-line'},
    {id:'two',title:'Two',audioSrc:'/two.mp3',bpm:'120',visualiserRudiment:'helix',visualiserRenderer:'spatial-sphere'}]});
  assert.equal(validatePageConfig(wire).visualiserRudiment, 'bounce');
  const [one, two] = validateSongCollection(wire.songs);
  assert.equal(one.visualiserRecordingUrl, '/one.json');
  assert.equal(one.visualiserRudiment, '');
  assert.deepEqual(one.visualiserAxes, ['left','right']);
  assert.equal(one.spectrumRecordingUrl, '/one-fft.json');
  assert.equal(one.spectrumRenderer, 'spectrum-line');
  assert.equal(two.visualiserRecordingUrl, '');
  assert.equal(two.visualiserRudiment, 'helix');
  assert.deepEqual(two.visualiserAxes, []);
  assert.throws(() => validateSongCollection([{...wire.songs[0],visualiserRudiment:'circle'}]), /Choose one/);
});

test('selection mounts only the current song source and destroys each previous view owner', () => {
  const songs = [{id:'first',visualiserRecordingUrl:'/first.json',visualiserAxes:['left','right'],visualiserRenderer:'path'},
    {id:'second',visualiserRudiment:'helix',visualiserRenderer:'spatial-torus'}, {id:'third'}]
    .map(song => ({...song,title:song.id,bpm:120,audioSrc:`https://example.test/${song.id}.mp3`}));
  const select = Object.assign(new EventTarget(), {value:'first'});
  const sections = songs.map(song => {
    const audio = Object.assign(new EventTarget(), {src:song.audioSrc,currentSrc:'',duration:0,paused:true,pause(){this.paused = true;}});
    return {hidden:false,audio,getAttribute:name => name === 'data-dance-moves-song' ? song.id : null,
      querySelector:selector => selector === 'audio' ? audio : null};
  });
  const host = {location:new URL('https://example.test/'),cancelAnimationFrame(){}};
  const root = {nodeType:1,ownerDocument:{defaultView:host},querySelectorAll:() => sections,
    querySelector:selector => selector === '[data-dance-moves-song-select]' ? select : null};
  const mounts = [];
  const collection = createSongCollection({root,songs,host,mount:options => {
    const handle = {options,destroyed:false,ready:Promise.resolve(),destroy(){this.destroyed = true;}};
    mounts.push(handle);return handle;
  }});
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].options.visualiserRecordingUrl, '/first.json');
  assert.deepEqual(mounts[0].options.visualiserAxes, ['left','right']);
  assert.equal(mounts[0].options.root, sections[0]);
  collection.select('second');
  assert.equal(mounts[0].destroyed, true);
  assert.equal(mounts[1].options.visualiserRecordingUrl, '');
  assert.equal(mounts[1].options.visualiserRudiment, 'helix');
  assert.equal(mounts[1].options.root, sections[1]);
  collection.select('third');
  assert.equal(mounts[1].destroyed, true);
  assert.equal(mounts[2].options.visualiserRudiment, '');
  assert.equal(mounts[2].options.visualiserRecordingUrl, '');
  assert.deepEqual(mounts[2].options.visualiserAxes, []);
  collection.destroy();
  assert.equal(mounts[2].destroyed, true);
});
