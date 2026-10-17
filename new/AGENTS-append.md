## Optional source-bound variable-tempo clocks

The StemLab beat-timeline.v1 consumer is explicitly opt-in, without disturbing
fixed-BPM beat-alignment.v1 or existing WordPress pages. `beats[].frame` and
`beats[].beat`, not rounded seconds, are authoritative; phase is piecewise
linear at 64 pips/beat and 16 DanceMoves ticks/beat. Verify SHA-256 of the
selected master and require strict monotonic sample frames/beat indices. Never
rewrite the source audio, cue/lyric timestamps or native recording capture clock.
Keep exact source-identity checks on excerpts, seeking and media switches;
failed identity must not result in guessed alignment. Disallow silent downgrade
to constant tempo when the map is enabled. Validate and sanitize user-imported
JSON before committing WordPress REST/admin metadata and use source-bound tests.
