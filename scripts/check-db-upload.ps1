$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AdminCheck = Join-Path $PSScriptRoot "check-admin-upload.ps1"

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

& $AdminCheck

$Sql = @"
SELECT
    (SELECT COUNT(*) FROM uploaded_file) AS uploaded_files,
    (SELECT COUNT(*) FROM dataset_collection_log WHERE collection_type = 'CSV_UPLOAD') AS upload_logs,
    (SELECT COUNT(*) FROM facility WHERE dataset_id = (SELECT dataset_id FROM dataset WHERE dataset_key = 'facilities')) AS facility_rows,
    COALESCE((SELECT stored_file_path FROM uploaded_file ORDER BY uploaded_at DESC LIMIT 1), '') AS latest_file_path;
"@

$Result = & $Psql.Source -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -t -A -F "|" -c $Sql
$Parts = $Result.Trim() -split "\|"

$UploadedFiles = [int]$Parts[0]
$UploadLogs = [int]$Parts[1]
$FacilityRows = [int]$Parts[2]
$LatestFilePath = $Parts[3]

Write-Output "db_uploaded_files=$UploadedFiles"
Write-Output "db_upload_logs=$UploadLogs"
Write-Output "db_facility_rows=$FacilityRows"
Write-Output "db_latest_file_path=$LatestFilePath"
Write-Output "db_latest_file_exists=$(Test-Path -LiteralPath $LatestFilePath)"

if ($UploadedFiles -lt 1 -or $UploadLogs -lt 1 -or $FacilityRows -lt 1 -or -not (Test-Path -LiteralPath $LatestFilePath)) {
    throw "DB upload integration check failed."
}

Write-Output "db_upload_check=ok"
