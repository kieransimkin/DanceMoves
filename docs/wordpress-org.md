# WordPress.org publication

Run the official Plugin Check against the exact production ZIP with the intended directory slug. Do not scan tests as installed runtime code, ignore an entire category or treat a passing static scan as a security audit. Review all warnings and document each contextual finding. Keep the readme stable tag, main PHP version and GitHub release aligned. After directory approval, publish the same verified source through the assigned SVN repository; verify the downloaded directory ZIP independently. No directory password belongs in source.

## Potential problems

On 8 October 2026 the official checker found missing directory readme fields and source-domain/output warnings. The complete report is retained privately by the release operator. WordPress common-issues guidance requires matching stable versions, GPL-compatible declarations and source links for compiled code. Source: https://developer.wordpress.org/plugins/wordpress-org/common-issues/ (accessed 8 October 2026).

The MP3 download uses a canonical, signed uploads path and direct binary streaming; WP_Filesystem does not supply an equivalent bounded download stream. This exception is annotated at the exact operation rather than hidden by broad exclusions.

The retained `ks_epk_*` functions and `KS_EPK_*` constants are plugin-specific compatibility names used by existing integrations. Renaming them solely to match the directory slug would break those integrations. The BPM and effect input warnings do not recognise the typed sanitizers: after nonce, autosave and capability checks, BPM must be finite and within 20–400; effects must match the implemented allowlist. No raw value is persisted. Keep these warnings visible and re-review affected handlers when they change.
