$ErrorActionPreference = 'Stop'
$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Split-Path -Parent $testRoot
$python = (Get-Command python -ErrorAction Stop).Source
$port = 8765
$process = Start-Process -FilePath $python -ArgumentList @(
    '-m', 'http.server', $port,
    '--bind', '127.0.0.1',
    '--directory', $pluginRoot
) -WindowStyle Hidden -PassThru

Write-Output "Harness: http://127.0.0.1:$port/tests/mobile-harness.html"
Write-Output "Server PID: $($process.Id)"
