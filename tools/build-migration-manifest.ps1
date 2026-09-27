[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$ReleasesRoot
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$releasesRoot = if ($ReleasesRoot) {
    (Resolve-Path -LiteralPath $ReleasesRoot).Path
} else {
    (Resolve-Path (Join-Path $repoRoot '..\..\..')).Path
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot 'migration'
}

$pagesPath = Join-Path $releasesRoot 'EPK Batch 2026\published-pages.tsv'
$registryPath = Join-Path $releasesRoot 'lyric-timing-canonical-registry.json'
$knownBpmPath = Join-Path $repoRoot 'migration\known-bpm.json'

$pages = Import-Csv -LiteralPath $pagesPath -Delimiter "`t"
$registry = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 | ConvertFrom-Json
$knownBpm = Get-Content -LiteralPath $knownBpmPath -Raw -Encoding UTF8 | ConvertFrom-Json

$aliases = @{
    'Light Will Win (Shubh Diwali)' = 'Light Will Win'
    'Made from the clay and the stars (Anunnaki)' = 'Made from the clay and the stars'
}

function Get-RegistryEntry([string]$title) {
    $key = if ($aliases.ContainsKey($title)) { $aliases[$title] } else { $title }
    return $registry.releases.PSObject.Properties[$key].Value
}

function Resolve-ReleasePath([string]$relativePath) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) { return $null }
    $candidate = Join-Path $releasesRoot $relativePath
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        return (Resolve-Path -LiteralPath $candidate).Path
    }
    return $null
}

function Get-FileEvidence([string]$path) {
    if (-not $path) { return $null }
    $item = Get-Item -LiteralPath $path
    [pscustomobject][ordered]@{
        path = $path.Substring($releasesRoot.Length + 1).Replace('\', '/')
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
        bytes = $item.Length
    }
}

$rows = foreach ($page in $pages) {
    $pageId = [string]$page.post_id
    $bpmEntry = $knownBpm.pages.PSObject.Properties[$pageId].Value
    $timing = Get-RegistryEntry $page.title
    $lyricEligible = $false
    $lyricEvidence = $null
    $cueEvidence = $null
    $timingStatus = 'not_in_canonical_registry'

    if ($timing) {
        $timingStatus = [string]$timing.status
        $lyricEligible = $timingStatus -in @('canonical_estimated_pending_listening_qa', 'canonical_user_edited_locked')
        if ($lyricEligible -and $timing.canonical_timing_path) {
            $lyricEvidence = Get-FileEvidence (Resolve-ReleasePath ([string]$timing.canonical_timing_path))
        }
        if ($timing.musical_cue_lrc_path) {
            $cueEvidence = Get-FileEvidence (Resolve-ReleasePath ([string]$timing.musical_cue_lrc_path))
        }
    }

    [pscustomobject][ordered]@{
        title = $page.title
        post_id = [int]$page.post_id
        url = $page.url
        bpm_property = if ($bpmEntry) { [double]$bpmEntry.bpm } else { $null }
        effective_bpm = if ($bpmEntry) { [double]$bpmEntry.bpm } else { 120 }
        bpm_source = if ($bpmEntry) { 'explicit' } else { 'fallback' }
        bpm_confidence = if ($bpmEntry) { [string]$bpmEntry.confidence } else { 'unknown' }
        bpm_evidence = if ($bpmEntry) { [string]$bpmEntry.evidence } else { $null }
        master_duration_milliseconds = if ($bpmEntry) { [double]$bpmEntry.master_duration_milliseconds } else { $null }
        master_sha256 = if ($bpmEntry) { [string]$bpmEntry.master_sha256 } else { $null }
        lyric_timing_status = $timingStatus
        lyric_timing_eligible = $lyricEligible -and $null -ne $lyricEvidence
        lyric_timing = $lyricEvidence
        cue_timing = $cueEvidence
        proposed_action = @(
            if ($bpmEntry) { 'set_bpm' }
            if ($bpmEntry -and $bpmEntry.master_duration_milliseconds) { 'set_master_duration' }
            if ($lyricEligible -and $lyricEvidence) { 'upload_or_reuse_lyric_timing' }
            if ($cueEvidence) { 'upload_or_reuse_cue_timing' }
        )
    }
}

$manifest = [ordered]@{
    schema = 'dance-moves-page-migration/v1'
    manifest_date = '2026-08-31'
    source_pages = $pagesPath
    source_canonical_registry = $registryPath
    source_known_bpm = $knownBpmPath
    page_count = $rows.Count
    explicit_bpm_count = @($rows | Where-Object bpm_source -eq 'explicit').Count
    fallback_bpm_count = @($rows | Where-Object bpm_source -eq 'fallback').Count
    eligible_lyric_timing_count = @($rows | Where-Object lyric_timing_eligible).Count
    cue_timing_count = @($rows | Where-Object { $null -ne $_.cue_timing }).Count
    pages = $rows
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$jsonPath = Join-Path $OutputDirectory 'epk-page-timing-manifest-2026-08-31.json'
$tsvPath = Join-Path $OutputDirectory 'epk-page-timing-manifest-2026-08-31.tsv'

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$rows | Select-Object title, post_id, url, bpm_property, effective_bpm, bpm_source, bpm_confidence, master_duration_milliseconds, lyric_timing_status, lyric_timing_eligible,
    @{Name='lyric_timing_path';Expression={$_.lyric_timing.path}},
    @{Name='cue_timing_path';Expression={$_.cue_timing.path}},
    @{Name='proposed_action';Expression={$_.proposed_action -join ','}} |
    Export-Csv -LiteralPath $tsvPath -Delimiter "`t" -NoTypeInformation -Encoding UTF8

Write-Output $jsonPath
Write-Output $tsvPath
Write-Output ("Pages={0}; explicit BPM={1}; fallback BPM={2}; lyric files={3}; cue files={4}" -f $manifest.page_count, $manifest.explicit_bpm_count, $manifest.fallback_bpm_count, $manifest.eligible_lyric_timing_count, $manifest.cue_timing_count)
