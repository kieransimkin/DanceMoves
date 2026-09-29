[CmdletBinding()]
param(
    [ValidateSet('Unit', 'Package', 'All')]
    [string]$Mode = 'Unit',
    [switch]$IncludeFailureFixture,
    [string]$ReleasesRoot
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runUnit = $Mode -in @('Unit', 'All')
$runPackage = $Mode -in @('Package', 'All')
if ($IncludeFailureFixture -and -not $runUnit) {
    throw '-IncludeFailureFixture is valid only when Unit validation runs.'
}

Push-Location -LiteralPath $repoRoot
try {
    if ($IncludeFailureFixture) {
        $fixture = Join-Path $repoRoot 'tests\fixtures\failing\validation-deliberate-failure.js'
        & node --check $fixture
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax failed: $fixture" }
        throw "Deliberate failure fixture unexpectedly passed: $fixture"
    }
    if ($runUnit) {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Shared-library build failed. Install dependencies first.' }
        & npm test
        if ($LASTEXITCODE -ne 0) { throw 'Shared-library, React SSR or Node service tests failed.' }
        # Preserves all original engine/PHP/harness/UTF-8 checks without walking node_modules.
        & npm run test:legacy
        if ($LASTEXITCODE -ne 0) { throw 'Original DanceMoves validation failed.' }
    }
    if ($runPackage) {
        # External site-migration evidence is optional and never inferred from a private drive.
        if ($ReleasesRoot) {
            & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-migration-manifest.ps1') -ReleasesRoot $ReleasesRoot
            if ($LASTEXITCODE -ne 0) { throw 'Explicit migration evidence generation failed.' }
        }
        & npm run package:wordpress
        if ($LASTEXITCODE -ne 0) { throw 'Shared WordPress archive generation/verification failed.' }
    }
    Write-Output "DanceMoves $Mode validation passed. Attended browser/device release acceptance is separate."
} finally {
    Pop-Location
}
