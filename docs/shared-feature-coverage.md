# Feature coverage and execution boundaries

No original browser engine is reimplemented in WordPress or React. The shared
factory compiles the ten canonical engine/data files and retains the existing
CSS and admin source. This table is a feature map, not a claim that browser or
physical tests were executed in a restricted development environment.

| Feature | Shared entry/API | Demo/test coverage |
|---|---|---|
| BPM, ticks, duration quantization, boundaries | Main factory/core methods | Existing clock/scheduling/interval gallery; original core tests |
| CSS timing/control/lyric disclosure | Core properties + CSS | WordPress-style clock/shared timing demos; original CSS contracts |
| Named cues, intervals, DOM events, animation ownership | Core methods | React cue panel; original 23-page gallery and core contracts |
| Lyrics, clear entries, previous/next visible neighbours, master matching | Core + React useLyric | Canonical Arcadians player in both React apps; lyric payload and master demos |
| Pointer, playbackPulse, cueClass, cueTimeline, lyricStage, quality | `runtime.effects` | React panels, actual transformed-registry tests, original effects/timeline tests and lyric-stage lifecycle contract |
| Catalogue CSS adoption | `catalogue:true` | Original catalogue demo now imports the module; original source test |
| All nine named orientation adapters | `orientation.adapter`, orientationCore | All nine original gallery layouts retained; original adapter/scheduler tests |
| Generic orientation and recorder | `createOrientation`, `createRecorder` | React permission/capture panels; lifecycle/server tests; real-device permission still manual |
| Clay cover/lights/particles/quality/native background | `clay:true`, getClay/getClayRudiment | React Clay panel, original Clay contracts and native adapter tests |
| Paper planes | `effect:'paper-planes'` | React/Next plane panel using the shipped atlas; original flight tests |
| All 15 native patterns and custom render callbacks | `runtime.rudiments` | React 15-motion grid; original Canvas/clock demos; actual WASM tests |
| Diagnostic attribution and lifetime inspection | diagnostic sink, resources/on/destroy | Original diagnostic demo, React inspect/unmount controls, scope tests |
| Page metadata and validation/revisions | Config exports, PageMetadataEditor, memory store | React metadata panel; server config tests; PHP's original native storage kept |
| Timing upload validation | `/server.validateTimingFile` | Strict UTF-8/order/extension/clear-line tests; PHP validation retained |
| Signed MP3 downloads | `/server.createDownloadService` | Actual temp-file GET/HEAD/path/signature tests and Next route smoke |
| Private capture HTTP handling | `/server.createCaptureHandler` | Auth/origin/body/storage/rate tests, Next private-file route, original PHP posts retained |
| SSR/Strict Mode and independent roots | createScope + React hooks | ESM/CJS/React SSR tests, actual Chromium mount/unmount tests, focused resource tests |
| No duplicate WordPress frontend | PHP aliases + shared build | PHP queue test; ZIP builder's byte equality and two-JS invariant |
| npm/web/WordPress release pipeline | CI/release workflows | Version/lock/checksum gates and idempotent publisher scripts |

The React/Next gallery reuses one React implementation and one Arcadians media
set. The 23 original workbench pages remain separately addressable but now load
the module rather than raw plugin scripts. A simulated metadata/HTTP demo is
not evidence of real WordPress capabilities, and synthetic sensor data is not
physical-device performance evidence.
