# JavaScript host services (Node)

Import from `@kieransimkin/dancemoves/server` only on the server. Node 22.14+
is the package baseline; Next route handlers must use `runtime = 'nodejs'`, not
Edge. The main browser entry contains no filesystem/signing/capture secret.

WordPress retains its existing PHP endpoints and native storage. These services
provide the corresponding operations to another host; there is no attempt to
turn a browser into WordPress or to reuse its public fixed capture token as an
application authentication scheme.

## Page properties and revisions

`validatePageConfig(input)` and `fromWordPressMeta(meta, attachmentResolver)` have
the same contracts as the main entry. Validation must run on the server before
persisting untrusted updates even when the React form already validated them.
Only persist fields the authenticated caller is allowed to change.

`createMemoryPageStore({maxPages:100,maxRevisions:20})` provides:

```js
const record = pages.save('arcadians', {bpm:145}, {expectedRevision:0});
const current = pages.read('arcadians');
const history = pages.revisions('arcadians');
const restored = pages.restore('arcadians', record.revision,
  {expectedRevision:current.revision});
pages.delete('arcadians');
```

Records are `{revision,config,savedAt}`. Read operations return clones; restore
creates a new revision. A revision mismatch or exceeded page limit fails. This
bounded store demonstrates the contract, not a durable production database. Use
an application transaction/optimistic lock for durable multi-process storage.

## Timing upload validation

`validateTimingFile(textOrUint8Array, {kind:'cue',filename?,maxBytes:1048576})`
returns frozen `{text,kind,bytes,timestamps}`. It accepts lyric `.lrc` or cue
`.lrc`/`.cue` extensions, strict UTF-8, no null/replacement characters, at least
one bracketed timestamp and monotonically ordered timestamps. Equal times and
lyric clear lines are retained. File parsing into browser events is provided by
the canonical runtime's parser methods.

Failure uses `ValidationError` with `code`, `message` and `status`. Relevant codes
are `timing_extension`, `timing_size` (413), `timing_utf8`, `timing_timestamps` and
`timing_order` (400). Invalid option types throw `TypeError`.

Validate uploaded bytes and server-owned filenames. This API does not fetch
arbitrary remote timing URLs; adding such a feature to your host requires SSRF,
redirect, size and content-type controls. The `.cue` convention is bracketed
musical cues, not the unrelated CD INDEX syntax.

## Signed MP3 attachment delivery

```js
import {createDownloadService} from '@kieransimkin/dancemoves/server';
const downloads = createDownloadService({
  rootDirectory: '/srv/my-app/media',
  secret: process.env.DANCEMOVES_DOWNLOAD_SECRET,
  origin: 'https://music.example',
  route: '/api/download'
});
const attachmentUrl = downloads.sign('arcadians.mp3');
const response = await downloads.handle(request);
```

`rootDirectory` must be absolute. `secret` is a server-only string/Uint8Array of at
least 32 bytes. `origin` must be HTTP(S), and route a same-origin absolute path
without query/fragment. `sign` returns a URL with normalized relative MP3 `path`
and HMAC-SHA256 `signature` query fields. Unsafe input throws `ValidationError`.

`normalizeDownloadPath(value)` returns the safe decoded relative path or an
empty string. It rejects traversal, absolute/drive paths, controls, empty path
segments and non-MP3 suffixes. Signature comparison is timing-safe. The handler
resolves the real filesystem path and verifies containment below the allowed
root; symlink escapes are rejected. Do not give an untrusted writer control over
that directory while serving it.

`handle(Request)` returns a Web `Response`: 200 for valid GET/HEAD, 404 for an
invalid signature/path/missing file, and 405 (`Allow: GET, HEAD`) for other methods
with otherwise valid routing. It sends `Content-Type: audio/mpeg`, exact content
length, UTF-8 attachment filename, `nosniff`, `noindex` and private/no-store cache
headers. HEAD closes the file without a response body. GET streams the file and
closes its handle.

Playback and download are deliberately separate. Use the ordinary static media
URL for `<audio>` so the host can provide range requests. The signed attachment
handler does not implement playback ranges or rewrite audio/source elements.
Render the signed URL on an `<a download>` element. A valid signature demonstrates
a server-produced path, not that the visitor bought access; implement additional
authorization where needed. Rotating the secret invalidates old links.

## Private motion capture

`validateMotionCapture(payload)` validates and sanitizes the inherited
`ks-epk-motion-recording/v1` schema. It requires 1–500 samples; finite timestamp
0–120000ms, beta -180..180 and gamma -90..90; alpha may be null/0..360.
Optional sample/capture flags and bounded descriptive fields are preserved.
Invalid nullable optional numeric fields become null, following the existing
schema's permissive optional-field policy. It caps failure records/counters and
the sanitized JSON size. The new HTTP boundary also bounds the incoming body
before JSON parsing, including chunked requests without Content-Length.

```js
import {createCaptureHandler} from '@kieransimkin/dancemoves/server';
const POST = createCaptureHandler({
  allowedOrigin: 'https://music.example',
  authorize: request => sessions.canCapture(request),
  rateLimit: request => limits.consumeVerifiedUser(request),
  store: async (capture, {visibility, request}) => {
    const id = await database.storePrivateCapture(capture, request);
    return {captureId:id, storedPrivately:true};
  }
});
```

All three callbacks are required. `authorize` and `rateLimit` return booleans or
Promises. `store` receives `{visibility:'private',request}` and must return a
truthy `captureId` and **`storedPrivately:true`**. The flag is a contract with the
host, not a substitute for real storage permissions. The library cannot verify
how a custom database adapter publishes its rows.

Responses are JSON, no-store:

| Condition | Status/code |
|---|---|
| Not POST | 405 `method_not_allowed`, Allow POST |
| Wrong or malformed supplied Origin | 403 `ks_motion_origin` |
| Authorization denied | 403 `ks_motion_forbidden` |
| Rate limit denied | 429 `ks_motion_rate`, Retry-After 600 |
| Not application/json | 415 `ks_motion_content_type` |
| Invalid schema/body/samples | 400 `ks_motion_schema`, `ks_motion_samples`, `ks_motion_invalid_samples` |
| Body/sanitized payload too large | 413 `ks_motion_size` |
| Storage/callback failed or did not confirm privacy | 500 `ks_motion_server`, with no internal error details |
| Success | 200 `{captureId,sampleCount,storedPrivately:true}` |

A missing Origin is not automatically authorization; the mandatory authorization
callback must still succeed. With cookie/session authentication, enforce your
host's CSRF policy. Do not authorize based on an untrusted payload flag or
forwarded IP header. Native/simulated/parity flags remain **client-reported**.

`createMemoryRateLimiter({limit:8,windowMilliseconds:600000,maxKeys:10000,now})`
returns `{consume(key)}`. It expires old keys, bounds key count and fails closed
when capacity is reached. This is for local demos/single-process applications;
replicas or serverless hosts need a shared atomic limiter.

The Next demo's private storage path is checked both lexically and through
realpath against `public/`. New files use exclusive creation and private POSIX
modes where supported. Production ACLs, backups, retention, user access and
data-protection policy remain the host's responsibility.
