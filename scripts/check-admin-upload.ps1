$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SampleCsv = Join-Path $ProjectRoot "frontend-static\assets\data\sample-facilities.csv"
$AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin1234"))

try {
    $Logs = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/admin/collection-logs" -Headers @{ Authorization = "Basic $AdminAuth" } -TimeoutSec 5
} catch {
    $StatusCode = $_.Exception.Response.StatusCode.value__
    if ($StatusCode -eq 401) {
        throw "Admin API returned 401. Restart backend after applying the latest auth config, or set ADMIN_INITIAL_LOGIN_ID=admin and ADMIN_INITIAL_PASSWORD=admin1234 before running DB mode."
    }
    throw "Admin API is not reachable at http://localhost:8080. Start backend first with .\scripts\run-backend-db.ps1 or .\scripts\run-backend-mock.ps1."
}

$PreviewJson = & curl.exe -s -u admin:admin1234 -F "file=@$SampleCsv" "http://localhost:8080/api/admin/uploads/preview?datasetKey=facilities"
$Preview = $PreviewJson | ConvertFrom-Json
$PreviewCode = if ($Preview.success) { 200 } else { 500 }
$CommitBody = @{
    datasetKey = "facilities"
    uploadId = $Preview.data.uploadId
    fileName = "sample-facilities.csv"
    rowCount = 3
    columnCount = 8
    columnMappings = @{
        id = "id"
        category = "category"
        name = "name"
        address = "address"
        phone = "phone"
        latitude = "latitude"
        longitude = "longitude"
        source = "source"
    }
} | ConvertTo-Json -Depth 4
$Commit = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/admin/uploads/commit" -Method POST -Headers @{ Authorization = "Basic $AdminAuth"; "Content-Type" = "application/json" } -Body $CommitBody -TimeoutSec 5

Write-Output "collection_logs=$($Logs.StatusCode)"
Write-Output "upload_preview=$PreviewCode"
Write-Output "upload_commit=$($Commit.StatusCode)"
