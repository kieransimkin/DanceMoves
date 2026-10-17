## Optional StemLab edited tempo-map metadata

Two revision-enabled Page properties add an opt-in corrected clock:
`_dance_moves_beat_timeline` (sanitised StemLab v1 JSON) and
`_dance_moves_use_beat_timeline` (boolean). Existing
`_dance_moves_beat_alignment` and the shared **Analysed Master Audio** selection
are unchanged. WordPress checks the exact master's SHA-256 and preserves
previous metadata if either admin save or REST validation fails. Without explicit
enablement, fixed-BPM pages behave as before. See [full guide](variable-tempo.md).
