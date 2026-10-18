export * from './rudiments';
import type {RudimentName, RudimentClock} from './rudiments';
export type Remove = () => void;
export type PlaybackMedia = HTMLMediaElement | PlaybackSource;
export interface PlaybackMapping {offset?:number;duration?:number;playerStart?:number}
export type MasterReference = HTMLMediaElement | Readonly<{id:string;duration:number;element?:HTMLMediaElement;sourceUrl?:string}>;
export interface PlaybackSource extends EventTarget {
 readonly nodeType:1;readonly tagName:string;readonly element:HTMLMediaElement|null;readonly activePlayer:HTMLMediaElement|HTMLIFrameElement|null;
 currentTime:number;readonly duration:number;readonly paused:boolean;readonly ended:boolean;readonly seeking:boolean;readonly playbackRate:number;
 play():Promise<void>|void;pause():void;
}
export interface PlayerRegistration extends PlaybackMapping {master:MasterReference;masterVerified:true}
export interface PlaybackController extends Controller {source:PlaybackSource;mapping:Readonly<PlaybackMapping>;ready?:Promise<PlaybackController>}

export interface ChildPlaybackPlayer extends EventTarget {
 readonly nodeType:1;readonly tagName:'VIDEO';readonly ownerDocument:Document;readonly isConnected:boolean;
 currentTime:number;readonly duration:number;readonly paused:boolean;readonly ended:boolean;readonly seeking:boolean;readonly playbackRate:number;
 play():Promise<void>;pause():void;
}
export interface ChildPlaybackIdentity {origin:string;channel:string;assetId:string}
export interface ChildPlaybackPublisherOptions extends ChildPlaybackIdentity {source:Pick<HTMLMediaElement,'currentTime'|'duration'|'playbackRate'|'paused'|'ended'|'seeking'|'pause'|'play'|'addEventListener'|'removeEventListener'> & {readonly error?:unknown};targetWindow?:Window;allowPlayCommands?:boolean;notifyEscape?:boolean;window?:Window}
export interface ChildPlaybackReceiverOptions extends ChildPlaybackIdentity {iframe:HTMLIFrameElement;staleAfterMilliseconds?:number;window?:Window}
export interface ChildPlaybackReceiver extends Controller {player:ChildPlaybackPlayer;readonly ready:Promise<ChildPlaybackReceiver>;reconnect():Promise<ChildPlaybackReceiver>}
export interface ChildPlaybackRegistration extends ChildPlaybackReceiverOptions, PlayerRegistration {}
export interface ChildPlaybackPublisher extends Controller {requestClose():void}
export function createPlaybackPublisher(options:ChildPlaybackPublisherOptions):ChildPlaybackPublisher;
export function createPlaybackReceiver(options:ChildPlaybackReceiverOptions):ChildPlaybackReceiver;
export type Offset = Readonly<{x:number;y:number;z?:number}>;
export type Metadata = string | {id?:string;handlerId?:string};
export interface BeatAlignment {
 schema:'stemlab.beat-alignment.v1';source_sha256:string;source_url:string;source_audio_verified:true;
 source_audio:Readonly<{sample_rate:number;num_frames:number;num_channels?:number;duration_seconds?:number}>;
 bpm:number;exact_bpm:string;bpm_basis:string;bpm_status:'canonical'|'estimated';phase_status:'estimated'|'confirmed'|'synthetic';
 analysis_id:string;evidence_sha256:string;report_sha256:string;first_beat_seconds:number;first_beat_exact_seconds:string;
 offset_pips:number;exact_offset_pips:string;pips_per_beat:64;canonical_first_beat_pip:0;
}
export interface BeatTimelineAnchor {beat:number;frame:number;source:'consensus'|'corrected'|'manual';reference_frame:number|null}
export interface BeatTimeline {
 schema:'stemlab.beat-timeline.v1';pips_per_beat:64;consensus_sha256:string;origin_beat:number;
 review_status:'estimated'|'artist_confirmed';source_url?:string;
 source_audio:{sha256:string;sample_rate:number;num_frames:number;num_channels:number;duration_seconds?:number};
 beats:BeatTimelineAnchor[];
 sync?:{beat_1_index:number;beat_1_source_frame:number;beat_1_start_seconds:number;beat_1_start_pips:number;sync_phase_offset_pips:number;exact_phase_offset_pips:string;pips_per_beat:64;canonical_first_beat_pip:0};
 beat_timeline?:Array<{beat:number;source_frame:number;pip:number;time_seconds:number;consensus_reference_frame:number|null}>;
 tempo_segments?:Array<{start_frame:number;end_frame:number;bpm:number}>;
}
export interface WordTimingEvent {index:number;time:number;start:number;end:number|null;word:string;text:string}
export interface SongCollectionEntry extends PageConfig {id:string;title:string;audioSrc:string}
export interface SongCollectionController {readonly destroyed:boolean;readonly current:string|null;readonly runtime:DanceMoves|null;readonly songs:readonly SongCollectionEntry[];readonly ready:Promise<DanceMoves>;select(id:string):DanceMoves;destroy():void}
export interface PageConfig {
 pageId?:number;bpm?:number|null;bpmSource?:'explicit'|'fallback'|'analysis';beatAlignment?:BeatAlignment|null;beatTimeline?:BeatTimeline|null;lyricTimingUrl?:string;wordTimingUrl?:string;cueTimingUrl?:string;
 lyricPopupsEnabled?:boolean;masterDurationMilliseconds?:number;sharedControlTicks?:number;lyricDisclosureTicks?:number;
 effect?:''|'paper-planes';diagnostics?:boolean;
 spectrumRecordingUrl?:string;spectrumRenderer?:SpectrumRenderer;
 visualiserRecordingUrl?:string;visualiserRenderer?:VisualiserRenderer;visualiserRudiment?:RudimentName|'';visualiserAxes?:readonly string[];
 /** Host-supplied directory URL for the shipped sprite PNGs; WordPress supplies its plugin asset URL. */
 visualiserAssetBaseUrl?:string;
 /** Empty selects the renderer's default atlas; retained but unused by other renderer families. */
 visualiserSpriteTheme?:SpriteTheme|'';
 /** FFT requires spatial-music-terrain and a calibrated saved recording when a source is configured. */
 visualiserTerrainSource?:'procedural'|'fft';
 /** Calibrated saved recordings only; supported by the three spatial-music renderers. */
 visualiserSpectralDeform?:boolean;
}
export interface Options extends PageConfig {
 root:HTMLElement;clayPerformance?:Record<string,number|boolean>;catalogue?:boolean;clay?:boolean;legacyGlobals?:boolean;nonce?:string;onError?:(error:Error)=>void;
 orientation?:{adapter?:OrientationAdapter;transitionTargetTicks?:number;harness?:boolean};
 paperPlanes?:{atlasUrl:string;planeCount?:number;compactPlaneCount?:number};
}
export type OrientationAdapter = 'light-will-win'|'dying-for-a-diagnosis'|'presents-and-chocolate'|'fully-nocturnal'|'amnesty-honestly'|'walk-with-me'|'dmitri-my-talisman'|'clay-stars'|'california-screamin';
export interface Cue {time:number;type:string;name:string;label?:string;normalisedType?:string;normalisedName?:string;normalisedLabel?:string;audio?:PlaybackMedia|null}
export interface Lyric {time:number;text:string;normalisedText?:string;audio?:PlaybackMedia|null;previousVisibleTime?:number|null;previousVisibleText?:string;previousVisibleNormalisedText?:string;previousVisibleIndex?:number;nextTime?:number|null;nextText?:string;nextVisibleTime?:number|null;nextVisibleText?:string;nextVisibleNormalisedText?:string;nextVisibleIndex?:number;[field:string]:unknown}
export interface Clock {clock?:'page'|'audio';audio?:PlaybackMedia;bpm?:number;strictlyFuture?:boolean;handlerId?:string}
export interface IntervalDetail {intervalTicks:number;boundaryTick:number;audio:PlaybackMedia|null;clock:'page'|'audio'}
export interface Controller {id?:string;teardown():void;snapshot():Record<string,unknown>}
export interface PointerController extends Controller {set(x:number,y:number,reason?:string):void;reset(reason?:string):void}
export interface QualityController extends Controller {setTier(index:number,reason?:string):void}
export interface CueTimelineController extends Controller {restore(reason?:string):void;start(reason?:string):void;stop(reason?:string):void}
export interface SpritePlaybackController extends Controller {restore(reason?:string):void;start(reason?:string):void;stop(reason?:string):void;setQuality(indexOrTier:number|string,reason?:string):void}
export interface LyricStageController extends Controller {restore(reason?:string):void}
export interface CooperativeArenaController extends Controller {setEnabled(value:boolean,reason?:string):void;setDensity(ships:number,hazards:number):void}
export interface LyricStageSlots {previous:HTMLElement;current:HTMLElement;next:HTMLElement;viewport:HTMLElement;track:HTMLElement}
export interface LyricStageState {root:Element;popover:HTMLElement;audio:PlaybackMedia;slots:LyricStageSlots;detail?:Lyric|null;phase?:string;progress?:number;reason?:string;playing?:boolean;reducedMotion:boolean;forcedColours:boolean;[field:string]:unknown}
export type LyricStageCleanup = void | (()=>void) | {durationTicks?:number;cleanup?:()=>void};
export interface Effects {
 version:string;
 pointer(options:EffectOptions & {target?:Element|string;bounds?:Element|string;render?:(point:{x:number;y:number;reason?:string})=>void}):PointerController;
 playbackPulse(options:EffectOptions & {audio?:PlaybackMedia|string;ticks?:number;className?:string;propertyPrefix?:string;render?:(state:Record<string,unknown> & {audio:PlaybackMedia})=>void}):Controller & {sync():void};
 cueClass(options:EffectOptions & {cue?:string;className?:string;durationTicks?:number;render?:(state:Record<string,unknown>)=>void}):Controller & {fire(cue?:Cue):void;clear(reason?:string):void};
 cueTimeline(options:EffectOptions & {audio?:PlaybackMedia|string;cues:Array<{id?:string;time:number;end?:number;[key:string]:unknown}>;onCue?:(event:Record<string,unknown>)=>void;render?:(state:Record<string,unknown>)=>void}):CueTimelineController;
 spritePlayback(options:EffectOptions & {audio?:PlaybackMedia|string;target?:HTMLElement|string;frameCount?:number;columns?:number;framesPerRow?:number;columnOffset?:number;rowOffset?:number;frameMap?:number[];cycleTicks?:number;phaseOffsetSeconds?:number;staticFrame?:number;propertyPrefix?:string;qualityTiers?:string[];qualityFramesPerSecond?:number[];initialQuality?:number;render?:(state:Record<string,unknown> & {audio:PlaybackMedia;target:HTMLElement;frame:number;localFrame:number;column:number;row:number;phase:number;cycleSeconds:number;playing:boolean})=>void}):SpritePlaybackController;
 lyricStage(options:EffectOptions & {audio?:PlaybackMedia|string;popover?:HTMLElement|string;travelTicks?:number;cueDurationTicks?:number;render?:(state:LyricStageState)=>void;renderLyric?:(state:LyricStageState & {previousDetail?:Lyric|null;previousText?:string})=>LyricStageCleanup;renderCue?:(state:LyricStageState & {detail:Cue;count:number})=>LyricStageCleanup}):LyricStageController|Controller;
 cooperativeArena(options:EffectOptions & {stage?:HTMLElement|string;shipSources:string[];hazardSources:string[];shipCount?:number;hazardCount?:number;speed?:number;bpm?:number;shotIntervalTicks?:number;enabled?:boolean;onHit?:(state:Record<string,unknown>)=>void;onCollision?:(state:Record<string,unknown>)=>void;render?:(state:Record<string,unknown>)=>void}):CooperativeArenaController;
 quality(options:EffectOptions & {tiers?:string[];render?:(state:{tier:string;index:number;reason:string;sample?:{fps:number}})=>void;[key:string]:unknown}):QualityController;
 get(id:string):Controller|null;snapshot():Record<string,unknown>[];teardown(id:string):void;teardownAll():void;
}
export interface EffectOptions {id?:string;root?:Element|string;[key:string]:unknown}
export interface OrientationController {enable():Promise<boolean>;disable():void;setActive(value:boolean):void;reset():void;destroy():void;snapshot():Record<string,unknown>}
export interface PhoneMotionConnection {enable():Promise<boolean>;reconcile():void;destroy():void;snapshot():Record<string,unknown>}
export interface PhoneMotionOptions {render?:(point:Offset & {reason:string})=>void;pointers?:string[];enabled?:()=>boolean;controlParent?:HTMLElement;watchAttributes?:string[];windowMilliseconds?:number}
export interface Recorder {start():Promise<MotionCapture>;stop(reason?:string):MotionCapture;snapshot():Record<string,unknown>;upload(endpoint:string,options?:{headers?:Record<string,string>;signal?:AbortSignal}):Promise<Record<string,unknown>>}
export interface MotionCapture {schema:'ks-epk-motion-recording/v1';samples:Array<{milliseconds:number;beta:number;gamma:number;alpha?:number|null;[key:string]:unknown}>;[key:string]:unknown}
export interface DanceMoves {
 playbackSource(master:MasterReference|PlaybackSource):PlaybackSource;
 registerPlayer(options:PlayerRegistration & {player:HTMLMediaElement}):PlaybackController;
 registerPlaybackProvider(options:PlayerRegistration & {player:ChildPlaybackPlayer}):PlaybackController;
 registerYouTube(options:PlayerRegistration & {iframe:HTMLIFrameElement}):PlaybackController & {ready:Promise<PlaybackController>};
 readonly version:string;readonly bpm:number;readonly bpmSource:string;readonly ticksPerBeat:16;readonly root:HTMLElement;readonly config:Readonly<PageConfig>;
 readonly destroyed:boolean;ready:Promise<DanceMoves>;
 quantizeTicks(value:number):number;durationMilliseconds(ticks:number,bpmOverride?:number):number;currentTick(options?:Clock):number;
 sourceTick(audio:PlaybackMedia,bpmOverride?:number):number;rhythmicTime(audio:PlaybackMedia):number;
 tempoAt(audio:PlaybackMedia,bpmOverride?:number):number;durationMillisecondsAt(audio:PlaybackMedia,ticks:number):number;
 beatTimelineState(audio:PlaybackMedia):Readonly<{status:string;applied:boolean;mode:'constant'|'variable';firstBeatSeconds?:number;offsetPips?:number;sourceSha256?:string}>;
 beatAlignmentState(audio:PlaybackMedia):Readonly<{status:string;applied:boolean;mode?:'constant'|'variable';firstBeatSeconds?:number;offsetPips?:number;sourceSha256?:string;bpmStatus?:string}>;
 nextIntervalTick(interval:number,fromTick:number,strictlyFuture?:boolean):number;
 scheduleAtInterval(interval:number,callback:(detail:IntervalDetail)=>void,options?:Clock):Remove;
 deferStart(target:HTMLElement,interval:number,options?:Clock & {start?:(detail:IntervalDetail)=>void}):Remove;
 onNextInterval(callback:(detail:IntervalDetail)=>void,interval:number,metadata?:Metadata):Remove;
 onEveryInterval(callback:(detail:IntervalDetail)=>void,interval:number,metadata?:Metadata):Remove;
 onNextBeat(callback:(detail:IntervalDetail)=>void,metadata?:Metadata):Remove;
 onEveryBeat(callback:(detail:IntervalDetail)=>void,metadata?:Metadata):Remove;
 onNextBar(callback:(detail:IntervalDetail)=>void,metadata?:Metadata):Remove;
 onEveryBar(callback:(detail:IntervalDetail)=>void,metadata?:Metadata):Remove;
 parseTimingFile(text:string):Cue[];parseLyricTimingFile(text:string):Lyric[];normaliseCueName(name:string):string;
 onCue(name:string,callback:(cue:Cue)=>void,metadata?:Metadata):Remove;onLyric(callback:(lyric:Lyric)=>void,metadata?:Metadata):Remove;
 onWord(callback:(word:WordTimingEvent & {audio?:PlaybackMedia|null;previousWord?:string|null;nextWord?:string|null})=>void,metadata?:Metadata):Remove;parseWordTimingFile(text:string):readonly WordTimingEvent[];
 fireCue(cue:Partial<Cue> & {name:string}):Cue;registerAnimationScope(root:HTMLElement,selectors:string[]):Remove;
 resetRunningAnimations(audio?:PlaybackMedia):number;discoverAudio():void;registerPlaybackSource(source:PlaybackSource):void;unregisterPlaybackSource(source:PlaybackSource):void;
 setDiagnosticsSink(callback:((record:Record<string,unknown>)=>void)|null):boolean;diagnosticsEnabled():boolean;
 applyCatalogueTiming?():Record<string,unknown>;catalogueTimingSnapshot?():Record<string,unknown>;removeCatalogueAnimationScope?():void;
 effects:Effects;rudiments:import('./rudiments').RudimentApi;recordings:RecordingService;spectrum:SpectrumService;visualisers:VisualiserService;
 orientationCore:Record<string,(...args:any[])=>any>;
 getOrientation():(Controller & {reset():void})|null;getClay():(Controller & Record<string,any>)|null;getPaperPlanes():Controller|null;
 createOrientation(options:{render:(point:Offset & Record<string,unknown>)=>void;windowMilliseconds?:number;minimumSpanDegrees?:number;smoothingTimeConstantMilliseconds?:number}):OrientationController;
  connectPhoneMotion(options?:PhoneMotionOptions):PhoneMotionConnection;
 createRecorder(options?:{durationMilliseconds?:number;maxSamples?:number}):Recorder;
 publishPlayback(options:ChildPlaybackPublisherOptions):ChildPlaybackPublisher;
 receiveChildPlayback(options:ChildPlaybackRegistration):ChildPlaybackReceiver & {source:EventTarget & {currentTime:number;readonly paused:boolean};mapping:Readonly<{offset?:number;duration?:number;playerStart?:number}>};
 on(type:string,callback:EventListener):Remove;resources():{id:string;disposed:boolean;listeners:number;timers:number;frames:number;observers:number;created:number};destroy():void;
}
export const VERSION:string;
export const ORIENTATION_ADAPTERS:readonly OrientationAdapter[];
export const PAGE_META_KEYS:Readonly<{bpm:string;lyric:string;cue:string;popups:string;duration:string;effect:string;alignment:string;alignmentAudio:string;word:string;beatTimeline:string;useBeatTimeline:string;spectrumRecording:string;spectrumRenderer:string;visualiserRecording:string;visualiserRenderer:string;visualiserRudiment:string;visualiserAxes:string;visualiserSpriteTheme:string;visualiserTerrainSource:string;visualiserSpectralDeform:string}>;
export function validateBeatAlignment(input?:BeatAlignment|null):Readonly<BeatAlignment>|null;
export function validateBeatTimeline(input?:BeatTimeline|null,options?:{requireSourceUrl?:boolean}):Readonly<BeatTimeline>|null;
export function phasePipsAtSeconds(map:BeatTimeline,sourceSeconds:number):number;
export function tempoAtSeconds(map:BeatTimeline,sourceSeconds:number):number;
export function tickAtSeconds(map:BeatTimeline,sourceSeconds:number):number;
export function createDanceMoves(options:Options):DanceMoves;
export function parseWordTimingFile(text:string,options?:{format?:'auto'|'json'|'tsv'|'lrc'}):readonly WordTimingEvent[];
export function validateSongCollection(input:readonly SongCollectionEntry[]|{schema:'dancemoves.song-collection.v1';songs:SongCollectionEntry[]}):readonly SongCollectionEntry[];
export function createSongCollection(options:{root:HTMLElement;songs:readonly SongCollectionEntry[];mount:(config:Options)=>DanceMoves;host?:Window}):SongCollectionController;
export function validatePageConfig(input?:PageConfig):Readonly<PageConfig>;
export function fromWordPressMeta(meta:Record<string,unknown>,resolveAttachment?:(id:number)=>string|Promise<string>):Promise<Readonly<PageConfig>>;
export interface Revision {revision:number;config:PageConfig;savedAt:string}
export interface PageStore {read(id:string):Revision|null;revisions(id:string):Revision[];save(id:string,input:PageConfig,options?:{expectedRevision?:number}):Revision;restore(id:string,revision:number,options?:{expectedRevision?:number}):Revision;delete(id:string):boolean}
export function createMemoryPageStore(options?:{maxPages?:number;maxRevisions?:number}):PageStore;
export interface AudioRecording {format:'dancerudiments.recording';schema_version:1;pips_per_beat:64;sample_dtype:'float64';sample_decimals?:12;name:string;dimensions:string[];samples:number[][];clock:{bpm:number;bpm_source:string;bpm_status:'confirmed'|'estimated';beat_zero_seconds:number;phase_status:'unverified'|'estimated'|'supplied';start_pip:number};provenance?:Record<string,unknown>|string}
export interface RecordingFrame {recording:string;dimensions:readonly string[];values:number[];position:{x:number;y:number;z:number};pip:number;positionPips:number;sourceBeats:number;loopProgress:null;reason:string}
export interface RecordingController {id:string;ready:Promise<RecordingController>;setEnabled(value:boolean):void;pause():void;resume():void;refresh():void;destroy():void;teardown():void;snapshot():Record<string,unknown>}
export interface RecordingService {load(url:string,options?:{signal?:AbortSignal}):Promise<AudioRecording>;animate(options:{id:string;root:HTMLElement;target:HTMLElement;audio:PlaybackMedia;recording:AudioRecording;offscreen?:boolean;enabled?:boolean;render:(frame:RecordingFrame)=>void}):RecordingController;get(id:string):RecordingController|null;destroyAll():void;snapshot():Record<string,unknown>}

export type SpectrumRenderer = 'spectrum'|'spectrum-line'|'spectrum-area'|'spectrum-dots'|'spectrum-stems'|'spectrum-steps'|'spectrum-mirror'|'spectrum-radial'|'spectrum-ring'|'spectrum-spiral';
export const SPECTRUM_RENDERERS:readonly SpectrumRenderer[];
export interface SpectrumStyle {floor_db?:number;ceiling_db?:number;hold_seconds?:number;decay_db_per_second?:number;peak_count?:number;min_peak_db?:number;min_peak_contrast_db?:number;min_peak_distance?:number;labels?:boolean;gap?:number;colours?:readonly string[];padding?:number;background?:string;line_width?:number;point_radius?:number;peak_colour?:string;label_colour?:string}
export interface SpectrumBandReport {readonly axis:string;readonly index:number;readonly low_hz:number;readonly high_hz:number;readonly rms:number;readonly dbfs:number|null;readonly display_dbfs:number;readonly held_dbfs:number}
export interface SpectrumReport {readonly kind:string;readonly units:string;readonly source_sha256:string;readonly fft_size:number;readonly fft_bin_resolution_hz:number;readonly bands:readonly SpectrumBandReport[];readonly peaks:ReadonlyArray<SpectrumBandReport & {readonly plateau_low_hz:number;readonly plateau_high_hz:number;readonly adjacent_contrast_db:number}>;readonly dominant:SpectrumBandReport|null;readonly peak_method:string;readonly hold_clock:string}
export interface SpectrumFrame {id:string;renderer:SpectrumRenderer;pip:number|null;sourceSeconds:number|null;reason:string;report:SpectrumReport|null}
export interface SpectrumSnapshot {id:string;type:'spectrum';renderer:SpectrumRenderer;recordingUrl:string|null;status:string;error:string|null;destroyed:boolean;enabled:boolean;paused:boolean;pip:number|null;sourceSeconds:number|null;report:SpectrumReport|null;historyPips:number;historyStride:number;canvasWidth:number;canvasHeight:number}
export type SpectrumOptions = {id:string;target:HTMLCanvasElement|string;audio:PlaybackMedia|string;renderer?:SpectrumRenderer;axes?:readonly (string|number)[];style?:SpectrumStyle;historyPips?:number;historyStride?:number;pixelRatio?:number;enabled?:boolean;offscreen?:boolean;onFrame?:(frame:SpectrumFrame)=>void} & ({recordingUrl:string;recording?:never}|{recording:AudioRecording;recordingUrl?:never});
export interface SpectrumController {readonly id:string;readonly ready:Promise<SpectrumController>;setEnabled(value:boolean):void;pause():void;resume():void;refresh():void;destroy():void;teardown():void;snapshot():SpectrumSnapshot}
export interface SpectrumService {animate(options:SpectrumOptions):SpectrumController;get(id:string):SpectrumController|null;destroyAll():void;snapshot():{renderers:readonly SpectrumRenderer[];sources:number;instances:SpectrumSnapshot[]}}

/** Complete 222-view FrameRudiments Canvas catalogue, preserving its renderer IDs. */
export type VisualiserRenderer =
  'particles'
  | 'bars'
  | 'waveform'
  | 'path'
  | 'spectrum'
  | 'spectrum-line'
  | 'spectrum-area'
  | 'spectrum-dots'
  | 'spectrum-stems'
  | 'spectrum-steps'
  | 'spectrum-mirror'
  | 'spectrum-radial'
  | 'spectrum-ring'
  | 'spectrum-spiral'
  | 'spectrum-horizon'
  | 'spectrum-waterfall'
  | 'spectrum-ridgeline'
  | 'spectrum-peaks'
  | 'spectrum-log'
  | 'spectrum-mel'
  | 'spectrum-third-octave'
  | 'spectrogram-linear'
  | 'spectrogram-log'
  | 'spectrogram-mel'
  | 'spectrogram-bark'
  | 'spectrogram-erb'
  | 'spectrogram-peaks'
  | 'spectrogram-contours'
  | 'spectrogram-mirror'
  | 'spectrogram-transposed'
  | 'spectrogram-polar'
  | 'waveform-area'
  | 'waveform-mirror'
  | 'waveform-dots'
  | 'waveform-steps'
  | 'waveform-oscilloscope'
  | 'waveform-envelope'
  | 'waveform-ribbon'
  | 'waveform-polar'
  | 'phase-portrait'
  | 'phase-points'
  | 'spectrum-annular-bars'
  | 'spectrum-annular-bars-inward'
  | 'spectrum-annular-bars-bipolar'
  | 'spectrum-annular-bars-mirror'
  | 'spectrum-annular-split'
  | 'spectrum-annular-sunburst'
  | 'spectrum-annular-fan'
  | 'spectrum-annular-petals'
  | 'spectrum-annular-led'
  | 'spectrum-annular-led-inward'
  | 'spectrum-annular-ticks'
  | 'spectrum-annular-arc'
  | 'spectrum-annular-dial'
  | 'spectrum-annular-dots'
  | 'spectrum-annular-lollipop'
  | 'spectrum-annular-orbit'
  | 'spectrum-annular-caterpillar'
  | 'spectrum-annular-peaks'
  | 'spectrum-annular-area'
  | 'spectrum-annular-line'
  | 'spectrum-annular-ribbon'
  | 'spectrum-annular-halo'
  | 'spectrum-annular-rose'
  | 'spectrum-annular-concentric'
  | 'spectrum-annular-sectors'
  | 'spectrum-annular-layers'
  | 'spectrum-annular-gauge'
  | 'spectrum-annular-spiral'
  | 'spectrum-annular-helix'
  | 'spectrogram-annular-time'
  | 'spectrogram-annular-rings'
  | 'spectrogram-annular-heatmap'
  | 'spectrogram-annular-stripes'
  | 'spectrogram-annular-contour'
  | 'spectrogram-annular-frequency'
  | 'spectrogram-annular-sweep'
  | 'spectrogram-annular-spiral'
  | 'waveform-annular-line'
  | 'waveform-annular-fill'
  | 'waveform-annular-area'
  | 'waveform-annular-envelope'
  | 'waveform-annular-halo'
  | 'waveform-annular-rose'
  | 'waveform-annular-pulse'
  | 'waveform-annular-mirror'
  | 'waveform-annular-ribbon'
  | 'waveform-annular-rings'
  | 'waveform-annular-bands'
  | 'waveform-annular-bars'
  | 'waveform-annular-spokes'
  | 'waveform-annular-led'
  | 'waveform-annular-petals'
  | 'waveform-annular-sectors'
  | 'waveform-annular-arc'
  | 'waveform-annular-dots'
  | 'waveform-annular-radar'
  | 'waveform-annular-trails'
  | 'waveform-annular-spiral'
  | 'waveform-annular-helix'
  | 'phase-annular-portrait'
  | 'spectrum-cityscape'
  | 'spectrum-led-matrix'
  | 'spectrum-capsules'
  | 'spectrum-outline-blocks'
  | 'spectrum-peak-ladder'
  | 'spectrum-staircase'
  | 'spectrum-eq-curve'
  | 'spectrum-ribbon-stack'
  | 'spectrum-peak-trails'
  | 'spectrum-gel-bars'
  | 'spectrum-lollipop-grid'
  | 'spectrum-mountain-range'
  | 'spectrum-band-delta'
  | 'spectrum-band-variance'
  | 'spectrum-energy-tiles'
  | 'spectrum-semi-circle'
  | 'spectrum-fan-meter'
  | 'spectrum-braided-lines'
  | 'spectrum-rain-bars'
  | 'spectrum-bead-stacks'
  | 'spectrum-dash-grid'
  | 'spectrum-thermometer'
  | 'spectrum-wave-fence'
  | 'spectrum-partition'
  | 'spectrogram-pixel-mosaic'
  | 'spectrogram-isometric-terrain'
  | 'spectrogram-voxel-city'
  | 'spectrogram-frequency-stripes'
  | 'spectrogram-dot-cloud'
  | 'spectrogram-isobands'
  | 'spectrogram-negative'
  | 'spectrogram-tape'
  | 'spectrogram-slit-scan'
  | 'spectrogram-trails'
  | 'spectrogram-hex-cells'
  | 'spectrogram-bead-grid'
  | 'spectrogram-tunnel'
  | 'spectrogram-record-grooves'
  | 'spectrogram-quilt'
  | 'spectrogram-crosshatch'
  | 'spectrogram-triangle-tiles'
  | 'spectrogram-pixel-rain'
  | 'waveform-phosphor'
  | 'waveform-echo'
  | 'waveform-sample-beads'
  | 'waveform-channel-braid'
  | 'waveform-pulse-train'
  | 'waveform-quantised'
  | 'waveform-triggered'
  | 'waveform-spiral-trace'
  | 'waveform-butterfly'
  | 'waveform-horizon'
  | 'waveform-heat-ribbon'
  | 'waveform-dotted-envelope'
  | 'waveform-vertical-scope'
  | 'waveform-phase-trails'
  | 'waveform-polar-radar'
  | 'waveform-dna-helix'
  | 'waveform-block-meter'
  | 'waveform-signal-staircase'
  | 'spatial-torus'
  | 'spatial-sphere'
  | 'spatial-terrain'
  | 'sprite-spectrum-lcd'
  | 'sprite-spectrum-lcd-horizontal'
  | 'sprite-spectrum-lcd-mirrored'
  | 'sprite-spectrum-led'
  | 'sprite-spectrum-led-radial'
  | 'sprite-spectrum-vfd'
  | 'sprite-spectrum-retro'
  | 'sprite-spectrum-neon'
  | 'sprite-spectrum-crystal'
  | 'sprite-spectrum-fire'
  | 'sprite-spectrum-ice'
  | 'sprite-spectrum-icons'
  | 'sprite-spectrum-petals'
  | 'sprite-spectrum-ring'
  | 'sprite-spectrum-halo'
  | 'sprite-spectrum-mosaic'
  | 'sprite-spectrum-city'
  | 'sprite-spectrum-gauge'
  | 'sprite-spectrum-spokes'
  | 'sprite-spectrum-orbits'
  | 'sprite-spectrogram-lcd'
  | 'sprite-spectrogram-led'
  | 'sprite-spectrogram-pixels'
  | 'sprite-spectrogram-heatmap'
  | 'sprite-spectrogram-icons'
  | 'sprite-spectrogram-neon'
  | 'sprite-spectrogram-crystal'
  | 'sprite-spectrogram-fire'
  | 'sprite-spectrogram-radial'
  | 'sprite-spectrogram-spiral'
  | 'sprite-spectrogram-rain'
  | 'sprite-spectrogram-blocks'
  | 'sprite-waveform-lcd'
  | 'sprite-waveform-led'
  | 'sprite-waveform-dots'
  | 'sprite-waveform-icons'
  | 'sprite-waveform-neon'
  | 'sprite-waveform-ribbon'
  | 'sprite-waveform-bars'
  | 'sprite-waveform-mirrored'
  | 'sprite-waveform-annular'
  | 'sprite-waveform-spiral'
  | 'sprite-waveform-sparks'
  | 'sprite-waveform-crystal'
  | 'sprite-motion-path'
  | 'sprite-motion-orbit'
  | 'sprite-motion-cloud'
  | 'sprite-motion-constellation'
  | 'sprite-motion-trails'
  | 'sprite-motion-particles'
  | 'sprite-motion-xy'
  | 'sprite-motion-icon-grid'
  | 'spatial-solid-torus'
  | 'spatial-solid-sphere'
  | 'spatial-solid-terrain'
  | 'spatial-music-torus'
  | 'spatial-music-sphere'
  | 'spatial-music-terrain';
/** These modes always require saved Fourier calibration; music modes can opt into it through style. */
export type SpectralVisualiserRenderer = Extract<VisualiserRenderer, `spectrum${string}` | `spectrogram${string}` | `sprite-spectrum-${string}` | `sprite-spectrogram-${string}`>;
export type MotionVisualiserRenderer = Exclude<VisualiserRenderer, SpectralVisualiserRenderer>;
export type SpriteVisualiserRenderer = Extract<VisualiserRenderer, `sprite-${string}`>;
export type SolidVisualiserRenderer = Extract<VisualiserRenderer, `spatial-solid-${string}`>;
export type MusicVisualiserRenderer = Extract<VisualiserRenderer, `spatial-music-${string}`>;
export interface VisualiserInfo {
 readonly name:VisualiserRenderer;readonly label:string;readonly description:string;
 readonly family:'motion'|'spectrum'|'spectrogram'|'spatial';
 readonly styleFamily:'primitive'|'spectrum'|'advanced-spectrum'|'advanced-motion'|'circular'|'effects'|'wire'|'sprites'|'solid'|'music';
 readonly requiresSpectrum:boolean;readonly minDimensions:1|2;readonly usesHistory:boolean;
 readonly requiresAtlas:boolean;readonly supportsSpectrum:boolean;
}
export const VISUALISER_CATALOGUE:readonly VisualiserInfo[];
export const VISUALISER_RENDERERS:readonly VisualiserRenderer[];
export const VISUALISER_RUDIMENTS:readonly RudimentName[];
export type SpriteTheme = 'lcd'|'lcd-green'|'lcd-amber'|'led'|'vfd'|'arcade'|'neon'|'glass'|'metal'|'crystal'|'pixel'|'hud'|'plasma'|'fire'|'ice'|'mono'|'generated-neon';
export interface SpriteAtlasInfo {
 readonly file:string;readonly sha256:string;readonly width:number;readonly height:number;readonly columns:number;readonly rows:number;
}
/** Metadata only: importing these constants does not request or decode images. */
export const SPRITE_THEMES:readonly SpriteTheme[];
export const SPRITE_ATLASES:Readonly<Record<SpriteTheme,SpriteAtlasInfo>>;
/** Pinned HTTP(S) or relative PNG URL. The legacy path spelling is accepted as a browser URL. */
export type SpriteAsset = Readonly<{url:string;sha256:string;path?:never}> | Readonly<{path:string;sha256:string;url?:never}>;
export interface VisualiserStyleBase {colours?:readonly string[];padding?:number;background?:string}
export interface ParticleVisualiserStyle extends VisualiserStyleBase {count?:number;radius?:number;amplitude?:number;seed?:number;trail?:number;lag?:number}
export interface BarVisualiserStyle extends VisualiserStyleBase {orientation?:'vertical'|'horizontal';gap?:number;negative_colour?:string;baseline_colour?:string}
export interface WaveformVisualiserStyle extends VisualiserStyleBase {line_width?:number;layout?:'stacked'|'overlay';baseline_colour?:string}
export interface PathVisualiserStyle extends VisualiserStyleBase {line_width?:number;radius?:number}
export interface AdvancedSpectralStyle extends VisualiserStyleBase {floor_db?:number;ceiling_db?:number;line_width?:number;contrast?:number;history_limit?:number}
export interface AdvancedMotionStyle extends VisualiserStyleBase {line_width?:number;grid?:boolean}
export interface CircularVisualiserStyle extends VisualiserStyleBase {
 inner_radius?:number;outer_radius?:number;start_angle?:number;sweep_angle?:number;clockwise?:boolean;mirror?:boolean;grid?:boolean;
 line_width?:number;bar_gap?:number;bar_width?:number;gain?:number;floor_db?:number;ceiling_db?:number;fill_alpha?:number;
 led_segments?:number;rings?:number;history_limit?:number;axis?:number;twists?:number;cap_radius?:number;peak_threshold?:number;peak_count?:number;decay?:number;
 frequency_scale?:'equal'|'linear'|'log'|'mel'|'bark'|'erb';
}
export interface EffectVisualiserStyle extends VisualiserStyleBase {
 line_width?:number;floor_db?:number;ceiling_db?:number;gain?:number;history_limit?:number;axis?:number;segments?:number;quantize?:number;
 gap?:number;fill_alpha?:number;decay?:number;bead_radius?:number;perspective?:number;smoothing?:number;threshold?:number;stride?:number;
 amplitude_curve?:'linear'|'sqrt'|'square'|'log'|'ease';colour_map?:'axis'|'level'|'time'|'alternating'|'mono'|'rainbow';
 mirror?:boolean;reverse?:boolean;grid?:boolean;baseline?:boolean;
}
export interface WireVisualiserStyle extends VisualiserStyleBase {geometry?:'torus'|'sphere'|'terrain';camera_distance?:number;fov?:number;rotation?:number;orbit?:number;depth?:number;line_width?:number;fog?:number;glow?:number;rings?:number;segments?:number}
export interface SpriteVisualiserStyle extends VisualiserStyleBase {
 sprite_theme?:SpriteTheme;sprite_asset?:SpriteAsset|null;
 /** Built-in atlases use an 8 by 8 grid. Custom PNG grids accept 1..32 columns and rows. */
 sprite_columns?:number;sprite_rows?:number;
 shape?:'segment'|'dot'|'tube'|'crystal'|'icon'|'spark'|'block'|'flame';sprite_index?:number;
 sprite_colour?:'original'|'tint'|'level';sprite_blend?:'normal'|'add'|'screen'|'multiply'|'lighten'|'difference';
 sprite_tint_colour?:string|null;sprite_outline_colour?:string;orientation?:'vertical'|'horizontal';mirror?:boolean;pixelated?:boolean;
 sprite_size?:number;sprite_opacity?:number;tint_strength?:number;segment_count?:number;segment_gap?:number;off_opacity?:number;
 bar_gap?:number;start_angle?:number;sweep_angle?:number;inner_radius?:number;outer_radius?:number;history_limit?:number;
 bin_stride?:number;sample_stride?:number;spacing?:number;threshold?:number;floor_db?:number;ceiling_db?:number;
 /** Animation advances on the source clock at 60 frames per second, independently of repaint count. */
 animation_frames?:number;animation_stride?:number;sprite_animation_rate?:number;sprite_animation_phase?:number;
 axis?:number;rings?:number;twists?:number;seed?:number;max_stamps?:number;
 sprite_scale?:number;sprite_scale_x?:number;sprite_scale_y?:number;sprite_rotation?:number;sprite_spin?:number;
 sprite_offset_x?:number;sprite_offset_y?:number;sprite_layout_rotation?:number;sprite_spread?:number;
 sprite_anchor_x?:number;sprite_anchor_y?:number;sprite_shear_x?:number;sprite_shear_y?:number;
 sprite_jitter?:number;sprite_angle_jitter?:number;sprite_visible_fraction?:number;sprite_palette_shift?:number;
 sprite_hue_shift?:number;sprite_saturation?:number;sprite_brightness?:number;sprite_contrast?:number;sprite_gamma?:number;
 sprite_temperature?:number;sprite_red?:number;sprite_green?:number;sprite_blue?:number;sprite_posterize?:number;
 sprite_pixel_size?:number;sprite_blur?:number;sprite_glow?:number;sprite_outline?:number;sprite_shadow?:number;
 sprite_shadow_x?:number;sprite_shadow_y?:number;sprite_shadow_opacity?:number;sprite_scanlines?:number;sprite_grain?:number;sprite_sharpen?:number;
}
export type SpatialGeometry = 'torus'|'sphere'|'terrain';
export interface SolidVisualiserStyle extends VisualiserStyleBase {
 geometry?:SpatialGeometry;camera_distance?:number;fov?:number;rotation?:number;orbit?:number;depth?:number;rings?:number;segments?:number;
 ambient?:number;roughness?:number;metallic?:number;light_direction?:readonly [number,number,number];light_colour?:string;
 fog?:number;fog_colour?:string;fog_steps?:number;fog_resolution?:number;glow?:number;
 /** Both choices use the CPU rasterizer; auto includes a fallback reason in renderReport. GPU requests are rejected. */
 backend?:'cpu'|'auto';
 /** Longest raster edge: integer 64..1024, default 512. Work limits can reduce the actual resolution. */
 raster_size?:number;
}
export interface MusicVisualiserStyle extends SolidVisualiserStyle {
 /** FFT is valid only for spatial-music-terrain and requires a calibrated recording. */
 terrain_source?:'procedural'|'fft';terrain_height?:number;fft_floor_db?:number;fft_gain?:number;
 /** Enabling spectral deformation requires a calibrated recording for every music geometry. */
 spectral_deform?:boolean;spectral_gain?:number;mesh_gain?:number;
 audio_displacement?:number;audio_frequency?:number;audio_twist?:number;audio_ripple_speed?:number;
 texture_scale?:number;texture_octaves?:number;bump_strength?:number;normal_strength?:number;
 weathering?:number;thermal_erosion?:number;hydraulic_erosion?:number;glaciation?:number;erosion_iterations?:number;seed?:number;
 snowline?:number;ice_coverage?:number;light_power?:number;light_azimuth?:number;light_elevation?:number;camera_pitch?:number;
}
export type EffectVisualiserRenderer = 'spectrum-cityscape'|'spectrum-led-matrix'|'spectrum-capsules'|'spectrum-outline-blocks'|'spectrum-peak-ladder'|'spectrum-staircase'|'spectrum-eq-curve'|'spectrum-ribbon-stack'|'spectrum-peak-trails'|'spectrum-gel-bars'|'spectrum-lollipop-grid'|'spectrum-mountain-range'|'spectrum-band-delta'|'spectrum-band-variance'|'spectrum-energy-tiles'|'spectrum-semi-circle'|'spectrum-fan-meter'|'spectrum-braided-lines'|'spectrum-rain-bars'|'spectrum-bead-stacks'|'spectrum-dash-grid'|'spectrum-thermometer'|'spectrum-wave-fence'|'spectrum-partition'|'spectrogram-pixel-mosaic'|'spectrogram-isometric-terrain'|'spectrogram-voxel-city'|'spectrogram-frequency-stripes'|'spectrogram-dot-cloud'|'spectrogram-isobands'|'spectrogram-negative'|'spectrogram-tape'|'spectrogram-slit-scan'|'spectrogram-trails'|'spectrogram-hex-cells'|'spectrogram-bead-grid'|'spectrogram-tunnel'|'spectrogram-record-grooves'|'spectrogram-quilt'|'spectrogram-crosshatch'|'spectrogram-triangle-tiles'|'spectrogram-pixel-rain'|'waveform-phosphor'|'waveform-echo'|'waveform-sample-beads'|'waveform-channel-braid'|'waveform-pulse-train'|'waveform-quantised'|'waveform-triggered'|'waveform-spiral-trace'|'waveform-butterfly'|'waveform-horizon'|'waveform-heat-ribbon'|'waveform-dotted-envelope'|'waveform-vertical-scope'|'waveform-phase-trails'|'waveform-polar-radar'|'waveform-dna-helix'|'waveform-block-meter'|'waveform-signal-staircase';
export type AdvancedSpectralRenderer = 'spectrum-horizon'|'spectrum-waterfall'|'spectrum-ridgeline'|'spectrum-peaks'|'spectrum-log'|'spectrum-mel'|'spectrum-third-octave'|'spectrogram-linear'|'spectrogram-log'|'spectrogram-mel'|'spectrogram-bark'|'spectrogram-erb'|'spectrogram-peaks'|'spectrogram-contours'|'spectrogram-mirror'|'spectrogram-transposed'|'spectrogram-polar';
export type VisualiserStyle<R extends VisualiserRenderer = VisualiserRenderer> =
 R extends SpectrumRenderer ? SpectrumStyle :
 R extends 'particles' ? ParticleVisualiserStyle : R extends 'bars' ? BarVisualiserStyle :
 R extends 'waveform' ? WaveformVisualiserStyle : R extends 'path' ? PathVisualiserStyle :
 R extends SpriteVisualiserRenderer ? SpriteVisualiserStyle :
 R extends `spatial-music-${infer G extends SpatialGeometry}` ? MusicVisualiserStyle & {geometry?:G;terrain_source?:G extends 'terrain' ? 'procedural'|'fft' : 'procedural'} :
 R extends `spatial-solid-${infer G extends SpatialGeometry}` ? SolidVisualiserStyle & {geometry?:G} :
 R extends `spatial-${string}` ? WireVisualiserStyle :
 R extends `${string}-annular-${string}` ? CircularVisualiserStyle :
 R extends EffectVisualiserRenderer ? EffectVisualiserStyle :
 R extends AdvancedSpectralRenderer ? AdvancedSpectralStyle : AdvancedMotionStyle;
export function validateVisualiserStyle<R extends VisualiserRenderer>(renderer:R,style?:VisualiserStyle<R>):Readonly<VisualiserStyle<R>>;
export interface SpriteVisualiserRenderReport {
 readonly kind:'sprite-rudiment';readonly stamps:number;readonly drawn_stamps:number;
 /** floor(sourceSeconds * 60), independent of repaint count. */
 readonly animation_frame:number;
 readonly atlas:Readonly<{sha256:string;width:number;height:number;columns:number;rows:number;custom:boolean}>;
}
export interface SpatialVisualiserRenderReport {
 readonly backend:'cpu';readonly fallbackReason?:string;readonly geometry:SpatialGeometry;
 readonly rasterWidth:number;readonly rasterHeight:number;readonly triangles:number;readonly coveredPixels:number;
 readonly rasterPixelTests:number;readonly rasterLimited:boolean;
 readonly depthBuffer:'per-pixel reciprocal camera depth';readonly shading:'linear-light Cook-Torrance GGX';
 readonly fog:'off'|'depth-terminated bounded fog';readonly shadows:'not calculated by the CPU backend';
 readonly sourcePips:readonly number[];readonly sourceSha256:string|null;
}
/** Frozen renderer diagnostics, separate from the calibrated SpectrumReport. */
export type VisualiserRenderReport = SpriteVisualiserRenderReport | SpatialVisualiserRenderReport;
export interface VisualiserFrame {
 readonly id:string;readonly renderer:VisualiserRenderer;readonly rudiment:RudimentName|null;readonly pip:number|null;readonly sourceSeconds:number|null;
 readonly reason:string;readonly dimensions:readonly string[]|null;readonly values:readonly number[]|null;readonly historyLength:number;readonly report:SpectrumReport|null;
 readonly renderReport:VisualiserRenderReport|null;
}
export interface VisualiserSnapshot {
 id:string;type:'visualiser';renderer:VisualiserRenderer;rudiment:RudimentName|null;recordingUrl:string|null;status:string;error:string|null;
 destroyed:boolean;enabled:boolean;paused:boolean;clock:RudimentClock;rate:number|null;pip:number|null;sourceSeconds:number|null;
 dimensions:readonly string[];values:readonly number[]|null;historyLength:number;report:SpectrumReport|null;renderReport:VisualiserRenderReport|null;
 historyPips:number;historyStride:number;canvasWidth:number;canvasHeight:number;
}
export type VisualiserOptions<R extends VisualiserRenderer = VisualiserRenderer> = {
 id:string;target:HTMLCanvasElement|string;renderer?:R;axes?:readonly (string|number)[];style?:VisualiserStyle<R>;
 historyPips?:number;historyStride?:number;pixelRatio?:number;enabled?:boolean;offscreen?:boolean;onFrame?:(frame:VisualiserFrame)=>void;
} & ((R extends MotionVisualiserRenderer ? {
 rudiment:RudimentName;recording?:never;recordingUrl?:never;audio?:PlaybackMedia|string;clock?:RudimentClock;rate?:number;phasePips?:number;resetOnCue?:boolean|string;
 style?:R extends MusicVisualiserRenderer ? VisualiserStyle<R> & {terrain_source?:'procedural';spectral_deform?:false} : VisualiserStyle<R>;
} : never) | ({rudiment?:never;audio:PlaybackMedia|string;clock?:never;rate?:never;phasePips?:never;resetOnCue?:never} &
 ({recordingUrl:string;recording?:never}|{recording:AudioRecording;recordingUrl?:never})));
export interface VisualiserController {
 readonly id:string;readonly ready:Promise<VisualiserController>;setEnabled(value:boolean):void;pause():void;resume():void;refresh():void;
 /** Generic native patterns only; saved recordings retain their capture origin. */
 reset():void;destroy():void;teardown():void;snapshot():VisualiserSnapshot;
}
export interface VisualiserService {
 animate<R extends VisualiserRenderer = 'waveform'>(options:VisualiserOptions<R>):VisualiserController;
 catalogue():readonly VisualiserInfo[];describe(name:string):VisualiserInfo|null;get(id:string):VisualiserController|null;destroyAll():void;
 snapshot():{renderers:readonly VisualiserRenderer[];sources:number;patterns:number;atlases:number;instances:VisualiserSnapshot[]};
}
