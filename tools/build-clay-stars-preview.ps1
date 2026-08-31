[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = 'Z:\My Songs\Releases\Made from the clay and the stars\wordpress-warm-light-effects-2026-08-31\qa-published-signed-out.html'
$outputDirectory = Join-Path $repoRoot 'qa'
$output = Join-Path $outputDirectory 'clay-stars-merged-preview.html'

$html = Get-Content -LiteralPath $source -Raw -Encoding UTF8
$html = [regex]::Replace($html, '<link[^>]+kieran-made-from-clay-stars-epk-effects/assets/effects\.css[^>]*>', '<link rel="stylesheet" href="../assets/clay-stars-effects.css?ver=2.0.0-local">', 1)
$html = [regex]::Replace($html, '<script[^>]+kieran-made-from-clay-stars-epk-effects/assets/effects\.js[^>]*></script>', '', 1)
$coreStyle = '<link rel="stylesheet" href="../assets/dance-moves-core.css?ver=2.0.0-local">'
$html = $html -replace '</head>', ($coreStyle + "`n</head>")
$scripts = @'
<script>window.danceMovesConfig={pageId:252,version:"2.0.0",bpm:116,bpmSource:"explicit",lyricTimingUrl:"",cueTimingUrl:"",masterDurationMilliseconds:359523.56};</script>
<script src="../assets/dance-moves-core.js"></script>
<script src="../assets/clay-stars-effects.js"></script>
'@
$html = $html -replace '</body>', ($scripts + "`n</body>")

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$html | Set-Content -LiteralPath $output -Encoding UTF8
Write-Output $output
