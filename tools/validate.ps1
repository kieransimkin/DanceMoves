[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-migration-manifest.ps1') | Write-Output

Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Filter '*.php' | ForEach-Object {
    & php -l $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "PHP syntax failed: $($_.FullName)" }
}

Get-ChildItem -LiteralPath $repoRoot -Recurse -File | Where-Object { $_.Extension -in @('.js', '.cjs') } | ForEach-Object {
    & node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax failed: $($_.FullName)" }
}

Get-ChildItem -LiteralPath (Join-Path $repoRoot 'tests') -File -Filter '*.test.cjs' | Sort-Object Name | ForEach-Object {
    & node $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Test failed: $($_.Name)" }
}

& php (Join-Path $repoRoot 'tests\validate-clay-transform.php')
if ($LASTEXITCODE -ne 0) { throw 'Clay/Stars content-transform validation failed.' }

$strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
$textExtensions = @('.php', '.js', '.cjs', '.css', '.md', '.html', '.json', '.tsv', '.ps1', '.lrc')
Get-ChildItem -LiteralPath $repoRoot -Recurse -File | Where-Object {
    $_.Extension -in $textExtensions -and $_.FullName -notlike '*\dist\*'
} | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    try {
        $text = $strictUtf8.GetString($bytes)
    } catch {
        throw "Strict UTF-8 decoding failed: $($_.FullName)"
    }
    if ($text.Contains([char]0xFFFD)) {
        throw "Replacement character found: $($_.FullName)"
    }
}

$entrypoint = Get-Content -LiteralPath (Join-Path $repoRoot 'kieran-epk-device-orientation.php') -Raw -Encoding UTF8
if ($entrypoint -notmatch 'Plugin Name:\s*DanceMoves' -or $entrypoint -notmatch 'Version:\s*2\.0\.0') {
    throw 'WordPress plugin name/version contract failed.'
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'package.ps1') | Write-Output
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }

$packageManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'dist\DanceMoves-2.0.0-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $packageManifest.root_entrypoint_present -or -not $packageManifest.forward_slash_entries) {
    throw 'Package layout validation failed.'
}
if (@($packageManifest.files | Where-Object { $_.path -match '/(?:tests|tools|qa|migration)/' }).Count -ne 0) {
    throw 'Development-only files leaked into the WordPress package.'
}

Write-Output 'DanceMoves validation passed.'
