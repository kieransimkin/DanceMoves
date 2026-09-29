/** Node-only host services. Never import this entry into a Client Component. */
import {createHmac, timingSafeEqual} from 'node:crypto';
import {realpath, open} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
export {validatePageConfig, fromWordPressMeta, PAGE_META_KEYS, createMemoryPageStore} from './config.mjs';

export class ValidationError extends Error {
  constructor(code, message, status = 400) {super(message); this.name='ValidationError'; this.code=code; this.status=status;}
}
const fail = (code,message,status) => {throw new ValidationError(code,message,status);};
export function validateTimingFile(input, {kind='cue', filename, maxBytes=1048576} = {}) {
  if (!['cue','lyric'].includes(kind)) throw new TypeError('kind must be cue or lyric');
  if (filename) {
    const ext=path.extname(filename).toLowerCase();
    if (!(kind==='lyric'?['.lrc']:['.lrc','.cue']).includes(ext)) fail('timing_extension','Incorrect timing-file extension');
  }
  if (typeof input !== 'string' && !(input instanceof Uint8Array)) throw new TypeError('Timing input must be text or bytes');
  const bytes=typeof input==='string'?Buffer.from(input,'utf8'):input;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || bytes.byteLength>maxBytes) fail('timing_size','Timing file exceeds the byte limit',413);
  let text;
  try {text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {fail('timing_utf8','Timing file is not valid UTF-8');}
  if (/[\u0000\uFFFD]/.test(text)) fail('timing_utf8','Timing file contains a null or replacement character');
  const stamps=[...text.matchAll(/\[(\d{1,3}):(\d{2})(?:[\.:](\d{1,3}))?\]/g)];
  if (!stamps.length) fail('timing_timestamps','Timing file must contain at least one bracketed timestamp');
  let previous=-1;
  for (const stamp of stamps) {
    const time=Number(stamp[1])*60+Number(stamp[2])+(stamp[3]?Number('0.'+stamp[3]):0);
    if (time<previous) fail('timing_order','Timing timestamps must be monotonic');
    previous=time;
  }
  return Object.freeze({text,kind,bytes:bytes.byteLength,timestamps:stamps.length});
}
export function normalizeDownloadPath(value) {
  if (typeof value!=='string' || value.length>4096) return '';
  let result;
  try {result=decodeURIComponent(value.trim().replaceAll('\\','/'));} catch {return '';}
  if (!result || result.startsWith('/') || /[:\u0000-\u001f\u007f\\]/.test(result) || !/\.mp3$/i.test(result)) return '';
  if (result.split('/').some(part=>!part || part==='.' || part==='..')) return '';
  return result;
}
function asOrigin(value) {
  const u=new URL(value);
  if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw new TypeError('Invalid HTTP origin');
  return u.origin;
}
function privateHeaders() {return {'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};}
function json(body,status=200,extra={}) {return new Response(JSON.stringify(body),{status,headers:{...privateHeaders(),'Content-Type':'application/json; charset=utf-8',...extra}});}
/** Signed attachment delivery. MP3 playback uses a normal static/range-enabled media URL. */
export function createDownloadService({rootDirectory,secret,origin,route='/api/download'} = {}) {
  if (typeof rootDirectory!=='string' || !path.isAbsolute(rootDirectory)) throw new TypeError('rootDirectory must be an absolute local directory');
  if (!(typeof secret==='string' || secret instanceof Uint8Array) || Buffer.byteLength(secret)<32) throw new TypeError('Use a server-only secret of at least 32 bytes');
  const baseOrigin=asOrigin(origin);
  if (typeof route!=='string' || !route.startsWith('/') || route.startsWith('//')) throw new TypeError('route must be a same-origin absolute path');
  const routeURL=new URL(route,baseOrigin);
  if (routeURL.origin!==baseOrigin || routeURL.search || routeURL.hash) throw new TypeError('route must not include an origin, query or fragment');
  const digest=relative=>createHmac('sha256',secret).update(relative).digest('hex');
  function sign(relative) {
    const normal=normalizeDownloadPath(relative);
    if (!normal) throw new ValidationError('download_path','A safe relative MP3 path is required');
    const url=new URL(routeURL);url.searchParams.set('path',normal);url.searchParams.set('signature',digest(normal));return url.href;
  }
  async function handle(request) {
    let input;
    try {input=new URL(request.url);} catch {return new Response(null,{status:404,headers:privateHeaders()});}
    if (input.pathname!==routeURL.pathname) return new Response(null,{status:404,headers:privateHeaders()});
    const relative=normalizeDownloadPath(input.searchParams.get('path'));
    const signature=input.searchParams.get('signature') || '';
    if (!relative || !/^[0-9a-f]{64}$/i.test(signature) || !timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(digest(relative),'hex')))
      return new Response(null,{status:404,headers:privateHeaders()});
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...privateHeaders(),Allow:'GET, HEAD'}});
    let file;
    try {
      const base=await realpath(rootDirectory);
      const resolved=await realpath(path.join(base,...relative.split('/')));
      const rel=path.relative(base,resolved);
      if (!rel || rel==='..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel) || path.extname(resolved).toLowerCase()!=='.mp3') return new Response(null,{status:404,headers:privateHeaders()});
      file=await open(resolved,fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
      const stat=await file.stat();
      if (!stat.isFile()) {await file.close(); return new Response(null,{status:404,headers:privateHeaders()});}
      const filename=path.basename(resolved);
      const ascii=filename.replace(/[^\x20-\x7e]/g,'_').replace(/["\\]/g,'_') || 'audio.mp3';
      const encoded=encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
      const headers={...privateHeaders(),'Content-Type':'audio/mpeg','Content-Length':String(stat.size),
        'Content-Disposition':`attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`};
      if (request.method==='HEAD') {await file.close();return new Response(null,{status:200,headers});}
      const stream=file.createReadStream({autoClose:true});
      return new Response(Readable.toWeb(stream),{status:200,headers});
    } catch {if (file) await file.close().catch(()=>{}); return new Response(null,{status:404,headers:privateHeaders()});}
  }
  return Object.freeze({sign,handle});
}
const numeric=(v,min,max)=>typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
function boundedText(value,max=500) {return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);}
/** Same capture schema as WordPress; storage/auth are deliberately supplied by the application. */
export function validateMotionCapture(payload) {
  if (!payload || payload.schema!=='ks-epk-motion-recording/v1') fail('ks_motion_schema','Unsupported capture schema');
  if (!Array.isArray(payload.samples) || payload.samples.length<1 || payload.samples.length>500) fail('ks_motion_samples','A capture must contain 1..500 samples');
  const samples=payload.samples.map(sample=>{
    if (!sample || !numeric(sample.milliseconds,0,120000) || !numeric(sample.beta,-180,180) || !numeric(sample.gamma,-90,90)) fail('ks_motion_invalid_samples','Invalid motion sample');
    return {milliseconds:sample.milliseconds,beta:sample.beta,gamma:sample.gamma,
      alpha:sample.alpha===null || sample.alpha===undefined?null:numeric(sample.alpha,0,360)?sample.alpha:null,
      screenAngle:numeric(sample.screenAngle ?? 0,-360,360)?sample.screenAngle || 0:null,
      ...Object.fromEntries(['absolute','nativeTrusted','simulatedTrusted','fieldParity','dispatchParity','mapperParity'].map(k=>[k,!!sample[k]]))};
  });
  const clean={schema:payload.schema,capturedAt:boundedText(payload.capturedAt,100),userAgent:boundedText(payload.userAgent),samples,
    screenAngle:numeric(payload.screenAngle ?? 0,-360,360)?payload.screenAngle || 0:null,
    storedSampleCount:samples.length,sampleStrategy:boundedText(payload.sampleStrategy || 'legacy',80).toLowerCase().replace(/[^a-z0-9_-]/g,''),
    fullWindowObserved:!!payload.fullWindowObserved,expectedDifference:boundedText(payload.expectedDifference),passed:!!payload.passed,
    failures:(Array.isArray(payload.failures)?payload.failures:[]).slice(0,100).filter(v=>v && typeof v==='object').map(v=>({
      type:boundedText(v.type || 'unknown',80).toLowerCase().replace(/[^a-z0-9_-]/g,''),sample:Number.isFinite(Number(v.sample))?Math.abs(Math.trunc(Number(v.sample))):null,
      validPairs:Number.isFinite(Number(v.validPairs))?Math.abs(Math.trunc(Number(v.validPairs))):null}))};
  for (const key of ['targetDurationMilliseconds','captureDurationMilliseconds','sampledDurationMilliseconds','storageIntervalMilliseconds']) clean[key]=numeric(payload[key] ?? 0,0,120000)?payload[key] || 0:null;
  for (const key of ['processedPairCount','failureCount']) clean[key]=Math.min(100000,Math.abs(Math.trunc(Number(payload[key]) || (key==='processedPairCount'?samples.length:clean.failures.length))));
  if (Buffer.byteLength(JSON.stringify(clean))>262144) fail('ks_motion_size','Capture too large',413);
  return clean;
}
export function createMemoryRateLimiter({limit=8,windowMilliseconds=600000,maxKeys=10000,now=Date.now}={}) {
  for (const [key,value] of Object.entries({limit,windowMilliseconds,maxKeys})) if (!Number.isSafeInteger(value) || value<1) throw new RangeError(key);
  const records=new Map();
  return Object.freeze({consume(key) {
    if (typeof key!=='string' || !key || key.length>512) return false;
    const time=now();
    for (const [id,r] of records) if (r.until<=time) records.delete(id);
    if (!records.has(key) && records.size>=maxKeys) return false;
    const r=records.get(key) || {until:time+windowMilliseconds,count:0};
    records.set(key,r); return ++r.count<=limit;
  }});
}
async function boundedBody(request,maxBytes) {
  const length=request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length)>maxBytes)) fail('ks_motion_size','Capture too large',413);
  if (!request.body) fail('ks_motion_schema','Missing JSON body');
  const reader=request.body.getReader();const chunks=[];let size=0;
  try {
    while (true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();fail('ks_motion_size','Capture too large',413);}chunks.push(value);}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  } catch(error) {if(error instanceof ValidationError)throw error;fail('ks_motion_schema','Invalid UTF-8 JSON');}
  finally {reader.releaseLock();}
}
export function createCaptureHandler({authorize,store,rateLimit,allowedOrigin,maxBytes=262144}={}) {
  for (const [key,fn] of Object.entries({authorize,store,rateLimit})) if (typeof fn!=='function') throw new TypeError(`${key} callback is required`);
  const origin=asOrigin(allowedOrigin);
  if (!Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>262144) throw new RangeError('maxBytes must be 1..262144');
  return async request => {
    if (request.method!=='POST') return json({code:'method_not_allowed'},405,{Allow:'POST'});
    try {
      const source=request.headers.get('origin');
      if (source) {let sourceOrigin;try {sourceOrigin=asOrigin(source);}catch {return json({code:'ks_motion_origin'},403);}
        if(sourceOrigin!==origin)return json({code:'ks_motion_origin'},403);}
      if (!await authorize(request)) return json({code:'ks_motion_forbidden'},403);
      if (!await rateLimit(request)) return json({code:'ks_motion_rate'},429,{'Retry-After':'600'});
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return json({code:'ks_motion_content_type'},415);
      const capture=validateMotionCapture(await boundedBody(request,maxBytes));
      const stored=await store(capture,{visibility:'private',request});
      if (!stored || !stored.captureId || stored.storedPrivately!==true) throw new Error('Storage did not confirm private persistence');
      return json({captureId:stored.captureId,sampleCount:capture.samples.length,storedPrivately:true});
    } catch(error) {
      if (error instanceof ValidationError) return json({code:error.code,message:error.message},error.status);
      return json({code:'ks_motion_server',message:'Capture could not be stored'},500);
    }
  };
}
