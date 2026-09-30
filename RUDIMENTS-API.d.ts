/** DanceMoves rudiment animation API v1.1; available on WordPress Page requests. */
export type RudimentName = 'bounce' | 'sway' | 'circle' | 'figure_eight' | 'step_touch' |
  'box_step' | 'helix' | 'clay_background' | 'single_stroke_roll' | 'double_stroke_roll' |
  'multiple_bounce_roll' | 'single_paradiddle' | 'flam' | 'drag' | 'five_stroke_roll';
export type Offset3 = Readonly<{ x: number; y: number; z: number }>;
export type RudimentClock = 'page' | 'audio' | 'auto';
export type RudimentStatus = 'loading' | 'running' | 'paused' | 'disabled' | 'hidden' |
  'offscreen' | 'reduced-motion' | 'forced-colors' | 'audio-paused' | 'seeking' |
  'ended' | 'error' | 'destroyed';
export interface RudimentInfo {
  readonly name: RudimentName;
  readonly description: string;
  readonly periodPips: number;
  readonly dimensions: 1 | 2 | 3;
  /** Internal order in this pinned catalogue, not a stable cross-version ID. */
  readonly index: number;
}
export interface RudimentFrame {
  readonly id: string;
  readonly root: Element;
  readonly target: Element;
  readonly audio: HTMLAudioElement | null;
  readonly rudiment: RudimentName;
  readonly clock: 'page' | 'audio';
  readonly sourceBeats: number;
  readonly bpm: number;
  readonly rate: number;
  /** Wrapped integer pip; null for a neutral disabled/accessibility pose. */
  readonly pip: number | null;
  readonly positionPips: number | null;
  /** Continuous clock phase; positions themselves remain integer-pip samples. */
  readonly loopProgress: number;
  /** Loop duration at playbackRate=1, derived from page BPM and rudiment rate. */
  readonly durationMilliseconds: number;
  readonly offset: Offset3;
  /** Pixel-scaled offset for the default CSS renderer. */
  readonly position: Offset3;
  readonly reason: RudimentStatus | 'frame';
}
export interface RudimentOptions {
  readonly id: string;
  readonly rudiment: RudimentName;
  readonly target: Element | string;
  readonly root?: Element | string;
  readonly clock?: RudimentClock;
  readonly audio?: HTMLAudioElement | string;
  readonly rate?: number;
  readonly phasePips?: number;
  readonly amplitude?: number | Partial<Offset3>;
  readonly enabled?: boolean;
  readonly css?: boolean;
  readonly cssPrefix?: string;
  readonly offscreen?: boolean;
  readonly resetOnCue?: boolean | string;
  readonly renderEveryFrame?: boolean;
  readonly render?: (detail: RudimentFrame) => void;
}
export interface RudimentAnimationSnapshot {
  readonly id: string;
  readonly rudiment: RudimentName;
  readonly status: RudimentStatus;
  readonly enabled: boolean;
  readonly clock: RudimentClock;
  readonly rate: number;
  readonly phasePips: number;
  readonly destroyed: boolean;
  readonly loaded: boolean;
  readonly error: string | null;
  readonly updates: number;
  readonly pip: number | null;
  readonly sourceClock: 'page' | 'audio' | null;
  readonly position: Offset3 | null;
  readonly framePending: boolean;
}
export interface RudimentAnimation {
  readonly id: string;
  readonly ready: Promise<RudimentAnimation>;
  pause(): void;
  resume(): void;
  setEnabled(enabled: boolean): void;
  reset(): void;
  refresh(): void;
  snapshot(): RudimentAnimationSnapshot;
  destroy(): void;
  teardown(): void;
}
export interface RudimentApi {
  readonly version: '1.1.0';
  readonly upstreamVersion: string;
  readonly upstreamCommit: string;
  /** Total movements exposed by the pinned upstream DanceRudiments catalogue. */
  readonly sourceCatalogueCount: number;
  readonly pipsPerBeat: 64;
  readonly ticksPerBeat: 16;
  readonly pipsPerTick: 4;
  ready(): Promise<RudimentApi>;
  catalogue(): readonly RudimentInfo[];
  describe(name: string): RudimentInfo | null;
  sample(name: RudimentName, pip: number): Offset3;
  pipsFromTicks(ticks: number): number;
  pipsFromSeconds(seconds: number, bpm?: number): number;
  animate(options: RudimentOptions): RudimentAnimation;
  get(id: string): RudimentAnimation | null;
  snapshot(): Readonly<{ version: '1.1.0'; upstreamVersion: string; sourceCatalogueCount: number; loaded: boolean;
    error: string | null; framePending: boolean; instances: readonly RudimentAnimationSnapshot[] }>;
  destroyAll(): void;
}
declare global {
  interface Window {
    DanceMovesRudiments?: RudimentApi;
  }
  interface DocumentEventMap {
    'dance-moves-rudiments-ready': CustomEvent<{
      api: RudimentApi; version: string; upstreamVersion: string; upstreamCommit: string;
      sourceCatalogueCount: number;
    }>;
    'dance-moves-rudiments-error': CustomEvent<{ id: string | null; message: string }>;
  }
}
