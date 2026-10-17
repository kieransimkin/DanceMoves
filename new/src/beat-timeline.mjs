/** StemLab variable-tempo beat maps: source-bound piecewise 64-pip phase.
 * This is an optional clock. It never changes media, lyric or cue timestamps.
 */
export const BEAT_TIMELINE_SCHEMA = 'stemlab.beat-timeline.v1';
export const PIPS_PER_BEAT = 64;
const HASH = /^[a-f0-9]{64}$/;
const rationalRE = /^-?\d{1,80}(?:\/[1-9]\d{0,79})?$/;
const num = (v, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`Invalid ${name}`);
  return v;
};
const int = (v, name, lo, hi) => {
  if (!Number.isSafeInteger(v) || v < lo || v > hi) throw new RangeError(`Invalid ${name}`);
  return v;
};
function rationalPair(value) {
  if (typeof value !== 'string' || !rationalRE.test(value)) throw new TypeError('Invalid exact pip offset');
  const [n,d='1'] = value.split('/');
  return [BigInt(n), BigInt(d)];
}
function sourceUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f]/.test(value)) throw new TypeError('Verified master URL required');
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new TypeError('Invalid verified master URL');
  return value;
}
const close = (value, expected, tolerance = 1e-7) => Math.abs(num(value, 'derived field') - expected) <= tolerance;

/** Validate a full exported JSON or its compact WordPress projection.
 * A matching *verified* master URL is required at runtime, not for offline validation.
 */
export function validateBeatTimeline(input, {requireSourceUrl = false} = {}) {
  if (input === null || input === undefined || input === '') return null;
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schema !== BEAT_TIMELINE_SCHEMA ||
      input.pips_per_beat !== 64 || !input.source_audio || typeof input.source_audio !== 'object' ||
      !HASH.test(input.source_audio.sha256 || '') || !HASH.test(input.consensus_sha256 || '')) {
    throw new TypeError('Expected source-bound StemLab beat-timeline.v1');
  }
  const audio = input.source_audio;
  const sr = int(audio.sample_rate, 'sample_rate', 1, 768000);
  const frames = int(audio.num_frames, 'num_frames', 2, 1e13);
  int(audio.num_channels, 'num_channels', 1, 512);
  const origin = int(input.origin_beat, 'origin_beat', 0, 2147483647);
  if (!['estimated','artist_confirmed'].includes(input.review_status)) throw new TypeError('Beat review status must remain explicit');
  const rows = input.beats;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 25000) throw new RangeError('Beat map must contain 2..25000 anchors');
  let lastBeat = -1, lastFrame = -1, hasOrigin = false;
  const beats = rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('Invalid beat anchor');
    const beat = int(row.beat, 'beat number', 0, 2147483647);
    const frame = int(row.frame, 'source frame', 0, frames - 1);
    if (beat <= lastBeat || frame <= lastFrame) throw new RangeError('Beat indices and frames must strictly increase');
    if (!['consensus','corrected','manual'].includes(row.source)) throw new TypeError('Invalid beat provenance');
    const reference = row.reference_frame;
    if (reference !== null && reference !== undefined) int(reference, 'consensus reference', 0, frames - 1);
    if ((row.source === 'consensus' && (reference === null || reference === undefined || frame !== reference)) ||
        (row.source === 'manual' && reference !== null && reference !== undefined) ||
        (row.source === 'corrected' && (reference === null || reference === undefined))) {
      throw new TypeError('Original detector timestamps must retain their provenance');
    }
    hasOrigin ||= beat === origin;
    lastBeat = beat; lastFrame = frame;
    return Object.freeze({beat,frame,source:row.source,reference_frame:reference ?? null});
  });
  if (!hasOrigin) throw new RangeError('Beat 1 origin must identify a real anchor');
  const master = input.source_url === undefined ? null : sourceUrl(input.source_url);
  if (requireSourceUrl && !master) throw new TypeError('Verified master URL required for variable tempo');
  const out = {...input,source_audio:Object.freeze({sha256:audio.sha256,sample_rate:sr,num_frames:frames,num_channels:audio.num_channels}),
    beats:Object.freeze(beats),origin_beat:origin,source_url:master};
  const first = beats[0], next = beats[1];
  const deltaBeat = next.beat - first.beat, deltaFrame = next.frame - first.frame;
  const den = BigInt(deltaFrame);
  const expectedNumerator = BigInt(64) * (BigInt(first.beat-origin)*den-BigInt(first.frame)*BigInt(deltaBeat));
  const expectedOffset = Number(expectedNumerator) / deltaFrame;
  const selected = beats.find(row => row.beat === origin);
  const sync = input.sync;
  if (sync !== undefined) {
    if (!sync || typeof sync !== 'object' || sync.canonical_first_beat_pip !== 0 || sync.pips_per_beat !== 64 ||
        sync.beat_1_index !== origin || sync.beat_1_source_frame !== selected.frame ||
        !close(sync.beat_1_start_seconds, selected.frame/sr) ||
        !close(sync.sync_phase_offset_pips,expectedOffset) ||
        !close(sync.beat_1_start_pips,-expectedOffset)) throw new RangeError('Beat 1 and signed phase metadata disagree with anchors');
    const [n,d]=rationalPair(sync.exact_phase_offset_pips);
    if (n*den !== expectedNumerator*d) throw new RangeError('Exact phase offset disagrees with beat frames');
  }
  if (input.beat_timeline !== undefined) {
    if (!Array.isArray(input.beat_timeline) || input.beat_timeline.length !== beats.length) throw new RangeError('Derived beat timeline must contain every anchor');
    input.beat_timeline.forEach((row,i) => {
      const beat = beats[i];
      if (!row || row.beat !== beat.beat || row.source_frame !== beat.frame ||
          row.pip !== 64*(beat.beat-origin) || !close(row.time_seconds,beat.frame/sr) ||
          row.consensus_reference_frame !== beat.reference_frame) throw new RangeError('Derived beat timeline disagrees with source frames');
    });
  }
  if (input.tempo_segments !== undefined) {
    if (!Array.isArray(input.tempo_segments) || input.tempo_segments.length !== beats.length-1) throw new RangeError('Tempo segments do not match beat anchors');
    input.tempo_segments.forEach((row,i) => {
      const a=beats[i],b=beats[i+1], bpm=60*sr*(b.beat-a.beat)/(b.frame-a.frame);
      if (!row || row.start_frame !== a.frame || row.end_frame !== b.frame || !close(row.bpm,bpm,1e-7)) throw new RangeError('Tempo segments disagree with beat frames');
    });
  }
  return Object.freeze(out);
}

/** Return full fractional source-clock position in 64-pip units.
 * No cumulative floating-point tempo integration: the exact anchor indices win.
 */
export function phasePipsAtSeconds(map, seconds) {
  const frame = num(seconds,'source seconds') * map.source_audio.sample_rate;
  const rows = map.beats;
  let left=0,right=rows.length-1;
  while (left<right) {const mid=Math.floor((left+right)/2);if(rows[mid].frame<=frame)left=mid+1;else right=mid;}
  const index = Math.max(0, Math.min(rows.length-2, rows[left].frame <= frame ? left : left-1));
  const a=rows[index],b=rows[index+1];
  return 64*((a.beat-map.origin_beat)+(frame-a.frame)*(b.beat-a.beat)/(b.frame-a.frame));
}
export function tempoAtSeconds(map, seconds) {
  const frame=num(seconds,'source seconds')*map.source_audio.sample_rate;
  const rows=map.beats;let lo=0,hi=rows.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].frame<=frame)lo=mid+1;else hi=mid;}
  const i=Math.max(0,Math.min(rows.length-2,rows[lo].frame<=frame?lo:lo-1));
  const a=rows[i],b=rows[i+1];return 60*map.source_audio.sample_rate*(b.beat-a.beat)/(b.frame-a.frame);
}
export function tickAtSeconds(map, seconds) {return phasePipsAtSeconds(map,seconds)/4;}
