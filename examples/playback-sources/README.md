# Shared playback fixture

Run `npm run build`, then `python examples/playback-sources/generate-fixture.py`.
Run `node examples/playback-sources/serve.mjs` and open the printed local URL.
The server supports byte ranges; a server without them cannot verify seeking.
The generator requires ffmpeg and creates original test-tone/test-pattern media,
not a release recording. Generated media stays outside source/packages.

Play the excerpt: song time starts at 48, and shared lyrics/cues/pulse follow that
coordinate. Seek to 60: the clip seeks to 12. Switch to full video or audio:
the prior player pauses and the same effect owners follow the new source. Pause,
change rate, test reduced motion and forced colours, hide/restore the tab, and
destroy the runtime. Teardown must report zero owned listeners/frames/timers.
YouTube uses the same registration contract; real YouTube playback additionally
requires its official API and verified soundtrack provenance.
