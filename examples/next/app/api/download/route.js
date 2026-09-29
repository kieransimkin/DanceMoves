import path from 'node:path';
import {createDownloadService} from '@kieransimkin/dancemoves/server';
export const runtime='nodejs';
async function serve(request){
 const secret=process.env.DANCEMOVES_DOWNLOAD_SECRET;
 if(!secret)return new Response('Download signing is not configured',{status:503});
 return createDownloadService({rootDirectory:path.resolve(process.cwd(),'public/media'),secret,origin:process.env.DANCEMOVES_ORIGIN || 'http://localhost:3000'}).handle(request);
}
export const GET=serve;export const HEAD=serve;
