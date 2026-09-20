<#
.SYNOPSIS
    Push staged Bible source data to DigitalOcean Spaces.

.DESCRIPTION
    Uploads the local staging tree (.ingest) to object storage, skipping any
    translation release already uploaded from identical publisher bytes.

    Safe to run at any time. Idempotency comes from the run ledger in
    MongoDB, which records the SHA256 of the publisher archive each run
    processed. Because parsing is deterministic, an unchanged hash means
    unchanged output, so re-running is a no-op until a source actually
    changes.

    Fetch and parse run first unless -SkipFetch or -SkipParse is given, so a
    single invocation picks up newly published source text.

.PARAMETER Translation
    Translation codes to process. All staged translations when omitted.

.PARAMETER SkipFetch
    Do not download from publishers; upload what is already staged.

.PARAMETER SkipParse
    Do not re-parse; upload the existing parsed output.

.PARAMETER Force
    Re-upload even when the ledger says a release is current. Use after
    changing the storage layout, or when an upload is suspected incomplete.

.PARAMETER WhatIf
    Report what would be uploaded and stop.

.EXAMPLE
    .\Push-BibleSources.ps1
    Fetch, parse and upload everything that changed.

.EXAMPLE
    .\Push-BibleSources.ps1 -Translation BSB, KJV -SkipFetch
    Re-upload two translations from existing staged data.

.EXAMPLE
    .\Push-BibleSources.ps1 -WhatIf
    Show current state without uploading.

.NOTES
    Requires DO_SPACES_ENDPOINT, DO_SPACES_BUCKET, DO_SPACES_KEY,
    DO_SPACES_SECRET and MONGODB_URI (for the ledger). Put them in .env at
    the repository root; see .env.example.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string[]] $Translation,
    [switch] $SkipFetch,
    [switch] $SkipParse,
    [switch] $Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-RepositoryRoot
Import-DotEnv -Path (Join-Path $root '.env')

Assert-RequiredSetting `
    -Name @('DO_SPACES_ENDPOINT', 'DO_SPACES_BUCKET', 'DO_SPACES_KEY', 'DO_SPACES_SECRET') `
    -Purpose 'Uploading to Spaces'

# The ledger lives in MongoDB so idempotency survives a rebuilt machine and
# is visible to every operator, not just this one.
Assert-RequiredSetting -Name @('MONGODB_URI') -Purpose 'Run tracking'

Assert-IngestBuilt -RepositoryRoot $root

$codes = @()
if ($Translation) { $codes = $Translation }

$started = Get-Date

Write-Stage 'Current state'
Invoke-IngestCli -RepositoryRoot $root -Arguments (@('status') + $codes)

if ($WhatIfPreference) {
    Write-Host ''
    Write-Host 'WhatIf: nothing was uploaded.' -ForegroundColor Yellow
    return
}

if (-not $SkipFetch) {
    Write-Stage 'Fetching publisher archives'
    Write-Detail 'Cached archives are left alone; only missing ones download.'
    Invoke-IngestCli -RepositoryRoot $root -Arguments (@('fetch') + $codes)
}

if (-not $SkipParse) {
    Write-Stage 'Parsing USFM'
    Write-Detail 'Validation refuses a malformed release before anything is uploaded.'
    Invoke-IngestCli -RepositoryRoot $root -Arguments (@('parse') + $codes)
}

Write-Stage "Uploading to $($env:DO_SPACES_BUCKET)"

$uploadArgs = @('upload') + $codes
if ($Force) {
    Write-Detail 'Force: re-uploading regardless of the ledger.'
    $uploadArgs += '--force'
}

if ($PSCmdlet.ShouldProcess($env:DO_SPACES_BUCKET, 'Upload Bible source data')) {
    Invoke-IngestCli -RepositoryRoot $root -Arguments $uploadArgs
}

$elapsed = (Get-Date) - $started

Write-Stage 'Final state'
Invoke-IngestCli -RepositoryRoot $root -Arguments (@('status') + $codes)

Write-Host ''
Write-Host ("Done in {0:mm\:ss}." -f $elapsed) -ForegroundColor Green
