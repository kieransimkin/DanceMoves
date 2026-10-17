## Word lyrics and opt-in song collections

Per-word timing must remain independent of the existing per-line LRC and CUE
source-clock files; no beat-map correction may rewrite lyric timestamps. Source
formats are StemLab words.tsv, JSON words and word LRC; parsers reject malformed,
oversized or unsorted data. Single-song pages must retain their old EPK Timing
fields. Multi-song Pages must validate every master and timing attachment and
bind every beat-map hash to that song's own master. Exactly one selected song owns
rhythmic animation at once; previous mounts, callbacks, listeners and timers must
be released on selection changes. No music or weights are copied into this repo.
Do not confuse successful source tests with public WordPress deployment or audible
browser QA. Rebuild shared library + WordPress ZIP from the canonical modules.
