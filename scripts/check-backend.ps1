$ErrorActionPreference = "Stop"

function Get-EnvValue {
    param([string]$Name, [string]$Default)

    $Value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }
    return $Value
}

$AdminLoginId = Get-EnvValue "ADMIN_INITIAL_LOGIN_ID" "admin"
$AdminPassword = Get-EnvValue "ADMIN_INITIAL_PASSWORD" "admin1234"
$AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$AdminLoginId`:$AdminPassword"))

$Health = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/actuator/health" -TimeoutSec 5
$Datasets = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/public/datasets" -TimeoutSec 5
$Facilities = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/public/facilities" -TimeoutSec 5
$AdminDatasets = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/admin/datasets" -Headers @{ Authorization = "Basic $AdminAuth" } -TimeoutSec 5

Write-Output "health=$($Health.StatusCode)"
Write-Output "public_datasets=$($Datasets.StatusCode)"
Write-Output "public_facilities=$($Facilities.StatusCode)"
Write-Output "admin_datasets=$($AdminDatasets.StatusCode)"
