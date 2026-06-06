$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SampleExcel = Join-Path $ProjectRoot ("tmp-sample-facilities-" + [Guid]::NewGuid().ToString("N") + ".xlsx")

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

function Escape-Xml {
    param([string]$Value)

    return [System.Security.SecurityElement]::Escape($Value)
}

function New-CellXml {
    param(
        [string]$CellRef,
        [string]$Value,
        [string]$Type = "inlineStr"
    )

    if ($Type -eq "number") {
        return "<c r=`"$CellRef`"><v>$Value</v></c>"
    }

    if ($Type -eq "date") {
        return "<c r=`"$CellRef`" s=`"1`"><v>$Value</v></c>"
    }

    return "<c r=`"$CellRef`" t=`"inlineStr`"><is><t>$(Escape-Xml $Value)</t></is></c>"
}

function Add-ZipTextEntry {
    param(
        [System.IO.Compression.ZipArchive]$Zip,
        [string]$Name,
        [string]$Text
    )

    $Entry = $Zip.CreateEntry($Name)
    $Writer = [System.IO.StreamWriter]::new($Entry.Open(), [System.Text.Encoding]::UTF8)
    try {
        $Writer.Write($Text)
    } finally {
        $Writer.Dispose()
    }
}

function New-SampleExcel {
    param([string]$Path)

    $Rows = @(
        @("id", "category", "name", "address", "phone", "latitude", "longitude", "source", "openedAt"),
        @("FAC-X01", "hospital", "Geumcheon Health Center", "Siheung-daero 73-gil 70", "02-2627-2422", "37.4568", "126.8954", "Excel Sample", "45900"),
        @("FAC-X02", "pharmacy", "Gasan Digital Pharmacy", "Gasan-dong", "02-0000-0000", "37.4784", "126.8839", "Excel Sample", "45901"),
        @("FAC-X03", "parking", "Geumcheon Office Parking", "Siheung-daero 73-gil 70", "02-0000-0000", "37.4556", "126.8941", "Excel Sample", "45902")
    )

    $SheetRows = for ($RowIndex = 0; $RowIndex -lt $Rows.Count; $RowIndex += 1) {
        $Cells = for ($ColumnIndex = 0; $ColumnIndex -lt $Rows[$RowIndex].Count; $ColumnIndex += 1) {
            $Column = [char]([int][char]'A' + $ColumnIndex)
            $CellRef = "$Column$($RowIndex + 1)"
            if ($RowIndex -gt 0 -and ($ColumnIndex -eq 5 -or $ColumnIndex -eq 6)) {
                New-CellXml -CellRef $CellRef -Value $Rows[$RowIndex][$ColumnIndex] -Type "number"
            } elseif ($RowIndex -gt 0 -and $ColumnIndex -eq 8) {
                New-CellXml -CellRef $CellRef -Value $Rows[$RowIndex][$ColumnIndex] -Type "date"
            } else {
                New-CellXml -CellRef $CellRef -Value $Rows[$RowIndex][$ColumnIndex]
            }
        }
        "<row r=`"$($RowIndex + 1)`">$($Cells -join '')</row>"
    }

    $ContentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
'@
    $RootRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
'@
    $Styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="1">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="2">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="1" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>
'@
    $Workbook = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="facilities" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
'@
    $WorkbookRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@
    $Worksheet = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    $($SheetRows -join "`n    ")
  </sheetData>
</worksheet>
"@

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Force
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew)
    $Zip = [System.IO.Compression.ZipArchive]::new($Stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Add-ZipTextEntry $Zip "[Content_Types].xml" $ContentTypes
        Add-ZipTextEntry $Zip "_rels/.rels" $RootRels
        Add-ZipTextEntry $Zip "xl/workbook.xml" $Workbook
        Add-ZipTextEntry $Zip "xl/_rels/workbook.xml.rels" $WorkbookRels
        Add-ZipTextEntry $Zip "xl/styles.xml" $Styles
        Add-ZipTextEntry $Zip "xl/worksheets/sheet1.xml" $Worksheet
    } finally {
        $Zip.Dispose()
        $Stream.Dispose()
    }
}

$AdminLoginId = Get-EnvValue "ADMIN_INITIAL_LOGIN_ID" "admin"
$AdminPassword = Get-EnvValue "ADMIN_INITIAL_PASSWORD" "admin1234"
$AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$AdminLoginId`:$AdminPassword"))

try {
    New-SampleExcel $SampleExcel

    $PreviewResponse = Invoke-CurlWithStatus @(
        "-sS",
        "-H", "Authorization: Basic $AdminAuth",
        "-F", "file=@$SampleExcel;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "http://localhost:8080/api/admin/uploads/preview?datasetKey=facilities"
    )
    $Preview = $PreviewResponse.Body | ConvertFrom-Json
    if (-not $Preview.success) {
        throw "Excel preview failed ($($PreviewResponse.StatusCode)): $($Preview.message)"
    }

    $CommitBody = @{
        datasetKey = "facilities"
        uploadId = $Preview.data.uploadId
        fileName = "sample-facilities.xlsx"
        rowCount = 3
        columnCount = 9
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

    $CommitRequestPath = Join-Path $ProjectRoot ("tmp-excel-upload-commit-" + [Guid]::NewGuid().ToString("N") + ".json")
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

    $Commit = $CommitResponse.Body | ConvertFrom-Json
    if (-not $Commit.success) {
        throw "Excel commit failed ($($CommitResponse.StatusCode)): $($Commit.message)"
    }
    if ($Commit.data.rowCount -ne 3 -or $Commit.data.columnCount -ne 9) {
        throw "Excel upload commit returned unexpected source counts: rowCount=$($Commit.data.rowCount), columnCount=$($Commit.data.columnCount)"
    }
    if ($Commit.data.savedRowCount -ne 3 -or $Commit.data.skippedRowCount -ne 0) {
        throw "Excel upload commit returned unexpected saved/skipped counts: savedRowCount=$($Commit.data.savedRowCount), skippedRowCount=$($Commit.data.skippedRowCount)"
    }

    Write-Output "excel_preview=$($PreviewResponse.StatusCode)"
    Write-Output "excel_commit=$($CommitResponse.StatusCode)"
    Write-Output "excel_upload_check=ok"
} finally {
    if (Test-Path -LiteralPath $SampleExcel) {
        Remove-Item -LiteralPath $SampleExcel -Force
    }
}
