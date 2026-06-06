$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AdminCheck = Join-Path $PSScriptRoot "check-admin-upload.ps1"

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
} else {
    throw "DB_PASSWORD is not set in this PowerShell session. Set it to the geumcheon database user's password before running this check."
}

if ([string]::IsNullOrWhiteSpace($env:PGCLIENTENCODING)) {
    $env:PGCLIENTENCODING = "UTF8"
}

$Psql = Resolve-PsqlPath

& $AdminCheck

$Sql = @"
SELECT
    (SELECT COUNT(*) FROM uploaded_file) AS uploaded_files,
    (SELECT COUNT(*) FROM dataset_collection_log WHERE collection_type = 'CSV_UPLOAD') AS upload_logs,
    (SELECT COUNT(*) FROM facility WHERE dataset_id = (SELECT dataset_id FROM dataset WHERE dataset_key = 'facilities')) AS facility_rows,
    COALESCE((SELECT stored_file_path FROM uploaded_file ORDER BY uploaded_at DESC LIMIT 1), '') AS latest_file_path;
"@

$Result = @(& $Psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -t -A -F "|" -c $Sql 2>&1)
if ($LASTEXITCODE -ne 0) {
    $PsqlError = ($Result -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($PsqlError)) {
        $PsqlError = "psql exited with code $LASTEXITCODE."
    }
    throw "psql query failed: $PsqlError"
}

$ResultText = ($Result -join "`n").Trim()
if ([string]::IsNullOrWhiteSpace($ResultText)) {
    throw "psql query returned no data."
}

$Parts = $ResultText -split "\|"
if ($Parts.Count -lt 4) {
    throw "Unexpected psql output: $ResultText"
}

$UploadedFiles = [int]$Parts[0]
$UploadLogs = [int]$Parts[1]
$FacilityRows = [int]$Parts[2]
$LatestFilePath = $Parts[3]

Write-Output "db_target=${DbHost}:${DbPort}/${DbName} user=$DbUser"
Write-Output "db_uploaded_files=$UploadedFiles"
Write-Output "db_upload_logs=$UploadLogs"
Write-Output "db_facility_rows=$FacilityRows"
Write-Output "db_latest_file_path=$LatestFilePath"
Write-Output "db_latest_file_exists=$(Test-Path -LiteralPath $LatestFilePath)"

if ($UploadedFiles -lt 1) {
    throw "DB upload integration check failed: no uploaded_file rows were found."
}

if ($UploadLogs -lt 1) {
    throw "DB upload integration check failed: no CSV upload logs were found."
}

if ($FacilityRows -lt 1) {
    throw "DB upload integration check failed: no facility rows were stored for dataset 'facilities'."
}

if (-not (Test-Path -LiteralPath $LatestFilePath)) {
    throw "DB upload integration check failed: the latest uploaded file was not found at '$LatestFilePath'."
}

Write-Output "db_upload_check=ok"
