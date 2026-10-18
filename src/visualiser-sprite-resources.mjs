import {SPRITE_ATLASES, validateSpriteAsset} from './visualiser-sprite-catalogue.mjs';
import {createSpriteBank} from './visualiser-sprites.mjs';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_SIDE = 4096, MAX_PIXELS = 16777216;
function httpUrl(value, base, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value))
    throw new TypeError(`${label} must be a bounded HTTP(S) or relative URL`);
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new TypeError(`${label} must be HTTP(S) without credentials`);
  url.hash = '';
  return url;
}

/** No request happens while resolving metadata or importing the library. */
export function resolveSpriteAtlas(style, assetBaseUrl, pageUrl) {
  const custom = validateSpriteAsset(style.sprite_asset);
  if (custom) return Object.freeze({url: httpUrl(custom.url, pageUrl, 'Sprite atlas URL').href,
    sha256: custom.sha256, columns: style.sprite_columns, rows: style.sprite_rows, custom: true});
  const atlas = SPRITE_ATLASES[style.sprite_theme];
  if (!atlas) throw new RangeError('Unknown sprite atlas theme');
  if (!assetBaseUrl) throw new TypeError('Set visualiserAssetBaseUrl to the shipped visualiser-sprites directory for a built-in sprite view');
  const base = httpUrl(assetBaseUrl, pageUrl, 'visualiserAssetBaseUrl');
  if (base.search) throw new TypeError('visualiserAssetBaseUrl must be a directory URL without a query');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return Object.freeze({...atlas, url: new URL(atlas.file, base).href, custom: false});
}

/** Bound decoded pixels before invoking an image decoder. Animated PNGs are not atlases. */
export function validateAtlasPng(bytes, descriptor) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 45 || bytes.length > MAX_BYTES ||
      ![137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value))
    throw new TypeError('Sprite atlas must be a static PNG of at most 16 MiB');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452)
    throw new TypeError('Sprite atlas PNG requires a valid IHDR header');
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS)
    throw new RangeError('Sprite atlas exceeds the 4096-pixel side or 16,777,216-pixel limit');
  const {columns, rows} = descriptor;
  if (![columns, rows].every(value => Number.isInteger(value) && value >= 1 && value <= 32) ||
      width % columns || height % rows)
    throw new RangeError('Sprite atlas dimensions must divide evenly into 1..32 columns and rows');
  if (descriptor.width !== undefined && descriptor.width !== width || descriptor.height !== undefined && descriptor.height !== height)
    throw new RangeError('Sprite atlas dimensions differ from its pinned manifest');
  let position = 8, ended = false;
  while (position + 12 <= bytes.length) {
    const length = view.getUint32(position), type = view.getUint32(position + 4);
    if (position + length + 12 > bytes.length) throw new TypeError('Sprite atlas PNG has a truncated chunk');
    if (type === 0x6163544c) throw new TypeError('Animated PNG is unsupported; use static atlas cells with animation_frames');
    position += length + 12;
    if (type === 0x49454e44) {if (length !== 0) throw new TypeError('Invalid PNG end chunk');ended = true;break;}
  }
  if (!ended || position !== bytes.length) throw new TypeError('Sprite atlas PNG has an incomplete or trailing payload');
  return Object.freeze({width, height});
}

async function readBytes(response, signal) {
  if (!response.ok) throw new Error(`Sprite atlas request failed: ${response.status}`);
  if (Number(response.headers?.get('content-length')) > MAX_BYTES) {
    await response.body?.cancel?.();
    throw new RangeError('Sprite atlas exceeds 16 MiB');
  }
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    signal.throwIfAborted();
    if (bytes.length > MAX_BYTES) throw new RangeError('Sprite atlas exceeds 16 MiB');
    return bytes;
  }
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {await reader.cancel();throw new RangeError('Sprite atlas exceeds 16 MiB');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset);offset += chunk.byteLength;}
  return bytes;
}

async function decodeImage(host, bytes, signal) {
  const blob = new host.Blob([bytes], {type: 'image/png'});
  if (typeof host.createImageBitmap === 'function') return host.createImageBitmap(blob, {
    imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
  if (!host.URL?.createObjectURL) throw new Error('Sprite atlas image decoding is unavailable');
  const image = host.document.createElement('img'), url = host.URL.createObjectURL(blob);
  let abort;
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Sprite atlas PNG could not be decoded'));
      abort = () => {image.removeAttribute('src');reject(signal.reason || new Error('Sprite atlas request aborted'));};
      signal.addEventListener('abort', abort, {once: true});
      if (signal.aborted) abort();else image.src = url;
    });
    return image;
  } finally {
    image.onload = null;image.onerror = null;
    signal.removeEventListener('abort', abort);
    host.URL.revokeObjectURL(url);
  }
}

/** Page-scoped, reference-counted decoded images and bounded sprite-cell caches. */
export function createSpriteResources(scope, {createBank = createSpriteBank} = {}) {
  const host = scope.root.ownerDocument.defaultView, entries = new Map();
  let destroyed = false;
  async function load(entry, descriptor) {
    let bytes = null, image = null, bank = null;
    try {
      const signal = entry.abort.signal;
      if (!host.crypto?.subtle) throw new Error('Sprite atlas integrity verification requires Web Crypto (HTTPS or localhost)');
      bytes = await readBytes(await host.fetch(descriptor.url, {signal}), signal);
      signal.throwIfAborted();
      const size = validateAtlasPng(bytes, descriptor);
      const digest = await host.crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      if (sha256 !== descriptor.sha256) throw new Error('Sprite atlas SHA-256 mismatch');
      signal.throwIfAborted();
      image = await decodeImage(host, bytes, signal);
      bytes = null;
      signal.throwIfAborted();
      if ((image.naturalWidth || image.width) !== size.width || (image.naturalHeight || image.height) !== size.height)
        throw new RangeError('Decoded sprite atlas dimensions differ from its PNG header');
      bank = createBank({...descriptor, ...size, image}, () => host.document.createElement('canvas'));
      image = null;
      if (destroyed || scope.disposed || entry.refs < 1) throw new Error('Sprite atlas owner was destroyed during loading');
      entry.bank = bank;bank = null;
      return entry.bank;
    } catch (error) {
      image?.close?.();bank?.destroy();
      throw error;
    } finally {bytes = null;image = null;bank = null;}
  }
  function releaseEntry(key, entry) {
    entry.abort.abort();entry.bank?.destroy();entry.bank = null;
    if (entries.get(key) === entry) entries.delete(key);
  }
  function acquire(descriptor) {
    if (destroyed || scope.disposed) throw new Error('Sprite atlas scope is destroyed');
    const key = JSON.stringify([descriptor.url, descriptor.sha256, descriptor.columns, descriptor.rows, descriptor.custom]);
    let entry = entries.get(key);
    if (!entry) {
      entry = {refs: 0, abort: new host.AbortController(), bank: null, promise: null};
      entries.set(key, entry);
      entry.promise = load(entry, descriptor);entry.promise.catch(() => {});
    }
    entry.refs++;
    let released = false;
    return {promise: entry.promise, release() {
      if (released) return;released = true;
      if (--entry.refs <= 0) releaseEntry(key, entry);
    }};
  }
  function destroy() {
    if (destroyed) return;destroyed = true;
    for (const [key, entry] of entries) releaseEntry(key, entry);
  }
  scope.onDispose(destroy);
  return Object.freeze({acquire, destroy, count: () => entries.size});
}
