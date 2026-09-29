import {spawnSync} from 'node:child_process';
/** These tests intentionally fail when the real build or React dependencies are absent. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import React from 'react';import {renderToString} from 'react-dom/server';
import * as esm from '../../lib/index.mjs';import * as react from '../../lib/react.mjs';import * as server from '../../lib/server.mjs';
const require=createRequire(import.meta.url),cjs=require('../../lib/index.cjs');
test('ESM and CommonJS imports are SSR-safe with no window/document',()=>{assert.equal(typeof window,'undefined');assert.equal(typeof document,'undefined');for(const mod of [esm,cjs])assert.equal(typeof mod.createDanceMoves,'function');assert.equal(esm.VERSION,JSON.parse(fs.readFileSync('package.json','utf8')).version);assert.equal(typeof server.createCaptureHandler,'function');});
test('React provider renders on a server without mounting browser engines',()=>{const html=renderToString(React.createElement(react.DanceMovesProvider,{options:{bpm:145}},React.createElement('p',null,'Arcadians')));assert.match(html,/Arcadians/);assert.match(html,/ks-epk/);});
test('React metadata editor covers all host-neutral page fields',()=>{const html=renderToString(React.createElement(react.PageMetadataEditor,{value:{bpm:145},onSave(){}}));for(const label of ['BPM','Lyric timing URL','Cue timing URL','Master duration','Timed lyric pop-ups','Ambient effect'])assert.ok(html.includes(label));});
test('React bundle has a use-client boundary and references the shared engine once',()=>{const source=fs.readFileSync('lib/react.mjs','utf8');assert.match(source,/^["']use client["']/);assert.match(source,/\.\/index\.mjs/);assert.doesNotMatch(source,/clay_keys|wasmBase64|function parseTimingFile/);});
test('ordinary browser output contains no Node file server or secret',()=>{const source=fs.readFileSync('lib/dancemoves.min.js','utf8');assert.doesNotMatch(source,/node:fs|node:crypto|DANCEMOVES_DOWNLOAD_SECRET|DANCEMOVES_CAPTURE_KEY/);});

test('consumer TypeScript declarations compile against the actual package export map',()=>{const compiler=require.resolve('typescript/bin/tsc');const result=spawnSync(process.execPath,[compiler,'-p','tests/shared/tsconfig.json'],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);});
