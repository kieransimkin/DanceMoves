import * as esbuild from 'esbuild-wasm';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),port=Number(process.env.PORT || 4173);
const output=path.join(root,'.build/react');fs.mkdirSync(output,{recursive:true});
await esbuild.build({entryPoints:[path.join(root,'examples/react/main.jsx')],outfile:path.join(output,'app.js'),bundle:true,format:'esm',jsx:'automatic',sourcemap:true,define:{'process.env.NODE_ENV':'"development"'}});
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.lrc':'text/plain','.cue':'text/plain','.html':'text/html'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 let file;
 if(name==='/' || name==='/index.html')file=path.join(root,'examples/react/index.html');
 else if(name.startsWith('/demo/'))file=path.join(output,name.slice(6));
 else if(name.startsWith('/media/'))file=path.join(root,'examples/wordpress/media',name.slice(7));
 else if(name.startsWith('/dancemoves-assets/'))file=path.join(root,'lib/assets',name.slice(19));
 const allowed=[output,path.join(root,'examples/wordpress/media'),path.join(root,'lib/assets'),path.join(root,'examples/react/index.html')];
 if(!file || !allowed.some(dir=>file===dir || (path.resolve(file).startsWith(dir+path.sep)&&!path.relative(dir,file).startsWith('..')))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Prepare the canonical Arcadians assets with npm run demo:prepare');return;}
 const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
 const range=req.headers.range;
 if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}start=Number(m[1]);end=m[2]?Number(m[2]):size-1;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}end=Math.min(end,size-1);status=206;}
 const headers={'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file,{start,end}).pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`React Arcadians demo: http://127.0.0.1:${port}/`));
