import type {ReactNode,RefObject,HTMLAttributes} from 'react';
import type {DanceMoves,Options,PageConfig,Cue,Lyric} from './index';
import type {RudimentOptions,RudimentAnimation} from './rudiments';
export interface MountState {runtime:DanceMoves|null;error:Error|null}
export function useDanceMoves(root:RefObject<HTMLElement|null>,options?:Omit<Options,'root'>):MountState;
export function DanceMovesProvider(props:HTMLAttributes<HTMLDivElement> & {options?:Omit<Options,'root'>;children?:ReactNode}):ReactNode;
export function useDanceMovesContext():MountState;
export function useCue(runtime:DanceMoves|null,name:string,callback:(cue:Cue)=>void):void;
export function useLyric(runtime:DanceMoves|null):Lyric|null;
export function useRudiment(runtime:DanceMoves|null,target:RefObject<HTMLElement|null>,options:Omit<RudimentOptions,'root'|'target'>):{controller:RudimentAnimation|null;error:Error|null};
export function Rudiment(props:HTMLAttributes<HTMLDivElement> & {runtime:DanceMoves|null;options:Omit<RudimentOptions,'root'|'target'>;children?:ReactNode}):ReactNode;
export function PageMetadataEditor(props:{value?:PageConfig;onSave:(config:PageConfig)=>void|Promise<unknown>}):ReactNode;
