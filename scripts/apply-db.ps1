param(
    [ValidateSet("fresh", "migrate")]
    [string]$Mode = "migrate",
    [switch]$WithSeed
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DatabaseRoot = Join-Path $ProjectRoot "database"

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

$Psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $Psql) {
    throw "psql was not found. Install PostgreSQL client tools or add psql to PATH."
}

function Invoke-PsqlFile {
    param([string]$Path)
    Write-Output "apply=$Path"
    & $Psql.Source -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $Path
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed while applying $Path"
    }
}

if ($Mode -eq "fresh") {
    Invoke-PsqlFile (Join-Path $DatabaseRoot "schema.sql")
    if ($WithSeed) {
        Invoke-PsqlFile (Join-Path $DatabaseRoot "seed-mock.sql")
    }
} else {
    Invoke-PsqlFile (Join-Path $DatabaseRoot "migration-20260602-admin-upload.sql")
}

Write-Output "db_apply=ok"
