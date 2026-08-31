[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $repoRoot 'dist'
$entrypoint = Get-Content -LiteralPath (Join-Path $repoRoot 'kieran-epk-device-orientation.php') -Raw -Encoding UTF8
if ($entrypoint -notmatch 'Version:\s*([0-9]+(?:\.[0-9]+){2})') {
    throw 'Unable to establish the DanceMoves version from the plugin entrypoint.'
}
$version = $Matches[1]
$slug = 'kieran-epk-device-orientation'
$zip = Join-Path $dist ("DanceMoves-{0}.zip" -f $version)
$manifestPath = Join-Path $dist ("DanceMoves-{0}-manifest.json" -f $version)
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("DanceMoves-package-{0}" -f [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $temporaryRoot $slug

New-Item -ItemType Directory -Path $dist -Force | Out-Null
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

$include = @(
    'kieran-epk-device-orientation.php',
    'README.md',
    'assets'
)
foreach ($item in $include) {
    Copy-Item -LiteralPath (Join-Path $repoRoot $item) -Destination $packageRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zip) {
    Remove-Item -LiteralPath $zip -Force
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$writeArchive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
        $entryName = $_.FullName.Substring($temporaryRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $writeArchive,
            $_.FullName,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $writeArchive.Dispose()
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName })
} finally {
    $archive.Dispose()
}

$manifest = [ordered]@{
    schema = 'dance-moves-package/v1'
    plugin_name = 'DanceMoves'
    version = $version
    wordpress_upgrade_slug = $slug
    zip = Split-Path -Leaf $zip
    zip_bytes = (Get-Item -LiteralPath $zip).Length
    zip_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash
    entry_count = $entries.Count
    root_entrypoint = "$slug/kieran-epk-device-orientation.php"
    root_entrypoint_present = $entries -contains "$slug/kieran-epk-device-orientation.php"
    forward_slash_entries = @($entries | Where-Object { $_ -like '*\*' }).Count -eq 0
    files = Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($temporaryRoot.Length + 1).Replace('\', '/')
            bytes = $_.Length
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
        }
    }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$resolvedTemporary = [System.IO.Path]::GetFullPath($temporaryRoot)
$resolvedSystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
if (-not $resolvedTemporary.StartsWith($resolvedSystemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove package staging outside the system temporary directory: $resolvedTemporary"
}
Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force

Write-Output $zip
Write-Output $manifestPath
Write-Output ("SHA256={0}; entries={1}; upgradeRoot={2}" -f $manifest.zip_sha256, $manifest.entry_count, $manifest.root_entrypoint_present)
