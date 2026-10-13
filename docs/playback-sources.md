# Audio, video and excerpt playback

One verified master can have several native audio/video and YouTube players.
`playbackSource(master)` returns a stable, event-driven transport. Existing
shared cues, lyrics, pulse, sprite, timeline and rudiment consumers resolve that
transport automatically when given its native master element. Page callbacks
that directly read a native element must instead read the returned transport.
The visible native controls keep controlling their original element.

Register each additional player explicitly, after its master duration is known:

```js
const master = root.querySelector('audio');
const source = motion.playbackSource(master);
const full = motion.registerPlayer({master, player: root.querySelector('video'),
  masterVerified: true});
const short = motion.registerYouTube({master,
  iframe: root.querySelector('iframe'), masterVerified: true,
  offset: 48, duration: 20});
await short.ready;
// Player time 3 seconds is master time 51 seconds.
// Dispose before removing/replacing the player:
short.teardown();
```

A video-only page may pass one stable `{id, duration}` master reference instead
of a native element, using the verified recording identity and exact master
duration. This avoids adding or playing hidden audio. Reuse that reference for
all of the recording's players and pass `playbackSource(reference)` to its
effects. Registration joins the existing timing engine after runtime readiness.
WordPress still obtains its lyric/cue files exclusively from selected metadata.
If a native master is present but its metadata is still loading, include that
element as `element` in the reference. Its existing consumers keep the same
transport and the verified duration supplies the initial clock without waiting
for another media download. Conflicting or mismatched durations are rejected.

All values are seconds. `offset` is the start in the associated master,
`duration` is its contiguous excerpt length, and optional `playerStart` is the
point in the video where that soundtrack starts. Default offset/playerStart are
zero and default duration is the complete master. Negative, nonfinite, empty or
out-of-master windows are rejected. Preroll/postroll do not acquire a song clock.
This mapping describes a contiguous, unchanged-rate excerpt, not a mashup,
reordered edit or changed recording. Such media needs a separately verified
mapping and must not be falsely assigned to this master.

`masterVerified: true` is the caller's explicit provenance attestation. It is
never inferred from equal duration, similar titles or artwork. Preserve the
render/source hashes and exact published-player identity outside the runtime.
The top campaign video must use the exact release master as its soundtrack;
other full-master players share its clock, while distinct edits retain their
own identity. YouTube necessarily transcodes the upload: exactness here means
the supplied soundtrack and timing, not byte identity of YouTube's stream.

The first playing associated player pauses the prior associated player. It does
not secretly play muted duplicate audio. The source exposes master `currentTime`
and `duration`, actual playback state/rate, `activePlayer` and native `element`.
Mapped source seeks are clamped to the selected excerpt. Switching players
reconciles a seek without replaying skipped cues. Buffering pauses the source;
seek/rate/loop changes use the same existing effect lifecycle.

YouTube uses the official IFrame API, adds `enablejsapi=1` and the current origin,
and preserves an existing API-ready callback. Register after the visitor/consent
flow permits the iframe. Registration itself never requests autoplay. `ready`
rejects API/player failures or timeout. Always handle that promise and show an
accurate unavailable state. A successfully constructed player does not prove
playback or soundtrack identity. Test an advancing content timeline, controls,
pause, seek, rate, buffering, replay, visibility and teardown on real embeds.

Sampling runs only for the active, playing, visible YouTube source. Native
players use their events without a second scheduler. `teardown()` is idempotent;
runtime destruction releases registered owners. Shared effects retain their
reduced-motion, forced-colour, quality and visibility policies. Physical-device
performance still needs physical evidence.

Reference: [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference).
