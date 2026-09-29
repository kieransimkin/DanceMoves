import {randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createCaptureHandler,createMemoryRateLimiter} from '@kieransimkin/dancemoves/server';
export const runtime='nodejs';
const limiter=createMemoryRateLimiter();
export async function POST(request){
 const secret=process.env.DANCEMOVES_CAPTURE_KEY,folder=process.env.DANCEMOVES_CAPTURE_DIR;
 if(!secret || secret.length<32 || !folder || !path.isAbsolute(folder))return new Response('Private capture storage/auth is not configured',{status:503});
 const publicRoot=path.resolve(process.cwd(),'public');
 const absoluteFolder=path.resolve(folder);
 const within=(base,candidate)=>candidate===base || candidate.startsWith(base+path.sep);
 if(within(publicRoot,absoluteFolder))return new Response('Capture storage must be outside public/',{status:503});
 await mkdir(absoluteFolder,{recursive:true,mode:0o700});
 const resolvedFolder=await realpath(absoluteFolder);
 const resolvedPublic=await realpath(publicRoot);
 if(within(resolvedPublic,resolvedFolder))return new Response('Capture storage resolves into public/',{status:503});
 return createCaptureHandler({allowedOrigin:process.env.DANCEMOVES_ORIGIN || 'http://localhost:3000',
   authorize:req=>{const supplied=req.headers.get('X-DanceMoves-Demo-Key') || '';const a=Buffer.from(supplied),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);},
   // Single-process authenticated demo. Production replicas need a shared limiter keyed to a verified user.
   rateLimit:()=>limiter.consume('authenticated-demo'),
   store:async capture=>{const id=randomUUID();await writeFile(path.join(resolvedFolder,id+'.json'),JSON.stringify(capture),{flag:'wx',mode:0o600});return {captureId:id,storedPrivately:true};}
 }).call(null,request);
}
