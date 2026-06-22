param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [string]$BackendUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CsvPath = (Resolve-Path -LiteralPath $Path).Path

if ([System.IO.Path]::GetExtension($CsvPath) -ne ".csv") {
    throw "CCTV source must be a CSV file: $CsvPath"
}

$EnvPath = Join-Path $ProjectRoot ".env"
if (Test-Path -LiteralPath $EnvPath) {
    Get-Content -LiteralPath $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $Name = $matches[1].Trim()
            if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
                $Value = $matches[2].Trim().Trim('"').Trim("'")
                [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
            }
        }
    }
}

$LoginId = $env:ADMIN_INITIAL_LOGIN_ID
$Password = $env:ADMIN_INITIAL_PASSWORD
if ([string]::IsNullOrWhiteSpace($LoginId) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "ADMIN_INITIAL_LOGIN_ID and ADMIN_INITIAL_PASSWORD are required."
}

$Auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$LoginId`:$Password"))
$PreviewBody = Join-Path $env:TEMP ("cctv-preview-" + [Guid]::NewGuid().ToString("N") + ".json")
$ColumnNames = '{"id":"\uAD00\uB9AC\uBC88\uD638","purpose":"\uC124\uCE58\uBAA9\uC801\uAD6C\uBD84","roadAddress":"\uC18C\uC7AC\uC9C0\uB3C4\uB85C\uBA85\uC8FC\uC18C","lotAddress":"\uC18C\uC7AC\uC9C0\uC9C0\uBC88\uC8FC\uC18C","phone":"\uAD00\uB9AC\uAE30\uAD00\uC804\uD654\uBC88\uD638"}' | ConvertFrom-Json

try {
    $Status = & curl.exe -sS -o $PreviewBody -w "%{http_code}" `
        -H "Authorization: Basic $Auth" `
        -F "file=@$CsvPath" `
        "$BackendUrl/api/admin/uploads/preview?datasetKey=cctv-stations"
    if ($LASTEXITCODE -ne 0 -or [int]$Status -ne 200) {
        $Body = if (Test-Path -LiteralPath $PreviewBody) { Get-Content -LiteralPath $PreviewBody -Raw -Encoding UTF8 } else { "" }
        throw "CCTV preview failed (HTTP $Status): $Body"
    }

    $Preview = Get-Content -LiteralPath $PreviewBody -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $Preview.success) {
        throw "CCTV preview failed: $($Preview.message)"
    }

    $Mappings = @{}
    $Mappings[$ColumnNames.id] = "id"
    $Mappings[$ColumnNames.purpose] = "purpose"
    $Mappings[$ColumnNames.roadAddress] = "roadAddress"
    $Mappings[$ColumnNames.lotAddress] = "lotAddress"
    $Mappings[$ColumnNames.phone] = "phone"
    $Mappings["WGS84" + ([char]0xC704) + ([char]0xB3C4)] = "latitude"
    $Mappings["WGS84" + ([char]0xACBD) + ([char]0xB3C4)] = "longitude"

    $CommitBody = @{
        datasetKey = "cctv-stations"
        uploadId = $Preview.data.uploadId
        fileName = [System.IO.Path]::GetFileName($CsvPath)
        rowCount = $Preview.data.rowCount
        columnCount = $Preview.data.columnCount
        columnMappings = $Mappings
    } | ConvertTo-Json -Depth 6

    $Headers = @{
        Authorization = "Basic $Auth"
        Accept = "application/json"
    }
    $Commit = Invoke-RestMethod -Method Post `
        -Uri "$BackendUrl/api/admin/uploads/commit" `
        -Headers $Headers `
        -ContentType "application/json; charset=utf-8" `
        -Body ([Text.Encoding]::UTF8.GetBytes($CommitBody)) `
        -TimeoutSec 120

    if (-not $Commit.success -or $Commit.data.skippedRowCount -ne 0) {
        throw "CCTV commit was not clean: $($Commit | ConvertTo-Json -Depth 8 -Compress)"
    }

    [pscustomobject]@{
        datasetKey = "cctv-stations"
        file = $CsvPath
        previewRows = $Preview.data.rowCount
        savedRows = $Commit.data.savedRowCount
        skippedRows = $Commit.data.skippedRowCount
        status = "success"
    } | ConvertTo-Json -Depth 4
} finally {
    if (Test-Path -LiteralPath $PreviewBody) {
        Remove-Item -LiteralPath $PreviewBody -Force
    }
}
