/** Run after npm run build: node examples/spectrum/serve.mjs */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFixture} from './fixture.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = createFixture();
const routes = new Map([
  ['/', {type:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'examples/spectrum/index.html'))}],
  ['/lib/index.mjs', {type:'text/javascript',body:fs.readFileSync(path.join(root,'lib/index.mjs'))}],
  ['/lib/dancemoves.css', {type:'text/css',body:fs.readFileSync(path.join(root,'lib/dancemoves.css'))}],
  ['/fixture.json', {type:'application/json',body:Buffer.from(JSON.stringify(fixture.recording))}],
  ['/fixture.wav', {type:'audio/wav',body:fixture.wav}]
]);
const port = Number(process.env.PORT || 4194);
http.createServer((request,response) => {
  const item = routes.get(new URL(request.url,'http://localhost').pathname);
  if (!item) {response.writeHead(404);response.end();return;}
  const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
  if (range) {
    const start = Number(range[1]), end = range[2] ? Number(range[2]) : item.body.length - 1;
    if (start > end || end >= item.body.length) {response.writeHead(416,{'Content-Range':`bytes */${item.body.length}`});response.end();return;}
    response.writeHead(206,{'Content-Type':item.type,'Content-Range':`bytes ${start}-${end}/${item.body.length}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});
    response.end(request.method === 'HEAD' ? undefined : item.body.subarray(start,end+1));return;
  }
  response.writeHead(200,{'Content-Type':item.type,'Content-Length':item.body.length,'Cache-Control':'no-store','Accept-Ranges':'bytes'});
  response.end(request.method === 'HEAD' ? undefined : item.body);
}).listen(port,'127.0.0.1',() => console.log(`Spectrum gallery: http://127.0.0.1:${port}`));
