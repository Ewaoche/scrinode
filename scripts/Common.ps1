<#
.SYNOPSIS
    Shared helpers for the Scrinode ingestion scripts.

.DESCRIPTION
    Dot-sourced by Push-BibleSources.ps1 and Push-BibleToPostgres.ps1. Holds the
    parts both need: locating the repository, loading a .env file, checking
    required settings, and reporting.

    Nothing here writes a secret to disk or to the console. Values read from
    .env are set as process-scoped environment variables so they reach the
    ingestion CLI and vanish when the script ends.
#>

Set-StrictMode -Version Latest

function Get-RepositoryRoot {
    <#
        The scripts live in <repo>/scripts, so the repository is one level up.
        Resolved from the script's own location rather than the working
        directory, so the scripts run correctly from anywhere.
    #>
    [CmdletBinding()]
    param()

    $root = Split-Path -Parent $PSScriptRoot
    if (-not (Test-Path (Join-Path $root 'pnpm-workspace.yaml'))) {
        throw "Could not find the Scrinode repository root. Expected pnpm-workspace.yaml in '$root'."
    }
    return $root
}

function Import-DotEnv {
    <#
        Load KEY=VALUE pairs from a .env file into the process environment.

        Variables already set in the environment win, so CI and a shell that
        has exported credentials are not overridden by a stale file.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Path
    )

    if (-not (Test-Path $Path)) {
        Write-Verbose "No .env at $Path; relying on the existing environment."
        return
    }

    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }

        $split = $trimmed.IndexOf('=')
        if ($split -lt 1) { continue }

        $name = $trimmed.Substring(0, $split).Trim()
        $value = $trimmed.Substring($split + 1).Trim()

        # Strip one layer of surrounding quotes, as .env files commonly use.
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($name))) {
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

function Assert-RequiredSetting {
    <#
        Fail before doing any work when a setting is missing.

        Names only are reported. A missing secret is a configuration problem,
        and printing the ones that ARE set would leak them into logs and
        terminal history.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string[]] $Name,
        [Parameter(Mandatory)] [string] $Purpose
    )

    $missing = @()
    foreach ($n in $Name) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($n))) {
            $missing += $n
        }
    }

    if ($missing.Count -gt 0) {
        throw ("$Purpose needs these settings, which are not set:`n  " +
            ($missing -join "`n  ") +
            "`n`nSet them in .env at the repository root, or export them before running. See .env.example.")
    }
}

function Write-Stage {
    [CmdletBinding()]
    param([Parameter(Mandatory)] [string] $Message)
    Write-Host ''
    Write-Host "== $Message" -ForegroundColor Cyan
}

function Write-Detail {
    [CmdletBinding()]
    param([Parameter(Mandatory)] [string] $Message)
    Write-Host "   $Message" -ForegroundColor DarkGray
}

function Invoke-IngestCli {
    <#
        Run the ingestion CLI and surface its exit code.

        The CLI owns hashing, the run ledger and every write. PowerShell
        orchestrates; it never reimplements that logic, so both scripts and a
        direct CLI invocation behave identically.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $RepositoryRoot,
        [Parameter(Mandatory)] [string[]] $Arguments
    )

    $cli = Join-Path $RepositoryRoot 'packages/ingest/dist/cli.js'
    if (-not (Test-Path $cli)) {
        throw "The ingestion CLI is not built. Run: pnpm --filter @scrinode/ingest run build"
    }

    & node $cli @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Ingestion CLI failed (exit $LASTEXITCODE): node cli.js $($Arguments -join ' ')"
    }
}

function Assert-IngestBuilt {
    <#
        Build the CLI when its output is missing or older than its source.

        Running a stale CLI against production data is worse than waiting for
        a build, and the difference is invisible without this check.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $RepositoryRoot
    )

    $dist = Join-Path $RepositoryRoot 'packages/ingest/dist/cli.js'
    $src = Join-Path $RepositoryRoot 'packages/ingest/src'

    $needsBuild = -not (Test-Path $dist)

    if (-not $needsBuild) {
        $built = (Get-Item $dist).LastWriteTimeUtc
        $newest = Get-ChildItem -Path $src -Recurse -Filter '*.ts' |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1

        if ($newest -and $newest.LastWriteTimeUtc -gt $built) {
            Write-Detail 'Source is newer than the built CLI; rebuilding.'
            $needsBuild = $true
        }
    }

    if ($needsBuild) {
        Write-Stage 'Building the ingestion CLI'
        Push-Location $RepositoryRoot
        try {
            & pnpm --filter '@scrinode/ingest' run build
            if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)." }
        }
        finally {
            Pop-Location
        }
    }
}
