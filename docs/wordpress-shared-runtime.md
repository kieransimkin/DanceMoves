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
Node, npm, a C++ compiler nor an external CDN. Install `dist/DanceMoves-wordpress-3.0.5.zip`
through Plugins → Add New → Upload Plugin, preserving a backup and the prior
working archive. Do not upload the npm tarball, web ZIP, repository source ZIP
or a downloaded patch bundle.

The ZIP contains the PHP adapter, `lib/wordpress.js`, `lib/admin.min.js`, shared
styles, atlas, native licence/build information and documentation. The packager
checks that its runtime is byte-identical to the shared library output and that
no tests, examples, source engines or duplicate JavaScript files enter it.

## Metadata for each Page

Open the Page editor's **EPK Timing** box. Existing timing uploads, validation,
capability/nonce checks and revisions remain in PHP.

| Stored key | Setup |
|---|---|
| `_dance_moves_bpm` | Enter the song's own BPM (20–400). Blank removes the explicit value and uses the 120 fallback. Arcadians reference: 145. |
| `_dance_moves_lyric_timing_id` | Choose a Media Library `.lrc` attachment; this is an attachment ID, not a URL string. |
| `_dance_moves_cue_timing_id` | Choose a `.lrc`/bracketed `.cue` timing attachment. |
| `_dance_moves_lyric_popups_enabled` | Explicit checkbox opt-in. Custom song art direction remains page CSS. |
| `_dance_moves_master_duration_ms` | Advanced duration property, positive milliseconds; no ordinary editor field and not exposed through the standard REST metadata response. Arcadians reference: 273604.558. |
| `_dance_moves_effect` | Empty or `paper-planes`; no song/page-ID coupling for that effect. |

The existing `examples/wordpress/wordpress/configure-page.php` helper and the
[metadata recipes](wordpress-examples.md) cover validated WP-CLI writes, REST
boundaries and restoration. Never copy a demo attachment ID to production without
resolving that site's actual attachment. Upload files as UTF-8; clear lyric lines
are meaningful. Validation on editor save is stronger than merely sanitizing an
ID supplied by a programmatic update.

No existing keys or page IDs are renamed by the shared-library migration.
Rudiment choice, amplitude and phase are JavaScript options, not new WordPress
metadata fields. Existing orientation page mappings and the special Clay target
remain in `dance_moves_orientation_adapters()` and the Clay page constant.

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
        '1.0.0',
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
