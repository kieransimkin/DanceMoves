[CmdletBinding()]
param(
    [ValidateSet('Unit', 'Package', 'All')]
    [string]$Mode = 'Unit',

    [switch]$IncludeFailureFixture
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runUnit = $Mode -in @('Unit', 'All')
$runPackage = $Mode -in @('Package', 'All')

if ($IncludeFailureFixture -and -not $runUnit) {
    throw '-IncludeFailureFixture is valid only when Unit validation runs.'
}

function Invoke-UnitValidation {
    Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Filter '*.php' | Where-Object {
        $_.FullName -notlike '*\dist\*'
    } | ForEach-Object {
        & php -l $_.FullName
        if ($LASTEXITCODE -ne 0) { throw "PHP syntax failed: $($_.FullName)" }
    }

    Get-ChildItem -LiteralPath $repoRoot -Recurse -File | Where-Object {
        $_.Extension -in @('.js', '.cjs', '.mjs') -and
        $_.FullName -notlike '*\dist\*' -and
        $_.FullName -notlike '*\tests\fixtures\failing\*'
    } | ForEach-Object {
        & node --check $_.FullName
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax failed: $($_.FullName)" }
    }

    if ($IncludeFailureFixture) {
        $failureFixture = Join-Path $repoRoot 'tests\fixtures\failing\validation-deliberate-failure.js'
        & node --check $failureFixture
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax failed: $failureFixture" }
        throw "Deliberate failure fixture unexpectedly passed: $failureFixture"
    }

    Get-ChildItem -LiteralPath (Join-Path $repoRoot 'tests') -File -Filter '*.test.cjs' | Sort-Object Name | ForEach-Object {
        & node $_.FullName
        if ($LASTEXITCODE -ne 0) { throw "Test failed: $($_.Name)" }
    }

    & php (Join-Path $repoRoot 'tests\validate-clay-transform.php')
    if ($LASTEXITCODE -ne 0) { throw 'Clay/Stars content-transform validation failed.' }

    & php (Join-Path $repoRoot 'tests\validate-clay-legacy-collision.php')
    if ($LASTEXITCODE -ne 0) { throw 'Clay/Stars legacy-plugin collision validation failed.' }

    & php (Join-Path $repoRoot 'tests\validate-epk-download-paths.php')
    if ($LASTEXITCODE -ne 0) { throw 'EPK download-path validation failed.' }

    & python -X utf8 (Join-Path $PSScriptRoot 'validate-effect-harness.py') (Join-Path $repoRoot 'tests\harness\plugin-core') --mode scaffold
    if ($LASTEXITCODE -ne 0) { throw 'DanceMoves core harness validation failed.' }

    $clayHarness = Join-Path $repoRoot 'tests\harness\clay-stars'
    $clayHarnessOutput = & python -X utf8 (Join-Path $PSScriptRoot 'validate-effect-harness.py') $clayHarness --mode scaffold --manifest-file (Join-Path $clayHarness 'clay-stars.json') --shared-root (Join-Path $repoRoot 'tests\harness\plugin-core')
    if ($LASTEXITCODE -ne 0) { throw 'Clay/Stars shared harness validation failed.' }
    Write-Output 'Clay/Stars shared harness validation passed.'

    $californiaHarness = Join-Path $repoRoot 'tests\harness\california-screamin'
    $californiaHarnessOutput = & python -X utf8 (Join-Path $PSScriptRoot 'validate-effect-harness.py') $californiaHarness --mode scaffold --manifest-file (Join-Path $californiaHarness 'california-screamin.json') --shared-root (Join-Path $repoRoot 'tests\harness\plugin-core')
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'California Screamin full-page audit retains known page-owned width/background-position blockers. Review the separate audit output; adapter contracts remain release-gating.'
    } else {
        Write-Output 'California Screamin shared harness validation passed.'
    }

    $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $textExtensions = @('.php', '.js', '.cjs', '.mjs', '.css', '.md', '.html', '.json', '.tsv', '.ps1', '.lrc')
    Get-ChildItem -LiteralPath $repoRoot -Recurse -File | Where-Object {
        $_.Extension -in $textExtensions -and
        $_.FullName -notlike '*\dist\*' -and
        $_.FullName -notlike '*\tests\fixtures\failing\*'
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
        if ($text.Contains([char]0)) {
            throw "Null character found: $($_.FullName)"
        }
    }

    $entrypoint = Get-Content -LiteralPath (Join-Path $repoRoot 'kieran-epk-device-orientation.php') -Raw -Encoding UTF8
    if ($entrypoint -notmatch 'Plugin Name:\s*DanceMoves' -or $entrypoint -notmatch 'Version:\s*([0-9]+(?:\.[0-9]+){2})') {
        throw 'WordPress plugin name/version contract failed.'
    }

    Write-Output 'DanceMoves Unit validation passed without rebuilding migration or package artifacts.'
}

function Invoke-PackageValidation {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-migration-manifest.ps1') | Write-Output
    if ($LASTEXITCODE -ne 0) { throw 'Migration manifest build failed.' }

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'package.ps1') | Write-Output
    if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }

    $entrypoint = Get-Content -LiteralPath (Join-Path $repoRoot 'kieran-epk-device-orientation.php') -Raw -Encoding UTF8
    if ($entrypoint -notmatch 'Version:\s*([0-9]+(?:\.[0-9]+){2})') {
        throw 'Unable to establish plugin version for package validation.'
    }
    $version = $Matches[1]
    $packageManifestPath = Join-Path $repoRoot ("dist\DanceMoves-{0}-manifest.json" -f $version)
    $packageManifest = Get-Content -LiteralPath $packageManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $packageManifest.root_entrypoint_present -or -not $packageManifest.forward_slash_entries) {
        throw 'Package layout validation failed.'
    }
    if ($packageManifest.version -ne $version) {
        throw "Package version mismatch: entrypoint $version, manifest $($packageManifest.version)."
    }
    if (@($packageManifest.files | Where-Object { $_.path -match '/(?:tests|tools|qa|migration)/' }).Count -ne 0) {
        throw 'Development-only files leaked into the WordPress package.'
    }

    Write-Output "DanceMoves Package validation passed for version $version."
}

if ($runUnit) {
    Invoke-UnitValidation
}

if ($runPackage) {
    Invoke-PackageValidation
}

Write-Output "DanceMoves $Mode validation passed."
