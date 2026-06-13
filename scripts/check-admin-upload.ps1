$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SampleFacilitiesCsv = Join-Path $ProjectRoot "frontend-static\assets\data\sample-facilities.csv"

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

function Convert-ApiBody {
    param($Response)

    try {
        return $Response.Body | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Assert-ApiSuccess {
    param(
        [string]$Label,
        $Response,
        [int]$ExpectedStatus = 200
    )

    $Payload = Convert-ApiBody $Response
    if ($Response.StatusCode -ne $ExpectedStatus -or -not $Payload -or -not $Payload.success) {
        $Message = if ($Payload -and -not [string]::IsNullOrWhiteSpace($Payload.message)) { $Payload.message } else { $Response.Body }
        throw "$Label failed ($($Response.StatusCode)): $Message"
    }
    return $Payload
}

function Assert-ApiFailure {
    param(
        [string]$Label,
        $Response,
        [int]$ExpectedStatus,
        [string]$ExpectedMessagePattern
    )

    $Payload = Convert-ApiBody $Response
    if ($Response.StatusCode -ne $ExpectedStatus) {
        throw "$Label returned unexpected status $($Response.StatusCode). Expected $ExpectedStatus."
    }
    if (-not $Payload -or $Payload.success) {
        $Message = if ($Payload -and -not [string]::IsNullOrWhiteSpace($Payload.message)) { $Payload.message } else { $Response.Body }
        throw "$Label should fail, but it succeeded or returned an unexpected response: $Message"
    }
    if ($Payload.message -notmatch $ExpectedMessagePattern) {
        throw "$Label returned an unexpected message: $($Payload.message)"
    }
}

function New-TempCsvFile {
    param(
        [string]$Prefix,
        [string]$Content
    )

    $Path = Join-Path $ProjectRoot ("tmp-" + $Prefix + "-" + [Guid]::NewGuid().ToString("N") + ".csv")
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.Encoding]::UTF8)
    return $Path
}

function Invoke-Preview {
    param(
        [string]$DatasetKey,
        [string]$FilePath,
        [string]$AdminAuth
    )

    return Invoke-CurlWithStatus @(
        "-sS",
        "-H", "Authorization: Basic $AdminAuth",
        "-F", "file=@$FilePath",
        "http://localhost:8080/api/admin/uploads/preview?datasetKey=$([uri]::EscapeDataString($DatasetKey))"
    )
}

function Invoke-Commit {
    param(
        [hashtable]$Body,
        [string]$AdminAuth
    )

    $RequestPath = Join-Path $ProjectRoot ("tmp-upload-commit-" + [Guid]::NewGuid().ToString("N") + ".json")
    try {
        [System.IO.File]::WriteAllText($RequestPath, ($Body | ConvertTo-Json -Depth 6 -Compress), [System.Text.Encoding]::UTF8)
        return Invoke-CurlWithStatus @(
            "-sS",
            "-H", "Authorization: Basic $AdminAuth",
            "-H", "Content-Type: application/json",
            "--data-binary", "@$RequestPath",
            "http://localhost:8080/api/admin/uploads/commit"
        )
    } finally {
        if (Test-Path -LiteralPath $RequestPath) {
            Remove-Item -LiteralPath $RequestPath -Force
        }
    }
}

if (-not (Test-Path -LiteralPath $SampleFacilitiesCsv)) {
    throw "Sample CSV was not found at $SampleFacilitiesCsv."
}

$StoresCsv = $null
$PopulationCsv = $null

try {
    $StoresCsv = New-TempCsvFile -Prefix "stores" -Content @"
id,name,category,address,phone,latitude,longitude,source
STORE-001,Geumcheon Cafe,Cafe,서울특별시 금천구 시흥대로 10,02-1111-2222,37.4560,126.8950,Sample
"@

    $PopulationCsv = New-TempCsvFile -Prefix "population" -Content @"
areaName,baseDate,populationTotal,male,female,source
가산동,2026-05-01,24000,12100,11900,Sample
"@

    $AdminLoginId = Get-EnvValue "ADMIN_INITIAL_LOGIN_ID" "admin"
    $AdminPassword = Get-EnvValue "ADMIN_INITIAL_PASSWORD" "admin1234"
    $AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$AdminLoginId`:$AdminPassword"))

    try {
        $Logs = Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/admin/collection-logs?limit=20" -Headers @{ Authorization = "Basic $AdminAuth" } -TimeoutSec 5
    } catch {
        $StatusCode = $_.Exception.Response.StatusCode.value__
        if ($StatusCode -eq 401) {
            throw "Admin API returned 401. Start the backend with the same ADMIN_INITIAL_LOGIN_ID and ADMIN_INITIAL_PASSWORD values that you use for this check."
        }
        throw "Admin API is not reachable at http://localhost:8080. Start backend first with .\scripts\run-backend-db.ps1 or .\scripts\run-backend-mock.ps1."
    }

    $FacilitiesPreview = Assert-ApiSuccess "Facilities preview" (Invoke-Preview -DatasetKey "facilities" -FilePath $SampleFacilitiesCsv -AdminAuth $AdminAuth)

    Assert-ApiFailure "Facilities count validation" (Invoke-Commit -AdminAuth $AdminAuth -Body @{
        datasetKey = "facilities"
        uploadId = $FacilitiesPreview.data.uploadId
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
    }) -ExpectedStatus 400 -ExpectedMessagePattern 'rowCount does not match preview data'

    $FacilitiesPreview = Assert-ApiSuccess "Facilities preview (commit)" (Invoke-Preview -DatasetKey "facilities" -FilePath $SampleFacilitiesCsv -AdminAuth $AdminAuth)
    $FacilitiesCommit = Assert-ApiSuccess "Facilities commit" (Invoke-Commit -AdminAuth $AdminAuth -Body @{
        datasetKey = "facilities"
        uploadId = $FacilitiesPreview.data.uploadId
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
    })
    if ($FacilitiesCommit.data.savedRowCount -ne 3 -or $FacilitiesCommit.data.skippedRowCount -ne 0) {
        throw "Facilities commit returned unexpected saved/skipped counts: savedRowCount=$($FacilitiesCommit.data.savedRowCount), skippedRowCount=$($FacilitiesCommit.data.skippedRowCount)"
    }

    $FacilitiesPreview = Assert-ApiSuccess "Facilities preview (invalid mapping)" (Invoke-Preview -DatasetKey "facilities" -FilePath $SampleFacilitiesCsv -AdminAuth $AdminAuth)
    Assert-ApiFailure "Facilities mapping validation" (Invoke-Commit -AdminAuth $AdminAuth -Body @{
        datasetKey = "facilities"
        uploadId = $FacilitiesPreview.data.uploadId
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
    }) -ExpectedStatus 400 -ExpectedMessagePattern 'missing required mappings'

    Assert-ApiFailure "Unknown dataset preview" (Invoke-Preview -DatasetKey "unknown-dataset" -FilePath $SampleFacilitiesCsv -AdminAuth $AdminAuth) -ExpectedStatus 404 -ExpectedMessagePattern 'Unknown datasetKey'

    $StoresPreview = Assert-ApiSuccess "Stores preview" (Invoke-Preview -DatasetKey "stores" -FilePath $StoresCsv -AdminAuth $AdminAuth)
    $StoresCommit = Assert-ApiSuccess "Stores commit" (Invoke-Commit -AdminAuth $AdminAuth -Body @{
        datasetKey = "stores"
        uploadId = $StoresPreview.data.uploadId
        fileName = "stores.csv"
        rowCount = 1
        columnCount = 8
        columnMappings = @{
            id = "id"
            name = "name"
            category = "category"
            address = "address"
            phone = "phone"
            latitude = "latitude"
            longitude = "longitude"
            source = "source"
        }
    })
    if ($StoresCommit.data.savedRowCount -ne 1) {
        throw "Stores commit returned unexpected savedRowCount: $($StoresCommit.data.savedRowCount)"
    }

    $PopulationPreview = Assert-ApiSuccess "Population preview" (Invoke-Preview -DatasetKey "population" -FilePath $PopulationCsv -AdminAuth $AdminAuth)
    $PopulationCommit = Assert-ApiSuccess "Population commit" (Invoke-Commit -AdminAuth $AdminAuth -Body @{
        datasetKey = "population"
        uploadId = $PopulationPreview.data.uploadId
        fileName = "population.csv"
        rowCount = 1
        columnCount = 6
        columnMappings = @{
            areaName = "areaName"
            baseDate = "baseDate"
            populationTotal = "populationTotal"
            male = "male"
            female = "female"
            source = "source"
        }
    })
    if ($PopulationCommit.data.savedRowCount -ne 1) {
        throw "Population commit returned unexpected savedRowCount: $($PopulationCommit.data.savedRowCount)"
    }

    Write-Output "collection_logs=$($Logs.StatusCode)"
    Write-Output "facilities_preview=200"
    Write-Output "facilities_commit=200"
    Write-Output "facilities_count_validation=400"
    Write-Output "facilities_mapping_validation=400"
    Write-Output "unknown_dataset_preview=404"
    Write-Output "stores_preview=200"
    Write-Output "stores_commit=200"
    Write-Output "population_preview=200"
    Write-Output "population_commit=200"
} finally {
    if ($StoresCsv -and (Test-Path -LiteralPath $StoresCsv)) {
        Remove-Item -LiteralPath $StoresCsv -Force
    }
    if ($PopulationCsv -and (Test-Path -LiteralPath $PopulationCsv)) {
        Remove-Item -LiteralPath $PopulationCsv -Force
    }
}
