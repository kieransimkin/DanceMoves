[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = "Z:\My Songs\Releases\California Screamin'\WordPress Migration\california-screamin-wordpress-payload-final.txt"
$output = Join-Path $repoRoot 'qa\california-screamin-harness-candidate.html'
$payload = Get-Content -LiteralPath $source -Raw -Encoding UTF8

if (([regex]::Matches($payload, 'id="cs-epk"')).Count -ne 1 -or $payload -notmatch 'data-release="california-screamin"') {
    throw 'Canonical California Screamin payload does not contain exactly one expected release root.'
}

$head = @'
<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>California Screamin' - DanceMoves 2.3.5 harness</title>
  <link rel="stylesheet" href="../assets/dance-moves-core.css?ver=2.3.5-local">
  <link rel="stylesheet" href="../assets/ks-epk-device-orientation.css?ver=2.3.5-local">
</head>
<body>
'@

$tail = @'
<script>window.danceMovesConfig={pageId:839,version:"2.3.5",bpm:110,bpmSource:"explicit",lyricTimingUrl:"",cueTimingUrl:"",masterDurationMilliseconds:212007.46,diagnostics:true};</script>
<script src="../assets/dance-moves-core.js?ver=2.3.5-local"></script>
<script src="../assets/dance-moves-catalogue-timing.js?ver=2.3.5-local"></script>
<script src="../assets/ks-epk-device-orientation-core.js?ver=2.3.5-local"></script>
<script>window.ksEpkOrientationConfig={adapter:"california-screamin",pageId:839,version:"2.3.5",bpm:110,bpmSource:"explicit",ticksPerBeat:16,transitionTargetTicks:2,harness:true};</script>
<script src="../assets/ks-epk-device-orientation.js?ver=2.3.5-local"></script>
<script src="../tests/harness/california-screamin/effect-under-test-adapter.js"></script>
<script src="../tests/harness/plugin-core/harness-bridge.js"></script>
</body>
</html>
'@

$html = $head + "`n" + $payload + "`n" + $tail
if (([regex]::Matches($html, 'id="cs-epk"')).Count -ne 1 -or
    ([regex]::Matches($html, 'ks-epk-device-orientation\.js\?ver=2\.3\.5-local')).Count -ne 1) {
    throw 'California Screamin candidate root or DanceMoves version-parity check failed.'
}

New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null
$html | Set-Content -LiteralPath $output -Encoding UTF8
Write-Output $output
