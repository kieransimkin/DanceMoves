# WordPress.org publication

The plugin and author URI headers must identify different pages. The author
header uses https://kieransimkin.co.uk/; the plugin retains its published My Songs
homepage. `npm run check:release` rejects duplicate URLs (including a trailing
slash variation), matching the directory upload validation. Keep the public
plugin name **DanceMoves** and its existing compatibility identifiers.

Run the official Plugin Check against the exact production ZIP with the intended directory slug. Do not scan tests as installed runtime code, ignore an entire category or treat a passing static scan as a security audit. Review all warnings and document each contextual finding. Keep the readme stable tag, main PHP version and GitHub release aligned. After directory approval, publish the same verified source through the assigned SVN repository; verify the downloaded directory ZIP independently. No directory password belongs in source.

## Potential problems

On 8 October 2026 the official checker found missing directory readme fields and source-domain/output warnings. The complete report is retained privately by the release operator. WordPress common-issues guidance requires matching stable versions, GPL-compatible declarations and source links for compiled code. Source: https://developer.wordpress.org/plugins/wordpress-org/common-issues/ (accessed 8 October 2026).

The MP3 download uses a canonical, signed uploads path and direct binary streaming; WP_Filesystem does not supply an equivalent bounded download stream. This exception is annotated at the exact operation rather than hidden by broad exclusions.

The retained `ks_epk_*` functions and `KS_EPK_*` constants are plugin-specific compatibility names used by existing integrations. Renaming them solely to match the directory slug would break those integrations. The BPM and effect input warnings do not recognise the typed sanitizers: after nonce, autosave and capability checks, BPM must be finite and within 20–400; effects must match the implemented allowlist. No raw value is persisted. Keep these warnings visible and re-review affected handlers when they change.

## Visualiser integration checks

The [18 October 2026 Plugin Check run](https://github.com/kieransimkin/DanceMoves/actions/runs/39099018143/job/117591274195) used Plugin Check 2.1.0 and reported three errors: the spectrum attachment validator called PHP's `parse_url()`, and the scanner could not follow the two escaped canvas helpers used by song collections. The validator now uses `wp_parse_url()`. Each collection echo has a single-operation annotation because its helper builds a fixed canvas/status template and escapes every dynamic attribute. Regression tests cover malicious song titles, renderer allowlists, accessible status bindings and HTTP(S)/relative attachment URLs. These annotations do not permit arbitrary HTML or suppress checks elsewhere.

The remaining contextual warnings require the following review:

- Recording attachment IDs, renderer and rudiment names, axes and collection rows pass strict validators after nonce and capability checks. IDs resolve to readable bounded JSON attachments; styles, names and sprite themes must match their catalogues; axes must be bounded and unique. FFT terrain and spectral deformation require compatible music renderers and recorded sources when configured. Invalid rows preserve the prior saved collection. The input scanner does not follow these validators. Do not replace validation with lossy text sanitization of recording references, beat maps or structured song data.
- Fixed and variable beat-map input uses the existing schema and source-identity validators before metadata is committed. The existing BPM/effect and compatibility-prefix findings remain as described above.
- `AGENTS.md` is deliberately included as contributor guidance alongside `CONTRIBUTING.md`. It is an inert documentation file, although Plugin Check flags its filename as unexpected in the plugin root.

Run `php tests/shared/spectrum-wordpress.php`, `php tests/shared/visualiser-wordpress.php` and `php tests/shared/song-collection.php` for the local PHP regressions. The `Validate WordPress directory package` workflow checks `.build/wordpress`, after `npm run build:wordpress`, using the official action with `categories: plugin_repo`. It continues to report contextual warnings; errors still fail the workflow. A local scanner result does not establish a successful hosted rerun or a public WordPress deployment.
