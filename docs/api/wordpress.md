# WordPress, PHP and REST API reference

[Documentation index](../README.md) · [JavaScript API](javascript.md)

Source: [kieran-epk-device-orientation.php](../../kieran-epk-device-orientation.php).
Baseline: **2.8.0 / `4cb6a71f60459b5579be87d7e55ac8b1426c578e`**.
All PHP calls below run inside a loaded WordPress environment. Callback functions
are globally visible PHP symbols, not a promise of a separately versioned SDK.
Prefer the explicit configuration, sanitisation and validation helpers to invoking
registration, rendering or save callbacks manually.

## Constants

| Constant | Value / purpose |
| --- | --- |
| `DANCE_MOVES_VERSION` | `2.8.0` |
| `KS_EPK_ORIENTATION_VERSION` | Alias of `DANCE_MOVES_VERSION`. |
| `KS_EPK_MOTION_CAPTURE_TOKEN` | Existing fixed capture submission token; deliberately not reproduced here. It is in public source and is **not a deployment secret**. See the capture security section. |
| `DANCE_MOVES_META_BPM` | `_dance_moves_bpm` |
| `DANCE_MOVES_META_LYRIC_TIMING` | `_dance_moves_lyric_timing_id` |
| `DANCE_MOVES_META_CUE_TIMING` | `_dance_moves_cue_timing_id` |
| `DANCE_MOVES_META_LYRIC_POPUPS` | `_dance_moves_lyric_popups_enabled` |
| `DANCE_MOVES_META_MASTER_DURATION` | `_dance_moves_effect` | `string` / `""` | `dance_moves_sanitize_effect`: sanitised key restricted to `""` / `"paper-planes"`. | Yes |
| `_dance_moves_master_duration_ms` |
| `DANCE_MOVES_CLAY_STARS_PAGE_ID` | `252` |
| `DANCE_MOVES_META_EFFECT` | `_dance_moves_effect` |
| `DANCE_MOVES_DOWNLOAD_QUERY_VAR` | `dance_moves_download` |
| `DANCE_MOVES_DOWNLOAD_SIGNATURE_QUERY_VAR` | `dance_moves_download_signature` |

`KS_CLAY_STARS_EFFECTS_VERSION` is an **external legacy-plugin marker**, not a
constant defined here. Its presence suppresses DanceMoves' Clay effects assets
and content transformation. The plugin's own constants are defined unconditionally;
predefining them is not a supported configuration override mechanism.

## Page metadata

All keys are registered for post type `page`, as single values, with
`revisions_enabled: true`. `dance_moves_meta_auth()` requires
`current_user_can('edit_post', $post_id)`. The plugin also adds the six keys to
`wp_post_revision_meta_keys`. Revision support still depends on the site's
WordPress version and revision configuration.

| Key | Registered type / default | Sanitiser | Standard REST exposure |
| --- | --- | --- | --- |
| `_dance_moves_bpm` | `number` / 0 | Finite 20–400, rounded to 3 decimals; invalid/blank becomes `''`. | Yes |
| `_dance_moves_lyric_timing_id` | `integer` / 0 | `absint()` only. | Yes |
| `_dance_moves_cue_timing_id` | `integer` / 0 | `absint()` only. | Yes |
| `_dance_moves_lyric_popups_enabled` | `boolean` / false | `rest_sanitize_boolean`. | Yes |
| `_dance_moves_effect` | `string` / `""` | `dance_moves_sanitize_effect`: sanitised key restricted to `""` / `"paper-planes"`. | Yes |
| `_dance_moves_master_duration_ms` | `number` / 0 | Positive finite milliseconds, at most 86,400,000, rounded to 3 decimals; otherwise 0. | **No** |

These are metadata on the ordinary WordPress Page REST resource, not a separate
`/dance-moves` endpoint. The usual resource is `/wp-json/wp/v2/pages/<id>`; use the
site's actual REST root, including a subdirectory or `?rest_route=` form where
applicable. Normal WordPress authentication and edit permissions apply to writes.

Illustrative **authenticated** page update body:

```json
{
  "meta": {
    "_dance_moves_bpm": 120,
    "_dance_moves_lyric_timing_id": 1234,
    "_dance_moves_cue_timing_id": 1235,
    "_dance_moves_lyric_popups_enabled": false,
    "_dance_moves_effect": ""
  }
}
```

The attachment IDs above are examples, not existing media. Use IDs validated for
this site. The editor's invalid-value preservation and full attachment-content
validation are **not** implemented as REST pre-update validation. A REST write
only uses registered type/schema checks and sanitisation; `absint()` does not
prove attachment type, readability, file extension, UTF-8 or timing order.
Do not send an empty string as though it were a valid REST number: use a validated
BPM or clear metadata through an appropriate trusted WordPress path. Defaults
such as zero mean unknown, not a valid musical BPM.

### Trusted PHP integration

Validate before calling `update_post_meta()`, and retain the caller's own nonce
and capability checks for any custom admin endpoint. Example inside an authorised
save operation, with `$page_id` and `$attachment_id` already resolved:

```php
if (!current_user_can('edit_post', $page_id)) {
    return;
}
$valid = dance_moves_validate_timing_attachment($attachment_id, 'lyric');
if (is_wp_error($valid)) {
    // Return/display this error through the calling integration's error path.
    return;
}
update_post_meta($page_id, DANCE_MOVES_META_LYRIC_TIMING, absint($attachment_id));

$duration = dance_moves_sanitize_duration(183420.125);
if ($duration > 0) {
    update_post_meta($page_id, DANCE_MOVES_META_MASTER_DURATION, $duration);
}
$config = dance_moves_get_page_config($page_id);
```

This does not authorise an unauthenticated caller or implement a complete custom
save route. `update_post_meta()` is not a substitute for the integration's access
control, and individual field updates are not an atomic multi-field transaction.

## Configuration and sanitisation helpers

| Function | Return and behaviour |
| --- | --- |
| `dance_moves_orientation_adapters()` | `array<int,string>` mapping the nine configured Page IDs to adapter names; see [adapters](adapters.md#orientation-page-map). |
| `dance_moves_shared_control_pages()` | Array of Page IDs receiving 8-tick shared-control transitions: `250, 254, 260, 262, 264, 266, 272, 274, 278, 280, 282, 284, 286, 288, 290, 292, 294, 296, 300, 302, 304, 306, 308, 312, 314, 316, 318, 320, 322`. |
| `dance_moves_lyric_disclosure_ticks($page_id)` | `5` for 130, `7` for 243, otherwise `6`. |
| `dance_moves_attachment_url($attachment_id)` | Absolute integer ID lookup with `wp_get_attachment_url()` and `esc_url_raw()`; empty string for no ID/unusable URL. Does not run timing validation. |
| `dance_moves_get_page_config($page_id)` | Configuration array described below. Reads page meta, resolves URLs and assigns fallback BPM/provenance. No writes. |
| `dance_moves_sanitize_bpm($value)` | Number rounded to 3 decimals for finite numeric 20–400; `''` for blank/null/invalid input. |
| `dance_moves_sanitize_attachment_id($value)` | `absint($value)`; no existence or content check. |
| `dance_moves_sanitize_duration($value)` | Positive finite milliseconds up to one day, rounded to 3 decimals; otherwise 0. |
| `dance_moves_sanitize_effect($value)` | Runs `sanitize_key((string) $value)`, accepts only empty string or `paper-planes`, otherwise returns empty string. |
| `dance_moves_meta_auth($allowed, $meta_key, $post_id)` | Boolean from `current_user_can('edit_post', $post_id)`; the first two arguments do not alter the decision. |
| `ks_epk_motion_finite_number($value, $minimum, $maximum)` | Float for numeric, finite, inclusive-range input, otherwise `null`. Numeric strings are accepted. |

`dance_moves_get_page_config()` returns all of:
`pageId`, `version`, `bpm`, `bpmSource`, `fallbackBpm`, `lyricTimingUrl`,
`lyricPopupsEnabled`, `cueTimingUrl`, `masterDurationMilliseconds`,
`tickDefinition`, `ticksPerBeat`, `longDurationQuantumTicks`, `sharedControlTicks`,
`lyricDisclosureTicks`, `effect`. See the [boot table](javascript.md#boot-object-windowdancemovesconfig)
for their values. This helper does not emit `diagnostics` or a capture credential.
Its read-time duration check accepts a positive numeric value; use the duration
sanitiser on writes rather than relying on this reader to enforce the one-day cap.

## Timing attachment validation

### `dance_moves_validate_timing_attachment($attachment_id, $kind)`

Returns `true` or `WP_Error`. Zero/empty ID is a valid cleared selection. `$kind`
equal to `'lyric'` permits only `.lrc`; every other kind uses the cue extension
set `.lrc`/`.cue`. This is not an enum-validating argument.

| Error code | Validation failure |
| --- | --- |
| `dance_moves_attachment` | ID is not a WordPress attachment. |
| `dance_moves_file` | Missing/unreadable path, or file larger than 1 MiB. |
| `dance_moves_extension` | Extension invalid for the selected field. |
| `dance_moves_utf8` | Unreadable contents, invalid UTF-8, null or U+FFFD replacement character. |
| `dance_moves_timestamps` | No recognised bracketed timestamp token. |
| `dance_moves_order` | Timestamp tokens decrease in physical file order. |

The validator does not check media ownership, attachment-level read permission,
lyric accuracy, master identity, a seconds-field range of 00–59, or whether the
file contains a nonblank displayable lyric. It reads `get_attached_file()` locally;
remote-only offloaded media may need an accessible local copy for editor validation.

### Upload hooks versus selection validation

`dance_moves_timing_upload_mimes($mimes)` returns the array with `lrc` and `cue`
set to `text/plain`.

`dance_moves_timing_filetype($data, $file, $filename, $mimes)` is the four-argument
`wp_check_filetype_and_ext` filter. For recognised extensions with readable
contents no larger than 1 MiB, no nulls and valid UTF-8, it sets `ext`, `type` and
`proper_filename`. Otherwise it returns the incoming data unchanged. It does
**not** perform the selection validator's timestamp-order or replacement-character
checks, and returning unchanged data is not itself a guaranteed upload rejection.
The full validator runs when the Page editor saves the selected attachment.

## Motion-capture REST API

### Endpoint and permission contract

```text
POST <WordPress REST root>/ks-epk-motion/v1/capture
Content-Type: application/json
X-KS-Motion-Token: <operator-supplied value; not reproduced here>
```

Implemented by `ks_epk_motion_register_rest_route()` using
`WP_REST_Server::CREATABLE`, permission callback
`ks_epk_motion_capture_permission(WP_REST_Request $request)` and handler
`ks_epk_motion_store_capture(WP_REST_Request $request)`.

Permission processing, in order:

1. Compare the supplied header with the fixed token using `hash_equals()`.
2. When `get_http_origin()` returns an origin, require it to equal `home_url()`
   after trailing-slash removal. A missing Origin is **not rejected**.
3. Rate-limit by a transient keyed from MD5 of `REMOTE_ADDR` (or `'unknown'`).
   Eight accepted permission checks are allowed before a 429. Each allowed check
   writes a new ten-minute expiry; this is not a rigorously sliding-window quota.
   A later-invalid payload still consumes a permission-check attempt.

**Security limitation:** the token is embedded in this public repository. The
endpoint does not require a logged-in user, a WordPress capability or a WordPress
nonce. Origin checking and a shared IP transient do not turn a published constant
into authentication. Do not document this as a secure secret-protected upload
service. Restrict/disable access or implement genuine authenticated capture
submission before relying on it in a new deployment. This documentation patch
does not change the endpoint's security model or rotate its constant.

### Request shape

Required: `schema` exactly `"ks-epk-motion-recording/v1"`, and `samples`, an array
of **1–500** sample objects. The entire request is treated as untrusted data.
Unknown fields are discarded when the clean payload is built.

| Top-level field | Accepted / stored behaviour |
| --- | --- |
| `schema` | Required exact schema string. |
| `capturedAt` | Sanitised text, default `""`; not parsed as a date. |
| `userAgent` | Sanitised text, default `""`. |
| `screenAngle` | Finite numeric -360–360, default 0; invalid becomes `null`. |
| `targetDurationMilliseconds` | Finite numeric 0–120000, default 0; invalid becomes `null`. |
| `captureDurationMilliseconds` | Same range/default. |
| `sampledDurationMilliseconds` | Same range/default. |
| `processedPairCount` | `absint()`, capped at 100000; defaults to validated sample count. |
| `storedSampleCount` | Recomputed from samples; a supplied value is ignored. |
| `storageIntervalMilliseconds` | Finite numeric 0–120000, default 0; invalid becomes `null`. |
| `sampleStrategy` | `sanitize_key()`, default `"legacy"`. |
| `fullWindowObserved` | Boolean derived with `!empty()`. |
| `expectedDifference` | Sanitised text, default `""`. |
| `passed` | Boolean derived with `!empty()`; this is a caller claim, not server-verified conformance. |
| `failureCount` | `absint()`, capped at 100000; defaults to cleaned failure count. |
| `failures` | Optional array; only first 100 input entries considered, nonobjects skipped. |
| `samples` | Required 1–500 valid sample objects. |

Each sample:

| Field | Validation / output |
| --- | --- |
| `milliseconds` | Required numeric finite 0–120000. |
| `beta` | Required numeric finite -180–180. |
| `gamma` | Required numeric finite -90–90. |
| `alpha` | Optional/null; otherwise numeric finite 0–360; invalid becomes `null`. |
| `screenAngle` | Optional numeric finite -360–360, default 0; invalid becomes `null`. |
| `absolute` | Boolean from `!empty()`. |
| `nativeTrusted` | Boolean from `!empty()`; not independently authenticated. |
| `simulatedTrusted` | Boolean from `!empty()`. |
| `fieldParity` | Boolean from `!empty()`. |
| `dispatchParity` | Boolean from `!empty()`. |
| `mapperParity` | Boolean from `!empty()`. |

A nonobject sample or invalid `milliseconds`/`beta`/`gamma` invalidates the whole
capture; samples are not silently removed on a successful submission. Numeric
strings pass `is_numeric()`. Sample ordering, actual observation duration, event
trust and parity are not verified by this endpoint. Use JSON booleans, not strings
such as `"false"`, since PHP `!empty()` treats nonempty strings as true.

Each retained failure becomes:
`{type: sanitize_key(string or "unknown"), sample: absint or null,
validPairs: absint or null}`. The supplied counts do not have to agree with the
booleans or retained arrays.

Minimal illustrative request (not a physical-device acceptance record):

```json
{
  "schema": "ks-epk-motion-recording/v1",
  "capturedAt": "2026-09-29T00:00:00Z",
  "passed": false,
  "sampleStrategy": "manual-example",
  "samples": [
    {"milliseconds": 0, "alpha": null, "beta": 0, "gamma": 0, "screenAngle": 0}
  ]
}
```

### Response, errors and storage

Success returns a normal REST response (no explicit 201 status is set):

```json
{"captureId": 123, "sampleCount": 1, "storedPrivately": true}
```

| HTTP status | Error code | Meaning |
| --- | --- | --- |
| 403 | `ks_motion_forbidden` | Missing/wrong token. |
| 403 | `ks_motion_origin` | Supplied origin does not match the site. |
| 429 | `ks_motion_rate` | Permission-check quota exhausted. |
| 400 | `ks_motion_schema` | Missing/wrong schema or nonarray JSON payload. |
| 400 | `ks_motion_samples` | Missing/nonarray samples or input count outside 1–500. |
| 400 | `ks_motion_invalid_samples` | At least one required sample field is invalid. |
| 413 | `ks_motion_size` | Clean JSON encoding fails or exceeds 262144 bytes. |
| WordPress-defined | WordPress insertion error | A `WP_Error` from `wp_insert_post()` is passed through. |

The size limit is on the **sanitised, pretty-printed encoded payload**, not an
up-front raw request-body limiter. Normal WordPress/server request parsing and
limits remain separate.

A successful record is a `private` post of type `ks_motion_capture`, titled
`Phone motion capture <site-local date/time>`, with the cleaned JSON in
`post_content`. Extra metadata: `_ks_motion_passed` (`'1'`/`'0'`),
`_ks_motion_sample_count`, and `_ks_motion_sha256` (hash of stored encoded JSON).
The post type has a Tools-menu UI, title/editor support, `public: false`,
`show_in_rest: false`, and default mapped post capabilities; no custom
administrator-only capability scheme is defined.

There is **no plugin GET/list/delete capture REST route, retention job, automatic
capture upload, or cryptographic proof of native sensor provenance**. Private
storage does not mean anonymous data or verified evidence. Review data retention
and access through normal authorised WordPress operations.

## Enqueued asset contract

| Handle | Type | Dependencies | Scope |
| --- | --- | --- | --- |
| `dance-moves-core` | CSS and JS | None | Singular Pages; JS in footer; localises `danceMovesConfig`. |
| `dance-moves-effects` | JS | `dance-moves-core` | Singular Pages; footer; installs `DanceMovesEffects`. |
| `dance-moves-paper-dreams` | CSS and JS | `dance-moves-core` for both | Only when `effect === "paper-planes"`; JS localises `danceMovesPaperDreamsConfig`; footer. |
| `dance-moves-catalogue-timing` | JS | `dance-moves-core`, `dance-moves-effects` | Same Page gate; footer. |
| `dance-moves-clay-stars` | CSS and JS | JS: `dance-moves-core` | Page 252, only without the legacy marker. |
| `ks-epk-device-orientation` | CSS | None | Configured orientation pages. |
| `ks-epk-device-orientation-core` | JS | None | Configured orientation pages. |
| `ks-epk-device-orientation` | JS | Orientation core and `dance-moves-core`; also Clay JS when applicable | Localises `ksEpkOrientationConfig`; footer. |
| `dance-moves-admin` | JS | `jquery` | Page editing on `post.php` / `post-new.php`; loads the Media Library picker. |

Runtime asset versions use the plugin version. To load a page integration, enqueue
it with `array('dance-moves-core')` for core-only consumers or
`array('dance-moves-effects')` for shared primitives; add `dance-moves-catalogue-timing` or
`dance-moves-clay-stars` when those optional surfaces are actually required and
available. Do not assume a root exists merely because the shared script loaded.

## Registered hooks and callback reference

These are WordPress hooks **consumed** by the plugin, not plugin-defined extension
hooks. Default priority is 10 unless shown. No `apply_filters('dance_moves_...')`
or `do_action('dance_moves_...')` extension contract is exposed in this baseline.

| Hook | Callback | Role |
| --- | --- | --- |
| `wp_enqueue_scripts` (20) | `ks_epk_orientation_enqueue_runtime()` | Enqueues assets/localises configuration after Page gating; returns no value. |
| `init` | `ks_epk_motion_register_capture_type()` | Registers private capture post type; no value. |
| `init` | `dance_moves_register_page_meta()` | Registers the six Page-meta schemas; no value. |
| `rest_api_init` | `ks_epk_motion_register_rest_route()` | Registers capture POST route; no value. |
| `wp_post_revision_meta_keys` | `dance_moves_revision_meta_keys($keys)` | Returns unique merge of incoming keys and the six DanceMoves keys. |
| `add_meta_boxes_page` | `dance_moves_add_meta_box()` | Registers side/default `dance-moves-epk-timing` meta box; no value. |
| `admin_enqueue_scripts` | `dance_moves_admin_assets($hook)` | Loads Page-editor media/admin JS when the screen matches; no value. |
| `upload_mimes` | `dance_moves_timing_upload_mimes($mimes)` | Adds the two text MIME extensions. |
| `wp_check_filetype_and_ext` (10; 4 arguments) | `dance_moves_timing_filetype($data, $file, $filename, $mimes)` | See upload validation above. |
| `admin_notices` | `dance_moves_admin_notice()` | Reads/deletes the current user's queued transient and prints escaped error HTML, or returns without output. |
| `save_post_page` | `dance_moves_save_page_meta($post_id)` | Nonce/capability/autosave checks, per-field preservation/clear/update, popup checkbox and ambient-effect persistence; no value. Blank/invalid/missing effect clears its metadata. |
| `query_vars` | `dance_moves_epk_download_query_vars($query_vars)` | Adds the two signed-download query vars; unique array returned. |
| `the_content` (30) | `dance_moves_epk_download_filter_content($content)` | Rewrites eligible MP3 download anchors on main Page content; see [downloads](downloads.md). |
| `template_redirect` (0) | `dance_moves_epk_download_serve()` | Validates/serves signed MP3 GET/HEAD requests; terminates handled requests. |
| `the_content` (20) | `dance_moves_clay_stars_filter_content($content)` | Conditionally returns transformed Clay markup. |

The eight `dance_moves_epk_download_*` functions have complete signatures and
contracts in the [download API](downloads.md#php-functions). Together with that
reference and `dance_moves_sanitize_effect()`, the tables cover all **38** global
PHP functions in 2.8.0.

Additional callbacks/helpers:

| Function | Contract |
| --- | --- |
| `dance_moves_file_field($post_id, $label, $field_name, $meta_key, $allowed_extensions)` | Prints escaped file-picker markup, hidden attachment ID, status text, view/choose/clear controls; no return value. |
| `dance_moves_render_meta_box($post)` | Prints the nonce, BPM/file inputs and opt-in checkbox plus Ambient effect selector for `$post->ID`; no return value. |
| `dance_moves_queue_admin_error($message)` | Stores sanitised text at `dance_moves_admin_error_<user-id>` for 60 seconds; subsequent errors overwrite the same transient. |
| `dance_moves_clay_stars_is_target()` | Boolean `is_page(252)`. |
| `dance_moves_clay_stars_filter_content($content)` | Returns input unchanged in admin, off-target, outside the main loop/query, while the legacy constant exists, or without `ks-clay-stars-v2`. Otherwise conditionally inserts warm-bloom/lens/specular and cloud spans, removes the old `ks-clay-stars-v2-script`, and returns the string (empty on a nonstring replacement result). It transforms output, not stored Page content. |

`ks_epk_motion_capture_permission()` and `ks_epk_motion_store_capture()` are fully
specified in the capture section; all remaining global functions appear in the
configuration, upload, validation or hook tables, and the download reference. No PHP classes are defined.
