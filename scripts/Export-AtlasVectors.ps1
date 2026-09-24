<#
.SYNOPSIS
    Export embedded vectors from MongoDB Atlas before the cluster is retired.

.DESCRIPTION
    One-shot migration aid. Scrinode moved from MongoDB Atlas to PostgreSQL
    on 2026-09-24; the vectors already embedded on Atlas were paid for per
    token and do not transfer on their own.

    Reads `retrieval_units` from Atlas, writes one JSON Lines file holding
    each unit's id, text hash and vector, and nothing else. Import it with
    Import-AtlasVectors.ps1 once the Postgres schema exists.

    Read-only against Atlas. It writes nothing there and can be re-run.

    Delete this script, and its importer, once the migration is done. A
    one-shot tool left lying around is eventually mistaken for a supported
    path.

.PARAMETER AtlasUri
    The Atlas connection string. Falls back to ATLAS_URI, then to
    MONGODB_URI, in the environment — the latter only if .env still carries
    the pre-migration value.

.PARAMETER Database
    Atlas database name. Defaults to "scrinode_dev".

.PARAMETER Path
    Output file. Defaults to .ingest/atlas-vectors.jsonl, which is
    git-ignored.

.EXAMPLE
    .\Export-AtlasVectors.ps1
    Export every embedded unit to the default path.

.NOTES
    Vectors are float32 in BSON BinData. They are exported as plain number
    arrays, which is lossless: halfvec narrows them on import, and doing that
    conversion in Postgres rather than here keeps this file re-importable if
    the storage type is ever revisited.
#>

[CmdletBinding()]
param(
    [string] $AtlasUri,
    [string] $Database = 'scrinode_dev',
    [string] $Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-RepositoryRoot
Import-DotEnv -Path (Join-Path $root '.env')

if ([string]::IsNullOrWhiteSpace($AtlasUri)) {
    $AtlasUri = [Environment]::GetEnvironmentVariable('ATLAS_URI')
}
if ([string]::IsNullOrWhiteSpace($AtlasUri)) {
    $AtlasUri = [Environment]::GetEnvironmentVariable('MONGODB_URI')
}

if ([string]::IsNullOrWhiteSpace($AtlasUri)) {
    Write-Host 'No Atlas connection string.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Pass -AtlasUri, or set ATLAS_URI in .env. MONGODB_URI was removed'
    Write-Host 'from .env.example by the migration, so it will only be present if'
    Write-Host 'your local .env still carries the pre-migration value.'
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Path)) {
    $Path = Join-Path $root '.ingest/atlas-vectors.jsonl'
}

# The driver is no longer a workspace dependency, so this runs it directly
# from the pnpm store rather than reinstating it in package.json for a
# one-shot script.
$exporter = Join-Path $PSScriptRoot 'export-atlas-vectors.mjs'

if (-not (Test-Path $exporter)) {
    Write-Host "Missing $exporter" -ForegroundColor Red
    exit 1
}

Write-Stage 'Exporting vectors from Atlas'
Write-Detail "database $Database"
Write-Detail "output   $Path"
Write-Host ''

$env:ATLAS_URI = $AtlasUri
$env:ATLAS_DB = $Database
$env:EXPORT_PATH = $Path

node $exporter

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Export failed. Nothing was changed on Atlas.' -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ''
Write-Host "Exported to $Path" -ForegroundColor Green
Write-Host 'Import with: .\Import-AtlasVectors.ps1' -ForegroundColor Green
