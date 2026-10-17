# Optional variable-tempo maps from StemLab

DanceMoves 3.3 has a source-verified fixed-BPM offset (`stemlab.beat-alignment.v1`).
This addition introduces an **optional**, independent consumer of
`stemlab.beat-timeline.v1` exported by StemLab's Beat correction editor.
No existing EPK page is silently converted. The old constant tempo/offset
remains the default for pages without the opt-in switch.

## WordPress EPK Timing

1. In StemLab open an analysed track and the **Beat correction** panel.
   The original consensus beats are loaded at source sample-frame precision.
   Correct timing and mark Beat 1 explicitly, then select **Export Beat 1 + full
   beat timeline JSON**. Keep the full JSON; do not manually reduce it to BPM.
2. In DanceMoves EPK Timing select the exact **Analysed Master Audio** attachment
   for that StemLab analysis. SHA-256 must match the JSON's master identity.
3. Paste the JSON into **StemLab full beat timeline JSON**. Check **Use corrected
   variable-tempo beat map (optional)**. Save the page and check the status.
4. To revert to fixed BPM, *uncheck* the new option; the original BPM/offset
   metadata is retained. Clearing the JSON is not required.

The import enforces the 64-pip schema, up to 25,000 strictly increasing beats,
source frame bounds, a valid Beat 1 origin, detected-reference identity and
coherent derived timing/phase fields. The source audio bytes, not the filename or
page title, bind the map to the master. Save/revision and REST operations reject
invalid input before writing page metadata. A compact, whitelisted representation
is stored and localized, discarding arbitrary unknown fields/paths.

## JS / React / Next.js

```js
import {createDanceMoves,validateBeatTimeline,phasePipsAtSeconds,tempoAtSeconds} from '@kieransimkin/dancemoves';

const exportJson = JSON.parse(stemlabExportText);
const beatTimeline = validateBeatTimeline({...exportJson,
  source_url:'https://example.org/uploads/exact-master.mp3'},
  {requireSourceUrl:true});
const motion = createDanceMoves({root,bpm:120,beatTimeline});
await motion.ready;
const source=motion.playbackSource(master);
const state=motion.beatTimelineState(source);
const ticks=motion.sourceTick(source);   // actual variable beat phase: 16 ticks/beat
const localBpm=motion.tempoAt(source);  // BPM across current pair of beat anchors
const twoBeatMs=motion.durationMillisecondsAt(source,32);
```

`beatTimelineState` returns `applied`, `mode` and `status`; `sourceTick` is
fractional and exact at the integer beat frames. `currentTick({clock:'audio'})`,
beat/bar interval scheduling, playback pulses, sprite atlases and procedural
DanceRudiments all derive phase from that shared clock. Audio-derived effects
also receive local BPM. Page-only clocks do not use the track's irregular tempo.

The beat-phase interpolation is

```
source_frame = master_seconds * sample_rate
pip = 64 * (beat_left - origin_beat +
            (source_frame-frame_left)/(frame_right-frame_left) *
            (beat_right-beat_left))
ticks = pip / 4
local_bpm = 60 * sample_rate * (beat_right-beat_left)/(frame_right-frame_left)
```

The closest interval extrapolates before the first and after the last anchor.
This is *not* a new detected beat. Missing beat ordinals remain explicit and are
not reconstructed as audio onset evidence. The exported Beat 1 sync offset can
be fractional and is not rounded to integer ticks/pips.

Registered YouTube/video/excerpt transports are mapped to original master time
before beat-phase conversion; original `currentTime` and cue/LRC timestamps are
never changed. Raw captured DanceRudiments recordings retain their own original
clock: the variable-tempo option is for rhythmic procedural/page effects, not
silent time-warping or reinterpretation of a fixed-clock captured recording.

## Compatibility and limitations

The original `beat-alignment.v1` importer and all its prior validations remain
unchanged. Pages without the new checkbox use the old constant BPM/offset; a
configured map applies only when the playback source matches its verified master
URL. On a mismatched source the new map reports `source-mismatch` and does not
modify that player's phase. There is no unverified/fallback map.

CSS duration custom properties follow the local BPM interval for an active
master. For precise fractional phase, call `sourceTick()` or use the phase-bound
sprite, pulse and rudiment controllers rather than relying on independent,
free-running browser CSS animations. Variable tempo never rewrites the media,
lyric/cue, or master sample timeline. Legacy `durationMilliseconds(ticks)` and
page-only effects still use the nominal page BPM; opt-in audio effects can use
`durationMillisecondsAt(source,ticks)`.

This is a source patch, not a deployed WordPress update or published npm version.
Validate on real browser playback, seeking, excerpt switching, all affected
EPK styles and site accessibility controls before releasing/deploying.
