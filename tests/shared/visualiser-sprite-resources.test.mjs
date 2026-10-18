import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {SPRITE_ATLASES, SPRITE_THEMES, validateSpriteAsset} from '../../src/visualiser-sprite-catalogue.mjs';
import {createSpriteResources, resolveSpriteAtlas, validateAtlasPng} from '../../src/visualiser-sprite-resources.mjs';

const png = new Uint8Array(readFileSync(new URL('../../assets/visualiser-sprites/lcd.png', import.meta.url)));
const base = 'https://example.test/page/';
const builtin = (theme = 'lcd') => resolveSpriteAtlas({sprite_theme:theme}, '/atlases/', base);
const custom = (extra = {}) => ({...builtin(), custom:true, ...extra});
function fixture({fetch, decode, fallback = false} = {}) {
  const requests = [], images = [], banks = [], callbacks = [], revoked = [], urls = [];
  const host = {AbortController, crypto:webcrypto, Blob, document:{createElement(tag) {
    assert.equal(tag, 'img');
    const image = {naturalWidth:768,naturalHeight:768,onload:null,onerror:null,removeAttribute() {this.removed = true;}};
    Object.defineProperty(image,'src',{set() {queueMicrotask(() => image.onload?.());}});
    images.push(image);return image;
  }},URL:{createObjectURL() {const url = `blob:synthetic-${urls.length}`;urls.push(url);return url;},
    revokeObjectURL(url) {revoked.push(url);}},
    async fetch(url, options) {requests.push({url,signal:options.signal});return fetch ? fetch(url, options) : new Response(png);}};
  if (!fallback) host.createImageBitmap = async (blob, options) => {
    assert.equal(blob.type, 'image/png');
    assert.deepEqual(options, {imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const image = {width:768,height:768,closed:0,close() {this.closed++;}};
    images.push(image);return decode ? decode(image) : image;
  };
  const scope = {root:{ownerDocument:{defaultView:host}},disposed:false,onDispose(fn) {callbacks.push(fn);},
    dispose() {if (this.disposed) return;this.disposed = true;for (const fn of callbacks) fn();}};
  const pool = createSpriteResources(scope,{createBank(descriptor) {
    let image = descriptor.image;
    const bank = {destroyed:false,descriptor:{...descriptor,image:undefined},destroy() {
      if (this.destroyed) return;this.destroyed = true;image?.close?.();image = null;
    }};
    banks.push(bank);return bank;
  }});
  return {pool,host,scope,requests,images,banks,revoked,urls};
}

test('all original atlas bytes, PNG dimensions, manifest hashes and exported theme metadata agree', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../assets/visualiser-sprites/manifest.json', import.meta.url)));
  assert.equal(SPRITE_THEMES.length, 17);assert.ok(Object.isFrozen(SPRITE_THEMES));
  assert.deepEqual(SPRITE_THEMES, Object.keys(manifest.themes));
  for (const theme of SPRITE_THEMES) {
    const atlas = SPRITE_ATLASES[theme];assert.ok(Object.isFrozen(atlas));
    const bytes = readFileSync(new URL('../../assets/visualiser-sprites/' + atlas.file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), atlas.sha256, theme);
    assert.equal(manifest.themes[theme].sha256, atlas.sha256);
    assert.deepEqual(validateAtlasPng(bytes, atlas), {width:768,height:768});
  }
});

test('atlas references resolve without fetching and reject unpinned or unsafe custom URLs', () => {
  assert.equal(builtin().url, 'https://example.test/atlases/lcd.png');
  assert.equal(resolveSpriteAtlas({sprite_theme:'ice'}, '../atlases', base).url, 'https://example.test/atlases/ice.png');
  assert.throws(() => resolveSpriteAtlas({sprite_theme:'lcd'}, '', base), /visualiserAssetBaseUrl/);
  assert.throws(() => resolveSpriteAtlas({sprite_theme:'lcd'}, '/atlases/?v=1', base), /directory URL/);
  const asset = validateSpriteAsset({path:' ../custom.png ',sha256:'A'.repeat(64)});
  assert.deepEqual(asset, {url:'../custom.png',sha256:'a'.repeat(64)});assert.ok(Object.isFrozen(asset));
  assert.deepEqual(resolveSpriteAtlas({sprite_asset:asset,sprite_columns:4,sprite_rows:2}, '', base), {
    url:'https://example.test/custom.png',sha256:'a'.repeat(64),columns:4,rows:2,custom:true});
  for (const invalid of [{url:'/a.png'}, {url:'/a.png',sha256:'x'.repeat(64)},
    {url:'/a.png',path:'/b.png',sha256:'a'.repeat(64)}, {url:'/a.png',sha256:'a'.repeat(64),image:{}},
    ...['data:image/png,abc','javascript:alert(1)','file:///image.png','https://user:secret@example.test/a.png','/line\nbreak.png']
      .map(url => ({url,sha256:'a'.repeat(64)}))]) assert.throws(() => validateSpriteAsset(invalid));
});

test('one page shares a selected atlas and closes its decoded image after the last view releases it', async () => {
  const f = fixture();assert.equal(f.requests.length, 0);assert.equal(f.pool.count(), 0);
  const a = f.pool.acquire(builtin()), b = f.pool.acquire(builtin());
  assert.equal(a.promise, b.promise);const [first, second] = await Promise.all([a.promise,b.promise]);
  assert.equal(first, second);assert.equal(f.requests.length, 1);assert.equal(f.images.length, 1);
  assert.equal(f.pool.count(), 1);assert.equal(f.images[0].closed, 0);
  a.release();a.release();assert.equal(f.images[0].closed, 0);assert.equal(f.pool.count(), 1);
  b.release();assert.equal(f.images[0].closed, 1);assert.equal(first.destroyed, true);assert.equal(f.pool.count(), 0);
  const next = f.pool.acquire(builtin());await next.promise;
  assert.equal(f.requests.length, 2);next.release();f.scope.dispose();
  assert.ok(f.images.every(image => image.closed === 1));
  assert.throws(() => f.pool.acquire(builtin()), /destroyed/);
});

test('grid layouts and separate page mounts own independent decoded atlases', async () => {
  const a = fixture(), b = fixture();
  const leases = [a.pool.acquire(custom()), a.pool.acquire(custom({columns:4,rows:4})), b.pool.acquire(custom())];
  await Promise.all(leases.map(lease => lease.promise));
  assert.equal(a.requests.length, 2);assert.equal(b.requests.length, 1);
  a.scope.dispose();assert.ok(a.images.every(image => image.closed === 1));assert.equal(b.images[0].closed, 0);
  for (const lease of leases) lease.release();b.scope.dispose();assert.equal(b.images[0].closed, 1);
});

test('integrity, grid and image-header failures reject before decoding pixels', async () => {
  for (const [descriptor, pattern] of [[custom({sha256:'0'.repeat(64)}), /SHA-256 mismatch/],
    [custom({columns:5}), /divide evenly/], [custom({width:512}), /pinned manifest/]]) {
    const f = fixture(), lease = f.pool.acquire(descriptor);
    await assert.rejects(lease.promise, pattern);assert.equal(f.images.length, 0);
    lease.release();assert.equal(f.pool.count(), 0);f.scope.dispose();
  }
  const f = fixture({decode(image) {image.width = 1;return image;}}), lease = f.pool.acquire(builtin());
  await assert.rejects(lease.promise, /PNG header/);assert.equal(f.images[0].closed, 1);
  lease.release();f.scope.dispose();
});

test('PNG bounds reject oversized pixels, incomplete payloads and animation before browser decoding', () => {
  for (const [width,height] of [[0,768],[4097,768],[768,4097]]) {
    const bytes = png.slice();const view = new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);
    assert.throws(() => validateAtlasPng(bytes,custom({width:undefined,height:undefined})), /pixel.*limit/);
  }
  assert.throws(() => validateAtlasPng(png.slice(0,-1), custom()), /truncated|incomplete/);
  assert.throws(() => validateAtlasPng(new Uint8Array([...png, 0]), custom()), /trailing/);
  const animated = new Uint8Array(png.length + 12);animated.set(png.subarray(0,33));
  new DataView(animated.buffer).setUint32(37,0x6163544c);animated.set(png.subarray(33),45);
  assert.throws(() => validateAtlasPng(animated,custom()), /Animated PNG/);
});

test('both declared and streamed image byte limits cancel oversized requests', async () => {
  for (const declared of [true,false]) {
    let cancelled = 0, released = 0, reads = 0;
    const body = declared ? {async cancel() {cancelled++;}} : {getReader() {return {
      async read() {reads++;return {done:false,value:new Uint8Array(9 * 1024 * 1024)};},
      async cancel() {cancelled++;},releaseLock() {released++;}};}};
    const f = fixture({fetch:() => ({ok:true,headers:new Headers(declared ? {'content-length':String(17 * 1024 * 1024)} : {}),body})});
    const lease = f.pool.acquire(builtin());await assert.rejects(lease.promise, /16 MiB/);
    assert.equal(cancelled, 1);assert.equal(f.images.length, 0);
    if (!declared) {assert.equal(reads, 2);assert.equal(released, 1);}
    lease.release();f.scope.dispose();
  }
});

test('late responses and image decodes cannot resurrect a destroyed atlas owner', async () => {
  let respond;
  const f = fixture({fetch:() => new Promise(resolve => {respond = resolve;})});
  const lease = f.pool.acquire(builtin());f.scope.dispose();assert.equal(f.requests[0].signal.aborted, true);
  respond(new Response(png));await assert.rejects(lease.promise, /abort/i);
  assert.equal(f.images.length, 0);assert.equal(f.pool.count(), 0);lease.release();
  let complete, begin;
  const started = new Promise(resolve => {begin = resolve;});
  const g = fixture({decode:image => new Promise(resolve => {complete = () => resolve(image);begin();})});
  const later = g.pool.acquire(builtin());await started;later.release();complete();
  await assert.rejects(later.promise, /abort/i);
  assert.equal(g.images[0].closed, 1);assert.equal(g.banks.length, 0);assert.equal(g.pool.count(), 0);g.scope.dispose();
});

test('the HTML image fallback releases blob URLs and decode listeners while retaining its owned image', async () => {
  const f = fixture({fallback:true}), lease = f.pool.acquire(builtin());
  const bank = await lease.promise;assert.equal(bank.destroyed, false);
  assert.deepEqual(f.revoked, f.urls);assert.equal(f.urls.length, 1);
  assert.equal(f.images[0].onload, null);assert.equal(f.images[0].onerror, null);
  lease.release();assert.equal(bank.destroyed, true);f.scope.dispose();
});
