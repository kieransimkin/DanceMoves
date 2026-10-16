/** Validate a saved StemLab reading. This never detects beats or approves a tempo. */
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function rational(value, label) {
  if (typeof value !== 'string' || !/^-?\d{1,80}(?:\/[1-9]\d{0,79})?$/.test(value)) throw new TypeError(`Invalid exact ${label}`);
  const [n,d='1'] = value.split('/');
  return [BigInt(n),BigInt(d)];
}
function numeric(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`Invalid ${label}`);
  return value;
}
export function validateBeatAlignment(input) {
  if (input === undefined || input === null || input === '') return null;
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schema !== 'stemlab.beat-alignment.v1'
      || input.pips_per_beat !== 64 || input.canonical_first_beat_pip !== 0
      || !hash(input.source_sha256) || !hash(input.evidence_sha256) || !hash(input.report_sha256)) throw new TypeError('Invalid source-bound StemLab beat alignment');
  const bpm = numeric(input.bpm,'alignment BPM',20,400);
  const first = numeric(input.first_beat_seconds,'first beat',0,86400);
  const offset = numeric(input.offset_pips,'pip offset',-36864000,0);
  const [bn,bd]=rational(input.exact_bpm,'BPM'),[fn,fd]=rational(input.first_beat_exact_seconds,'first beat'),[pn,pd]=rational(input.exact_offset_pips,'pip offset');
  if (fn*bn*64n*pd + pn*fd*bd*60n !== 0n || bn<=0n || fn<0n
      || Math.abs(Number(bn)/Number(bd)-bpm)>1e-9 || Math.abs(Number(fn)/Number(fd)-first)>1e-9
      || Math.abs(Number(pn)/Number(pd)-offset)>1e-7) throw new RangeError('Exact beat alignment and numeric clock disagree');
  if (!['canonical','estimated'].includes(input.bpm_status) || !['estimated','confirmed','synthetic'].includes(input.phase_status)) throw new TypeError('Alignment authority is required');
  for (const key of ['analysis_id','bpm_basis']) if (typeof input[key]!=='string' || !/^[a-zA-Z0-9_.-]{1,128}$/.test(input[key])) throw new TypeError(`Invalid ${key}`);
  if (input.source_audio_verified!==true || !input.source_audio || !Number.isSafeInteger(input.source_audio.num_frames)
      || input.source_audio.num_frames<1 || !Number.isSafeInteger(input.source_audio.sample_rate) || input.source_audio.sample_rate<1
      || first>=input.source_audio.num_frames/input.source_audio.sample_rate) throw new TypeError('Verified source audio frame bounds are required');
  const sourceUrl=input.source_url;
  if (typeof sourceUrl!=='string' || sourceUrl.length>4096 || /[\u0000-\u001f]/.test(sourceUrl)) throw new TypeError('An exact verified master URL is required');
  const parsed=new URL(sourceUrl);
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) throw new TypeError('Invalid verified master URL');
  return Object.freeze({...input,bpm,first_beat_seconds:first,offset_pips:offset,source_audio:Object.freeze({...input.source_audio})});
}
