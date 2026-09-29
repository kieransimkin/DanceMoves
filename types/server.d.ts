export {validatePageConfig,fromWordPressMeta,PAGE_META_KEYS,createMemoryPageStore} from './index';
import type {MotionCapture} from './index';
export class ValidationError extends Error {code:string;status:number;constructor(code:string,message:string,status?:number)}
export function validateTimingFile(input:string|Uint8Array,options?:{kind?:'cue'|'lyric';filename?:string;maxBytes?:number}):Readonly<{text:string;kind:string;bytes:number;timestamps:number}>;
export function normalizeDownloadPath(value:unknown):string;
export function createDownloadService(options:{rootDirectory:string;secret:string|Uint8Array;origin:string;route?:string}):Readonly<{sign(relative:string):string;handle(request:Request):Promise<Response>}>;
export function validateMotionCapture(input:unknown):MotionCapture;
export function createMemoryRateLimiter(options?:{limit?:number;windowMilliseconds?:number;maxKeys?:number;now?:()=>number}):Readonly<{consume(key:string):boolean}>;
export function createCaptureHandler(options:{authorize:(request:Request)=>boolean|Promise<boolean>;rateLimit:(request:Request)=>boolean|Promise<boolean>;
 store:(capture:MotionCapture,context:{visibility:'private';request:Request})=>Promise<{captureId:string|number;storedPrivately:true}>;
 allowedOrigin:string;maxBytes?:number}):(request:Request)=>Promise<Response>;
