import {validateBeatAlignment} from './beat-alignment.mjs';
import {validateBeatTimeline, tempoAtSeconds} from './beat-timeline.mjs';
import {SPECTRUM_RENDERERS} from './spectrum-analysis.mjs';
import {VISUALISER_RENDERERS, VISUALISER_RUDIMENTS, describeVisualiser} from './visualiser-catalogue.mjs';
/** Host-neutral page properties. WordPress attachment IDs remain a host concern. */
export const PAGE_META_KEYS = Object.freeze({
  bpm: '_dance_moves_bpm', lyric: '_dance_moves_lyric_timing_id', word: '_dance_moves_word_timing_id', cue: '_dance_moves_cue_timing_id',
  popups: '_dance_moves_lyric_popups_enabled', duration: '_dance_moves_master_duration_ms', effect: '_dance_moves_effect',
  alignment: '_dance_moves_beat_alignment', alignmentAudio: '_dance_moves_beat_alignment_audio_id',
  beatTimeline: '_dance_moves_beat_timeline', useBeatTimeline: '_dance_moves_use_beat_timeline',
  spectrumRecording: '_dance_moves_spectrum_recording_id', spectrumRenderer: '_dance_moves_spectrum_renderer',
  visualiserRecording: '_dance_moves_visualiser_recording_id', visualiserRenderer: '_dance_moves_visualiser_renderer',
  visualiserRudiment: '_dance_moves_visualiser_rudiment', visualiserAxes: '_dance_moves_visualiser_axes'
});
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function finite(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be a finite number in [${min}, ${max}]`);
  return value;
}
function url(value, name) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f]/.test(value)) throw new TypeError(`Invalid ${name}`);
  const parsed = new URL(value, 'https://dancemoves.invalid/');
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new TypeError(`${name} must be an HTTP(S) or relative URL`);
  return value;
}
export function validatePageConfig(input = {}) {
  if (!object(input)) throw new TypeError('Page configuration must be an object');
  const explicit = input.bpm !== undefined && input.bpm !== null && input.bpm !== '';
  const beatAlignment=validateBeatAlignment(input.beatAlignment);
  const beatTimeline=validateBeatTimeline(input.beatTimeline,{requireSourceUrl:true});
  const canonicalExplicit=explicit && !['fallback','analysis'].includes(input.bpmSource);
  if (canonicalExplicit && beatAlignment && !beatTimeline && Math.abs(input.bpm-beatAlignment.bpm)>0.000500001) throw new RangeError('Stored BPM and selected beat alignment disagree; select a matching BPM basis');
  const derivedTempo=beatTimeline ? tempoAtSeconds(beatTimeline,beatTimeline.beats[0].frame/beatTimeline.source_audio.sample_rate) : null;
  const nominalTempo=beatTimeline ? beatAlignment?.bpm ?? Math.min(400,Math.max(20,derivedTempo)) : null;
  const bpm = beatTimeline ? (explicit ? Math.round(finite(input.bpm,'bpm',20,400)*1000)/1000 : nominalTempo)
    : beatAlignment ? beatAlignment.bpm : explicit ? Math.round(finite(input.bpm, 'bpm', 20, 400) * 1000) / 1000 : 120;
  if (explicit) finite(input.bpm, 'bpm', 20, 400);
  const effect = input.effect ?? '';
  if (!['', 'paper-planes'].includes(effect)) throw new RangeError('effect must be empty or paper-planes');
  const spectrumRenderer = input.spectrumRenderer ?? 'spectrum';
  if (!SPECTRUM_RENDERERS.includes(spectrumRenderer)) throw new RangeError('Unknown spectrum renderer');
  const visualiserRenderer = input.visualiserRenderer ?? 'waveform';
  if (!VISUALISER_RENDERERS.includes(visualiserRenderer)) throw new RangeError('Unknown visualiser renderer');
  const visualiserRecordingUrl = url(input.visualiserRecordingUrl, 'visualiserRecordingUrl');
  const visualiserRudiment = input.visualiserRudiment ?? '';
  if (typeof visualiserRudiment !== 'string' || (visualiserRudiment !== '' && !VISUALISER_RUDIMENTS.includes(visualiserRudiment)))
    throw new RangeError('Unknown visualiser rudiment');
  if (visualiserRecordingUrl && visualiserRudiment) throw new RangeError('Choose one visualiser source: a recording URL or a named rudiment');
  if (visualiserRudiment && describeVisualiser(visualiserRenderer).requiresSpectrum)
    throw new RangeError('This visualiser renderer requires a calibrated spectrum recording');
  const axes = input.visualiserAxes ?? [];
  if (!Array.isArray(axes) || axes.length > 64) throw new RangeError('visualiserAxes must contain at most 64 unique dimension names');
  const selectedAxes = new Set();
  for (const axis of axes) {
    if (typeof axis !== 'string' || axis.trim() !== axis || !/^[a-z][a-z0-9_]{0,127}$/.test(axis) || selectedAxes.has(axis))
      throw new RangeError('visualiserAxes must contain unique valid dimension names');
    selectedAxes.add(axis);
  }
  const visualiserAxes = Object.freeze([...selectedAxes]);
  if (input.lyricPopupsEnabled !== undefined && typeof input.lyricPopupsEnabled !== 'boolean') throw new TypeError('lyricPopupsEnabled must be boolean');
  const duration = finite(input.masterDurationMilliseconds ?? 0, 'masterDurationMilliseconds', 0, 86400000);
  const ticks = finite(input.sharedControlTicks ?? 0, 'sharedControlTicks', 0, 65536);
  const disclosure = finite(input.lyricDisclosureTicks ?? 6, 'lyricDisclosureTicks', 1, 65536);
  const pageId = input.pageId ?? 0;
  if (!Number.isSafeInteger(pageId) || pageId < 0) throw new RangeError('pageId must be a non-negative safe integer');
  return Object.freeze({pageId, bpm,
    bpmSource: canonicalExplicit ? 'explicit' : beatAlignment || beatTimeline ? 'analysis' : 'fallback', fallbackBpm: 120,
    beatAlignment, beatTimeline,
    ticksPerBeat: 16, tickDefinition: 'sixteenth-of-beat', longDurationQuantumTicks: 16,
    cueTimingUrl: url(input.cueTimingUrl, 'cueTimingUrl'), lyricTimingUrl: url(input.lyricTimingUrl, 'lyricTimingUrl'),
    wordTimingUrl: url(input.wordTimingUrl,'wordTimingUrl'),
    spectrumRecordingUrl: url(input.spectrumRecordingUrl,'spectrumRecordingUrl'), spectrumRenderer,
    visualiserRecordingUrl, visualiserRenderer, visualiserRudiment, visualiserAxes,
    lyricPopupsEnabled: input.lyricPopupsEnabled === true, masterDurationMilliseconds: Math.round(duration * 1000) / 1000,
    sharedControlTicks: ticks, lyricDisclosureTicks: disclosure, effect, diagnostics: input.diagnostics === true});
}
export async function fromWordPressMeta(meta, resolveAttachment) {
  if (!object(meta)) throw new TypeError('meta must be an object');
  const numeric = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
  const b = meta[PAGE_META_KEYS.bpm];
  const bpm = numeric(b) && Number(b) >= 20 && Number(b) <= 400 ? Number(b) : undefined;
  const resolve = async key => {
    const value = Number(meta[key] || 0);
    if (!Number.isSafeInteger(value)) throw new RangeError('Attachment ID must be a safe integer');
    const id = Math.abs(value);
    if (!id) return '';
    if (typeof resolveAttachment !== 'function') throw new TypeError('An attachment URL resolver is required for nonzero IDs');
    return (await resolveAttachment(id)) || '';
  };
  const duration = Number(meta[PAGE_META_KEYS.duration]);
  let beatAlignment=meta[PAGE_META_KEYS.alignment] || null;
  if (typeof beatAlignment==='string') {
    if (beatAlignment.length>16384) throw new RangeError('Beat alignment exceeds 16 KiB');
    beatAlignment=JSON.parse(beatAlignment);
  }
  if (beatAlignment) beatAlignment={...beatAlignment,source_url:await resolve(PAGE_META_KEYS.alignmentAudio)};
  const enabled=[true,1,'1'].includes(meta[PAGE_META_KEYS.useBeatTimeline]);
  let beatTimeline=enabled ? meta[PAGE_META_KEYS.beatTimeline] || null : null;
  if (typeof beatTimeline==='string') {
    if (beatTimeline.length > 16*1024*1024) throw new RangeError('Beat timeline exceeds 16 MiB');
    beatTimeline=JSON.parse(beatTimeline);
  }
  if (beatTimeline) beatTimeline={...beatTimeline,source_url:await resolve(PAGE_META_KEYS.alignmentAudio)};
  return validatePageConfig({bpm, beatAlignment, beatTimeline, lyricTimingUrl: await resolve(PAGE_META_KEYS.lyric), wordTimingUrl: await resolve(PAGE_META_KEYS.word), cueTimingUrl: await resolve(PAGE_META_KEYS.cue),
    spectrumRecordingUrl: await resolve(PAGE_META_KEYS.spectrumRecording),
    spectrumRenderer: SPECTRUM_RENDERERS.includes(meta[PAGE_META_KEYS.spectrumRenderer]) ? meta[PAGE_META_KEYS.spectrumRenderer] : 'spectrum',
    visualiserRecordingUrl: await resolve(PAGE_META_KEYS.visualiserRecording),
    visualiserRenderer: VISUALISER_RENDERERS.includes(meta[PAGE_META_KEYS.visualiserRenderer]) ? meta[PAGE_META_KEYS.visualiserRenderer] : 'waveform',
    visualiserRudiment: meta[PAGE_META_KEYS.visualiserRudiment] || '',
    visualiserAxes: meta[PAGE_META_KEYS.visualiserAxes] || [],
    lyricPopupsEnabled: meta[PAGE_META_KEYS.popups] === true || String(meta[PAGE_META_KEYS.popups]) === '1',
    masterDurationMilliseconds: Number.isFinite(duration) && duration > 0 && duration <= 86400000 ? duration : 0,
    effect: meta[PAGE_META_KEYS.effect] === 'paper-planes' ? 'paper-planes' : ''});
}
/** No database is bundled. This bounded revision store is for demos and local applications. */
export function createMemoryPageStore({maxPages = 100, maxRevisions = 20} = {}) {
  for (const [name, value] of Object.entries({maxPages,maxRevisions})) if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(name);
  const pages = new Map();
  const key = id => { if (typeof id !== 'string' || !id.trim() || id.length > 160) throw new TypeError('Invalid page id'); return id; };
  const clone = value => value ? structuredClone(value) : null;
  return Object.freeze({
    read(id) { return clone(pages.get(key(id))?.at(-1) || null); },
    revisions(id) { return clone(pages.get(key(id)) || []); },
    save(id, input, {expectedRevision} = {}) {
      key(id); const config = validatePageConfig(input); const history = pages.get(id) || [];
      const current = history.at(-1)?.revision || 0;
      if (expectedRevision !== undefined && expectedRevision !== current) throw new Error('Revision conflict');
      if (!pages.has(id) && pages.size >= maxPages) throw new Error('Page store capacity reached');
      const record = {revision: current + 1, config, savedAt: new Date().toISOString()};
      pages.set(id, [...history, record].slice(-maxRevisions)); return clone(record);
    },
    restore(id, revision, options) {
      const record = (pages.get(key(id)) || []).find(item => item.revision === revision);
      if (!record) throw new RangeError('Revision not found');
      return this.save(id, record.config, options);
    },
    delete(id) { return pages.delete(key(id)); }
  });
}
