param(
    [ValidateSet("fresh", "migrate", "seed")]
    [string]$Mode = "migrate",
    [switch]$WithSeed
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DatabaseRoot = Join-Path $ProjectRoot "database"
$MigrationFiles = @(
    (Join-Path $DatabaseRoot "migration-20260602-admin-upload.sql"),
    (Join-Path $DatabaseRoot "migration-20260611-collection-log-index.sql")
)

function Resolve-PsqlPath {
    $Command = Get-Command psql -ErrorAction SilentlyContinue
    if ($Command) {
        return $Command.Source
    }

    $CommonRoots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)}
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    $Versions = @("18", "17", "16", "15", "14", "13")
    foreach ($Root in $CommonRoots) {
        foreach ($Version in $Versions) {
            $Candidate = Join-Path $Root "PostgreSQL\$Version\bin\psql.exe"
            if (Test-Path -LiteralPath $Candidate) {
                return $Candidate
            }
        }
    }

    throw "psql was not found. Install PostgreSQL client tools or add psql to PATH."
}

$DbHost = $env:DB_HOST
if ([string]::IsNullOrWhiteSpace($DbHost)) { $DbHost = "localhost" }

$DbPort = $env:DB_PORT
if ([string]::IsNullOrWhiteSpace($DbPort)) { $DbPort = "5432" }

$DbName = $env:DB_NAME
if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "geumcheon_data" }

$DbUser = $env:DB_USERNAME
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "geumcheon" }

$DbPassword = $env:DB_PASSWORD
if (-not [string]::IsNullOrWhiteSpace($DbPassword)) {
    $env:PGPASSWORD = $DbPassword
}

if ([string]::IsNullOrWhiteSpace($env:PGCLIENTENCODING)) {
    $env:PGCLIENTENCODING = "UTF8"
}

$Psql = Resolve-PsqlPath

Write-Output "db_target=${DbHost}:${DbPort}/${DbName} user=$DbUser"

function Invoke-PsqlFile {
    param([string]$Path)
    Write-Output "apply=$Path"
    & $Psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $Path
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed while applying $Path"
    }
}

if ($Mode -eq "fresh") {
    Invoke-PsqlFile (Join-Path $DatabaseRoot "schema.sql")
    foreach ($MigrationFile in $MigrationFiles) {
        Invoke-PsqlFile $MigrationFile
    }
    if ($WithSeed) {
        Invoke-PsqlFile (Join-Path $DatabaseRoot "seed-mock.sql")
    }
} elseif ($Mode -eq "seed") {
    Invoke-PsqlFile (Join-Path $DatabaseRoot "seed-mock.sql")
} else {
    foreach ($MigrationFile in $MigrationFiles) {
        Invoke-PsqlFile $MigrationFile
    }
}

Write-Output "db_apply=ok"
