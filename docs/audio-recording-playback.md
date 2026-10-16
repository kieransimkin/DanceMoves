# Audio-derived recording playback

DanceMoves 3.2.0 adds `runtime.recordings` for the bounded `dancerudiments.recording`
v1 JSON format exported by StemLab and DanceRudiments 0.3.0. Named native patterns
continue to loop at their own periods. Recordings retain their captured origin,
64-pip resolution, named dimensions and exact extent; they never wrap or interpolate.

```js
const recording = await runtime.recordings.load('/approved-motion.json');
const motion = runtime.recordings.animate({
  id: 'subject:recording', root, target, audio,
  recording,
  render({values, reason}) {
    // Map bounded native samples to the existing subject's appearance.
    // A CSSOM rule avoids high-frequency inline-style mutation observers.
    rule.style.setProperty('--subject-angle', `${values[0] * 6}deg`);
  }
});
await motion.ready;
motion.setEnabled(false); // neutral values, preserving the captured clock
motion.setEnabled(true);
motion.destroy();
```

The controller composes the existing native DanceMoves audio scheduler and its
shared-player mapping. Pause holds the source pose; seeking reconstructs it.
Reduced motion, forced colours and explicit disable output zeroes. Hidden and
offscreen subjects suspend through the existing lifecycle. Positions outside the
recording emit zeroes with `reason: 'outside-recording'`; seeking back into the
capture resumes its exact native sample. Runtime disposal destroys all recording
controllers, including pending native loads. Use `pause()`, `resume()`, `refresh()`,
`snapshot()`, `recordings.get(id)` and `recordings.snapshot()` for ownership and QA.

The recording BPM must match the authoritative runtime/page BPM. A controller
cannot override tempo, rate, phase or clock. BPM provenance and phase provenance
remain separate. The page's WordPress EPK Timing metadata remains the only source
for lyric/cue attachments; a movement recording never replaces those fields.
Use the exact track/master, same-clock stem provenance and original capture origin.
StemLab owns separation, filtering and smoothing; this player performs no DSP.
All smoothing variants should use a fixed reference scale for a fair comparison.

The sampler is the official native C++/WebAssembly accessor from DanceRudiments
0.3.0. There is no JavaScript movement fallback. Its embedded binary SHA-256 is
`d4cd976156860aa7a5c9665b27d2fda3cf6a0fa0da3dc0b9df365e425f1c6e29`, built from
upstream `include/dancerudiments/recording_view.hpp` SHA-256
`19dd73a150a82c4d9074fe4b9ba4c2f09d41e206028a6a6dc922d94e00dc4b8d` and
`tools/recording_wasm.cpp` SHA-256
`f4713cc7c773fa065715383fc68dccd91398fff08cd89167c5f24e64c0cecea9`.
See the [upstream recording contract](https://github.com/kieransimkin/DanceRudiments/blob/v0.3.0/docs/recordings.md).
The existing bundled named catalogue and its separate version are unchanged.

Inputs are limited to 64 MiB JSON, 8,388,608 finite values in [-1,1], 1..64 unique
named dimensions and signed 32-bit integer pip bounds. Loading fails closed for
bad UTF-8, schema, samples, HTTP responses, mismatched BPM or unavailable WASM.
Treat `ready` rejection as an unavailable motion state and retain static content.
These source/build changes do not deploy a WordPress plugin or page.
