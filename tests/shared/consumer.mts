import {createDanceMoves,createMemoryPageStore,fromWordPressMeta,VISUALISER_CATALOGUE,SPRITE_THEMES,SPRITE_ATLASES,PAGE_META_KEYS,validateVisualiserStyle,type DanceMoves,type SpriteAsset,type SpriteTheme} from '@kieransimkin/dancemoves';
import {useDanceMoves,PageMetadataEditor} from '@kieransimkin/dancemoves/react';
import {createCaptureHandler,createDownloadService,validateTimingFile} from '@kieransimkin/dancemoves/server';
const root = document.createElement('section');
const audio = document.createElement('audio');
root.append(audio);
const motion: DanceMoves = createDanceMoves({root,bpm:145,diagnostics:true,
  visualiserAssetBaseUrl:'/plugin/lib/assets/visualiser-sprites/',visualiserSpriteTheme:'lcd-amber',
  visualiserTerrainSource:'procedural',visualiserSpectralDeform:false});
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
void VISUALISER_CATALOGUE[0].supportsSpectrum;void VISUALISER_CATALOGUE[0].requiresAtlas;
const theme:SpriteTheme=SPRITE_THEMES[0];
const customAtlas:SpriteAsset={url:'/page-assets/sprites.png',sha256:SPRITE_ATLASES[theme].sha256};
const legacyAtlas:SpriteAsset={path:'/page-assets/sprites.png',sha256:SPRITE_ATLASES.lcd.sha256};
validateVisualiserStyle('sprite-waveform-led',{sprite_asset:legacyAtlas,sprite_columns:4,sprite_rows:2});
motion.visualisers.animate({id:'types:sprite',target:visualiserCanvas,rudiment:'circle',renderer:'sprite-motion-path',
  style:{sprite_theme:theme,sprite_asset:customAtlas,sprite_blend:'add',sprite_spin:.25,sprite_tint_colour:null,
    sprite_anchor_x:.5,sprite_shear_y:.1,sprite_grain:.1,shape:'icon',max_stamps:1000},
  onFrame(frame){
    const report=frame.renderReport;
    if(report&&'kind' in report){
      console.log(report.kind,report.animation_frame,report.atlas.sha256,report.drawn_stamps);
      // @ts-expect-error Renderer diagnostic metadata is frozen.
      report.atlas.rows=4;
    }
  }}).destroy();
motion.visualisers.animate({id:'types:sprite-spectrum',target:visualiserCanvas,audio,recordingUrl:'/page-assets/fourier.json',
  renderer:'sprite-spectrum-lcd',style:{sprite_theme:'lcd-green',segment_count:16,floor_db:-72}}).destroy();
validateVisualiserStyle('spatial-solid-sphere',{geometry:'sphere',backend:'auto',raster_size:512,
  roughness:.5,light_direction:[-.45,-.35,.82],fog_steps:6});
motion.visualisers.animate({id:'types:music-motion',target:visualiserCanvas,rudiment:'helix',renderer:'spatial-music-torus',
  style:{backend:'cpu',spectral_deform:false,terrain_source:'procedural',audio_displacement:.2}}).destroy();
motion.visualisers.animate({id:'types:music-spectrum',target:visualiserCanvas,audio,recordingUrl:'/page-assets/fourier.json',
  renderer:'spatial-music-terrain',style:{terrain_source:'fft',spectral_deform:true,backend:'auto',raster_size:256,
    spectral_gain:.5,thermal_erosion:.2,erosion_iterations:4,ice_coverage:.35,light_power:2},
  onFrame(frame){
    const report=frame.renderReport;
    if(report&&'backend' in report){
      const backend:'cpu'=report.backend;
      console.log(backend,report.fallbackReason,report.rasterPixelTests,report.rasterLimited,report.sourceSha256);
      // @ts-expect-error Captured source history in a render report is immutable.
      report.sourcePips.push(64);
    }
  }}).destroy();
void motion.visualisers.snapshot().atlases;
void visualiser.snapshot().renderReport;
void PAGE_META_KEYS.visualiserSpriteTheme;void PAGE_META_KEYS.visualiserTerrainSource;void PAGE_META_KEYS.visualiserSpectralDeform;
// @ts-expect-error Built-in sprite metadata is deeply read-only.
SPRITE_ATLASES.lcd.sha256='changed';
// @ts-expect-error Custom sprite assets require exactly one URL spelling.
const conflictingAtlas:SpriteAsset={url:'/sprite.png',path:'/sprite.png',sha256:SPRITE_ATLASES.lcd.sha256};
// @ts-expect-error An asset directory is host configuration, not persisted WordPress metadata.
void PAGE_META_KEYS.visualiserAssetBaseUrl;
// @ts-expect-error Spectral sprite modes also require calibrated saved recordings.
motion.visualisers.animate({id:'types:bad-sprite-source',target:visualiserCanvas,rudiment:'circle',renderer:'sprite-spectrogram-rain'});
// @ts-expect-error Enabling music spectral deformation cannot synthesize calibration from a pattern.
motion.visualisers.animate({id:'types:bad-deformation',target:visualiserCanvas,rudiment:'helix',renderer:'spatial-music-torus',style:{spectral_deform:true}});
// @ts-expect-error FFT terrain requires a saved recording even though procedural terrain permits a pattern.
motion.visualisers.animate({id:'types:bad-terrain-source',target:visualiserCanvas,rudiment:'circle',renderer:'spatial-music-terrain',style:{terrain_source:'fft'}});
// @ts-expect-error FFT terrain is unavailable for a sphere.
validateVisualiserStyle('spatial-music-sphere',{terrain_source:'fft'});
// @ts-expect-error Solid geometry must match the selected renderer.
validateVisualiserStyle('spatial-solid-torus',{geometry:'terrain'});
// @ts-expect-error Browser spatial modes expose only the supported CPU backend choices.
validateVisualiserStyle('spatial-solid-terrain',{backend:'gpu'});
// @ts-expect-error Sprite themes come from the shipped manifest.
validateVisualiserStyle('sprite-motion-cloud',{sprite_theme:'unlisted'});
// @ts-expect-error Sprite style controls do not belong to wire renderers.
validateVisualiserStyle('spatial-torus',{sprite_glow:2});
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
