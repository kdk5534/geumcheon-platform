$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SampleCsv = Join-Path $ProjectRoot "frontend-static\assets\data\sample-facilities.csv"

function Get-EnvValue {
    param([string]$Name, [string]$Default)

    $Value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }
    return $Value
}

function Invoke-CurlWithStatus {
    param([string[]]$Arguments)

    $TempBody = Join-Path $ProjectRoot ("tmp-curl-body-" + [Guid]::NewGuid().ToString("N") + ".json")
    try {
        $Output = @(& curl.exe @Arguments -o $TempBody -w "%{http_code}" 2>&1)
        if ($LASTEXITCODE -ne 0) {
            $ErrorText = ($Output -join "`n").Trim()
            if ([string]::IsNullOrWhiteSpace($ErrorText)) {
                $ErrorText = "curl exited with code $LASTEXITCODE."
            }
            throw $ErrorText
        }

        if ($Output.Count -eq 0) {
            throw "curl returned no status output."
        }

        $StatusText = [string]$Output[-1]
        if ($StatusText -notmatch '^\d{3}$') {
            throw "Unexpected curl status output: $($Output -join "`n")"
        }

        $Body = if (Test-Path -LiteralPath $TempBody) {
            [System.IO.File]::ReadAllText($TempBody, [System.Text.Encoding]::UTF8)
        } else {
            ""
        }

        return [pscustomobject]@{
            StatusCode = [int]$StatusText
            Body = $Body
        }
    } finally {
        if (Test-Path -LiteralPath $TempBody) {
            Remove-Item -LiteralPath $TempBody -Force
        }
    }
}

if (-not (Test-Path -LiteralPath $SampleCsv)) {
    throw "Sample CSV was not found at $SampleCsv."
}

$AdminLoginId = Get-EnvValue "ADMIN_INITIAL_LOGIN_ID" "admin"
$AdminPassword = Get-EnvValue "ADMIN_INITIAL_PASSWORD" "admin1234"
$AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$AdminLoginId`:$AdminPassword"))

try {
    $Logs = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/admin/collection-logs" -Headers @{ Authorization = "Basic $AdminAuth" } -TimeoutSec 5
} catch {
    $StatusCode = $_.Exception.Response.StatusCode.value__
    if ($StatusCode -eq 401) {
        throw "Admin API returned 401. Start the backend with the same ADMIN_INITIAL_LOGIN_ID and ADMIN_INITIAL_PASSWORD values that you use for this check."
    }
    throw "Admin API is not reachable at http://localhost:8080. Start backend first with .\scripts\run-backend-db.ps1 or .\scripts\run-backend-mock.ps1."
}

 $PreviewResponse = Invoke-CurlWithStatus @(
     "-sS",
     "-H", "Authorization: Basic $AdminAuth",
     "-F", "file=@$SampleCsv",
     "http://localhost:8080/api/admin/uploads/preview?datasetKey=facilities"
 )
 $Preview = $null
 try {
     $Preview = $PreviewResponse.Body | ConvertFrom-Json
 } catch {
     $Preview = $null
 }
 $PreviewCode = if ($Preview -and $Preview.success) { 200 } else { $PreviewResponse.StatusCode }
if (-not $Preview -or -not $Preview.success) {
    $PreviewMessage = if ($Preview -and -not [string]::IsNullOrWhiteSpace($Preview.message)) { $Preview.message } else { $PreviewResponse.Body }
    throw "Upload preview failed ($($PreviewResponse.StatusCode)): $PreviewMessage"
}

$CountMismatchBody = @{
    datasetKey = "facilities"
    uploadId = $Preview.data.uploadId
    fileName = "sample-facilities.csv"
    rowCount = 2
    columnCount = 7
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
} | ConvertTo-Json -Depth 4 -Compress

$CountMismatchRequestPath = Join-Path $ProjectRoot ("tmp-upload-count-mismatch-" + [Guid]::NewGuid().ToString("N") + ".json")
try {
    [System.IO.File]::WriteAllText($CountMismatchRequestPath, $CountMismatchBody, [System.Text.Encoding]::UTF8)
    $CountMismatchResponse = Invoke-CurlWithStatus @(
        "-sS",
        "-H", "Authorization: Basic $AdminAuth",
        "-H", "Content-Type: application/json",
        "--data-binary", "@$CountMismatchRequestPath",
        "http://localhost:8080/api/admin/uploads/commit"
    )
} finally {
    if (Test-Path -LiteralPath $CountMismatchRequestPath) {
        Remove-Item -LiteralPath $CountMismatchRequestPath -Force
    }
}

$CountMismatch = $null
try {
    $CountMismatch = $CountMismatchResponse.Body | ConvertFrom-Json
} catch {
    $CountMismatch = $null
}
if (-not $CountMismatch -or $CountMismatch.success) {
    $CountMismatchMessage = if ($CountMismatch -and -not [string]::IsNullOrWhiteSpace($CountMismatch.message)) { $CountMismatch.message } else { $CountMismatchResponse.Body }
    throw "Upload count validation should fail, but it succeeded or returned an unexpected response ($($CountMismatchResponse.StatusCode)): $CountMismatchMessage"
}
if ($CountMismatch.message -notmatch 'rowCount does not match preview data' -or $CountMismatch.message -notmatch 'columnCount does not match preview data') {
    throw "Upload count validation returned an unexpected message: $($CountMismatch.message)"
}

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
} | ConvertTo-Json -Depth 4 -Compress

$CommitRequestPath = Join-Path $ProjectRoot ("tmp-upload-commit-" + [Guid]::NewGuid().ToString("N") + ".json")
try {
    [System.IO.File]::WriteAllText($CommitRequestPath, $CommitBody, [System.Text.Encoding]::UTF8)
    $CommitResponse = Invoke-CurlWithStatus @(
        "-sS",
        "-H", "Authorization: Basic $AdminAuth",
        "-H", "Content-Type: application/json",
        "--data-binary", "@$CommitRequestPath",
        "http://localhost:8080/api/admin/uploads/commit"
    )
} finally {
    if (Test-Path -LiteralPath $CommitRequestPath) {
        Remove-Item -LiteralPath $CommitRequestPath -Force
    }
}

$Commit = $null
try {
    $Commit = $CommitResponse.Body | ConvertFrom-Json
} catch {
    $Commit = $null
}
if (-not $Commit -or -not $Commit.success) {
    $CommitMessage = if ($Commit -and -not [string]::IsNullOrWhiteSpace($Commit.message)) { $Commit.message } else { $CommitResponse.Body }
    throw "Upload commit failed ($($CommitResponse.StatusCode)): $CommitMessage"
}
if ($Commit.data.rowCount -ne 3 -or $Commit.data.columnCount -ne 8) {
    throw "Upload commit returned unexpected source counts: rowCount=$($Commit.data.rowCount), columnCount=$($Commit.data.columnCount)"
}
if ($Commit.data.savedRowCount -ne 3 -or $Commit.data.skippedRowCount -ne 0) {
    throw "Upload commit returned unexpected saved/skipped counts: savedRowCount=$($Commit.data.savedRowCount), skippedRowCount=$($Commit.data.skippedRowCount)"
}

$InvalidMappingBody = @{
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
        source = "source"
    }
} | ConvertTo-Json -Depth 4 -Compress

$InvalidMappingRequestPath = Join-Path $ProjectRoot ("tmp-upload-commit-invalid-mapping-" + [Guid]::NewGuid().ToString("N") + ".json")
try {
    [System.IO.File]::WriteAllText($InvalidMappingRequestPath, $InvalidMappingBody, [System.Text.Encoding]::UTF8)
    $InvalidMappingResponse = Invoke-CurlWithStatus @(
        "-sS",
        "-H", "Authorization: Basic $AdminAuth",
        "-H", "Content-Type: application/json",
        "--data-binary", "@$InvalidMappingRequestPath",
        "http://localhost:8080/api/admin/uploads/commit"
    )
} finally {
    if (Test-Path -LiteralPath $InvalidMappingRequestPath) {
        Remove-Item -LiteralPath $InvalidMappingRequestPath -Force
    }
}

$InvalidMapping = $null
try {
    $InvalidMapping = $InvalidMappingResponse.Body | ConvertFrom-Json
} catch {
    $InvalidMapping = $null
}
if (-not $InvalidMapping -or $InvalidMapping.success) {
    $InvalidMappingMessage = if ($InvalidMapping -and -not [string]::IsNullOrWhiteSpace($InvalidMapping.message)) { $InvalidMapping.message } else { $InvalidMappingResponse.Body }
    throw "Upload mapping validation should fail, but it succeeded or returned an unexpected response ($($InvalidMappingResponse.StatusCode)): $InvalidMappingMessage"
}
if ($InvalidMapping.message -notmatch 'missing required mappings') {
    throw "Upload mapping validation returned an unexpected message: $($InvalidMapping.message)"
}

$UnknownPreviewResponse = Invoke-CurlWithStatus @(
    "-sS",
    "-H", "Authorization: Basic $AdminAuth",
    "-F", "file=@$SampleCsv",
    "http://localhost:8080/api/admin/uploads/preview?datasetKey=unknown-dataset"
)
$UnknownPreview = $null
try {
    $UnknownPreview = $UnknownPreviewResponse.Body | ConvertFrom-Json
} catch {
    $UnknownPreview = $null
}
if (-not $UnknownPreview -or $UnknownPreview.success) {
    $UnknownPreviewMessage = if ($UnknownPreview -and -not [string]::IsNullOrWhiteSpace($UnknownPreview.message)) { $UnknownPreview.message } else { $UnknownPreviewResponse.Body }
    throw "Unknown datasetKey preview should fail, but it succeeded or returned an unexpected response ($($UnknownPreviewResponse.StatusCode)): $UnknownPreviewMessage"
}
if ($UnknownPreview.message -notmatch 'Unknown datasetKey') {
    throw "Unknown datasetKey preview returned an unexpected message: $($UnknownPreview.message)"
}

$StoresPreviewResponse = Invoke-CurlWithStatus @(
    "-sS",
    "-H", "Authorization: Basic $AdminAuth",
    "-F", "file=@$SampleCsv",
    "http://localhost:8080/api/admin/uploads/preview?datasetKey=stores"
)
$StoresPreview = $null
try {
    $StoresPreview = $StoresPreviewResponse.Body | ConvertFrom-Json
} catch {
    $StoresPreview = $null
}
if (-not $StoresPreview -or -not $StoresPreview.success) {
    $StoresPreviewMessage = if ($StoresPreview -and -not [string]::IsNullOrWhiteSpace($StoresPreview.message)) { $StoresPreview.message } else { $StoresPreviewResponse.Body }
    throw "Stores preview failed ($($StoresPreviewResponse.StatusCode)): $StoresPreviewMessage"
}

$StoresCommitBody = @{
    datasetKey = "stores"
    uploadId = $StoresPreview.data.uploadId
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
} | ConvertTo-Json -Depth 4 -Compress

$StoresCommitRequestPath = Join-Path $ProjectRoot ("tmp-upload-commit-stores-" + [Guid]::NewGuid().ToString("N") + ".json")
try {
    [System.IO.File]::WriteAllText($StoresCommitRequestPath, $StoresCommitBody, [System.Text.Encoding]::UTF8)
    $StoresCommitResponse = Invoke-CurlWithStatus @(
        "-sS",
        "-H", "Authorization: Basic $AdminAuth",
        "-H", "Content-Type: application/json",
        "--data-binary", "@$StoresCommitRequestPath",
        "http://localhost:8080/api/admin/uploads/commit"
    )
} finally {
    if (Test-Path -LiteralPath $StoresCommitRequestPath) {
        Remove-Item -LiteralPath $StoresCommitRequestPath -Force
    }
}

$StoresCommit = $null
try {
    $StoresCommit = $StoresCommitResponse.Body | ConvertFrom-Json
} catch {
    $StoresCommit = $null
}
if (-not $StoresCommit -or $StoresCommit.success) {
    $StoresCommitMessage = if ($StoresCommit -and -not [string]::IsNullOrWhiteSpace($StoresCommit.message)) { $StoresCommit.message } else { $StoresCommitResponse.Body }
    throw "Stores upload commit should be rejected, but it succeeded or returned an unexpected response ($($StoresCommitResponse.StatusCode)): $StoresCommitMessage"
}
if ($StoresCommit.message -notmatch 'not supported') {
    throw "Stores upload commit returned an unexpected message: $($StoresCommit.message)"
}

Write-Output "collection_logs=$($Logs.StatusCode)"
Write-Output "upload_preview=$PreviewCode"
Write-Output "upload_commit=$($CommitResponse.StatusCode)"
Write-Output "upload_mapping_validation_rejected=$($InvalidMappingResponse.StatusCode)"
Write-Output "unknown_dataset_preview_rejected=$($UnknownPreviewResponse.StatusCode)"
Write-Output "stores_preview=$($StoresPreviewResponse.StatusCode)"
Write-Output "stores_commit_rejected=$($StoresCommitResponse.StatusCode)"
