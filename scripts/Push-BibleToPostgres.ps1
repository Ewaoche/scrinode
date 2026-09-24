<#
.SYNOPSIS
    Load staged Bible text into PostgreSQL as verse rows.

.DESCRIPTION
    Writes one row per verse per translation and records each run in the
    ledger. The schema and its indexes come from the API's migrations, which
    must have been applied first.

    Safe to run at any time, and safe to interrupt. Every row carries a
    deterministic primary key (BSB:ROM.8.28), so writes are upserts: a re-run
    repairs a partial load rather than duplicating it. The ledger then skips
    any release already loaded from identical publisher bytes.

    Loading is not permission. All staged translations are loaded by default
    so the corpus is complete, but each translation row records whether the
    reader may offer it, and isAvailable() remains the only gate on serving
    text.

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
    .\Push-BibleToPostgres.ps1
    Load everything that changed since the last run.

.EXAMPLE
    .\Push-BibleToPostgres.ps1 -RegisteredOnly
    Load only the translations the reader can serve.

.EXAMPLE
    .\Push-BibleToPostgres.ps1 -Translation BSB -Force
    Rebuild one translation from scratch.

.NOTES
    Requires DATABASE_URL. Put it in .env at the repository root; see
    .env.example.

    Run the migrations first, or the tables will not exist:
        pnpm --filter @scrinode/api migrate

    This writes to whatever DATABASE_URL points at. Check it before running
    against a database you did not intend.
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

Assert-RequiredSetting -Name @('DATABASE_URL') -Purpose 'Loading into Postgres'
Assert-IngestBuilt -RepositoryRoot $root

# Show the target without printing credentials: a connection string carries a
# password, so only the host and database are reported.
$uri = [Environment]::GetEnvironmentVariable('DATABASE_URL')
$targetHost = 'unknown'
$database = 'unknown'
try {
    $parsed = [Uri] $uri
    $targetHost = if ($parsed.Port -gt 0) { "$($parsed.Host):$($parsed.Port)" } else { $parsed.Host }
    $database = $parsed.AbsolutePath.TrimStart('/')
}
catch {
    # A connection string this cannot parse is still usable by the driver;
    # only the display is affected, so this must not stop the run.
}
if ([string]::IsNullOrWhiteSpace($database)) { $database = 'unknown' }

$codes = @()
if ($Translation) { $codes = $Translation }

$started = Get-Date

Write-Stage 'Target'
Write-Detail "server   $targetHost"
Write-Detail "database $database"

Write-Stage 'Current state'
Invoke-IngestCli -RepositoryRoot $root -Arguments (@('status') + $codes)

if ($WhatIfPreference) {
    Write-Host ''
    Write-Host 'WhatIf: nothing was written to Postgres.' -ForegroundColor Yellow
    return
}

Write-Stage "Loading verse rows into $database"

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

if ($PSCmdlet.ShouldProcess("$targetHost/$database", 'Load Bible verse rows')) {
    Invoke-IngestCli -RepositoryRoot $root -Arguments $loadArgs
}

$elapsed = (Get-Date) - $started

Write-Stage 'Final state'
Invoke-IngestCli -RepositoryRoot $root -Arguments (@('status') + $codes)

Write-Host ''
Write-Host ("Done in {0:mm\:ss}." -f $elapsed) -ForegroundColor Green
