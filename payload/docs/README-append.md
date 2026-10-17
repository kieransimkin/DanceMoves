## Optional word-level lyrics and multi-song Pages

DanceMoves accepts an independent **Per-word Lyric Timing File** next to the existing
per-line `.lrc` and cue attachment selectors in WordPress EPK Timing. Supported
formats are StemLab `words.tsv` (`start`, `end`, `probability`, `word`), JSON with
a `words` array, enhanced LRC (`<mm:ss.xx>word`) or one `[mm:ss.xx]word` per line.
All timestamps remain in the source audio clock; neither the corrected beat
map nor the lyric timing alters the media clock. The core exposes `onWord`,
`parseWordTimingFile` and `dance-moves-word` independently of `onLyric`.

WordPress Pages may opt into **Song collection** from their editor metabox. Add
1–24 tracks with separate master attachments, BPM, optional full variable-tempo
beat maps or fixed alignments, line lyrics, word timings and cue files. A
track selector and independent audio/time lanes are rendered automatically (or
via `[dance_moves_song_collection]` to control placement). Switching songs stops
the previous audio and destroys its scoped motion controller. Existing ordinary
Pages, page effects, fixed BPM/offsets and legacy uploads retain their contract.

Details, file limits, source checks, JavaScript hooks and repeatable editor steps:
[Word lyrics and multi-song pages](docs/word-and-multi-song.md).
