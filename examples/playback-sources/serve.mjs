/** Local-only fixture server with byte ranges required by native media seeking. */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),port=Number(process.env.PORT||8768);
const allowed=[path.join(root,'lib'),path.join(root,'examples/playback-sources')];
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.mp4':'video/mp4','.lrc':'text/plain','.cue':'text/plain','.json':'application/json'};
export function response(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return;}
 if(!allowed.some(dir=>file===dir||file.startsWith(dir+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 file=fs.realpathSync(file);if(!allowed.some(dir=>file.startsWith(fs.realpathSync(dir)+path.sep))){res.writeHead(403);res.end();return;}
 const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
 if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}end=Math.min(end,size-1);status=206;}
 const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file,{start,end}).pipe(res);
}
http.createServer(response).listen(port,'127.0.0.1',()=>console.log(`Playback fixture: http://127.0.0.1:${port}/examples/playback-sources/index.html`));
