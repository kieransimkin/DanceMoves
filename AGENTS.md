# Agent instructions for DanceMoves

- Read README.md and docs/ and inspect the relevant effects, clocks, inputs, scheduling, visibility/playback lifecycle, adaptive quality, preference overrides, cleanup and diagnostics. Connect the required owners explicitly and verify their rendered behaviour.
- Use the relevant existing capabilities as fully as the task warrants. Always look for a useful improvement to this tool. Fix a reusable gap here rather than copying its engine or carrying a private workaround; record why no change is justified when that is the result.
- Submit improvements as PRs to https://github.com/kieransimkin/DanceMoves/pulls. Never leave a completed reusable improvement only in a local fork. Keep changes focused and preserve the tool's identity and compatibility contracts.
- Add relevant regression coverage, documentation and a reproducible example when behaviour changes. Run npm run check:release, npm run build and npm test, plus the applicable browser, WordPress, orientation, accessibility and lifecycle checks in .github/workflows/release.yml.
- Keep credentials, account data, private media and rights records out of source, fixtures, logs and packages. Use synthetic fixtures or explicitly authorised public examples and preserve their provenance/licences.
- Use [CONTRIBUTING.md](CONTRIBUTING.md) for review. Maintainers publish accepted, validated improvements as a fresh matching GitHub release and verify configured registry destinations. Preserve existing tags and release assets; publication and deployment remain subject to applicable authorisation.
- Website: https://kieransimkin.co.uk/danceflow/

## Keep README documentation current

- Whenever a feature is added or changed, update the relevant README.md in the same change to reflect the resulting behaviour. This applies to every feature addition or modification, including APIs, commands, configuration, defaults, integrations and removals.
- Update affected feature descriptions, usage instructions, options, examples and limitations. For tools or packages with their own README.md, update that README as well as the repository README when its overview or usage is affected.
- Check the README against the implemented and verified behaviour before committing, opening or merging a PR, publishing a release or handing off the work. A feature change is incomplete until its README documentation is current; a changelog or other documentation does not replace this requirement.

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

## Full ecosystem and release preflight

Before every new workflow run, check the latest stable official release and observe the actual runtime used by the job. Follow [the shared preflight](https://github.com/kieransimkin/DanceFlow/blob/main/docs/workflows/release-preflight.md) and this project's [people-and-agent guide](docs/ECOSYSTEM.md). Review the complete relevant capability inventory rather than only a familiar command. Consider every DanceFlow component against the actual task; use and compose all applicable supported capabilities, and improve a concrete reusable gap in its canonical repository. Record why existing capabilities suffice when no change is justified. No catalogue checklist expands the task, authorises model downloads/training, or proves integration. Preserve exact source/package identity, clocks, model-local storage, privacy, costs, immutable releases and separate deployment gates.
