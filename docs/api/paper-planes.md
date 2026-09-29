# Paper-plane effect API

[Documentation index](../README.md) · [Page metadata](wordpress.md#page-metadata) ·
[Shared primitives](effects.md) · [CSS/HTML](styling.md)

Sources: [JavaScript](../../assets/paper-dreams-flight.js),
[stylesheet](../../assets/paper-dreams-flight.css),
[PHP loading/configuration](../../kieran-epk-device-orientation.php).
Plugin baseline: **2.8.0 / `4cb6a71f60459b5579be87d7e55ac8b1426c578e`**.
The renderer's internal snapshot version remains **`2.6.3`**; that is not the
version of the installed DanceMoves plugin.

## Enable and supply the required DOM

Set the Page's **EPK Timing → Ambient effect → Paper planes**, which stores
`_dance_moves_effect = "paper-planes"`. The same field is revision-aware and
REST-exposed. `dance_moves_sanitize_effect()` allows only `"paper-planes"` or `""`;
blank, missing or invalid editor input clears it. Selection loads the
`dance-moves-paper-dreams` CSS/JS handle with `dance-moves-core` as a dependency.
The atlas is a bundled image, not a remote model or generated-on-demand asset.

The JS finds the first `.ks-epk` and its first `.epk-hero`; both must exist when
it executes. It returns without installation if either is absent or
`window.DanceMovesPaperDreams` already exists. It does not wait for later DOM
insertion, register a ready event, or create a hero/player.

```html
<main class="ks-epk" data-release="example-release">
  <section class="epk-hero">
    <div class="epk-heading"><h1>Example release</h1></div>
    <div class="epk-cover-wrap">Existing artwork</div>
  </section>
</main>
```

The renderer inserts an `aria-hidden="true"` `.paper-dreams-flight` stage as the
hero's first child. It is decorative and pointer-transparent. The JavaScript
activation is release-agnostic, but the shipped rule that establishes hero
`position:relative; isolation:isolate; overflow:hidden` is scoped to
`data-release="paper-dreams-from-the-sky"`. Another release must supply its own
hero containment; selecting the effect is not sufficient proof of correct bounds.

For the illustrative markup above, a page-owned containment rule is:

```css
.ks-epk[data-release="example-release"] .epk-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
```

The stage uses absolute inset bounds and z-index 2. Following siblings are made
positioned; following `.epk-cover-wrap` uses z-index 1 and `.epk-heading` z-index 3.
Audit player/control stacking explicitly; the stylesheet does not guarantee that
every arbitrary hero child is above the planes. On screens up to 760 px, its
stage inset starts 72 px from the top. Existing hero dimensions determine bounds.

## Boot configuration: window.danceMovesPaperDreamsConfig

PHP emits this before the JS. These are trusted boot values, **not** individually
editable settings in the WordPress sidebar or a runtime setter API.

| Key | WordPress value | Actual consumer behaviour |
| --- | --- | --- |
| `effect` | `"paper-planes"` | Emitted for identity; the JS does not inspect it. PHP has already gated loading. |
| `atlasUrl` | Plugin `assets/paper-dreams-plane-atlas.png` URL | Written into the stage's `--paper-dreams-atlas` CSS URL; no fetch/error API. |
| `planeCount` | `12` | Loop bound uses `Number(config.planeCount || 12)`. Not clamped to a hard maximum in JS; keep the shipped cap. |
| `compactPlaneCount` | `5` | Limits stepped planes in compact mode. Shipped CSS independently hides child 6 onward; changing only this number does not change that CSS cap. |
| `bpm` | Page-resolved BPM, fallback 120 | Used in page-clock conversion and snapshot. Keep it consistent with `DanceMoves.bpm`. |
| `effectBounds` | `"hero"` | Informational only; code always finds `.epk-hero`. It does not select a viewport mode or arbitrary selector. |

Zero/falsy counts fall back rather than disabling the effect. Arbitrary nonfinite,
negative, fractional or excessive boot values are not a supported tuning surface;
there is no robust public schema validator here. Use the Page effect field to
disable loading. The `planeCount` constant is a configured default, not an
unbreakable safety clamp.

## Rendering and lifecycle

Twelve pooled span nodes use a **6-column × 4-row atlas** and three depth profiles.
Plane selection uses `(index * 5) % 24`; no per-frame DOM insertion is required.
States cycle through `glide`, `climb`, `mush`, `stall`, `drop`, `recovery`, `swoop`
and back to glide, with bounded recycling outside the hero. Transform updates
include translation, pitch/roll-derived rotation and a scale-X squeeze. Two
sprite-local pseudo-elements supply bounded shutter echoes; no moving blur or
blend-mode field is added.

Geometry is cached from the hero and ResizeObserver, then passed once to the
plane loop. Integration delta is clamped to 0.05 seconds per frame. The ambient
phase reads `DanceMoves.currentTick({clock:"page"})`, not audio time, with a frame
clock fallback when the core is absent. **This is not a beat-triggered choreography
or a seek-reconstructable audio simulation**: physical flight state advances from
frame deltas, and phase conversion does not make every manoeuvre an integer-tick
duration. Do not apply the core CSS-duration rule as a false description of the
physics constants in this adapter.

A compact match is `(max-width: 760px), (update: slow)`; the first five planes are
stepped and later nodes are hidden by CSS. The stage's `data-quality` values are
`full`, `compact`, or `static`. These are distinct from the shared `quality()`
primitive and the Clay/Stars measured performance tiers.

The loop pauses for `document.hidden`, reduced motion and, when IntersectionObserver
is available, a hero outside its 120 px root margin. Without that observer,
offscreen pausing is unavailable. Visibility, reduced-motion and compact changes
call reconciliation. Returning to visibility resets the frame delta accumulator
but preserves plane state; hidden elapsed time is not replayed as flight motion.

Reduced motion stops the JavaScript loop and sets `static`. Although non-media
static rules describe three decorative sprites, the final reduced-motion CSS
hides **all** plane nodes and echoes with `!important`. Do not promise visible
static planes under that preference. Forced colours hides the entire stage using
CSS; the JS does not observe forced colours, so that preference alone does **not**
stop the loop. Audit CPU cost separately from visual hiding.

## Window API and snapshot

`window.DanceMovesPaperDreams` is installed after initial reconciliation. There
is one instance and no constructor/factory exposed for arbitrary multiple roots.
The object is not frozen; treat it as a handle, not a mutable configuration bag.

| Member | Type / behaviour |
| --- | --- |
| `root` | The generated `.paper-dreams-flight` stage element, **not** the enclosing `.ks-epk`. |
| `snapshot()` | Returns the object below; no historical frames retained. |
| `teardown()` | Returns `undefined`. Stops/cancels the loop, disconnects intersection/resize observers, removes media/visibility listeners and removes the generated stage. |

```text
{
  version: "2.6.3",          // adapter-local implementation marker
  planes: number,           // allocated nodes, normally 12 even in compact mode
  active: boolean,          // frame loop running
  quality: "full" | "compact" | "static",
  bpm: number,
  bounds: "hero",
  states: string[]          // one current state per allocated plane
}
```

There are no public `setParameters`, `setMotion`, `pause`, `resume`, `reset` or
`start` methods. Teardown does not delete `window.DanceMovesPaperDreams`; injecting
the script again encounters the existing-global guard. Prefer a fresh page load
for restart after teardown; do not claim disposal is a general remount facility.
There is no automatic teardown on root removal.

## Styling contract

These properties and attributes describe the generated DOM. They are useful for
release-owned CSS inspection, not promises of additional JavaScript setters.

| Surface | Meaning |
| --- | --- |
| `.paper-dreams-flight` | Contained, clipped, non-interactive decorative stage. |
| `.paper-dreams-flight__plane` | Pooled sprite; animated via inline `transform`. |
| `--paper-dreams-atlas` | Atlas background URL inherited from stage. |
| `--sprite-x`, `--sprite-y` | Per-node atlas-cell percentage positions. |
| `--plane-size`, `--plane-size-compact` | Per-depth normal/compact widths. |
| `--plane-opacity` | Per-depth opacity. |
| `--static-transform` | Precomputed decorative transform, overridden by final reduced-motion hiding. |
| `data-depth` | `0`, `1`, `2` depth layer. |
| `data-flight-state` | Flight state above; drop/recovery/swoop strengthen local echoes. |
| Stage `data-quality` | `full`, `compact`, `static`. |

Use the [preview](../../tests/paper-dreams-flight-preview.html) and
[contract](../../tests/paper-dreams-flight.test.cjs) for local checks. They do not
replace signed-out viewport, overflow, readability, offscreen/visibility,
accessibility and measured device-performance checks on the complete adopting EPK.
