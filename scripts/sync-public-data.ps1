param(
    [string]$DatasetKey
)

$BackendBase = $env:BACKEND_URL
if ([string]::IsNullOrWhiteSpace($BackendBase)) {
    $BackendBase = "http://localhost:8080"
}

$LoginId = $env:ADMIN_INITIAL_LOGIN_ID
if ([string]::IsNullOrWhiteSpace($LoginId)) {
    $LoginId = "admin"
}

$Password = $env:ADMIN_INITIAL_PASSWORD
if ([string]::IsNullOrWhiteSpace($Password)) {
    $Password = "admin1234"
}

$AuthBytes = [System.Text.Encoding]::ASCII.GetBytes("$LoginId`:$Password")
$AuthValue = [Convert]::ToBase64String($AuthBytes)
$Headers = @{
    Authorization = "Basic $AuthValue"
    Accept        = "application/json"
}

$SyncUri = "$BackendBase/api/admin/public-data/sync"
if (-not [string]::IsNullOrWhiteSpace($DatasetKey)) {
    $SyncUri = "$SyncUri?datasetKey=$([uri]::EscapeDataString($DatasetKey))"
}

try {
    $SyncResponse = Invoke-RestMethod -Method Post -Uri $SyncUri -Headers $Headers -TimeoutSec 30
    $SyncResponse | ConvertTo-Json -Depth 10
} catch {
    Write-Error "Public data sync failed: $($_.Exception.Message)"
    exit 1
}

try {
    $Sources = Invoke-RestMethod -Method Get -Uri "$BackendBase/api/public/api-sources" -Headers @{ Accept = "application/json" } -TimeoutSec 20
    "api_sources="
    $Sources.data | ConvertTo-Json -Depth 10
    $Logs = Invoke-RestMethod -Method Get -Uri "$BackendBase/api/public/api-logs" -Headers @{ Accept = "application/json" } -TimeoutSec 20
    "api_logs="
    $Logs.data | Select-Object -First 10 | ConvertTo-Json -Depth 10
} catch {
    Write-Warning "Post-sync lookup failed: $($_.Exception.Message)"
}
