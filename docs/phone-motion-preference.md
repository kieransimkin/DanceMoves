# Remembering phone motion across pages

DanceMoves stores the visitor's phone-motion choice under
`dancemoves:phone-motion:v1` in same-origin local storage. The values are
`enabled` and `disabled`; no sensor readings or browser permission tokens are
stored. A successful explicit enable saves `enabled`; the generic orientation
controller's `disable()` saves `disabled`. Destroying a mount does not erase the
choice. If storage is unavailable, the current page remains usable.

On subsequent WordPress EPK pages that already have a supported orientation
adapter, an enabled choice restores the sensor listener without invoking
`requestPermission()`. Usable finite beta/gamma readings establish active motion
and remove the enable button. If readings do not arrive, the button remains
usable after the existing 3.5-second availability check. Only a button click can
request permission. A denied request stops listening and records disabled.
Pages without a tilt adapter do not acquire a new effect.

The reusable `createOrientation()` controller follows the same stored choice.
Its `enabled` and `listening` snapshot fields describe local intent/listener
state, not verified browser permission or sensor delivery. Applications retain
ownership of their enable UI. Reduced motion, forced colours and hidden-page
handling remain authoritative for that controller.

This works with ordinary full-document navigation. It does not introduce a
router, fetch page markup, record motion, or make permission permanent. Browser
session expiry can require another explicit enable gesture. Storage and browser
permission are scoped by origin; different schemes, hosts or ports do not share
the preference.

## Verification

- `node tests/runtime.test.cjs` exercises the WordPress-compatible adapter.
- `node --test --test-isolation=none tests/shared/orientation-preference.test.mjs`
  exercises the reusable controller and inaccessible storage.
- After building, `node tests/shared/orientation-navigation-browser.mjs` uses
  real document navigation in headless Edge with explicitly simulated sensor
  and permission inputs. It records evidence in `.build/browser-evidence/` and
  runs as a CI/release gate. Linux uses the installed Playwright Chromium;
  Windows defaults to Edge. Override with `DANCEMOVES_BROWSER_CHANNEL` when needed.
- On physical iPhone Safari, enable once, move the phone, follow a same-origin
  link to another tilt-enabled EPK, and confirm motion resumes. Then exercise
  browser-session expiry, denial, reduced motion, background/foreground and
  back/forward. A desktop simulation cannot establish actual Safari permission
  persistence.

## Potential problems

Local loopback harnesses must set `ksEpkOrientationConfig.harness=true`. In
3.1.10 and later this bypasses both the mobile/sensor gate and the real
permission-control branch on `localhost`/`127.0.0.1`, allowing synthetic
orientation samples to reach the production adapter. It does not bypass
permission or device checks on any non-loopback origin and does not count as a
physical-device acceptance result.

### Every page shows the enable button although permission may still exist

- Symptom: the old runtime selected the enable-button-only path whenever
  `requestPermission` existed, rather than trying an already opted-in listener.
- Correction: persist visitor intent; restore listening without a permission
  call; require usable sensor readings before declaring active; retain the
  gesture-driven permission control when readings are absent.
- Verified 3 October 2026: automated adapter/controller cases and real Edge
  full-document navigation passed. Physical Safari and public deployment remain
  unverified in this record.
- Research checked 3 October 2026: [WebKit's same-origin session reuse fix](https://bugs.webkit.org/show_bug.cgi?id=197750)
  and [MDN permission API](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).
  The historical WebKit fix supports this design; it is not a current-device
  test or a promise about every browser.

### The local build or TypeScript gate cannot spawn its worker

- Symptom: Node 24.16.0/esbuild-wasm 0.28.2 reported `spawn EPERM`; the sandboxed
  TypeScript subprocess returned null status and the export test asserted
  `null !== 0`.
- Correction: use the existing narrowly scoped approved unsandboxed build/test
  route. Do not alter code or suppress the TypeScript test for this condition.
- Verification: local build completed and all 87 shared tests passed outside
  the worker restriction; the focused adapter/core/scheduler tests also passed.
- Corroborating report checked 3 October 2026:
  [Codex Windows worker restriction](https://github.com/openai/codex/issues/35070).
  This is internal machine guidance, not adopter-facing troubleshooting.
