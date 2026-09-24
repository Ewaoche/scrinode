<#
.SYNOPSIS
    Load staged Bible text into MongoDB as verse documents.

.DESCRIPTION
    Writes one document per verse per translation, creates the indexes the
    reader needs, and records each run in the ledger.

    Safe to run at any time, and safe to interrupt. Every document carries a
    deterministic _id (BSB:ROM.8.28), so writes are upserts: a re-run repairs
    a partial load rather than duplicating it. The ledger then skips any
    release already loaded from identical publisher bytes.

    Loading is not permission. All staged translations are loaded by default
    so the corpus is complete, but each translation document records whether
    the reader may offer it, and isAvailable() remains the only gate on
    serving text.

.PARAMETER Translation
    Translation codes to load. All staged translations when omitted.

.PARAMETER RegisteredOnly
    Load only translations registered in translations.ts — the ten the
    reader may currently serve.

.PARAMETER Force
    Reload even when the ledger says a release is current. Use after a schema
    change, or when a load is suspected incomplete.

.PARAMETER WhatIf
    Report what would be loaded and stop.

.EXAMPLE
    .\Push-BibleToMongo.ps1
    Load everything that changed since the last run.

.EXAMPLE
    .\Push-BibleToMongo.ps1 -RegisteredOnly
    Load only the translations the reader can serve.

.EXAMPLE
    .\Push-BibleToMongo.ps1 -Translation BSB -Force
    Rebuild one translation from scratch.

.NOTES
    Requires MONGODB_URI, and optionally MONGODB_DB (defaults to "scrinode").
    Put them in .env at the repository root; see .env.example.

    This writes to whatever MONGODB_URI points at. Check it before running
    against a cluster you did not intend.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string[]] $Translation,
    [switch] $RegisteredOnly,
    [switch] $Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-RepositoryRoot
Import-DotEnv -Path (Join-Path $root '.env')

Assert-RequiredSetting -Name @('MONGODB_URI') -Purpose 'Loading into MongoDB'
Assert-IngestBuilt -RepositoryRoot $root

# Show the target without printing credentials: a connection string carries a
# password, so only the host and database are reported.
$uri = [Environment]::GetEnvironmentVariable('MONGODB_URI')
$targetHost = 'unknown'
if ($uri -match '@([^/?,]+)') { $targetHost = $Matches[1] }
$database = [Environment]::GetEnvironmentVariable('MONGODB_DB')
if ([string]::IsNullOrWhiteSpace($database)) { $database = 'scrinode' }

$codes = @()
if ($Translation) { $codes = $Translation }

$started = Get-Date

Write-Stage 'Target'
Write-Detail "cluster  $targetHost"
Write-Detail "database $database"

Write-Stage 'Current state'
Invoke-IngestCli -RepositoryRoot $root -Arguments (@('status') + $codes)

if ($WhatIfPreference) {
    Write-Host ''
    Write-Host 'WhatIf: nothing was written to MongoDB.' -ForegroundColor Yellow
    return
}

Write-Stage "Loading verse documents into $database"

$loadArgs = @('load') + $codes

if (-not $RegisteredOnly) {
    Write-Detail 'Loading every staged translation. Unregistered ones are stored with available=false.'
    $loadArgs += '--all'
}
else {
    Write-Detail 'Loading only translations the reader may serve.'
}

if ($Force) {
    Write-Detail 'Force: reloading regardless of the ledger.'
    $loadArgs += '--force'
}

if ($PSCmdlet.ShouldProcess("$targetHost/$database", 'Load Bible verse documents')) {
    Invoke-IngestCli -RepositoryRoot $root -Arguments $loadArgs
}

$elapsed = (Get-Date) - $started

Write-Stage 'Final state'
Invoke-IngestCli -RepositoryRoot $root -Arguments (@('status') + $codes)

Write-Host ''
Write-Host ("Done in {0:mm\:ss}." -f $elapsed) -ForegroundColor Green
