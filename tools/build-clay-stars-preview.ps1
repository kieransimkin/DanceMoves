[CmdletBinding()]
param(
    [switch]$Harness
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot 'qa\prelive\clay-stars\canonical-live-2.3.2.html'
$expectedSourceHash = '2F3EC40E763E712CCFD5F94C818E0D651F9F98EF8CA925FEB05A9F39D464B038'
$outputDirectory = Join-Path $repoRoot 'qa'
$output = Join-Path $outputDirectory $(if ($Harness) { 'clay-stars-harness-candidate.html' } else { 'clay-stars-merged-preview.html' })

if (-not (Test-Path -LiteralPath $source)) {
    throw "Canonical Clay/Stars signed-out fixture is missing: $source"
}
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
if ($sourceHash -ne $expectedSourceHash) {
    throw "Canonical Clay/Stars fixture hash mismatch: expected $expectedSourceHash, received $sourceHash"
}

$html = Get-Content -LiteralPath $source -Raw -Encoding UTF8
if ($html -notmatch '<title>Made from the clay and the stars \(Anunnaki\)' -or
    ([regex]::Matches($html, 'class="[^"]*ks-clay-stars-v2[^"]*"')).Count -ne 1 -or
    ([regex]::Matches($html, '<audio\b')).Count -ne 1 -or
    ([regex]::Matches($html, '<button[^>]+data-time=')).Count -ne 5 -or
    $html -match 'id=["'']wpadminbar["'']') {
    throw 'Canonical Clay/Stars fixture identity or parity check failed.'
}

$html = [regex]::Replace($html, '<link[^>]+id=[^ >]+dance-moves-core-css[^ >]+[^>]*>', '<link rel="stylesheet" id="dance-moves-core-css" href="../assets/dance-moves-core.css?ver=2.3.5-local">', 1)
$html = [regex]::Replace($html, '<link[^>]+id=[^ >]+dance-moves-clay-stars-css[^ >]+[^>]*>', '<link rel="stylesheet" id="dance-moves-clay-stars-css" href="../assets/clay-stars-effects.css?ver=2.3.5-local">', 1)
$html = [regex]::Replace($html, '<link[^>]+id=[^ >]+ks-epk-device-orientation-css[^ >]+[^>]*>', '<link rel="stylesheet" id="ks-epk-device-orientation-css" href="../assets/ks-epk-device-orientation.css?ver=2.3.5-local">', 1)
$pluginScripts = '<script[^>]+id=[^ >]+(?:dance-moves-core-js(?:-extra)?|dance-moves-catalogue-timing-js|dance-moves-clay-stars-js|ks-epk-device-orientation-core-js|ks-epk-device-orientation-js(?:-extra)?)[^ >]+[^>]*>[\s\S]*?</script>'
$html = [regex]::Replace($html, $pluginScripts, '')
$probe = if ($Harness) { '<script src="../tests/harness/plugin-core/harness-probe.js"></script>' } else { '' }
if ($probe) {
    $html = $html -replace '</head>', ($probe + "`n</head>")
}
$scripts = @'
<script>window.danceMovesConfig={pageId:252,version:"2.3.5",bpm:90,bpmSource:"explicit",lyricTimingUrl:"",cueTimingUrl:"",masterDurationMilliseconds:359523.56,diagnostics:true};</script>
<script src="../assets/dance-moves-core.js?ver=2.3.5-local"></script>
<script src="../assets/dance-moves-catalogue-timing.js?ver=2.3.5-local"></script>
<script src="../assets/clay-stars-effects.js?ver=2.3.5-local"></script>
<script src="../assets/ks-epk-device-orientation-core.js?ver=2.3.5-local"></script>
<script>window.ksEpkOrientationConfig={adapter:"clay-stars",pageId:252,version:"2.3.5",bpm:90,bpmSource:"explicit",ticksPerBeat:16,transitionTargetTicks:2,harness:true};</script>
<script src="../assets/ks-epk-device-orientation.js?ver=2.3.5-local"></script>
'@
if ($Harness) {
    $scripts += @'
<script src="../tests/harness/clay-stars/effect-under-test-adapter.js"></script>
<script src="../tests/harness/plugin-core/harness-bridge.js"></script>
'@
}
$html = $html -replace '</body>', ($scripts + "`n</body>")

if ($html -match 'wp-content/plugins/kieran-epk-device-orientation' -or
    ([regex]::Matches($html, 'dance-moves-core\.js\?ver=2\.3\.5-local')).Count -ne 1 -or
    ([regex]::Matches($html, 'clay-stars-effects\.js\?ver=2\.3\.5-local')).Count -ne 1) {
    throw 'Candidate asset replacement or version-parity check failed.'
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$html | Set-Content -LiteralPath $output -Encoding UTF8
Write-Output $output
