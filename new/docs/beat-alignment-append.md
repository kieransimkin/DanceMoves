## Optional variable-tempo replacement for the fixed grid

A new `stemlab.beat-timeline.v1` import is supported alongside the existing
`beat-alignment.v1` reading. The beat-map option must be explicitly enabled in
EPK Timing; it **does not** replace fixed-BPM data. Its full beat list is
validated against the exact selected master audio, the Beat 1 origin and
piecewise integrated 64-pip phase. The original fixed reading, playback clock,
lyrics and cues are untouched. See [variable-tempo usage](variable-tempo.md).
