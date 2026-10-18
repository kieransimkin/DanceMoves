# Word-timed lyrics and multi-song WordPress Pages

## Per-word lyrics beside existing line lyrics

WordPress Pages still support the original **Lyric Timing File** (line-level LRC)
and **Cue Timing File**. The additional **Per-word Lyric Timing File** field is
independent and optional; attaching it does not replace, round or modify the
line-level timing. Choose the Media Library attachment from the EPK Timing box.

Supported per-word input formats (UTF-8, maximum 1 MiB, up to 50,000 words):

- **StemLab `speech/words.tsv`**, with `start`, `end`, `probability`, `word`
  columns; probability is preserved in source evidence but not used for timing
- **StemLab JSON**, containing `words: [{"start":0.125,"end":0.400,"word":"Hello"}]`
- **Enhanced LRC**: `[00:00.10]<00:00.125>Hello <00:00.420>world`
- **Word LRC**: `[00:00.125]Hello` on its own line per word

Each word's timestamp is measured in seconds from the start of its **own audio
source**, never from Beat 1. Word timestamps must be finite, nonnegative and
monotonic; an optional end timestamp must not precede its start. Malformed or
oversized files are rejected in the editor and are not silently treated as a
valid empty track. The uploaded file stays in the Media Library.

JavaScript/React consumers may use `runtime.onWord(handler)`,
`runtime.parseWordTimingFile(text)`, or listen for `dance-moves-word` events.
The payload has `time`, `start`, `end`, `word`, `text`, `index`, `previousWord`,
`nextWord` and the original `audio` reference. A paused seek reconstructs the
current word; audio playback, line-level lyric events and cue events remain
independent. Word highlighting is presentation-owned; DanceMoves does not inject
arbitrary HTML from lyrics.

## Multi-song page type (optional)

On a WordPress **Page**, open **Song collection**, select **Multiple songs**, and
click **Add song**. Supply a stable identifier, title, Media Library master audio
attachment, nominal BPM, and independently selected line lyric, word lyric and
cue attachments. Each song may also supply its own fixed first-beat alignment or
checked **Use variable-tempo map** and a complete StemLab beat-timeline JSON.
Both beat formats are checked against that **song's own audio SHA-256**. You can
reorder and remove songs. Maximum: 24 songs, 8 MiB metadata JSON total, 4 MiB
per optional corrected beat map. The WordPress field uses the existing edit
capability, nonce checks, revisions and REST validation.

Each song may also select a **Spectrum recording (.json)** and **Spectrum style**.
The selected song mounts its own Canvas visualisation from the shared
FrameRudiments spectrum views. Its saved Fourier data is fetched only by that
song's mount, shared by its views, and released on selection changes. Recording
files stay in the Media Library rather than the reusable rudiment package.
See [spectrum visualisations](spectrum-visualisations.md) for formats and options.

A song collection automatically appends its interface to the Page. Alternatively,
insert `[dance_moves_song_collection]` to place the interface deliberately. The
selected song shows native audio controls, its beat/line/word/cue timing lanes, live
source-time playhead, and current line/word/cue labels. The beat lane uses exact source-frame anchors for corrected maps or a labelled
constant-BPM grid when no map is selected. The displayed BPM follows the
selected song's current local tempo. A marker click seeks that
song's audio; word marker drawing may be thinned at extreme densities without
losing parsed data or timing events.

The WordPress runtime mounts a separate scoped DanceMoves instance inside the
selected song's content root. Switching songs **pauses the previous player and
destroys the previous mount**, then starts a new selected-song clock with its
own BPM, phase, lyrics, word timing and cues. No automatic playback on selection;
the user chooses Play. Unselected songs never fire cues or word events. The
existing `createDanceMoves` programming API and single-song WordPress pages
continue unchanged. Page-owned effects can be mounted under the active song
root; ordinary WordPress page effects outside that root are not cloned or
silently rewritten for all songs.

### Data flow

```text
WordPress Page (single song) -> original line + cue files, optional words.tsv
WordPress Page (multi-song) -> Song collection (selected song only)
  -> source-matched audio + fixed BPM / optional variable tempo map
  -> independent line LRC, word TSV/JSON/LRC and CUE/LRC
  -> shared DanceMoves effect / rudiment clock for selected audio
```

The song collection is a selectable **Page mode**, not a new WordPress post type:
existing permalinks, templates, revisions and Page permissions remain unchanged.
If a Page switches back to Single song mode, the old metadata and original
single-song renderer are still available. The stored song list is retained for
later re-enabling. Beat-map support is opt-in per song and falls back to that
song's fixed BPM when disabled; no variable-tempo approximation is fabricated.

### Security and validation

Master attachments must be readable public Media Library audio files. The source
SHA-256 of a beat map or fixed alignment is checked against the exact selected
master before WordPress accepts it. File extension, MIME, encoding, monotonic
timestamps and size are validated for each timing file. All visible lyric words
are set with `textContent`; JSON does not execute code. Source URLs come from
WordPress attachment IDs rather than arbitrary supplied JSON URLs. Invalid
multi-song updates are rejected while the previous song list remains intact.

### Build and verification

```sh
npm ci
npm test
node --test tests/shared/word-timing.test.mjs tests/shared/song-collection.test.mjs
npm run build
php -l dance-moves-song-collection.php
php tests/shared/song-collection.php
```

Verify actual browser playback and seek behaviour with two different songs,
including switching during a cue, invalid source map, long TSV and overlapping
word/line displays. Source tests do not demonstrate a live WordPress deployment.
