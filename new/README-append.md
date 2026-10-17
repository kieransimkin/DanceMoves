## Optional variable-tempo / corrected Beat 1 maps from StemLab

DanceMoves now accepts the **complete corrected beat map** exported by StemLab's
Beat correction editor (`stemlab.beat-timeline.v1`). Unlike the existing fixed-BPM
`beat-alignment.v1`, the map preserves every exact source sample frame, missing
or irregular beat, local BPM and the signed 64-pip Beat 1 offset. It is
**opt-in per page**: leave **Use corrected variable-tempo beat map** unchecked
and the existing fixed BPM, constant phase offset, cue clock, lyric timestamps,
and all other behaviour continue unchanged.

In WordPress **EPK Timing**, select **Analysed Master Audio**, paste the full
StemLab JSON into **StemLab full beat timeline JSON**, and explicitly enable the
checkbox. Its master SHA-256 is verified; the large export is normalised to
bounded authoritative beat anchors before storage/localisation. No additional
model, internet service or compulsory runtime is installed. Incorrect source
identity fails closed, and an invalid map cannot be saved over the previous
valid timing. The old **Beat alignment reading** field is retained separately.

The shared JS, React and Next.js API accepts `beatTimeline` with the same JSON
plus the verified `source_url`. `sourceTick()` and beat/bar scheduling interpolate
native fractional phase between edited anchors. `tempoAt()` exposes the local
BPM; `durationMillisecondsAt()` exposes beat-relative durations. Native
DanceRudiments callbacks, sprite playback, phase pulses and page CSS duration
variables follow changing BPM; page-only clocks remain fixed. Audio/recording,
lyric and cue timestamps remain in original master seconds. Registered excerpt
players are converted to master time *before* phase mapping.

See [variable-tempo integration, security, boundaries and examples](docs/variable-tempo.md).
