/** Read per-word timestamps independently of per-line LRC. All times are source seconds. */
export const MAX_WORD_EVENTS = 50000;
export const MAX_WORD_TIMING_BYTES = 1048576;

function word(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\uFFFD]/.test(value))
    throw new TypeError('Each timed word must contain nonempty UTF-8 text');
  return value.trim();
}
function numeric(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 86400)
    throw new RangeError(`Invalid ${field} in per-word timing`);
  return value;
}
function clock(minutes, seconds, fraction = '') {
  const ms = fraction ? Number(`0.${fraction}`) : 0;
  const time = Number(minutes) * 60 + Number(seconds) + ms;
  return numeric(time, 'word timestamp');
}
function normalize(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_WORD_EVENTS)
    throw new RangeError('Word timings require 1..50000 timed words');
  let previous = -1;
  return Object.freeze(rows.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError('Invalid timed word');
    const start = numeric(item.start ?? item.time, 'word start');
    const end = item.end === undefined || item.end === null || item.end === '' ? null : numeric(item.end, 'word end');
    if (start < previous || end !== null && end < start)
      throw new RangeError('Word starts must be monotonic, with end >= start');
    previous = start;
    const text = word(item.word ?? item.text);
    return Object.freeze({index, time:start, start, end, word:text, text});
  }));
}
function fromJson(text) {
  const data = JSON.parse(text);
  const rows = Array.isArray(data) ? data : data?.words;
  if (!Array.isArray(rows)) throw new TypeError('Word-timing JSON must contain a words array');
  return normalize(rows);
}
function fromTsv(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(row => row.trim());
  const header = lines[0]?.split('\t').map(x => x.trim().toLowerCase());
  const recognized = header?.includes('start') && header?.includes('end') && (header?.includes('word') || header?.includes('text'));
  const fields = recognized ? header : ['start', 'end', 'word'];
  const s = fields.indexOf('start'), e = fields.indexOf('end');
  const w = fields.indexOf('word') !== -1 ? fields.indexOf('word') : fields.indexOf('text');
  if (s < 0 || e < 0 || w < 0) throw new TypeError('Word TSV needs start, end and word columns');
  const values = (recognized ? lines.slice(1) : lines).map(line => {
    const cells = line.split('\t');
    const start = Number(cells[s]), end = Number(cells[e]);
    if (!cells[s]?.trim() || !cells[e]?.trim()) throw new RangeError('Missing TSV word timestamp');
    return {start,end,word:cells[w]};
  });
  return normalize(values);
}
function fromLrc(text) {
  const rows = [];
  const stamp = /([<\[])(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?[>\]]/g;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    const parts = [...line.matchAll(stamp)].filter(m => m[0].endsWith(m[1] === '<' ? '>' : ']'));
    const perWord = parts.filter(m => m[1] === '<');
    if (perWord.length) {
      for (let i = 0; i < perWord.length; i++) {
        const current = perWord[i];
        const after = current.index + current[0].length;
        const following = perWord[i+1]?.index ?? line.length;
        const text = line.slice(after, following).trim();
        if (!text) throw new TypeError('Enhanced LRC word marker is missing text');
        rows.push({start:clock(current[2],current[3],current[4]),word:text});
      }
    } else if (parts.length) {
      // One ordinary LRC timestamp per word line, distinct from line-level lyrics.
      const actual = parts.filter(m => m[1] === '[');
      if (actual.length !== 1) throw new TypeError('Word-level LRC requires one [] stamp per word or enhanced <> stamps');
      const mark = actual[0], text = line.slice(mark.index + mark[0].length).trim();
      rows.push({start:clock(mark[2],mark[3],mark[4]),word:text});
    } else if (!/^\[(?:ar|al|ti|by|offset):/i.test(line.trim())) {
      throw new TypeError('Untimed text in word LRC');
    }
  }
  return normalize(rows);
}
export function parseWordTimingFile(text, {format = 'auto'} = {}) {
  if (typeof text !== 'string' || /\u0000|\uFFFD/.test(text) ||
      new TextEncoder().encode(text).length > MAX_WORD_TIMING_BYTES)
    throw new TypeError('Word timing file must be valid UTF-8, under 1 MiB');
  const raw = text.trim();
  if (!raw) throw new TypeError('Word timing file is empty');
  if (!['auto','json','tsv','lrc'].includes(format)) throw new TypeError('Unsupported word-timing format');
  const kind = format === 'auto' ? (/^[\[{]/.test(raw) && (raw[0] === '{' || raw.startsWith('[{')) ? 'json' : raw.includes('\t') ? 'tsv' : 'lrc') : format;
  return kind === 'json' ? fromJson(raw) : kind === 'tsv' ? fromTsv(raw) : fromLrc(raw);
}
