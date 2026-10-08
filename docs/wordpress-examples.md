# WordPress setup and Arcadians examples

[Repository README](../README.md) · [Runnable gallery](../examples/wordpress/index.html) · [Release guide](../RELEASING.md)

## Before you start

Work on a draft Page or staging site. This patch creates no WordPress pages,
media attachments, settings or releases. `examples/wordpress` is a local teaching
environment; it is deliberately absent from the distributable plugin ZIP.

The native plugin source is 2.9.0 at `c4252556774f38cad6d75b1a52de7917d2c65af0`.
StemLab media is pinned at `a44045dd267b539f5d25445e2153f4cf2d8f43a8`.
The live EPK’s rendered text and chapters were inspected on 29 September 2026.
Its raw JavaScript and private WordPress metadata were not available through that
rendered-page read. The checked-in `tools/stage-central-effects-migrations.js`
provides the concrete Arcadians `pointer`, `playbackPulse` (64 ticks), and
`quality` usage pattern. Do not label supplementary demonstrations as live usage.

## Editor workflow

1. Install/activate the packaged DanceMoves plugin; preserve its internal
   `kieran-epk-device-orientation` folder/entrypoint identity.
2. Create a draft Page with slug `arcadians-demo`. Upload the prepared Arcadians
   MP3 and cover through Media Library; add the actual upload URLs to the
   [HTML example](../examples/wordpress/wordpress/arcadians-markup.html).
3. Upload the exact canonical LRC and the derived `sections.cue`. In **EPK Timing**,
   enter BPM **145** and choose those attachments. The UI stores attachment IDs
   and resolves their URLs later. Cue timestamps are absolute positions in the
   recording; do not retime them merely because BPM changes.
4. Leave **Timed lyric pop-ups** unchecked unless you are demonstrating the
   built-in layer and have supplied song-specific styling. With it off, `onLyric`
   still receives the selected LRC’s data. Keep the complete readable lyrics.
5. Choose **None** for Ambient effect except the paper-plane demonstration.
   That demonstration uses **Paper planes**, which stores `paper-planes`.
6. Set the hidden master-duration key through the validating helper or deliberate
   PHP/WP-CLI setup. It is not a field in the box and not REST-visible.
7. Save and inspect the public preview signed out. Confirm the effective BPM,
   selected files, audio binding, readable text, missing-asset errors, motion
   preferences and correct native/package version before publishing.

## Copyable child-theme implementation

Put `arcadians-example.js` and `arcadians-example.css` from
`examples/wordpress/wordpress/` in your child theme directory. Add
`enqueue-example.php` to its `functions.php` without duplicating the `<?php` tag.
The hook is conditional on the draft page slug and declares dependencies on
`dance-moves-core`, `dance-moves-effects` and `dance-moves-rudiments`; it runs at
priority 40, after the plugin has registered its scripts. Do not manually enqueue
another copy of DanceMoves or overwrite `window.danceMovesConfig` on production.

Use the supplied HTML in a Custom HTML block, with your own upload URLs. The
example mounts pointer, playback pulse and native orbit onto distinct owned
subjects. Its prefix and effect IDs are example-owned. It includes cleanup and
an explicit page-return policy; a production SPA needs its own navigation owner.
Other features use the API recipes in the README, with root/audio/targets and
callbacks supplied by your page. The local gallery’s `ctx` helpers are demo UI,
not plugin APIs and should not be copied into a page without their implementation.

## WP-CLI setup with full file validation

Copy `page-settings.example.json` to `page-settings.json`. Replace `pageId:1234`
with your actual Page ID. Replace zero timing IDs with actual Media Library
attachment IDs only when those files are desired. The local gallery’s 9001/9002
identifiers are not portable to any WordPress database.

```sh
# Import uploads; save the numeric IDs printed by these commands.
wp media import "examples/wordpress/media/arcadians.mp3" --porcelain
wp media import "examples/wordpress/media/cover.jpg" --porcelain
wp media import "examples/wordpress/media/canonical-lyric-timing.lrc" --porcelain
wp media import "examples/wordpress/media/sections.cue" --porcelain

# Validate all requested values first, then update only supplied metadata keys.
wp eval-file examples/wordpress/wordpress/configure-page.php page-settings.json --user=YOUR_ADMIN_LOGIN

# Read back; these commands do not change publication status.
wp post meta list YOUR_PAGE_ID
wp post meta get YOUR_PAGE_ID _dance_moves_master_duration_ms
```

The helper requires an editable Page and an explicit WP-CLI user. It uses
`dance_moves_validate_timing_attachment()` for timing IDs, not just `absint()`.
Empty BPM deletes the explicit property and restores the unknown/120 fallback;
zero attachment IDs clear selections; false lyric opt-in clears the checkbox;
an empty effect disables the property-selected ambient adapter. Unspecified
keys are left alone. Validation is all-before-write, but the updates are not a
transaction and WP-CLI does not automatically create the same editor revision
workflow. Keep a backup and check the printed read-back.

A deliberate single-value update is also possible:

```sh
wp post meta update YOUR_PAGE_ID _dance_moves_bpm 145
wp post meta update YOUR_PAGE_ID _dance_moves_master_duration_ms 273604.558
wp post meta update YOUR_PAGE_ID _dance_moves_effect paper-planes
wp post meta delete YOUR_PAGE_ID _dance_moves_effect
```

Direct timing-ID updates do not validate the file’s full contents. Prefer the
helper or editor for those keys. Do not store a media URL in an ID field.

## REST setup

The Page endpoint accepts these five registered metadata keys for an authorised
editor. Use a WordPress REST nonce in an authenticated same-origin session, or an
application password over HTTPS in a trusted server/CLI client. Never put an
application password in browser example code or commit it to the repository.

```json
{
  "meta": {
    "_dance_moves_bpm": 145,
    "_dance_moves_lyric_timing_id": 123,
    "_dance_moves_cue_timing_id": 124,
    "_dance_moves_lyric_popups_enabled": true,
    "_dance_moves_effect": ""
  }
}
```

POST that JSON to your site’s `/wp-json/wp/v2/pages/YOUR_PAGE_ID`; 123/124 are
placeholders. REST attachment-ID sanitisation is not equivalent to the editor’s
file validator. `_dance_moves_master_duration_ms` has `show_in_rest:false`, so
set it through the validated CLI/PHP path, not by inventing a REST parameter.
All six keys are registered revision-aware, but taking/restoring revisions is a
WordPress operation, not a browser runtime API. Use normal Page revisions and
read the restored metadata/config back after restoration.

## Settings which are not metadata

Rudiment name, rate, phase, amplitude, target and clock are `animate()` options.
Pointer bounds, pulse ticks, cue-class duration, timeline data and quality tiers
are JavaScript options. The audio URL is Page markup. There is no generic
`_dance_moves_enabled`, `_dance_moves_rudiment`, `_dance_moves_orientation`,
`_dance_moves_diagnostics`, `_dance_moves_audio_url` or API-key metadata field.

The orientation adapter mapping is currently fixed in PHP:
130 Dying for a Diagnosis; 140 Light Will Win; 243 Presents & Chocolate;
252 Clay/Stars; 268 Fully Nocturnal; 270 Amnesty, honestly?; 276 Walk With Me;
298 Dmitri My Talisman; 839 California Screamin’. Each needs its matching DOM.
A new Page cannot obtain those mappings just by copying an ID into metadata.
The local selector uses the localhost-only harness override and demonstrates all
nine mappings with Arcadians, not nine real new WordPress pages.

Clay’s retained release adapter is Page-252-specific and respects the
legacy-plugin coexistence guard. Native rudiment configuration is deliberately
absent: a consuming page owns that call to the general API. The supplementary
fixture uses the same real scripts with compact educational markup and Arcadians at 145 BPM.
Do not change the real Clay page’s tempo to the demo tempo or copy its art direction
into another release merely to enable generic input. Use the page-agnostic APIs
for new EPKs. Paper planes are property-selected and work with a positioned,
isolated, clipped `.epk-hero`; counts and atlas URL are not separate editor keys.

The generic quality API, Clay quality recovery and native rudiment lifecycle have
different contracts. Manual `setTier()` is not measured degradation; direct
`pointer.set()` bypasses native event gating; `cueClass` uses a wall-clock timer;
`cueTimeline` reconstructs half-open `[time,end)` intervals. Core file-cue landing
and timeline landing are not interchangeable. The examples call out those boundaries.

## Downloads and captures

Real MP3 downloads require an eligible same-site uploads URL in an explicit
`<a download>` on Page content. The plugin rewrites that anchor with its own PHP
HMAC helper and sends attachment headers; audio/source URLs stay direct and seekable.
Do not configure global MP3 attachment headers and do not use a signed download
URL as an audio source. The local server models GET/HEAD/Range behaviour only; its
random key is not the production WordPress salt, and it is not an implementation
of WordPress’s HTML Tag Processor.

The capture example sends only an explicitly synthetic fixture to a local route.
It stores nothing, requests no sensor permission and contains no production token.
The real `/ks-epk-motion/v1/capture` contract remains in the API reference. Its
fixed source token is not strong user authentication; review that endpoint before
expanding exposure. A local response is not evidence of private WordPress storage.

## Data provenance and reproducibility

`examples/wordpress/media/manifest.json` pins the Arcadians MP3 (11,708,403 bytes),
cover, LRC hash, source commit and reference metadata. The canonical master lasts
273.604558 seconds; the MP3 reference contains an estimated CBR duration
273.659 seconds. The demo does not call that estimate a sample-exact MP3 duration:
the browser reads the actual media metadata and the plugin applies its documented
master-length tolerance. Do not overwrite canonical duration with a rounded 4:33.

The canonical LRC still contains upstream placeholder metadata headers (`Project
title`, `Project author`, `la:af`). Its sung text and all 96 time tags, including
48 clear tags, are preserved. The runtime ignores those header fields. This
examples patch does not silently alter an artist-locked canonical file.

## Evidence and limits

The [coverage manifest](../examples/wordpress/coverage.json) maps all 23 pages and
acceptance checks. Static/contract coverage is not a browser pass. Real-browser
validation uses the actual plugin assets; a test-only silent media route can be
used by the browser runner for transport assertions, clearly separate from the
real Arcadians demos. The normal gallery never generates or substitutes audio.
Actual Arcadians listening, public WordPress rendering, physical motion permission
and sustained-device performance must be checked separately before release.

## Primary sources

- [Arcadians live EPK](https://kieransimkin.co.uk/arcadians/), rendered content checked 29 September 2026.
- [StemLab reference](https://github.com/kieransimkin/stemlab/blob/a44045dd267b539f5d25445e2153f4cf2d8f43a8/examples/arcadians/reference.json).
- [Arcadians migration source](../tools/stage-central-effects-migrations.js).
- [WordPress metadata commands](https://developer.wordpress.org/cli/commands/post/meta/update/).
- [WordPress REST metadata](https://developer.wordpress.org/rest-api/extending-the-rest-api/modifying-responses/).
- [GitHub release command](https://cli.github.com/manual/gh_release_create).
