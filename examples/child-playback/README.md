# Child-page playback example

Build DanceMoves and generate the original synthetic media, then serve the
checkout with the existing range-capable playback fixture server:

```sh
npm run build
python examples/playback-sources/generate-fixture.py
node examples/playback-sources/serve.mjs
```

Open `/examples/child-playback/index.html` on the printed loopback origin.
The main document opens a normal watch-page link in a native modal dialog.
The watch document also works by itself with its video visible immediately.
Native dialog semantics handle focus and background inertness. The adapter
restores scroll and focus, disposes the receiver, then removes its frame.

The example requires DanceMoves' shared player API (`playbackSource` and
`registerPlayer`) as well as the child-page bridge. It reports an accurate hold
when that API is absent. The parent reads synthetic LRC/CUE configuration; the
child reports only media state and never supplies timing files to the parent.
In WordPress, retain the parent's metadata-derived `danceMovesConfig` values.

The browser regression uses actual decoding of original synthetic media, with
explicit play controls, parent lyric/cue/pulse consumers, mapped seeks, playback
rate, reduced motion, forced colours, close/reopen and resource cleanup. It does
not prove any campaign master association or physical device performance.
