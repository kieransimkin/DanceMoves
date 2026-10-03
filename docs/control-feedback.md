# Motion permission control feedback

The phone-motion permission button has a gentle yellow outer glow and emits a
short shower of gold sparks when activated by pointer or keyboard. Permission
requests still occur in the original user gesture. Decorative failures do not
block authorization, and a burst survives removal of a successfully activated
control until its finite fade completes.

The page-agnostic `orientationCore.createControlFeedback(window, button, {color})`
helper owns the burst, cleanup and reusable attention class. It acquires no
sensor data and requests no permissions. Call `destroy()` when its owner is
destroyed; `clear()` stops a burst without removing the attention treatment.

## Bounds and lifecycle

- The idle glow animates opacity from 0.18 to 0.5 over 3.2 seconds. Its two soft
  shadows are static; button padding and dimensions do not animate. The fixed
  control reserves 2rem at the left/bottom edges for its shadow falloff.
- A click replaces any previous burst with 18 nodes, animated only by browser
  transforms and opacity. No JavaScript frame loop, canvas or viewport overlay.
- Sparks extend at most 84px horizontally, 104px upward and 51px downward from
  the control centre, plus their small painted extents. Centres are clamped 12px
  inside viewport edges. Their longest lifetime is 1,120ms; terminal nodes are
  removed. Hidden pages, reduced motion and teardown clear active feedback.
- Reduced motion and forced colours suppress decorative effects. Sparks are
  aria-hidden, cannot receive focus and do not intercept clicks.

## Verification

`node tests/shared/control-feedback-browser.mjs` tests the compiled runtime in
Chromium/Edge with explicitly simulated permission/sensor inputs. It samples all
four screen corners at 390x844, 900x1100 and 1440x1000, including 4px spark-shadow
padding, keyboard permission dispatch, successful-control removal, terminal
cleanup, forced colours, reduced motion and destroy. It retains screenshots and
JSON under `.build/browser-evidence/control-feedback/`. Physical phone rendering
and full live-page performance remain separate acceptance checks.

## Potential problems

Cancelled Web Animations reject their `finished` promises. Handle cancellation
rejections and explicitly remove cancelled particles during cleanup; do not let
a decorative exception prevent a permission request. The regression checks
teardown without uncaught errors. MDN documents this cancellation behaviour:
https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel and
https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished
(accessed 4 October 2026).

Browser screenshot paths in a workspace containing spaces must use Node's
`fileURLToPath()`, not `URL.pathname`: the latter retains percent encoding and
can write to a different directory. The browser test uses the platform-aware
conversion and its screenshots were reread from the intended workspace path.
https://nodejs.org/download/release/v24.21.0/docs/api/url.html
(accessed 4 October 2026).
