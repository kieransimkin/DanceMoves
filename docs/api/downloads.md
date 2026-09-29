# Signed MP3 download API

[Documentation index](../README.md) · [WordPress/PHP API](wordpress.md) ·
[User guide](../guide.md)

Source: [plugin entrypoint](../../kieran-epk-device-orientation.php), functions
`dance_moves_epk_download_*`. Baseline: **DanceMoves 2.8.0**, commit
`4cb6a71f60459b5579be87d7e55ac8b1426c578e`. Introduced in 2.5.0.

This feature gives explicit WordPress-upload MP3 downloads an attachment response
without changing the media URLs used by audio players. It is a **front-end query
endpoint**, not a REST route, shortcode, browser download API or media proxy.

## Authoring and automatic link transformation

In main Page content, use the original uploads URL and a `download` attribute:

```html
<a class="epk-download"
   href="/wp-content/uploads/2026/09/example-track.mp3"
   download>Download MP3</a>
```

At `the_content` priority **30**, the plugin uses `WP_HTML_Tag_Processor` to inspect
anchors. A link is eligible when it has a `download` attribute and its URL resolves
to an MP3 path under the configured uploads base URL. Eligibility is not tied to
an EPK CSS class, release title or page ID: it applies to eligible anchors in the
main content of any singular Page.

The filter returns unchanged content in admin, off singular Pages, outside the
main loop/query, or if `WP_HTML_Tag_Processor` is unavailable. It does not create
anchors or add missing `download` attributes. It rewrites `href` only, preserving
other attributes. A custom value such as `download="custom-name.mp3"` remains in
the markup but the server's filename is derived from the actual stored basename.

Audio players and `<source>` elements, ordinary media links, external upload
hosts and non-MP3 downloads are not rewritten. Direct MP3 URLs remain ordinary
media URLs. Stored post content is unchanged: this is a render-time transform.
JavaScript-inserted anchors and template links that never pass through
`the_content` need a server-generated URL from the helpers below.

## URL and HTTP contract

The generated URL uses `home_url('/')` with two registered query variables:

| Query key / constant | Value |
| --- | --- |
| `dance_moves_download` / `DANCE_MOVES_DOWNLOAD_QUERY_VAR` | Normalized path relative to the WordPress uploads directory, for example `2026/09/example-track.mp3`. |
| `dance_moves_download_signature` / `DANCE_MOVES_DOWNLOAD_SIGNATURE_QUERY_VAR` | Hex HMAC-SHA-256 over that normalized relative path using `wp_salt('auth')`. |

Generate the URL with WordPress rather than constructing a signature in browser
code. The URL is not a `wp-json` path; preserve subdirectory/site URL settings.
The handler runs at `template_redirect` priority **0**, independently of which
Page originally rendered the link.

### Successful GET and HEAD

A valid request returns status **200** with these headers:

| Header | Value / rule |
| --- | --- |
| `Content-Description` | `File Transfer` |
| `Content-Type` | `audio/mpeg` |
| `Content-Disposition` | `attachment`; ASCII-compatible sanitized basename in `filename`, plus URL-encoded original basename in `filename*=UTF-8''...`. |
| `Content-Length` | Size of the local file in bytes. |
| `Cache-Control` | `private, no-store, max-age=0` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Robots-Tag` | `noindex, nofollow` |

The handler clears active output buffers before sending a successful response.
GET streams the complete local file using `readfile()` and exits. HEAD sends the
same headers without the file body and exits. It does not implement Range/206,
conditional GET/304, ETag, remote fetching or an asynchronous job. Use the original
media URL in players that need normal seeking/range delivery, not this endpoint.

### Failure handling

| Condition | Behaviour |
| --- | --- |
| No download path, or path normalization returns empty | Handler returns without serving a file; ordinary WordPress routing continues. This branch is **not** a guaranteed 404 response. |
| Valid-shaped path but missing/incorrect signature | Status 404, WordPress no-cache headers, exit without a JSON response. |
| Unresolvable upload base/file, path outside the real upload base, unreadable/non-file or non-MP3 target | Same 404 path. |
| Other method after path/signature/file validation | Status 405, `Allow: GET, HEAD`, no-cache headers, exit. |

These are not `WP_Error` REST responses. The server checks real paths to stop a
symlink from resolving outside the uploads directory. Extension checking does
not decode or validate the audio format itself. Delivery still depends on a
readable local file; remote-only/offloaded media with no local copy cannot be
served by this implementation.

## PHP functions

All functions require a loaded WordPress environment. These eight functions are
part of the complete PHP inventory in [wordpress.md](wordpress.md).

| Signature | Return | Exact role |
| --- | --- | --- |
| `dance_moves_epk_download_normalize_relative_path($relative_path)` | string | Nonstring becomes `''`. Replaces literal backslashes with forward slashes, trims, then URL-decodes. Rejects empty/absolute paths, colons, control characters, non-`.mp3` suffixes and empty, `.` or `..` segments. Returns joined normalized segments. Case of the extension is not significant. |
| `dance_moves_epk_download_relative_path_from_url($url)` | string | Nonstring/blank or unusable upload-base data becomes `''`. HTML-decodes the URL, parses URL/base, requires paths, checks any supplied host/scheme/port against the uploads base, URL-decodes paths, requires the base-path prefix plus `/`, then passes the relative suffix through normalization. |
| `dance_moves_epk_download_signature($relative_path)` | string | Hex `hash_hmac('sha256', $relative_path, wp_salt('auth'))`. Does **not** normalize or validate its argument; use the URL helper for callers' input. |
| `dance_moves_epk_download_url($relative_path)` | string | Normalizes input, returns `''` if rejected, otherwise adds path/signature query args to `home_url('/')`. Does not verify file existence/readability at URL-generation time. |
| `dance_moves_epk_download_query_vars($query_vars)` | array | Adds both query-variable names and returns unique indexed values. Registered on `query_vars`. |
| `dance_moves_epk_download_filter_content($content)` | string | Eligible-anchor rewrite described above. Registered on `the_content` at 30. Returns original string if no change. |
| `dance_moves_epk_download_not_found()` | no return; exits | Sends 404 and no-cache headers, then terminates. Internal response helper, not a template renderer. |
| `dance_moves_epk_download_serve()` | void or exits | Reads registered query vars, verifies signature with `hash_equals`, checks real local path/method, emits headers and optionally body, then exits for a handled request. |

URL comparison is against the **configured upload base**, which may differ from
the site's display hostname. The helper checks supplied URL components, so a
root-relative upload URL can qualify. A different CDN scheme, hostname, port or
path can prevent rewriting. Query strings/fragments are not preserved in the
new download URL. Path decoding occurs in both the URL-to-path helper and the
normalizer; pass original URLs rather than repeatedly encoding/decoding them.

A template that does not use the content filter can generate an escaped link:

```php
<?php
// Execute within a WordPress template, with an actual uploads-relative path.
if (function_exists('dance_moves_epk_download_url')) {
    $download = dance_moves_epk_download_url('2026/09/example-track.mp3');
    if ($download !== '') {
        printf('<a href="%s" download>Download MP3</a>', esc_url($download));
    }
}
```

For an attachment, resolve its URL then convert it to an uploads-relative path
with `dance_moves_epk_download_relative_path_from_url()`. The feature has no
special attachment-ID download helper. Never emit `wp_salt('auth')` to clients or
reuse the independent motion-capture token to sign downloads.

## Security and operational boundaries

A signature proves that the server generated a URL for this path. It is **not** a
per-user access check: there is no login, capability, per-link expiry, attachment
privacy check, nonce or rate limit in this endpoint. Anyone holding a valid URL
can reuse/share it while the file and signing salt remain valid. The original
media URL is not made private. Use a separate reviewed access-control design for
restricted media; do not treat this as one.

Changing the signing salt invalidates earlier URLs. A long-lived HTML cache can
therefore serve stale links after a salt change. That is an operational detail,
not a reason to expose salts or weaken signature validation. Successful signed
responses themselves request no-store caching.

For troubleshooting, distinguish failure to **rewrite** (attribute, content
filter, tag processor or URL-base mismatch) from failure to **serve** (signature,
local realpath/readability or method). Confirm that the player still uses the
original media URL and that a real download returns the attachment header.

## Tests

[epk-download-contract.test.cjs](../../tests/epk-download-contract.test.cjs) checks
source contracts. [validate-epk-download-paths.php](../../tests/validate-epk-download-paths.php)
exercises normalization, upload URL restrictions and stable URL generation in a
stubbed WordPress environment. They do not replace a staging HTTP test of GET,
HEAD, 404/405, filenames, cache behaviour, main-loop link rewriting and player
seekability with real WordPress, server headers and local uploads.
