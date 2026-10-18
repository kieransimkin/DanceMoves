import test from 'node:test';
import assert from 'node:assert/strict';
import {PAGE_META_KEYS, validatePageConfig, fromWordPressMeta} from '../../src/config.mjs';
import {readWordPressConfig} from '../../src/wordpress-config.mjs';
import {validateSongCollection, createSongCollection} from '../../src/song-collection.mjs';
import {SPECTRUM_RENDERERS} from '../../src/spectrum-analysis.mjs';

test('spectrum is unconfigured by default and configuration contains only a URL and renderer', () => {
  const defaults = validatePageConfig();
  assert.equal(defaults.spectrumRecordingUrl, '');
  assert.equal(defaults.spectrumRenderer, 'spectrum');
  const selected = validatePageConfig({spectrumRecordingUrl:'/uploads/song.json', spectrumRenderer:'spectrum-ring',
    spectrumRecording:{samples:[[0.1]],name:'must not be retained'}});
  assert.equal(selected.spectrumRecordingUrl, '/uploads/song.json');
  assert.equal(selected.spectrumRenderer, 'spectrum-ring');
  assert.equal(Object.hasOwn(selected, 'spectrumRecording'), false);
  assert.equal(Object.isFrozen(selected), true);
});

test('every FrameRudiments spectrum style is accepted as page configuration', () => {
  assert.deepEqual([...SPECTRUM_RENDERERS], ['spectrum','spectrum-line','spectrum-area','spectrum-dots',
    'spectrum-stems','spectrum-steps','spectrum-mirror','spectrum-radial','spectrum-ring','spectrum-spiral']);
  for (const spectrumRenderer of SPECTRUM_RENDERERS) {
    assert.equal(validatePageConfig({spectrumRenderer}).spectrumRenderer, spectrumRenderer);
  }
  for (const spectrumRenderer of ['',false,{},'not-a-spectrum']) {
    assert.throws(() => validatePageConfig({spectrumRenderer}), /spectrum renderer/);
  }
});

test('spectrum URLs use the same bounded HTTP(S)/relative policy as timing files', () => {
  for (const spectrumRecordingUrl of ['/media/one.json','../data/two.json','https://media.example.test/three.json']) {
    assert.equal(validatePageConfig({spectrumRecordingUrl}).spectrumRecordingUrl, spectrumRecordingUrl);
  }
  for (const spectrumRecordingUrl of ['javascript:alert(1)','data:application/json,{}','file:///private/song.json',
    'https://user:secret@example.test/song.json','/media/line\n.json','x'.repeat(4097), {},42]) {
    assert.throws(() => validatePageConfig({spectrumRecordingUrl}));
  }
});

test('WordPress metadata resolves only the selected Page attachment without fetching sample data', async () => {
  const seen = [];
  const config = await fromWordPressMeta({[PAGE_META_KEYS.spectrumRecording]:'412',
    [PAGE_META_KEYS.spectrumRenderer]:'spectrum-mirror'}, id => { seen.push(id); return `/media/${id}.json`; });
  assert.deepEqual(seen, [412]);
  assert.equal(config.spectrumRecordingUrl, '/media/412.json');
  assert.equal(config.spectrumRenderer, 'spectrum-mirror');
  assert.equal((await fromWordPressMeta({})).spectrumRecordingUrl, '');
  assert.equal((await fromWordPressMeta({[PAGE_META_KEYS.spectrumRenderer]:'obsolete'})).spectrumRenderer, 'spectrum');
  await assert.rejects(fromWordPressMeta({[PAGE_META_KEYS.spectrumRecording]:1}, () => 'javascript:evil()'));
});

test('WordPress scalar normalization preserves page and per-song spectrum references', () => {
  const wire = readWordPressConfig({pageId:'42',spectrumRecordingUrl:'/media/page.json',spectrumRenderer:'spectrum-line',
    songCollectionEnabled:'1',songs:[{id:'first',title:'First',audioSrc:'/media/first.mp3',bpm:'120',
      spectrumRecordingUrl:'/media/first.json',spectrumRenderer:'spectrum-dots'}]});
  assert.equal(validatePageConfig(wire).spectrumRecordingUrl, '/media/page.json');
  const [song] = validateSongCollection(wire.songs);
  assert.equal(song.spectrumRecordingUrl, '/media/first.json');
  assert.equal(song.spectrumRenderer, 'spectrum-dots');
  assert.equal(song.bpm, 120);
});

test('only the selected song passes its recording URL to a mount and switching disposes the previous owner', () => {
  const songs = ['first','second'].map((id,index) => ({id,title:id,bpm:120 + index * 25,
    audioSrc:`https://example.test/${id}.mp3`,spectrumRecordingUrl:`/media/${id}.json`,
    spectrumRenderer:index ? 'spectrum-ring' : 'spectrum'}));
  const select = Object.assign(new EventTarget(), {value:'first'});
  const sections = songs.map(song => {
    const audio = Object.assign(new EventTarget(), {src:song.audioSrc,currentSrc:'',duration:0,paused:true,
      pause(){this.paused = true;}});
    return {hidden:false,audio,getAttribute:name => name === 'data-dance-moves-song' ? song.id : null,
      querySelector:selector => selector === 'audio' ? audio : null};
  });
  const host = {location:new URL('https://example.test/'),cancelAnimationFrame(){}};
  const root = {nodeType:1,ownerDocument:{defaultView:host},querySelectorAll:() => sections,
    querySelector:selector => selector === '[data-dance-moves-song-select]' ? select : null};
  const mounts = [];
  const collection = createSongCollection({root,songs,host,mount:options => {
    const handle = {options,ready:Promise.resolve(),destroyed:false,destroy(){this.destroyed = true;}};
    mounts.push(handle);
    return handle;
  }});
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].options.spectrumRecordingUrl, '/media/first.json');
  assert.equal(mounts[0].options.root, sections[0]);
  assert.equal(sections[1].hidden, true);
  collection.select('second');
  assert.equal(mounts.length, 2);
  assert.equal(mounts[0].destroyed, true);
  assert.equal(mounts[1].options.spectrumRecordingUrl, '/media/second.json');
  assert.equal(mounts[1].options.spectrumRenderer, 'spectrum-ring');
  assert.equal(mounts[1].options.root, sections[1]);
  collection.destroy();
  assert.equal(mounts[1].destroyed, true);
});
