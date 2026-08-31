[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$validator = Join-Path $PSScriptRoot 'validate.ps1'
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $validator -Mode Unit -IncludeFailureFixture 2>&1
    $exitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $previousErrorActionPreference
}
$rendered = $output | Out-String

if ($exitCode -eq 0) {
    throw 'Validator failure-contract test failed: deliberate syntax failure returned exit code 0.'
}

if ($rendered -notmatch 'validation-deliberate-failure\.js') {
    throw 'Validator failure-contract test failed: output did not attribute the deliberate fixture.'
}

Write-Output 'Validator failure-contract test passed: non-zero exit and fixture attribution confirmed.'
