# DanceMoves live EPK motion timing conversion plan — 2026-08-31

## Outcome

All 47 published EPK URLs in `epk-page-timing-manifest-2026-08-31.json` were fetched signed out and returned HTTP 200. The audit inspected rendered inline CSS, inline element timing variables, inline JavaScript and linked styles/scripts. It found 17 release-specific motion systems, 29 pages with only the shared EPK control transitions, and one page with no release-scoped timed motion beyond shared infrastructure.

This is a read-only conversion plan. No WordPress page or plugin state was changed.

Exact evidence is retained in:

- `epk-motion-timing-audit-2026-08-31.json` — 860 page-inline motion signals, their source/selector/snippet and the linked-asset inventory.
- `epk-motion-timing-conversion-ledger-2026-08-31.tsv` — 1,105 findings plus header, including all 768 page-inline fixed-duration tokens, calculated ticks, quantized milliseconds, replacement properties and conversion recommendations.
- `../tools/audit-live-epk-motion.mjs` — repeatable signed-out audit tool.

## Conversion contract

- One DanceMoves tick is one sixteenth of a beat: `3750 / BPM` milliseconds.
- Round fixed visual durations to the nearest integer tick. If the result is more than 16 ticks, round to the nearest multiple of 16 ticks.
- CSS durations become `var(--dance-moves-Nt)`. JavaScript visual timers become `DanceMoves.durationMilliseconds(N)`.
- Negative CSS phase offsets remain negative tick offsets. Where a distinct negative property is not generated, use `calc(-1 * var(--dance-moves-Nt))` rather than a fixed time.
- A repeating animation that should begin with playback gets `data-dance-moves-start-interval="16" data-dance-moves-start-clock="audio"` for the next beat, or interval `64` for the next four-beat bar. JavaScript/class-driven starts use `DanceMoves.deferStart(...)`, `onNextBeat(...)`, `onNextBar(...)` or the general interval APIs.
- Register every page-owned animated root with `DanceMoves.registerAnimationScope(...)`. This makes the current cue-reset rule explicit and prevents unrelated WordPress/theme animations from resetting.
- Use `DanceMoves.onCue("NAME", handler)` for named musical events. Cue handlers update page state/classes; cue text never executes code.
- Pointer, touch, scroll, orientation and sensor sampling remain event-driven. Their CSS easing/release durations are converted, but their input sampling, rAF coalescing, availability timeouts and scroll/view timelines are not musical durations.
- `prefers-reduced-motion` overrides remain unchanged, including `none`, `0.01ms` and equivalent stop rules.

Current effective BPMs are page 130 = 85, page 243 = 132, page 252 = 116, and fallback 120 for the other 44 pages. Fallback conversions must be recalculated automatically if an evidence-backed BPM is later saved.

## Shared declarations on the catalogue

| Shared layer | Current timing | Conversion |
|---|---|---|
| Generic EPK buttons/downloads | `.25s` on 29 basic pages and several enhanced pages | 8 ticks at fallback 120; 9 ticks on page 243 at 132 BPM. Replace with the page-resolved DanceMoves property. Narrow `transition: .25s ease` to the properties actually animated. |
| Lyric disclosure chevron | `.2s` declaration is loaded catalogue-wide and applies where the disclosure exists | 6 ticks at 120/116, 5 ticks at 85, 7 ticks at 132. Convert in the shared lyric component once. Keep its reduced-motion `transition:none`. |
| WordPress/WPForms global CSS | `0.5s` and `0.15s` transitions are present in every rendered response | Do not migrate into DanceMoves: these are site/form UI rules, not EPK choreography. Narrowing `transition:all` belongs to the site/theme layer. |
| Device-orientation adapter | `var(--dance-moves-3t, 93.75ms)` transform/background interpolation | Already tick-based. Keep 30 ms sensor batching and 3.5 s availability detection time-based because they process input rather than define an effect duration. |
| DanceMoves core reduced-motion rule | `0.01ms` | Keep unchanged; it is an accessibility stop, not a one-tick animation. |
| Clay/Stars adapter | 6, 32, 128, 192, 432, 1584 and 2208 tick durations | Already migrated. Keep its wildcard cue handler and registered animation scope; replace the page body's overridden `14s` signal declaration when the page is next edited so source and computed style agree. |

## Every published EPK

“Shared controls” below means the generic `.25s` EPK control transition and the catalogue lyric disclosure transition where its element exists.

| Page | BPM | Live motion inventory and conversion |
|---|---:|---|
| 140 — Light Will Win (Shubh Diwali) | 120 fallback | Release-specific system; convert per detailed plan below. |
| 130 — Dying for a Diagnosis | 85 explicit | Release-specific system plus a separate v1.0.1 runtime; convert per detailed plan below. |
| 150 — Moderate or Good | 120 fallback | Release-specific weather/signal system; convert per detailed plan below. |
| 397 — Santa Flies Tonight | 120 fallback | Release-specific atmosphere, WebGL and canvas system; convert per detailed plan below. |
| 399 — Christmas Tat | 120 fallback | Release-specific title, ember, fuse and reveal system; convert per detailed plan below. |
| 243 — Presents & Chocolate | 132 explicit | Release-specific overlay/reveal system; convert per detailed plan below. |
| 246 — Fighting Entropy | 120 fallback | Release-specific city/rain system; convert per detailed plan below. |
| 248 — November Christmas | 120 fallback | Release-specific sheen/view-reveal system; convert per detailed plan below. |
| 250 — PBXin' | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 252 — Made from the clay and the stars (Anunnaki) | 116 explicit | DanceMoves adapter is already timed; reconcile the remaining page-inline declarations per detailed plan. |
| 254 — Blame Putin | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 256 — Paper dreams from the sky | 120 fallback | Shared controls plus one release-specific plane drift; convert per detailed plan below. |
| 258 — Silly Sausage Britain | 120 fallback | No release-scoped fixed motion found; shared lyric chevron `.2s → 6t` where present. |
| 260 — Arcadians | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 262 — Chips and Ketchup | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 264 — The Truth is a Virus | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 266 — Hit Piece | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 268 — Fully Nocturnal | 120 fallback | Release-specific pointer/lamp/route/audio system; convert per detailed plan below. |
| 270 — Amnesty, honestly? (Spanish Migrant Invasion) | 120 fallback | Release-specific rain/weather/3D system; convert per detailed plan below. |
| 272 — So you're a racist now, father? | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 274 — Bed of Lies | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 276 — Walk With Me | 120 fallback | Release-specific route/audio/tilt system; convert per detailed plan below. |
| 278 — Battling a Bin (Nigel Farage Vs Count BinFace) | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 280 — Fur Coat Taxi | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 282 — Tool of the State | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 284 — Wardialing | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 286 — They Listen | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 288 — I Don't Care (Restore Britain Anthem) | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 290 — On Top Of The World | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 292 — Gremlins | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 294 — Time is a gift | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 296 — Lost Girls | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 298 — Dmitri My Talisman | 120 fallback | Release-specific altar/orbit/portal/network system; convert per detailed plan below. |
| 300 — Edie Rose (feat. DarthTwisty101's Music) | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 302 — Vibe Killer | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 304 — Tarquin and the Hairy Biker | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 306 — Emerald Shooting Star | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`; retain its release-scoped reduced-motion overrides. |
| 308 — Faded Dreams | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 310 — We Don't Need No Room To Roll | 120 fallback | Release-specific garden/leaf/vine/lantern system; convert per detailed plan below. |
| 312 — Rupert Lowe for PM | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 314 — Parallel Life (feat. North Laine) | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 316 — Alfie | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 318 — Mouse Ali Bye Bye (موش علی بای بای) | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 320 — So Slow Down | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 322 — Return of Freedom (بازگشت آزادی) | 120 fallback | Shared controls only: `.25s → 8t`; lyric chevron `.2s → 6t`. |
| 137 — Birth Stories | 120 fallback | Release-specific organic field/living-lines system; convert per detailed plan below. |
| 614 — Hell Gondola | 120 fallback | Release-specific current drift plus shared controls; convert per detailed plan below. |

## Release-specific conversion details

### 140 — Light Will Win

- Repeating loops: hero beam `7.5s→240t`; rangoli spin/bloom `72s→2304t`, `14s→448t`; rangoli orbit `18s→576t`; cover rings `132s→4224t`, `108s→3456t`, `84s→2688t`, `156s→4992t`; portal halo/drift/breathe/core `64s→2048t`, `88s→2816t`, `90s→2880t`, `18s→576t`, `10s→320t`; path flare `1.9s→64t`; wave glow `.72s→16t`; portrait orbit `18s→576t`.
- Transitions: buttons `.2s→6t`; path height `.12s→4t`; reveal `.75s→32t`; wave bars `.16s→5t`; tilt `.3s→10t`.
- Keep scroll rAF, audio progress/currentTime and pointer tilt event-driven. Start audio-reactive wave/path loops with `onNextBeat` or `data-dance-moves-start-interval="16"`; use named cues for chapter/lyric events once a cue file exists.

### 130 — Dying for a Diagnosis

- Repeating/one-shot motion at 85 BPM: ambient `24s→544t`; metal pass `6.4s→144t` with `.6s→14t` delay; hold label `2.6s→64t`; hold sweep and heartbeat `3.6s→80t`; fallback cover `6s→144t`; art breathe `9s→208t`; preview hold `5.5s→128t`; stamp `.66s→15t`.
- Transitions: cover `.72/.7s→16t`; preview `.35s→8t`; art `.5s→11t`; cards `.28s→6t`; reveals `.74/.82s→16t`.
- The separate `dying-for-a-diagnosis-epk-motion-runtime` sets reveal delays `0/85/170/255ms→0/2/4/6t` and a visual stamp timeout `180ms→4t`. Move those into DanceMoves or a DanceMoves page adapter. Keep scroll rAF and audio state events event-driven.

### 150 — Moderate or Good

- Weather/signal loops: swells `14/19/24s→448/608/768t`; fog `28/36s→896/1152t`; carrier `10s→320t`; player scan `7s→224t`, playing `2.4s→80t`; phosphor `7.5s→240t`, playing `2.8s→96t`; carrier line `12s→384t`; route drift `18s→576t`; breaker `1.65s→48t`; foam `.7s→16t`.
- Player transition `.8s→32t`; cards/phosphor `.35s→11t`. Convert the inline `--delay` phase/stagger values individually; the exact set from `-14s` through `.24s` is in the TSV ledger.
- Preserve audio play-state detection. Register the weather/player root, start playback-only loops at the next beat, and prefer named cues over anonymous phase offsets when musical sections are known.

### 397 — Santa Flies Tonight

- CSS atmosphere `28s→896t`; buttons `.2s→6t`; art/frost easing `.34s→11t`.
- The fog and particle systems use rAF/WebGL/canvas time. Keep rendering on rAF, but derive intentional repeating oscillator phase from DanceMoves audio ticks rather than raw `now/1000`; register the animated canvas/root for cue reset. Pointer weather remains event-driven.

### 399 — Christmas Tat

- Title write `2.4s→80t` with `.35s→11t` start delay; ember rise `6.8s→224t`; per-ember delays convert to `6,96,160,48,144,32,112,192,64,160,192,96t` in DOM order.
- Gift controls `160ms→5t`; fuse width/position `120ms→4t`; progressive reveal `380ms→12t`.
- Keep smooth scrolling and timeupdate-based progress event-driven. Use `deferStart(...,64)` for the title if it should enter on a bar, and cue handlers for section-specific fuse/title state when a cue file becomes available. Do not convert reduced-motion `0.01ms` overrides.

### 243 — Presents & Chocolate

- At 132 BPM: star drift `9s→320t`; cover float `7.2s→256t` (playing override `8.5s→304t`); gold sweep `6.4s→224t`; action lights `3.6s→128t`; button glint `8s→288t`.
- Section hover `.35s→12t`; reveals `.72s→32t`; shared controls `.25s→9t`; lyric disclosure `.2s→7t`.
- The IntersectionObserver remains event-driven. Align the initial reveal with `onNextBeat`/`deferStart(16)` only when audio is playing; otherwise keep view entry immediate.

### 246 — Fighting Entropy

- City mist/light `24/31s→768/992t`; clouds `64/43s→2048/1376t`; tower windows `14/17/11/19s→448/544/352/608t` with negative phases `-9/-4/-13s→-288/-128/-416t`; rain `2.6s→80t`, foreground `1.5s→48t`.
- Cover easing `.18s→6t`; shared controls `.25s→8t`.
- Keep scroll and pointer rAF transforms event-driven. Register the city/rain root and use interval starts for automatic loops; keep the user motion-off pause authoritative.

### 248 — November Christmas

- Live sheen `18s→576t`; cover easing `.9s→32t`; shared controls `.25s→8t`.
- The `1ms` view-timeline reveal is a scroll-progress interpolation token, not an elapsed visual duration; keep it view-driven rather than turning it into one musical tick. Any later audio-led reveal should be a separate `deferStart` call.

### 252 — Made from the clay and the stars

- The active DanceMoves adapter already owns tick timing: cover reaction `6t`; button/particle releases `32t`; particle `128t`; sparkles `192t`; signal `432t`; clouds `1584t` and `2208t`; negative sparkle phase `-64t`.
- The page body still declares cover `180ms→6t`, signal `14s→432t`, controls `.25s→8t` and lyric disclosure `.2s→6t`. The adapter currently overrides the signal. Replace the page literals on the next approved page edit so live source and computed behavior match.
- Keep chapter `currentTime` seeking and timeupdate status event-driven. The wildcard `onCue("*")` handler is already active; add named handlers for the 19 canonical cues when specific page updates are designed.

### 256 — Paper dreams from the sky

- Plane drift `18s→576t`; shared controls `.25s→8t`; lyric disclosure `.2s→6t`.
- Register the plane root and start it at the next beat or bar during active audio. A cue handler can change flight state at named sections once cue timing exists.

### 268 — Fully Nocturnal

- Lamp `14s→448t`; audio meter `.9s→32t` with `-.07s→-2t` phase; pointer opacity `.45s→14t`; cover `.7s→16t`; buttons `.35/.3s→11/10t`; route `.7/.45/.4/.35s→16/14/13/11t`.
- Keep pointer magnetism, route selection, scroll and cover tilt event-driven. Register lamps/meter; start the audio meter at the next beat, and map named route/lighting changes to cues when available.

### 270 — Amnesty, honestly?

- Rain/weather loops `18s→576t`; rain layers `11/7.5/5.25s→352/240/176t`, with live overrides `16/12s→512/384t`.
- Cover/heading `.55/.65s→16t`; facts `.28s→9t`; weather reveal `.85s→32t`; shared controls `.25s→8t`.
- Pointer puddle/3D rAF remains event-driven. Register the rain/weather scope, align automatic precipitation at a beat/bar boundary, and use named cues for changes in weather intensity or civil-aid visual state.

### 276 — Walk With Me

- Route arrival `5.8s→192t`, secondary `6.6s→208t` with `.55s→16t` delay; playback route/audio loops `7.5s→240t`.
- Cover `180/300ms→6/10t`; buttons/miles `160ms→5t`; button/summary `180ms→6t`; lyric dawn `900/500ms→32/16t`; shared controls `.25s→8t`.
- The fallback visual reveal timeout `1400ms→48t`; replace it with `deferStart(route,64,{start:revealRoute})` if bar alignment is intended, or `DanceMoves.durationMilliseconds(48)` if it is only a visual fallback. Keep pointer tilt and audio play/pause state event-driven.

### 298 — Dmitri My Talisman

- Altar `7s→224t` with `-3.5s→-112t` phase; orbit `3.8s→128t`; portals `28/19s→896/608t`.
- Buttons/play `.25s→8t`; button/state/branch `.35s→11t`; state pseudo `.45s→14t`; reveal `.75s→32t`.
- Keep pointer-driven network canvas on rAF, but register the automatic altar/orbit/portal scope and derive any repeating canvas oscillator from audio ticks. Reduced-motion `.001ms` rules stay unchanged.

### 310 — We Don't Need No Room To Roll

- Environment loops: light `24s→768t`; mist `20s→640t`; lantern breathe `7s→224t`; leaf shadows `16/19s→512/608t`; vine growth `4.8s→160t`; vine delays `.18/.8/1s→6/32/32t`; lantern arrival `18.6s→592t`.
- The 60 inline wind-leaf variables contain durations `18–48s→576–1536t` and negative phases `-2s` through `-44s→-64t` through `-1408t`. Lantern glow durations `3.8–5.8s→128–192t` and phases `-.8s` through `-4.9s→-32t` through `-160t`. Every exact DOM value is enumerated in the TSV ledger.
- Replace fixed inline seconds with tick-valued custom properties generated from integer data attributes or set with DanceMoves. Register garden, vine and lantern roots. Start slow ambience on a bar; use cues for section-level wind/lantern changes.

### 137 — Birth Stories

- Organic/art/title loops: `28/34/38/14/18/16s→896/1088/1216/448/576/512t`; listening overrides `5.5/9s→176/288t`; quote/scar `12/18s→384/576t`; video frame `20s→640t`.
- Living lines: filament `22/31/11/13/4.1/4.9s→704/992/352/416/128/160t`; node `9s→288t`, `-3s→-96t`; listening filament/node `8/4.5/1.7/3.6s→256/144/48/112t`. Inline micro phases map from `-.8s→-32t` through `-5.3s→-176t` and are enumerated in the ledger.
- Transitions: page `.7s→16t`; controls `.25s→8t`; preview `.4s→13t`; links `.35s→11t`; living-lines opacity `.8s→32t`.
- Keep pointer and scroll rAF updates event-driven. Register the automatic organic/living-line scope; audio-play state may switch duration maps on the next beat to avoid mid-cycle phase jumps.

### 614 — Hell Gondola

- Current drift `22s→704t`; shared controls `.25s→8t`; page lyric chevron `.2s→6t`.
- Register the current layer and start it at the next bar during audio. Add named cue changes only after a canonical cue file exists.

## Cue and interval handler coverage

No page-inline named `DanceMoves.onCue(...)` registrations were found. The only live page adapter using the new cue API is the shared Clay/Stars adapter, which registers a wildcard handler on page 252. Page 252 is also the only catalogue page currently carrying a canonical cue file; therefore named musical updates for the other 46 pages are a design/data follow-up, not something that can be inferred safely from animation names.

Recommended attachment pattern for every migrated release-specific system:

```js
const removeIntro = DanceMoves.onCue('SECTION: INTRO', () => root.classList.add('is-intro'));
const removeNextBar = DanceMoves.onNextBar(() => root.classList.add('is-active'));
const removeBeat = DanceMoves.onEveryBeat(({ boundaryTick }) => updatePulse(boundaryTick));

// Lifecycle cleanup when the page adapter is removed or replaced.
removeIntro();
removeNextBar();
removeBeat();
```

Use one-shot interval handlers for delayed entrances and repeating handlers only for discrete page updates. CSS keyframe loops should use tick durations and an aligned start rather than a JavaScript callback every frame or every tick.

## Recommended migration order

1. Convert the shared generic EPK control and lyric disclosure components once; verify all 47 pages at 1440, 900 and 390 pixels and preserve reduced motion.
2. Reconcile page 252's remaining inline literals with its already-active DanceMoves adapter.
3. Fold the separate Dying for a Diagnosis runtime into a DanceMoves page adapter so there is one timing/cue owner.
4. Migrate audio-reactive systems: pages 150, 268, 276 and 137.
5. Migrate atmospheric/repeating systems: pages 140, 246, 270, 298, 310, 397, 399, 243, 248, 256 and 614.
6. For each page, establish or verify BPM first, stage the exact selectors and tick map, register the animation scope, test cue reset and interval removal, then publish only with page-specific approval and signed-out responsive QA.

## Phase 1 staging status

DanceMoves 2.1.0 now stages step 1 without changing WordPress:

- 29 neutral/basic EPK pages receive an 8-tick control transition limited to `background-color`, `color`, `transform` and `border-color`.
- The shared lyric disclosure receives 5 ticks on page 130, 7 ticks on page 243 and 6 ticks elsewhere.
- Both shared component families are registered as DanceMoves-owned animation scopes for cue resets.
- Release-specific transitions and animations are unchanged.
- The local rendered fixture passed computed timing at 120, 132 and 85 BPM and zero positive overflow at 1440, 900 and 390 pixels.
- Exact staged package: `../dist/DanceMoves-2.1.0.zip`, SHA-256 `154217540436505B640AF1E6AE1963D8D7553249DCDC76D292C80CB00E909FEA`.
- Staging receipt: `dance-moves-2.1.0-shared-timing-staging.json`.

Publication and persisted signed-out verification remain pending action-time approval.

## Phase 2 catalogue timing implementation staged

DanceMoves 2.2.0 completes shared CSS timing ownership for the 17 release-specific rendered systems without changing any WordPress page body:

- The adopter resolves each release's actual EPK root, including the seven legacy root families, and quantizes release-owned stylesheet, inline, computed and pseudo-element animation/transition durations and delays against the page BPM.
- Negative phase offsets retain their sign. Durations above 16 ticks follow the shared whole-beat quantizer. The page-248 view-timeline sentinel remains one millisecond.
- The whole EPK root is registered for cue resets, and a requestAnimationFrame-batched observer adopts dynamically inserted effect markup.
- `prefers-reduced-motion: reduce` clamps the owned subtree and pseudo-elements to one 0.01 ms iteration; this specifically closes the page-310 generated `garden-light-drift` gap found during live injection.
- Read-only main-world injection across the 17 systems and 1440, 900 and 390 pixel viewports produced 51 passing checks, 3,320 conversions in total, zero unquantized computed timing tokens and zero owned-root horizontal overflow.
- Exact staged package: `../dist/DanceMoves-2.2.0.zip`, SHA-256 `8051911EE03D4D3524440D9F62F4CD6731244FB29C7C0A2738C94B7B00065438`.
- Staging receipt: `dance-moves-2.2.0-catalogue-timing-staging.json`.
- Live-injection evidence: `../qa/catalogue-timing-live-injection-2026-08-31.json`.

This does not infer unavailable musical data. The 44 unknown-BPM pages continue to store no BPM property and use the labelled 120 fallback. Page 252 remains the only page with a canonical cue file, so release-specific named cue choreography is not invented elsewhere. Canvas/WebGL oscillators that derive phase from raw frame time remain page-adapter work and should use `DanceMoves.currentTick({ clock: "audio", audio })`; the CSS adopter cannot rewrite drawing or shader code safely.

WordPress publication and persisted signed-out verification remain pending exact-package action-time approval.

## Limits and unknowns

- The 44 fallback-120 pages do not have evidence-backed tempo values. Their tick numbers are executable fallback conversions, not claims about the mastered tracks.
- CSS selectors declared in the response may not match a visible element on every page; the ledger distinguishes declarations but does not claim every rule is active in every viewport/state.
- Canvas/WebGL shader internals cannot be fully classified by CSS scanning. Their rAF drivers are listed, and each needs page-specific runtime instrumentation before migration.
- Scroll/view timelines, pointer movement, device orientation and functional timers are intentionally not forced onto musical time.
- This audit did not change WordPress, add cue files, or invent named musical events.
