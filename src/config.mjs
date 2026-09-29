/** Host-neutral page properties. WordPress attachment IDs remain a host concern. */
export const PAGE_META_KEYS = Object.freeze({
  bpm: '_dance_moves_bpm', lyric: '_dance_moves_lyric_timing_id', cue: '_dance_moves_cue_timing_id',
  popups: '_dance_moves_lyric_popups_enabled', duration: '_dance_moves_master_duration_ms', effect: '_dance_moves_effect'
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
  const bpm = explicit ? Math.round(finite(input.bpm, 'bpm', 20, 400) * 1000) / 1000 : 120;
  const effect = input.effect ?? '';
  if (!['', 'paper-planes'].includes(effect)) throw new RangeError('effect must be empty or paper-planes');
  if (input.lyricPopupsEnabled !== undefined && typeof input.lyricPopupsEnabled !== 'boolean') throw new TypeError('lyricPopupsEnabled must be boolean');
  const duration = finite(input.masterDurationMilliseconds ?? 0, 'masterDurationMilliseconds', 0, 86400000);
  const ticks = finite(input.sharedControlTicks ?? 0, 'sharedControlTicks', 0, 65536);
  const disclosure = finite(input.lyricDisclosureTicks ?? 6, 'lyricDisclosureTicks', 1, 65536);
  const pageId = input.pageId ?? 0;
  if (!Number.isSafeInteger(pageId) || pageId < 0) throw new RangeError('pageId must be a non-negative safe integer');
  return Object.freeze({pageId, bpm,
    bpmSource: explicit && input.bpmSource !== 'fallback' ? 'explicit' : 'fallback', fallbackBpm: 120,
    ticksPerBeat: 16, tickDefinition: 'sixteenth-of-beat', longDurationQuantumTicks: 16,
    cueTimingUrl: url(input.cueTimingUrl, 'cueTimingUrl'), lyricTimingUrl: url(input.lyricTimingUrl, 'lyricTimingUrl'),
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
  return validatePageConfig({bpm, lyricTimingUrl: await resolve(PAGE_META_KEYS.lyric), cueTimingUrl: await resolve(PAGE_META_KEYS.cue),
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
