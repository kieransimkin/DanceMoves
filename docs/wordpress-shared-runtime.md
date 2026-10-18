# WordPress with the shared DanceMoves library

WordPress remains a separately built plugin inside this repository. It consumes
the same frontend library as React/Next.js; no parallel animation engine is kept
in the WordPress adapter. The existing plugin folder and entrypoint are preserved.

## Build and install

From a complete repository checkout:

```sh
npm install --ignore-scripts
npm run build
npm test
npm run test:legacy
npm run package:wordpress
```

The retained PowerShell command is equivalent for the final build/archive step:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\package.ps1
if ($LASTEXITCODE -ne 0) { throw "WordPress build failed" }
```

The build machine needs Node, npm and Python. The WordPress server needs neither
Node, npm, a native compiler nor an external CDN. Install the WordPress ZIP
created by the matching GitHub release workflow
through Plugins → Add New → Upload Plugin, preserving a backup and the prior
working archive. Do not upload the npm tarball, web ZIP, repository source ZIP
or a downloaded patch bundle.

The ZIP contains the PHP adapter, `lib/wordpress.js`, `lib/admin.min.js`, shared
styles, the plane atlas, the 17 pinned visualiser sprite atlases, native
licence/build information and documentation. The packager checks that its runtime
is byte-identical to the shared library output and that no tests, examples,
source engines or duplicate JavaScript files enter it. Song recordings remain
separate Media Library attachments.

## Metadata for each Page

Use the Page editor's **EPK Timing**, **Dance-rudiment spectrum** and
**Dance-rudiment visualiser** boxes. Existing timing uploads, validation,
capability/nonce checks and revisions remain in PHP.

| Stored key | Setup |
|---|---|
| `_dance_moves_bpm` | Enter the song's own BPM (20–400). Blank removes the explicit value and uses the 120 fallback. Arcadians reference: 145. |
| `_dance_moves_lyric_timing_id` | Choose a Media Library `.lrc` attachment; this is an attachment ID, not a URL string. |
| `_dance_moves_cue_timing_id` | Choose a `.lrc`/bracketed `.cue` timing attachment. |
| `_dance_moves_lyric_popups_enabled` | Explicit checkbox opt-in. Custom song art direction remains page CSS. |
| `_dance_moves_master_duration_ms` | Advanced duration property, positive milliseconds; no ordinary editor field and not exposed through the standard REST metadata response. Arcadians reference: 273604.558. |
| `_dance_moves_effect` | Empty or `paper-planes`; no song/page-ID coupling for that effect. |
| `_dance_moves_spectrum_recording_id` | Optional saved StemLab Fourier JSON attachment, selected in **Dance-rudiment spectrum**. No samples are stored in metadata. |
| `_dance_moves_spectrum_renderer` | One of the ten basic spectrum styles; default `spectrum` (bars). |
| `_dance_moves_visualiser_recording_id` | Optional native JSON attachment in **Dance-rudiment visualiser**. Attachment metadata resolves its URL; PHP does not decode the recording samples. |
| `_dance_moves_visualiser_rudiment` | Empty or one of the 15 native names. Choose this or a recording, with the other source cleared. |
| `_dance_moves_visualiser_renderer` | One of the 222 FrameRudiments renderer IDs, grouped by family; default `waveform`. |
| `_dance_moves_visualiser_axes` | Optional array of unique dimension names; edit as a comma-separated list. Empty selects all source axes. |
| `_dance_moves_visualiser_sprite_theme` | Empty for **Renderer default**, or one of the 17 bundled themes. Used by sprite views; other views retain a valid choice for later. |
| `_dance_moves_visualiser_terrain_source` | `procedural` by default. `fft` selects **Saved spectrum (FFT)** for `spatial-music-terrain` only. A configured source must then be a calibrated recording. |
| `_dance_moves_visualiser_spectral_deform` | Boolean, default `false`. **Use saved spectrum for music deformation** applies to the three `spatial-music-*` views and requires a calibrated recording. |

Add `[dance_moves_spectrum]` in the same content root as the song's player to
render the selected spectrum. The shared runtime loads the recording only when
that page mounts a canvas. Each Multiple songs row has its own recording/style;
only the selected song fetches its data. See [spectrum setup and data ownership](spectrum-visualisations.md).

The seven `_dance_moves_visualiser_*` properties are revision-enabled Page
metadata. The two earlier spectrum properties and `[dance_moves_spectrum]`
continue to support their original ten styles. Neither shortcode embeds a
recording payload in the page.

The existing `examples/wordpress/wordpress/configure-page.php` helper and the
[metadata recipes](wordpress-examples.md) cover validated WP-CLI writes, REST
boundaries and restoration. Never copy a demo attachment ID to production without
resolving that site's actual attachment. Upload files as UTF-8; clear lyric lines
are meaningful. Validation on editor save is stronger than merely sanitizing an
ID supplied by a programmatic update.

No existing keys or page IDs are renamed by the shared-library migration.
The visualiser's named rudiment is a Page or per-song setting. Amplitude, phase,
other detailed styles and custom pinned sprite atlases remain JavaScript options.
Existing orientation page mappings and the special Clay target remain in
`dance_moves_orientation_adapters()` and the Clay page constant.

## Visualisers on single-song Pages

Choose exactly one source in **Dance-rudiment visualiser**: a saved native
`dancerudiments.recording` v1 JSON attachment, or a bundled rudiment such as
`circle` or `helix`. Clear the other source before saving. Leaving both empty
keeps the visualiser inactive, even if a renderer or theme is selected.

Add a Shortcode block inside the same DanceMoves content root as the player:

```text
[dance_moves_visualiser label="Movement history"]
```

This uses the saved renderer. The optional `renderer` attribute selects another
view of the same configured source and axes:

```text
[dance_moves_visualiser renderer="waveform-annular-ribbon" label="Movement history"]
```

The shortcode provides a labelled canvas, status and fallback text. A saved
recording needs the matching audio player in that root. The runtime prefers an
`audio[data-dance-moves-master]` player, then the first audio/video player. A
bundled pattern follows that player when present; without a player it follows
the page clock. Its samples are generated by the existing native runtime.

For a sprite path, choose `circle`, clear the recording, select
`sprite-motion-path` and optionally choose a **Sprite theme**. The available
themes are `lcd`, `lcd-green`, `lcd-amber`, `led`, `vfd`, `arcade`, `neon`, `glass`,
`metal`, `crystal`, `pixel`, `hud`, `plasma`, `fire`, `ice`, `mono` and
`generated-neon`. **Renderer default** uses the atlas selected for that mode.
The 20 sprite waveform/motion views can use native patterns; the 32 sprite
spectrum/spectrogram views require saved StemLab Fourier calibration.

Solid and music views use the browser's CPU renderer. The music views can use
a native pattern or ordinary saved motion recording with **Music terrain source**
set to **Procedural** and spectral deformation disabled. These two controls
enable additional spectral inputs:

| Control | Compatible renderer | Source requirement |
|---|---|---|
| **Music terrain source → Saved spectrum (FFT)** | `spatial-music-terrain` | Saved StemLab Fourier recording |
| **Use saved spectrum for music deformation** | `spatial-music-torus`, `spatial-music-sphere`, `spatial-music-terrain` | Saved StemLab Fourier recording |

For FFT terrain, clear the bundled rudiment, choose the recording attachment,
select `spatial-music-terrain`, then choose **Saved spectrum (FFT)**. Leave axes
empty to use all recording dimensions, or select at least three calibrated
dimension names. When changing to another renderer, return incompatible terrain
or deformation controls to their defaults before saving. A valid sprite theme
can stay selected when unused.

Editor saves and partial REST updates validate the complete proposed source and
style combination. WordPress checks the JSON attachment's extension, permitted
type, availability and size (at most 64 MiB). It stores the attachment reference
and settings, and resolves the URL without decoding the sample table. The
browser validates the bounded native recording and, where needed, its StemLab
Fourier provenance before drawing. Invalid declarative views show an error
status without destroying another correctly configured view or the song player.
See [the complete visualiser guide](rudiment-visualisers.md) for renderer styles,
native dimensions and calibration requirements.

## Multiple songs and resource ownership

For a **Multiple songs** page, configure each **Song collection** row. Its seven
visualiser fields are `visualiser_recording_id`, `visualiser_renderer`,
`visualiser_rudiment`, `visualiser_axes`, `visualiser_sprite_theme`,
`visualiser_terrain_source` and `visualiser_spectral_deform`. They have the same
defaults and validation as the single-song Page fields. The collection player
creates a visualiser canvas only for a song with a source; a separate visualiser
shortcode is unnecessary for that player.

Only the selected song owns an active runtime and loads its referenced
recording and required sprite atlas. Switching songs destroys the old runtime,
aborts unneeded pending requests and releases its recording samples, decoded
images and rendering surfaces. A theme or recording choice in one row does not
change another row. Page configuration without a matching mounted canvas starts
no visualiser request.

Several views of the same recording share a page-scoped recording resource,
including views created through the original `spectrum` API. Sprite views of
the same pinned atlas share its decoded image and bounded tile cache. Resources
are released when their last owner is removed. Page HTML and localized
configuration carry source references and settings; no song sample arrays enter
the shared DanceMoves bundle or the DanceRudiments package.

## Existing EPK JavaScript

Existing `window.DanceMoves`, `window.DanceMovesEffects`, native and orientation
aliases remain available. Enqueue page code with dependencies on the existing
handles rather than loading a second library or hand-writing asset URLs:

The 3.0.4 WordPress adapter also exposes `DanceMovesEffects.lyricStage()`. It is
the compatibility path for existing three-line lyric treatments: the plugin owns
the LRC/audio clock and all lifecycle listeners while page code owns only the
release-scoped render callbacks and CSS.

From 3.0.5, public `dance-moves-*-ready` events bubble for compatibility with
document-level page adapters. WordPress compatibility mode also keeps native
document-wide selectors, allowing the body-level lyric popover to be found from
the scoped runtime. Root-scoped module and React mounts remain isolated.

```php
add_action('wp_enqueue_scripts', function () {
    if (!is_page(260)) { return; } // Your actual Arcadians Page ID.
    wp_enqueue_script(
        'my-arcadians-effects',
        get_stylesheet_directory_uri() . '/arcadians-effects.js',
        array('dance-moves-rudiments', 'dance-moves-effects'),
        '1.1.0',
        true
    );
}, 40);
```

```js
// arcadians-effects.js; no repeated frontend import or timer engine.
const motion = window.DanceMoves;
const root = document.querySelector('.ks-epk');
const target = root.querySelector('.drift');
const handle = motion.rudiments.animate({
  id:'arcadians:drift', root, target, rudiment:'clay_background',
  clock:'audio', audio:root.querySelector('audio'),
  rate:0.5, amplitude:{x:14,y:10,z:0}
});
handle.ready.catch(console.error);
window.addEventListener('pagehide', () => handle.destroy(), {once:true});
```

The Clay page is already mounted by the adapter. Do not add a second controller
to the same background. Its eight-beat pace and original rotation/scale/opacity
accents remain separate from the position-only native pattern. Legacy Clay
plugin detection still suppresses the shared Clay styles and initializer.

`wp_localize_script` converts top-level scalar values to strings. The thin
JavaScript adapter deliberately normalizes known numbers/booleans before calling
the shared API; it does not use `Boolean('false')`. The page BPM comes from PHP
metadata, not a hard-coded song value.

## Script handles and assets

`dance-moves-core` loads `lib/wordpress.js`. Existing effects, catalogue,
orientation and rudiment handles remain dependency aliases with `src=false`.
They do not request another engine. The WordPress admin Media Library selector
uses the shared `lib/admin.min.js` build and its existing jQuery dependency.
CSS is still enqueued conditionally so the legacy Clay coexistence guard works.

Visualiser pages use the shared `lib/styles/visualisers.css`. The adapter derives
`visualiserAssetBaseUrl` from the installed plugin's
`lib/assets/visualiser-sprites/` directory and passes it to the active song
runtime. This is host configuration, with no Page metadata key or per-song
attachment picker. Renaming or moving the plugin directory therefore does not
require editing stored song settings.

That directory contains `manifest.json` and the 17 PNG atlases. PHP reads only
the small trusted manifest to populate the theme selector. A mounted sprite view
requests its required PNG and verifies the pinned SHA-256 before image decoding;
listing themes, importing the library or rendering a non-sprite view does not
request these images. Sprite integrity checks need Web Crypto, available on
HTTPS pages and localhost. Page JavaScript can provide a custom PNG through
`style.sprite_asset: {url, sha256}`; the runtime applies the same integrity and
image bounds. No general style JSON or custom atlas is stored by the editor.

Custom code that explicitly fetches old raw `assets/*.js` URLs must migrate to
these handles. Building from source produces `lib/`; activating an unbuilt raw
checkout is not a supported deployment. Purge caches after installing the ZIP.

## Server behaviour and acceptance

WordPress metadata, revisions, attachment lookup, signed MP3 delivery and private
motion-capture posts stay in the native PHP integration. Other applications use
the new Node equivalents; WordPress does not need a Node sidecar.

The existing fixed capture token is not reclassified as strong authentication
by this patch. The generic Node API requires application authorization instead.
Do not expose capture records publicly, and do not treat client-reported parity
flags as physical verification.

After deployment, inspect affected pages signed out: audio playback/ranges,
download attachments, exact cue landings, pause/seek/resume, lyric clears,
responsive layout, Clay native fallback, reduced motion, forced colours and
physical phone orientation. CI tests and package checks do not establish that a
particular WordPress installation or cache has been updated.

## Optional StemLab edited tempo-map metadata

Two revision-enabled Page properties add an opt-in corrected clock:
`_dance_moves_beat_timeline` (sanitised StemLab v1 JSON) and
`_dance_moves_use_beat_timeline` (boolean). Existing
`_dance_moves_beat_alignment` and the shared **Analysed Master Audio** selection
are unchanged. WordPress checks the exact master's SHA-256 and preserves
previous metadata if either admin save or REST validation fails. Without explicit
enablement, fixed-BPM pages behave as before. See [full guide](variable-tempo.md).
