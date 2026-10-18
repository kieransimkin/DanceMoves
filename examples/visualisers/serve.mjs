/** Synthetic gallery only; no example recording enters the reusable package. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFixture} from '../spectrum/fixture.mjs';
import {SPRITE_ATLASES} from '../../src/visualiser-sprite-catalogue.mjs';
const root = path.resolve(import.meta.dirname, '../..');
export function createGalleryServer({onRequest = () => {}} = {}) {
  const fixture = createFixture();
  // A narrow hand-authored band gives peak-only views an observable adjacent
  // contrast; a smooth spectrum can correctly contain no qualifying peaks.
  fixture.recording.name = 'synthetic_rudiment_gallery';
  fixture.recording.samples.forEach((values, pip) => {
    const rms = .09 + .025 * Math.sin(pip / 59);
    values[26] = Number((2 * rms / .25 - 1).toFixed(12));
  });
  const routes = new Map([
    ['/', {type:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'examples/visualisers/index.html'))}],
    ['/app.mjs', {type:'text/javascript',body:fs.readFileSync(path.join(root,'examples/visualisers/app.mjs'))}],
    ['/lib/index.mjs', {type:'text/javascript',body:fs.readFileSync(path.join(root,'lib/index.mjs'))}],
    ['/fixture.json', {type:'application/json',body:Buffer.from(JSON.stringify(fixture.recording))}],
    ['/fixture.wav', {type:'audio/wav',body:fixture.wav}]
  ]);
  for (const atlas of Object.values(SPRITE_ATLASES)) routes.set('/lib/assets/visualiser-sprites/' + atlas.file,
    {type:'image/png',body:fs.readFileSync(path.join(root,'lib/assets/visualiser-sprites',atlas.file))});
  return http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    onRequest(pathname);
    const item = routes.get(pathname);
    if (!item) {response.writeHead(404);response.end();return;}
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
    if (range) {
      const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : item.body.length - 1, item.body.length - 1);
      if (start > end) {response.writeHead(416,{'Content-Range':`bytes */${item.body.length}`});response.end();return;}
      response.writeHead(206,{'Content-Type':item.type,'Content-Range':`bytes ${start}-${end}/${item.body.length}`,
        'Content-Length':end-start+1,'Accept-Ranges':'bytes'});
      response.end(request.method === 'HEAD' ? undefined : item.body.subarray(start,end+1));return;
    }
    response.writeHead(200,{'Content-Type':item.type,'Content-Length':item.body.length,'Cache-Control':'no-store','Accept-Ranges':'bytes'});
    response.end(request.method === 'HEAD' ? undefined : item.body);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4195);
  createGalleryServer().listen(port,'127.0.0.1',() => console.log(`Rudiment gallery: http://127.0.0.1:${port}`));
}
