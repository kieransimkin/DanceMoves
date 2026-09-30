# CSS and HTML contract

[Documentation index](../README.md) · [JavaScript](javascript.md) ·
[Adapters](adapters.md)

Current shared-library baseline: DanceMoves 3.0.5.
Sources: [core JavaScript](../../assets/dance-moves-core.js),
[core stylesheet](../../assets/dance-moves-core.css),
[catalogue adopter](../../assets/dance-moves-catalogue-timing.js),
[orientation JavaScript](../../assets/ks-epk-device-orientation.js),
[orientation stylesheet](../../assets/ks-epk-device-orientation.css),
[Clay/Stars JavaScript](../../assets/clay-stars-effects.js), and
[Clay/Stars stylesheet](../../assets/clay-stars-effects.css).

## Timing custom properties

The core writes these properties to `document.documentElement.style` during
initialisation. Time values have an `ms` suffix and six decimal places. They are
outputs of the page's boot-time BPM; changing a variable does not change the
JavaScript clock or persist WordPress metadata.

| Property | Value / availability |
| --- | --- |
| `--dance-moves-beat` | `60000 / bpm` milliseconds. |
| `--dance-moves-tick` | `3750 / bpm` milliseconds. |
| `--dance-moves-1t` through `--dance-moves-16t` | Duration of the corresponding integer tick count. All sixteen exist. |
| `--dance-moves-32t`, `--dance-moves-64t`, `--dance-moves-128t`, `--dance-moves-192t`, `--dance-moves-432t`, `--dance-moves-1584t`, `--dance-moves-2208t` | Additional predefined durations, processed by `durationMilliseconds()`. |
| `--dance-moves-neg-64t` | Negative duration of 64 ticks, for animation offsets. |
| `--dance-moves-lyric-disclosure-duration` | Duration of the quantised configured disclosure ticks; defaults to six ticks. |
| `--dance-moves-lyric-disclosure-ticks` | Corresponding unitless tick count. |
| `--dance-moves-shared-control-duration` | Written only when `sharedControlTicks > 0`; quantised tick duration. |
| `--dance-moves-shared-control-ticks` | Corresponding unitless tick count, under the same condition. |

There is no automatic property for an arbitrary count such as
`--dance-moves-48t`. A release may declare its own property using
`DanceMoves.durationMilliseconds(48)`, or use an appropriate expression based on
`--dance-moves-tick`. Preserve the integer-tick/long-duration quantisation rule.
The predefined names are not a guarantee that arbitrary CSS expressions or
JavaScript timers will be rewritten automatically.

```css
/* Release-owned selectors; retain this release's own keyframes and design. */
.example-epk .cover {
  transition: transform var(--dance-moves-8t) ease;
}
.example-epk .ambient {
  animation-duration: var(--dance-moves-64t);
  animation-delay: var(--dance-moves-neg-64t);
}
@media (prefers-reduced-motion: reduce) {
  .example-epk .cover { transition: none; }
  .example-epk .ambient { animation: none; }
}
```

## Declarative interval starts

| Attribute | Set by | Contract |
| --- | --- | --- |
| `data-dance-moves-start-interval` | Page author | Finite numeric interval of at least one tick. Core scans once during initialisation, then calls `deferStart()`. The interval is rounded to an integer, not to a whole-beat duration quantum. |
| `data-dance-moves-start-clock` | Page author | Literal `audio` chooses the active song; any other/missing value chooses the page clock. |
| `data-dance-moves-waiting="true"` | `deferStart()` | Scheduling state, removed when released. This attribute alone does not pause CSS animations. |
| `data-dance-moves-started="true"` | `deferStart()` | Marks the released start and removes the declarative CSS pause. |

```html
<div data-dance-moves-start-interval="16">Page-beat entrance</div>
<div data-dance-moves-start-interval="64"
     data-dance-moves-start-clock="audio">Song-bar entrance</div>
```

The stylesheet pauses the marked element and its `::before`/`::after` animations
until `data-dance-moves-started="true"`. It does not automatically pause all
unmarked descendants. At release, `deferStart()` rewinds and plays all animations
returned by the element's subtree animation query, then invokes an optional
`start` callback and dispatches bubbling `dance-moves-start` on the element.
It does not use the narrower cue-animation ownership filter for that rewind.

Invalid declarative intervals are skipped by JavaScript but their marker can
still match the CSS pause selector. Remove an invalid marker rather than leaving
an element permanently paused. Dynamically inserted markers require an explicit
`deferStart()` call. Cancelling a deferred start does not clean up its attributes;
the owning adapter must restore its intended DOM state.

## Shared controls and lyric disclosures

When the page's `sharedControlTicks` is positive, the core marks
`html[data-dance-moves-shared-controls="true"]`. On that page, `.ks-epk
.epk-button` and `.ks-epk .epk-download` receive important transitions for
`background-color, color, transform, border-color`, using the shared duration
and `ease`. This is a specific shared-control override, not a generic transition
registry. The configured page-ID list is in the [WordPress reference](wordpress.md).

`.ks-epk .ks-epk-lyrics-track summary span[aria-hidden]` receives an important
transform transition using the disclosure duration and `ease`. Both shared
control transitions and this disclosure transition are removed under reduced
motion. These rules affect existing markup; the plugin does not create the
player, downloads or complete lyric section.

## Timed lyric component

The core supplies one visual-only layer, appended directly to `document.body`:

```html
<div class="dance-moves-lyric-popover"
     aria-hidden="true"
     data-dance-moves-lyric-state="idle">
  <span class="dance-moves-lyric-popover__text"></span>
</div>
```

It is **not a descendant of the EPK root**. A selector such as
`.ks-epk .dance-moves-lyric-popover` will not match the generated layer. Use a
release-specific body/page selector or deliberately assign a release marker to
the component. Palette defaults are declared on the component itself, so override
these properties on a matching component selector, not only on an ancestor.

| Styling hook | Meaning |
| --- | --- |
| `.dance-moves-lyric-popover` | Fixed, non-interactive outer layer; neutral default `z-index: 9998`, safe-area-aware side/bottom offsets, six-tick opacity/transform transitions. |
| `.dance-moves-lyric-popover__text` | Actual text node container; neutral type, border, background, padding and wrapping. |
| `--dance-moves-lyric-bg` | Default `rgba(20, 20, 24, 0.94)` on the outer layer. |
| `--dance-moves-lyric-border` | Default `rgba(255, 255, 255, 0.28)` on the outer layer. |
| `--dance-moves-lyric-color` | Default `#fff` on the outer layer. |
| `data-dance-moves-lyric-state="active"` | Current text is nonblank during playback; visible treatment. |
| `data-dance-moves-lyric-state="idle"` | Initial, blank, paused or ended visual state; default opacity zero. |
| `data-dance-moves-lyric-index` | Index of the last rendered lyric entry, including `-1` before the first entry. Not present before the first update. |
| `data-dance-moves-lyric-pulse="true"` | Removed and re-added on index changes to restart the text arrival animation. |
| `dance-moves-lyric-arrive` | Neutral six-tick arrival keyframe animation, attached to the text span while the pulse marker is present. |

Calling `DanceMovesEffects.lyricStage()` changes the interior to a shared
three-line structure while preserving the same popover:

```html
<div class="dance-moves-lyric-popover" data-dance-moves-lyric-stage="ready">
  <div class="dance-moves-lyric-stage__viewport">
    <div class="dance-moves-lyric-stage__track">
      <span class="dance-moves-lyric-stage__line dance-moves-lyric-stage__line--previous"></span>
      <span class="dance-moves-lyric-popover__text dance-moves-lyric-stage__line dance-moves-lyric-stage__line--current"></span>
      <span class="dance-moves-lyric-stage__line dance-moves-lyric-stage__line--next"></span>
    </div>
  </div>
</div>
```

The stage publishes `data-dance-moves-lyric-phase`, per-line
`data-dance-moves-lyric-slot` and `data-dance-moves-lyric-index`, plus the
`--dance-moves-lyric-progress` and `--dance-moves-lyric-stage-step` properties.
The neutral track moves only within the bounded lyric viewport. Reduced motion
and forced colours remove the travel transform while keeping the current text
readable; release CSS may change appearance but must preserve that fallback.

The default text block has a maximum width of `min(44rem, 100%)`, balanced centred
text and responsive font sizing. Reduced motion removes component animation,
transitions and transforms but keeps the words. Forced colours use `Canvas`,
`CanvasText`, a two-pixel border and no shadow.

For example, a **structural override**, not an approved song treatment, could
reserve space above a particular page's player:

```css
/* Substitute the actual owning page and its reviewed player clearance. */
body.page-id-252 .dance-moves-lyric-popover {
  bottom: max(6rem, env(safe-area-inset-bottom));
}
```

Do not use this example as approval to enable lyrics on page 252 or copy its
artwork/identity elsewhere. Follow the release-specific visual-language process
in the [guide](../guide.md). An override must preserve safe areas, narrow-screen
wrapping, real text, player clearance, reduced motion, forced colours and the
complete accessible lyric section.

The layer is `aria-hidden`, not a live region. The complete readable lyrics
remain the accessible source. Text is assigned with `textContent`; timing-file
content is never HTML. `onLyric()` and `dance-moves-lyric` run **before** that
frame's component update, so use their detail payload rather than expecting the
DOM to have already changed. Pause/end hide the visual layer without clearing
its text/index and without sending a blank lyric event. Custom renderers need
corresponding media lifecycle listeners.

Enabling pop-ups without usable lyric entries is not a supported publishing
workflow. Initialisation creates the layer only when entries exist, but a later
bound-audio tick can create an empty idle layer when the flag is enabled even
with an empty lyric list. Do not use mere layer existence as proof of successful
LRC loading.

## Core and catalogue DOM diagnostics

These are outputs for inspection, not writable configuration APIs. Attributes
use their HTML names below; JavaScript reads them through camel-cased `dataset`.

| Element | Attribute | Values / purpose |
| --- | --- | --- |
| `<html>` | `data-dance-moves-version` | Boot configuration version string. |
| `<html>` and first `.ks-epk` | `data-dance-moves-bpm` | Effective numeric BPM string. |
| `<html>` and first `.ks-epk` | `data-dance-moves-bpm-source` | `explicit` or `fallback`. |
| `<html>` | `data-dance-moves-shared-controls` | `true` when the shared-control override is enabled; otherwise absent. |
| First `.ks-epk` | `data-dance-moves-lyric-timing` | Resolved lyric URL, when configured. |
| First `.ks-epk` | `data-dance-moves-cue-timing` | Resolved cue URL, when configured. |
| `<html>` | `data-dance-moves-cue-count`, `data-dance-moves-lyric-count` | Parsed entry counts after both fetch promises settle. |
| `<html>` | `data-dance-moves-cue-status`, `data-dance-moves-lyric-status` | Final `ready` for nonempty lists, otherwise `none`; a fetch failure briefly writes `unavailable` but initialisation overwrites it. |
| Matching `<audio>` | `data-dance-moves-timing` | `master-length` once bound. |
| Designated `<audio>` | `data-dance-moves-master` | Author-supplied, presence-only candidate for duration inference when no master duration is supplied. |
| Catalogue EPK root | `data-dance-moves-catalogue-root` | `ready`. |
| Catalogue EPK root and `<html>` | `data-dance-moves-catalogue-timing` | `ready` after a conversion pass. |
| Catalogue EPK root | `data-dance-moves-catalogue-timing-conversions` | Retained evidence count, capped at 1,000; not necessarily all actual conversions. |
| Elements needing pseudo-element overrides | `data-dance-moves-timing-element` | Generated numeric selector identifier. |

The generated style element has ID `dance-moves-catalogue-pseudo-timing`.
Select the actual EPK root when auditing; a broad readiness selector can match
`<html>` first. Catalogue conversion covers owned timing declarations and
referenced variables, not arbitrary JavaScript, shaders or canvas phase logic.
Its reduced-motion rule clamps the owned root, descendants and pseudo-elements
to one `0.01ms` animation iteration, zero delay, `0.01ms` transitions, and
`scroll-behavior: auto`. See the [ownership caveats](adapters.md#what-gets-converted)
before assuming a broad stylesheet selector isolates the EPK from other elements.

## Orientation DOM state and release outputs

| Hook | Meaning |
| --- | --- |
| `.ks-epk-orientation-control` | Body-level permission/status button, with visible focus treatment, forced-colours fallback and safe-area positioning; hidden by reduced-motion CSS. |
| `data-ks-orientation` | On the adapter root: `supported` while reset/idle, `active` after a target commit. It is not an enum containing every permission failure. |
| `data-ks-orientation-adapter` | Configured adapter key or `detected`. |
| `data-ks-orientation-window` | Runtime mapping window: `2000` milliseconds. |
| `data-ks-orientation-target-ticks` | Target write cadence, normally `2`. |
| `data-ks-orientation-target-milliseconds` | Corresponding cadence, with three decimal places. |

The input lifecycle, page mapping and helper APIs are in the
[adapter reference](adapters.md#orientation-page-map). The following CSS outputs
belong to the named release; they are not a cross-release configuration contract.
The runtime writes/resets them, so direct manual changes may be overwritten.

| Adapter | Output location and properties |
| --- | --- |
| Light Will Win | Root `--lww-cover-x`, `--lww-cover-y`; selected cards `--lww-tilt-x`, `--lww-tilt-y`. |
| Dying for a Diagnosis | Cover `--cover-x`, `--cover-y`, `--cover-rotate`; parallax image gets an inline `transform`. |
| Presents & Chocolate | Root `--pc-sensor-x`, `--pc-sensor-y`, `--pc-sensor-rotate`. |
| Fully Nocturnal | Root `--fnx-shift-x`, `--fnx-shift-y`; cover `--fnx-card-x`, `--fnx-card-y`, `--fnx-card-shift-x`, `--fnx-card-shift-y`. |
| Amnesty, honestly? | Root `--epk-tilt-x`, `--epk-tilt-y`, `--epk-shift-x`, `--epk-shift-y`, `--epk-heading-x`, `--epk-heading-y`. |
| Walk With Me | Cover `--wwm-tilt-x`, `--wwm-tilt-y`, `--wwm-shift-x`, `--wwm-shift-y`, `--wwm-glow-x`, `--wwm-glow-y`. |
| Dmitri My Talisman | Root `--mx`, `--my`, `--parallax-x`, `--parallax-y`, `--tilt-x`, `--tilt-y`. |
| Clay/Stars | Delegates to `DanceMovesClayStars`; outputs below. |
| California Screamin' | Root `--cs-x`, `--cs-y`; reset writes `0`. |

Most active orientation targets transition `transform` over
`var(--dance-moves-2t, 62.5ms)` with the bundled easing. Light Will Win's hero
instead transitions `background-position`; therefore **not all existing
orientation CSS is compositor-only**. Device measurements, not a blanket claim,
are required for performance approval. Existing page CSS supplies the rest of
the artwork-specific transform composition.

## Clay/Stars DOM and styling state

The treatment is scoped to `.ks-clay-stars-v2`. The content filter can add
`.ks-warm-bloom`, `.ks-lens-flare`, `.ks-specular-sweep` inside the cover wrapper,
and `.ks-cloud-field` alongside the atmosphere layer. They are decorative,
`aria-hidden` elements; they are not shared artwork components.

| Hook | Meaning |
| --- | --- |
| `data-dance-moves-clay-runtime` | `ready` after initialisation, `stopped` after teardown. |
| `data-dance-moves-clay-lifecycle` | Last lifecycle label, such as `reset`, `hidden`, `visible`, `seeking`, `seeked` or `reduced-motion`. |
| `data-dance-moves-cue`, `data-dance-moves-cue-type` | Lowercased, whitespace-hyphenated cue state, removed on clear. |
| `data-dance-moves-performance` | `full`, `constrained` or `minimal`; controlled by the adaptive monitor. |
| `data-dance-moves-performance-reason` | Reason such as `initial`, `sustained-low-fps`, `low-fps-after-constrained`, `recovery-probe`, `recovery-probe-failed` or `recovery-confirmed`. |
| `--ks-master-intensity` | Root output of the enabled/intensity settings. |
| `--ks-particle-release-duration` | Root output of the configured release ticks. |
| `--ks-rx`, `--ks-ry` | Cover rotation targets in degrees. |
| `--ks-tx`, `--ks-ty` | Cover translation targets in pixels. |
| `--ks-bloom-x`, `--ks-bloom-y`, `--ks-flare-x`, `--ks-flare-y`, `--ks-spec-x`, `--ks-spec-y` | Cover-level light-plane translation targets in pixels. |
| `.ks-particle-release` | Transient control class during a captured-orbit release. |
| `--ks-orbit-release-opacity`, `--ks-orbit-release-transform` | Control-local captured pseudo-element state used during release, then removed. |

`constrained` and `minimal` stop the cloud, atmosphere and gold-sparkle ambient
loops while preserving static layers. `minimal` additionally removes filtering
and blending on the cloud/atmosphere planes. These markers do not imply that the
whole EPK or all interactions have stopped. Recovery can restore a higher tier;
see [performance behaviour](adapters.md#recoverable-claystars-performance-tiers).
The stylesheet's older comment about two poor windows is not the current
JavaScript default, which is three.

Reduced motion removes the non-essential treatment's animations/transitions;
forced colours hides decorative light/cloud planes and sparkle pseudo-elements
and simplifies shadows. Do not override these fallbacks with later high-specificity
release rules. Use `setParameters()` and the documented lifecycle rather than
manually forcing profile attributes while the monitor is running.


## Shared-effect and paper-plane outputs

The new primitives do not inherit the Clay/Stars appearance. See [effects.md](effects.md)
for full option/default and lifecycle contracts, and [paper-planes.md](paper-planes.md)
for the generated sprite DOM. All fields below are output state, not settings to
mutate instead of calling the corresponding API.

| Owner | Output | Meaning |
| --- | --- | --- |
| `pointer()` root | `--dance-moves-x`, `--dance-moves-y` | Four-decimal normalized input values; unitless. |
| `pointer()` root | `data-dance-moves-pointer` | Ready/active/reset reason. |
| `playbackPulse()` root | `--dance-moves-pulse-duration`, `--dance-moves-pulse-delay` | Default-prefix second-valued duration and negative phase; custom prefix allowed. |
| `playbackPulse()` root | `.dance-moves-playing`, `data-dance-moves-pulse` | Default playing class and inactive/paused/playing marker; class configurable. |
| `cueClass()` root | `.dance-moves-cue-active`, `data-dance-moves-cue-effect` | Default finite class and lifecycle reason; class configurable. |
| `cueTimeline()` root | `data-dance-moves-cue-timeline` | Last published render reason, not necessarily snapshot status. |
| `quality()` root | `data-dance-moves-quality`, `data-dance-moves-quality-reason` | Current tier and publish reason. |
| `quality()` root | `data-dance-moves-fps`, `data-dance-moves-reference-fps` | Last sample/reference as one-decimal strings. Not physical display-rate proof. |
| Paper stage | `data-quality`, `--paper-dreams-atlas` | Full/compact/static stage mode and atlas URL. |
| Paper plane | `data-depth`, `data-flight-state`, sprite/size/opacity properties | Per-plane visual state; see the dedicated table. |

Callbacks may still run when their effect is inactive; the consumer must provide
its own static rendering branch. The generic quality controller does not install
CSS reductions. Do not rely on writing a tier attribute to enforce reduced motion,
or assume forced-colour hiding always cancels a renderer's JavaScript loop.
