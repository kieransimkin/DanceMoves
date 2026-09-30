export * from './rudiments';
export type Remove = () => void;
export type Offset = Readonly<{x:number;y:number;z?:number}>;
export type Metadata = string | {id?:string;handlerId?:string};
export interface PageConfig {
 pageId?:number;bpm?:number|null;bpmSource?:'explicit'|'fallback';lyricTimingUrl?:string;cueTimingUrl?:string;
 lyricPopupsEnabled?:boolean;masterDurationMilliseconds?:number;sharedControlTicks?:number;lyricDisclosureTicks?:number;
 effect?:''|'paper-planes';diagnostics?:boolean;
}
export interface Options extends PageConfig {
 root:HTMLElement;clayPerformance?:Record<string,number|boolean>;catalogue?:boolean;clay?:boolean;legacyGlobals?:boolean;nonce?:string;onError?:(error:Error)=>void;
 orientation?:{adapter?:OrientationAdapter;transitionTargetTicks?:number;harness?:boolean};
 paperPlanes?:{atlasUrl:string;planeCount?:number;compactPlaneCount?:number};
}
export type OrientationAdapter = 'light-will-win'|'dying-for-a-diagnosis'|'presents-and-chocolate'|'fully-nocturnal'|'amnesty-honestly'|'walk-with-me'|'dmitri-my-talisman'|'clay-stars'|'california-screamin';
export interface Cue {time:number;type:string;name:string;label?:string;normalisedType?:string;normalisedName?:string;normalisedLabel?:string;audio?:HTMLAudioElement|null}
export interface Lyric {time:number;text:string;normalisedText?:string;audio?:HTMLAudioElement|null;previousVisibleTime?:number|null;previousVisibleText?:string;previousVisibleNormalisedText?:string;previousVisibleIndex?:number;nextTime?:number|null;nextText?:string;nextVisibleTime?:number|null;nextVisibleText?:string;nextVisibleNormalisedText?:string;nextVisibleIndex?:number;[field:string]:unknown}
export interface Clock {clock?:'page'|'audio';audio?:HTMLAudioElement;bpm?:number;strictlyFuture?:boolean;handlerId?:string}
export interface IntervalDetail {intervalTicks:number;boundaryTick:number;audio:HTMLAudioElement|null;clock:'page'|'audio'}
export interface Controller {id?:string;teardown():void;snapshot():Record<string,unknown>}
export interface PointerController extends Controller {set(x:number,y:number,reason?:string):void;reset(reason?:string):void}
export interface QualityController extends Controller {setTier(index:number,reason?:string):void}
export interface CueTimelineController extends Controller {restore(reason?:string):void;start(reason?:string):void;stop(reason?:string):void}
export interface LyricStageController extends Controller {restore(reason?:string):void}
export interface CooperativeArenaController extends Controller {setEnabled(value:boolean,reason?:string):void;setDensity(ships:number,hazards:number):void}
export interface LyricStageSlots {previous:HTMLElement;current:HTMLElement;next:HTMLElement;viewport:HTMLElement;track:HTMLElement}
export interface LyricStageState {root:Element;popover:HTMLElement;audio:HTMLAudioElement;slots:LyricStageSlots;detail?:Lyric|null;phase?:string;progress?:number;reason?:string;playing?:boolean;reducedMotion:boolean;forcedColours:boolean;[field:string]:unknown}
export type LyricStageCleanup = void | (()=>void) | {durationTicks?:number;cleanup?:()=>void};
export interface Effects {
 version:string;
 pointer(options:EffectOptions & {target?:Element|string;bounds?:Element|string;render?:(point:{x:number;y:number;reason?:string})=>void}):PointerController;
 playbackPulse(options:EffectOptions & {audio?:HTMLAudioElement|string;ticks?:number;className?:string;propertyPrefix?:string;render?:(state:Record<string,unknown> & {audio:HTMLAudioElement})=>void}):Controller & {sync():void};
 cueClass(options:EffectOptions & {cue?:string;className?:string;durationTicks?:number;render?:(state:Record<string,unknown>)=>void}):Controller & {fire(cue?:Cue):void;clear(reason?:string):void};
 cueTimeline(options:EffectOptions & {audio?:HTMLAudioElement|string;cues:Array<{id?:string;time:number;end?:number;[key:string]:unknown}>;onCue?:(event:Record<string,unknown>)=>void;render?:(state:Record<string,unknown>)=>void}):CueTimelineController;
 lyricStage(options:EffectOptions & {audio?:HTMLAudioElement|string;popover?:HTMLElement|string;travelTicks?:number;cueDurationTicks?:number;render?:(state:LyricStageState)=>void;renderLyric?:(state:LyricStageState & {previousDetail?:Lyric|null;previousText?:string})=>LyricStageCleanup;renderCue?:(state:LyricStageState & {detail:Cue;count:number})=>LyricStageCleanup}):LyricStageController|Controller;
 cooperativeArena(options:EffectOptions & {stage?:HTMLElement|string;shipSources:string[];hazardSources:string[];shipCount?:number;hazardCount?:number;speed?:number;bpm?:number;shotIntervalTicks?:number;enabled?:boolean;onHit?:(state:Record<string,unknown>)=>void;render?:(state:Record<string,unknown>)=>void}):CooperativeArenaController;
 quality(options:EffectOptions & {tiers?:string[];render?:(state:{tier:string;index:number;reason:string;sample?:{fps:number}})=>void;[key:string]:unknown}):QualityController;
 get(id:string):Controller|null;snapshot():Record<string,unknown>[];teardown(id:string):void;teardownAll():void;
}
export interface EffectOptions {id?:string;root?:Element|string;[key:string]:unknown}
export interface OrientationController {enable():Promise<boolean>;disable():void;reset():void;destroy():void;snapshot():Record<string,unknown>}
export interface Recorder {start():Promise<MotionCapture>;stop(reason?:string):MotionCapture;snapshot():Record<string,unknown>;upload(endpoint:string,options?:{headers?:Record<string,string>;signal?:AbortSignal}):Promise<Record<string,unknown>>}
export interface MotionCapture {schema:'ks-epk-motion-recording/v1';samples:Array<{milliseconds:number;beta:number;gamma:number;alpha?:number|null;[key:string]:unknown}>;[key:string]:unknown}
export interface DanceMoves {
 readonly version:string;readonly bpm:number;readonly bpmSource:string;readonly ticksPerBeat:16;readonly root:HTMLElement;readonly config:Readonly<PageConfig>;
 readonly destroyed:boolean;ready:Promise<DanceMoves>;
 quantizeTicks(value:number):number;durationMilliseconds(ticks:number,bpmOverride?:number):number;currentTick(options?:Clock):number;
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
 fireCue(cue:Partial<Cue> & {name:string}):Cue;registerAnimationScope(root:HTMLElement,selectors:string[]):Remove;
 resetRunningAnimations(audio?:HTMLAudioElement):number;discoverAudio():void;
 setDiagnosticsSink(callback:((record:Record<string,unknown>)=>void)|null):boolean;diagnosticsEnabled():boolean;
 applyCatalogueTiming?():Record<string,unknown>;catalogueTimingSnapshot?():Record<string,unknown>;removeCatalogueAnimationScope?():void;
 effects:Effects;rudiments:import('./rudiments').RudimentApi;
 orientationCore:Record<string,(...args:any[])=>any>;
 getOrientation():(Controller & {reset():void})|null;getClay():(Controller & Record<string,any>)|null;getPaperPlanes():Controller|null;
 createOrientation(options:{render:(point:Offset & Record<string,unknown>)=>void;windowMilliseconds?:number;minimumSpanDegrees?:number;smoothingTimeConstantMilliseconds?:number}):OrientationController;
 createRecorder(options?:{durationMilliseconds?:number;maxSamples?:number}):Recorder;
 on(type:string,callback:EventListener):Remove;resources():{id:string;disposed:boolean;listeners:number;timers:number;frames:number;observers:number;created:number};destroy():void;
}
export const VERSION:string;
export const ORIENTATION_ADAPTERS:readonly OrientationAdapter[];
export const PAGE_META_KEYS:Readonly<{bpm:string;lyric:string;cue:string;popups:string;duration:string;effect:string}>;
export function createDanceMoves(options:Options):DanceMoves;
export function validatePageConfig(input?:PageConfig):Readonly<PageConfig>;
export function fromWordPressMeta(meta:Record<string,unknown>,resolveAttachment?:(id:number)=>string|Promise<string>):Promise<Readonly<PageConfig>>;
export interface Revision {revision:number;config:PageConfig;savedAt:string}
export interface PageStore {read(id:string):Revision|null;revisions(id:string):Revision[];save(id:string,input:PageConfig,options?:{expectedRevision?:number}):Revision;restore(id:string,revision:number,options?:{expectedRevision?:number}):Revision;delete(id:string):boolean}
export function createMemoryPageStore(options?:{maxPages?:number;maxRevisions?:number}):PageStore;
