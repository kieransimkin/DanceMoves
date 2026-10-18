# Feature coverage and execution boundaries

No original browser engine is reimplemented in WordPress or React. The shared
factory compiles the ten canonical engine/data files and retains the existing
CSS and admin source. This table is a feature map, not a claim that browser or
physical tests were executed in a restricted development environment.

| Feature | Shared entry/API | Demo/test coverage |
|---|---|---|
| Child watch-page playback | `publishPlayback`, `receiveChildPlayback`, low-level receiver/publisher | Origin/session/state and lifecycle contracts; standalone/modal synthetic-media browser example |
| BPM, ticks, duration quantization, boundaries | Main factory/core methods | Existing clock/scheduling/interval gallery; original core tests |
| CSS timing/control/lyric disclosure | Core properties + CSS | WordPress-style clock/shared timing demos; original CSS contracts |
| Named cues, intervals, DOM events, animation ownership | Core methods | React cue panel; original 23-page gallery and core contracts |
| Lyrics, clear entries, previous/next visible neighbours, master matching | Core + React useLyric | Canonical Arcadians player in both React apps; lyric payload and master demos |
| Pointer, playbackPulse, cueClass, cueTimeline, spritePlayback, lyricStage, quality | `runtime.effects` | React panels, transformed-registry tests, original effects/timeline tests, lyric-stage lifecycle contract and sprite media-clock/lifecycle contract |
| Catalogue CSS adoption | `catalogue:true` | Original catalogue demo now imports the module; original source test |
| All ten named orientation adapters | `orientation.adapter`, orientationCore | All ten registered gallery layouts retained; adapter/scheduler tests and release-local harness contracts |
| Generic orientation and recorder | `createOrientation`, `createRecorder` | React permission/capture panels; lifecycle/server tests; real-device permission still manual |
| Retained Clay cover/lights/particles/quality | `clay:true`, getClay | React Clay panel and original Clay contracts |
| Paper planes | `effect:'paper-planes'` | React/Next plane panel using the shipped atlas; original flight tests |
| All 15 selected native patterns and custom render callbacks | `runtime.rudiments` | React 15-motion grid; generic Canvas/clock demos; actual WASM tests |
| Complete 222-view FrameRudiments catalogue | `runtime.visualisers`, catalogue/style exports | Renderer contracts, source/clock/lifecycle tests and browser gallery; 138 modes require saved Fourier calibration, with three music modes optionally using it |
| 52 sprite views and 17 pinned atlas themes | `visualisers.animate`, `SPRITE_THEMES`, `SPRITE_ATLASES` | Sprite layout/appearance and PNG-integrity tests; lazy page-scoped image ownership and bounded caches |
| Six CPU solid/music views | `visualisers.animate` with `solid`/`music` style families | Deterministic depth/shading, FFT terrain, render reports and raster-budget tests; explicit CPU backend contract |
| Page and per-song visualiser configuration | PageConfig, `[dance_moves_visualiser]`, Song collection fields | Seven PHP metadata controls and REST validation; source isolation, sprite theme/FFT/deformation options and host-derived asset directory |
| Original ten spectrum views | `runtime.spectrum`, `[dance_moves_spectrum]` | Existing API/metadata compatibility and recording resource sharing with general visualisers |
| Diagnostic attribution and lifetime inspection | diagnostic sink, resources/on/destroy | Original diagnostic demo, React inspect/unmount controls, scope tests |
| Page metadata and validation/revisions | Config exports, PageMetadataEditor, memory store | React metadata panel; server config tests; PHP's original native storage kept |
| Timing upload validation | `/server.validateTimingFile` | Strict UTF-8/order/extension/clear-line tests; PHP validation retained |
| Signed MP3 downloads | `/server.createDownloadService` | Actual temp-file GET/HEAD/path/signature tests and Next route smoke |
| Private capture HTTP handling | `/server.createCaptureHandler` | Auth/origin/body/storage/rate tests, Next private-file route, original PHP posts retained |
| SSR/Strict Mode and independent roots | createScope + React hooks | ESM/CJS/React SSR tests, actual Chromium mount/unmount tests, focused resource tests |
| No duplicate WordPress frontend | PHP aliases + shared build | PHP queue test; ZIP builder's byte equality and two-JS invariant |
| npm/web/WordPress release pipeline | CI/release workflows | Version/lock/checksum gates and idempotent publisher scripts |

See the [complete visualiser guide](rudiment-visualisers.md) for the renderer
catalogue, source requirements, style schemas and CPU rendering limits, and the
[WordPress guide](wordpress-shared-runtime.md) for editor controls. Recording
references and immutable atlas metadata do not load payloads at import time;
only the mounted page or selected song owns its recording and image resources.

The React/Next gallery reuses one React implementation and one Arcadians media
set. The 23 original workbench pages remain separately addressable but now load
the module rather than raw plugin scripts. A simulated metadata/HTTP demo is
not evidence of real WordPress capabilities, and synthetic sensor data is not
physical-device performance evidence.
