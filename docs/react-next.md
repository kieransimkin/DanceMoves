# React and Next.js

The React entry is optional and starts with `"use client"`. Neither the main
entry nor the hooks create a browser runtime during module import/server render.
The hooks call the same shared `createDanceMoves` factory and dispose it on
unmount. There is no React-only animation engine.

## A React component

```jsx
'use client';
import {useMemo, useRef} from 'react';
import {useDanceMoves, useRudiment, useLyric} from '@kieransimkin/dancemoves/react';
import '@kieransimkin/dancemoves/styles.css';

export default function ArcadiansPlayer() {
  const root = useRef(null);
  const target = useRef(null);
  const config = useMemo(() => ({
    bpm: 145,
    lyricTimingUrl: '/media/canonical-lyric-timing.lrc',
    cueTimingUrl: '/media/sections.cue',
    masterDurationMilliseconds: 273604.558
  }), []);
  const motion = useMemo(() => ({
    id: 'arcadians:sway', rudiment: 'sway', clock: 'audio', audio: 'audio',
    amplitude: {x: 24, y: 12, z: 0}
  }), []);
  const {runtime, error} = useDanceMoves(root, config);
  const native = useRudiment(runtime, target, motion);
  const lyric = useLyric(runtime);
  return <section ref={root} className="ks-epk">
    <audio controls preload="metadata" src="/media/arcadians.mp3" />
    <div ref={target} className="drifting-art">Arcadians</div>
    <p>{lyric?.text || ''}</p>
    {(error || native.error) && <p role="alert">{(error || native.error).message}</p>}
  </section>;
}
```

```css
.drifting-art {
  translate: var(--dance-moves-rudiment-x, 0px)
             var(--dance-moves-rudiment-y, 0px);
}
```

Keep `config` and controller options stable with `useMemo`. New options deliberately
cause a destroy/remount so page clocks, media files and tempo are never partially
reconfigured. A ref must be attached when the effect runs. Remount the component
when its root changes; do not mount nested providers over the same subtree.

## Hook and component reference

| Export | Contract |
|---|---|
| `useDanceMoves(rootRef, options?)` | `{runtime, error}`; runtime is initially null during SSR/first render. Automatically creates and destroys the shared runtime. |
| `DanceMovesProvider({options, children, className, ...divProps})` | Owns one `div.ks-epk` and exposes the hook result through context. |
| `useDanceMovesContext()` | Returns that context; throws outside a provider. |
| `useCue(runtime, name, callback)` | Subscribes/unsubscribes canonical cues; callback ref keeps the latest closure without recreating subscriptions. |
| `useLyric(runtime)` | Current lyric payload or null. Clears on player pause/end/seeking as well as canonical blank cues. |
| `useRudiment(runtime, targetRef, options)` | `{controller,error}`; owns one native animation and destroys it on dependency changes/unmount. |
| `Rudiment({runtime, options, children, ...divProps})` | Div wrapper using `useRudiment`. CSS consumes its scoped native output. |
| `PageMetadataEditor({value,onSave})` | Controlled host-neutral BPM, timing URLs, duration, popup and effect editor. Validates before calling `onSave`; persistence/auth are not supplied by a browser form. |

The provider does not inject audio, attach an automatic upload endpoint or
replace your application's router. Keep event subscriptions and custom renderer
writes inside effects with cleanup. Development Strict Mode is supported, not
disabled to hide duplicate initialization.

## Next.js App Router

Import global DanceMoves CSS in `app/layout.jsx`. Put the player/hooks inside a
Client Component. The shared `/server` entry belongs only in Server Components,
route handlers or other server-only modules. The download secret must never be
named `NEXT_PUBLIC_*` or passed to a Client Component.

The included `examples/next` app imports `examples/react/App.jsx`; there is one
React demonstration implementation, not a copy maintained in both apps. The
repository root supplies the local package exports and a single React install.
`tools/run-next.mjs` runs Next in that app directory. Do not `npm install` a
second copy of the library inside the demo app.

The production download/capture examples are Node route handlers:

```js
// app/api/download/route.js
import path from 'node:path';
import {createDownloadService} from '@kieransimkin/dancemoves/server';
export const runtime = 'nodejs';
const downloads = createDownloadService({
  rootDirectory: path.resolve(process.cwd(), 'public/media'),
  origin: process.env.DANCEMOVES_ORIGIN,
  secret: process.env.DANCEMOVES_DOWNLOAD_SECRET
});
export const GET = request => downloads.handle(request);
export const HEAD = request => downloads.handle(request);
```

Sign the known, allowed filename in a Server Component and pass only the signed
URL to the player. Do not expose an unauthenticated public endpoint that signs
arbitrary filenames. The capture example requires a separate key and private
folder outside `public/`; its single-process limiter is for demonstration.
Replace it with application sessions, capabilities and a shared limiter for
production replicas. Filesystem persistence is unsuitable for read-only or
stateless hosting; provide a durable private database/object-store callback.

## Run the Arcadians demos

From the repository root after applying the patch:

```sh
npm install --ignore-scripts
npm run build
npm run demo:prepare
npm run demo:react
```

Open `http://127.0.0.1:4173/`. The media preparer downloads the hash-pinned Arcadians
MP3 and artwork from StemLab; it never generates a substitute. Existing canonical
LRC and section data are reused. A local StemLab checkout can be supplied through
`python tools/prepare-app-demos.py --stemlab-root ../stemlab`.

The React gallery has panels for all native motions, pointer mapping, playback
pulse, named cues, cue timeline, quality, generic phone orientation, Clay, planes,
metadata/revisions and private capture. Every panel uses the same Arcadians
player. Chapter buttons, playback rate, canonical lyrics, lifetime inspection,
and runtime unmount/remount controls are shared. Camera/sensor parity and
physical performance are not simulated as proof of real-device behaviour.

For Next.js:

```sh
npm run demo:next
```

Open `http://localhost:3000/`. Copy `examples/next/.env.example` to
`examples/next/.env.local` and set your own server-only secrets to enable signed
downloads/captures. Use at least 32 bytes of unpredictable secret material;
example test values in the automated tests are not production secrets.
Without configuration those server features are disabled/reject requests, not
silently backed by a public token. The song still plays via its ordinary media URL.

The existing 23-page WordPress-style gallery also imports `/lib/index.mjs` now:

```sh
python tools/serve-wordpress-examples.py
```

Open `http://127.0.0.1:8765/examples/wordpress/`. It retains all nine legacy
orientation mappings, all 23 core methods, the catalogue and diagnostic workbench,
all 15 native motions, HTTP simulations and page metadata inspectors. Those
simulated PHP/HTTP behaviours are labelled; the frontend module is real.

## Tests and production builds

```sh
npm test
npm run test:legacy
npx playwright-core install --with-deps chromium
npm run test:browser
npm run test:next
npm run test:next:smoke
```

`npm test` includes real ESM/CJS imports and React server rendering after a build.
Browser tests use the real React bundle, actual WASM and canonical MP3, check
chapter seeking, feature mounts, cue effects, Strict Mode disposal/remount and
capture a reduced-motion screenshot. The Next smoke test starts the actual
production build and exercises server rendering, signed HEAD downloads,
unauthenticated rejection and private capture persistence. Missing build/media
or browser prerequisites fail; they are not reported as passing skipped tests.

Desktop Chromium automation does not certify iOS permission prompts, Safari
pseudo-element animation behaviour, screen orientation or real device cadence.
Keep attended mobile/browser checks before deployment.

## CSP and accessibility

Serve the atlas and media as same-origin public assets unless CORS is deliberately
configured. Dynamic style elements can use the `nonce` mount option. The native
backend needs browser WebAssembly permission under the application's CSP; do not
turn on arbitrary JavaScript eval. Test actual CSP headers and fallback behaviour.
Avoid full-frame flashes or brightness/tint modulation. Honour reduced motion
and forced colours in custom callbacks as well as in the shipped CSS.
