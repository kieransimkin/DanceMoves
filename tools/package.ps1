[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    & npm run package:wordpress
    if ($LASTEXITCODE -ne 0) { throw 'WordPress library build or archive validation failed.' }
} finally {
    Pop-Location
}
