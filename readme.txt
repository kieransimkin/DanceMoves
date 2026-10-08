=== DanceMoves ===
Contributors: kieransimkin0
Tags: animation, music, accessibility
Requires at least: 6.7
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 3.1.15
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

BPM-synchronised web motion with media clocks, cue timing and accessible fallbacks.

== Description ==

A shared runtime for BPM-, cue- and lyric-timed creative effects, orientation inputs, playback lifecycle and adaptive quality. Pages explicitly connect the required effects; installing the plugin alone does not choreograph a page. Reduced-motion and forced-colour fallbacks are supported.

No external service is required and no external executable code is downloaded. Device orientation is used locally when explicitly connected. The optional motion-lab capture feature stores submitted samples only after a participant actively chooses to record and upload; it is not analytics and does not run automatically on ordinary pages. Its fixed public capture token is an anti-spam marker, not a secret or permission to upload private data. Site owners must review capture consent and retention before enabling a lab.

Human-readable JavaScript source and reproducible build instructions for bundled scripts and WebAssembly: https://github.com/kieransimkin/DanceMoves/tree/v3.1.15/src and https://github.com/kieransimkin/DanceMoves/tree/v3.1.15/tools . Run npm ci and npm run build. Rhythmic function source: https://github.com/kieransimkin/DanceRudiments .

Author and ecosystem: https://kieransimkin.co.uk/ and https://kieransimkin.co.uk/danceflow/

== Installation ==

1. Install the released ZIP or the approved directory listing.
2. Activate the plugin.
3. Review the source README and configure only the page features required.
4. Check the public result, keyboard use, preferences and duplicate metadata owners.

== Frequently Asked Questions ==

= Is an account or paid service required? =

No. The plugin is independent and does not require an external account.

= Does installation guarantee a search or sharing result? =

No. Search engines and sharing services decide how to present a page.

== Changelog ==

= 3.1.15 =

* Prepare directory readme, headers and production-package checks.
* Address the reviewed Plugin Check findings while preserving runtime behavior.

== Upgrade Notice ==

= 3.1.15 =

Directory packaging and compatibility corrections. Review documentation before activating optional features.
