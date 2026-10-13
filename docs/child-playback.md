# Playback from a child watch page

The parent EPK owns its timing metadata, master association and existing effect
controllers. A watch page owns its visible player. DanceMoves forwards the
child's actual playback state into the parent's shared player transport. It
does not forward cue labels, timing-file URLs, artwork or choreography.

```js
// Parent: mount the runtime and its effects before opening the modal.
// Register after the selected master duration is known.
const child = motion.receiveChildPlayback({
  iframe: document.querySelector('#watch-frame'),
  origin: location.origin,
  channel: 'watch-player',
  assetId: 'verified-published-video-id',
  master: document.querySelector('audio'),
  masterVerified: true,
  offset: 0, duration: 180
});
await child.ready;
// The existing motion.playbackSource(master) now follows the child.
// On modal close, dispose BEFORE removing the iframe:
child.teardown();
```

```js
// Child watch page: its real player is present on initial load.
// Standalone visits have no parent bridge or autoplay.
if (window.parent !== window) {
  const publisher = motion.publishPlayback({
    source: motion.playbackSource(master), // Native or registered YouTube transport.
    targetWindow: window.parent,
    origin: location.origin,
    channel: 'watch-player',
    assetId: 'verified-published-video-id'
  });
  // Dispose on route removal; runtime destruction also disposes the publisher.
}
```

The scoped receiver requires the shared `registerPlaybackProvider`/`playbackSource` API.
Both low-level `createPlaybackReceiver()` and `createPlaybackPublisher()` are
exported for composition outside a mounted runtime. Their `window` option is an
explicit browser Window; module import is safe during SSR.

Supply an exact HTTP(S) origin including its port, never `*` or an opaque
origin. Source Window, channel, asset ID, a fresh receiver session, monotonic
sequence and finite bounded numeric state are checked on both sides. The asset
ID is a caller-selected identity, not runtime proof of soundtrack provenance.
Each frame has one receiver and each explicit route has one publisher until
teardown; reuse their transports for additional effect consumers.
Preserve verified published player IDs, render/source hashes and master mappings
outside the runtime. Do not bind unrelated edits using equal titles/durations.

Playback state includes position, duration, rate, pause, seek, buffering, end and
error. Position updates are coalesced to four per second; transport changes
remain immediate. The receiver interpolates between samples for
at most 500 ms and stops a playing source after 1500 ms without data. The
`staleAfterMilliseconds` option accepts 750–10000 ms. Native media events can
arrive sooner. No independent cue/beat parser or animation scheduler is added.
After a stale connection, call `reconnect()` to start a fresh session and await
its returned readiness promise; late packets from a disconnected session cannot
restart it. `ready` exposes the current connection attempt.

Parent pause and seek commands reach the child; parent play is rejected unless
the publisher explicitly enables `allowPlayCommands:true`. Browser autoplay
policies still apply and play-command rejection is observable through the
returned promise. Registering, reconnecting and receiving state never starts
media. Use real visitor controls and preserve consent flows before registering
a YouTube iframe. The parent does not play a muted duplicate soundtrack.

For Escape inside the child document, enable `notifyEscape:true` on the
publisher and subscribe to the receiver player's `dismiss` event to close the
dialog. Explicit child close buttons may call `publisher.requestClose()`.
Fullscreen retains its native Escape behaviour. Cross-origin nested players
may keep keyboard events in their own document; keep a visible parent close
control and test the actual embed's keyboard behaviour separately.

Frame load, visibility suspension and page restoration rotate the session.
Closing/removing the frame, pagehide, stale data and teardown stop the remote
clock; teardown also asks the child to pause and removes timers/listeners.
`ready` rejects after ten seconds without valid metadata or when removed before
readiness. Catch readiness failures and show accurate availability. A ready
bridge does not prove public playback or Google classification.

The parent source retains existing reduced-motion, forced-colour, quality,
visibility, cue/seek reconciliation and cleanup policies. The modal adapter owns
only dialog focus, ordinary controls, the iframe and lifecycle calls. Keep a
normal crawlable watch-page link and a player visible on the standalone page.
The browser fixture uses original synthetic media and tests cross-document
playback, seek, rate, preferences and removal; it is not physical Safari or
phone performance evidence.

Protocol design follows [Window.postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).
