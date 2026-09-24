<#
.SYNOPSIS
    Import vectors exported from Atlas into PostgreSQL.

.DESCRIPTION
    One-shot migration aid, pairing with Export-AtlasVectors.ps1. Attaches
    vectors that were already paid for to the retrieval units rebuilt in
    Postgres, so the embed stage has less to do.

    Run these first, in order:
        pnpm --filter @scrinode/api migrate
        node packages/ingest/dist/cli.js load
        node packages/ingest/dist/cli.js units

    Only existing units are updated, and only where the text hash still
    matches. A unit whose text changed since it was embedded is left alone
    for the embedder to redo — serving a stale vector as current text is
    worse than paying to re-embed.

    Safe to re-run: an import that stops partway resumes by being run again.

    Delete this script, its exporter and their .mjs files once the migration
    is done.

.PARAMETER Path
    The exported file. Defaults to .ingest/atlas-vectors.jsonl.

.EXAMPLE
    .\Import-AtlasVectors.ps1
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-RepositoryRoot
Import-DotEnv -Path (Join-Path $root '.env')

Assert-RequiredSetting -Name @('DATABASE_URL') -Purpose 'Importing vectors'

if ([string]::IsNullOrWhiteSpace($Path)) {
    $Path = Join-Path $root '.ingest/atlas-vectors.jsonl'
}

if (-not (Test-Path $Path)) {
    Write-Host "No export at $Path" -ForegroundColor Red
    Write-Host 'Run Export-AtlasVectors.ps1 first, while the Atlas cluster is still up.'
    exit 1
}

$size = (Get-Item $Path).Length / 1MB

Write-Stage 'Importing Atlas vectors'
Write-Detail ("source  {0}  ({1:N0} MB)" -f $Path, $size)

if ($WhatIfPreference) {
    Write-Host ''
    Write-Host 'WhatIf: nothing was written.' -ForegroundColor Yellow
    return
}

if ($PSCmdlet.ShouldProcess('retrieval_units', 'Import embedding vectors')) {
    $env:IMPORT_PATH = $Path
    node (Join-Path $PSScriptRoot 'import-atlas-vectors.mjs')

    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host 'Import failed.' -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host ''
Write-Host 'Done. Run the embed stage to fill any gaps.' -ForegroundColor Green
