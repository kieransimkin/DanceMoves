import {createDanceMoves,createMemoryPageStore,fromWordPressMeta,VISUALISER_CATALOGUE,validateVisualiserStyle,type DanceMoves} from '@kieransimkin/dancemoves';
import {useDanceMoves,PageMetadataEditor} from '@kieransimkin/dancemoves/react';
import {createCaptureHandler,createDownloadService,validateTimingFile} from '@kieransimkin/dancemoves/server';
const root = document.createElement('section');
const audio = document.createElement('audio');
root.append(audio);
const motion: DanceMoves = createDanceMoves({root,bpm:145,diagnostics:true});
const spectrumCanvas=document.createElement('canvas');root.append(spectrumCanvas);
const spectrum=motion.spectrum.animate({id:'types:spectrum',target:spectrumCanvas,audio,
  recordingUrl:'/page-assets/fourier.json',renderer:'spectrum-ring',style:{floor_db:-72,labels:true},
  onFrame(frame){console.log(frame.report?.dominant?.low_hz);}});
spectrum.ready.then(view=>view.destroy());
void motion.spectrum.snapshot().sources;
const visualiserCanvas=document.createElement('canvas');root.append(visualiserCanvas);
const visualiser=motion.visualisers.animate({id:'types:visualiser',target:visualiserCanvas,audio,
  rudiment:'helix',renderer:'spatial-torus',style:{rings:13,orbit:35},axes:['x','y'],
  onFrame(frame){console.log(frame.values?.[0],frame.historyLength);}});
visualiser.ready.then(view=>view.destroy());
motion.visualisers.animate({id:'types:sonogram',target:visualiserCanvas,audio,recordingUrl:'/page-assets/fourier.json',
  renderer:'spectrogram-annular-heatmap',style:{inner_radius:.25,frequency_scale:'mel'}}).destroy();
motion.visualisers.animate({id:'types:default',target:visualiserCanvas,rudiment:'circle'}).destroy();
validateVisualiserStyle('particles',{count:24,trail:4});
void VISUALISER_CATALOGUE[0].requiresSpectrum;void motion.visualisers.describe('path');
// @ts-expect-error Spectral evidence cannot be created by a named motion pattern.
motion.visualisers.animate({id:'types:bad-spectrum',target:visualiserCanvas,rudiment:'circle',renderer:'spectrum-waterfall'});
// @ts-expect-error A capture owns its clock and phase.
motion.visualisers.animate({id:'types:bad-clock',target:visualiserCanvas,audio,recordingUrl:'/fixture.json',rate:2});
// @ts-expect-error Family styles use their own schemas.
validateVisualiserStyle('particles',{floor_db:-60});
// @ts-expect-error Source choices are exclusive.
motion.visualisers.animate({id:'types:bad-source',target:visualiserCanvas,audio,rudiment:'circle',recordingUrl:'/fixture.json'});
motion.onEveryBeat(detail => console.log(detail.boundaryTick));
motion.effects.pointer({root,target:root}).reset();
motion.effects.playbackPulse({root,audio}).sync();
const source = motion.playbackSource(audio);
motion.effects.playbackPulse({root,audio:source}).sync();
motion.registerYouTube({master:audio,iframe:document.createElement('iframe'),masterVerified:true,offset:12,duration:20}).ready.catch(console.error);
motion.applyCatalogueTiming?.();
motion.createOrientation({render(point){console.log(point.x,point.y);}}).disable();
const frame=document.createElement('iframe');
motion.publishPlayback({source:audio,targetWindow:window.parent,origin:'https://example.test',channel:'watch',assetId:'fixture'}).teardown();
motion.receiveChildPlayback({iframe:frame,master:audio,masterVerified:true,origin:'https://example.test',channel:'watch',assetId:'fixture'}).teardown();
motion.rudiments.animate({id:'types:motion',root,target:root,rudiment:'clay_background',audio,clock:'audio'}).destroy();
const store = createMemoryPageStore();
store.save('arcadians',{bpm:145});
void fromWordPressMeta({_dance_moves_bpm:145});
validateTimingFile('[00:00.00]INTRO',{kind:'cue',filename:'sections.cue'});
const download=createDownloadService({rootDirectory:'/private/media',origin:'https://example.test',secret:'a'.repeat(32)});
void download.handle(new Request(download.sign('track.mp3')));
const capture=createCaptureHandler({allowedOrigin:'https://example.test',authorize:()=>true,rateLimit:()=>true,store:async()=>({captureId:'demo',storedPrivately:true})});
void capture(new Request('https://example.test/api/capture',{method:'POST'}));
void useDanceMoves;void PageMetadataEditor;
motion.destroy();
