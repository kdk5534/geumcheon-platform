$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$BackendRoot = $ProjectRoot

function Get-EnvValue {
    param([string]$Name, [string]$Default)

    $Value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }
    return $Value
}

$DbPortText = Get-EnvValue "DB_PORT" "5432"
[int]$DbPort = $DbPortText

$AdminLoginId = [Environment]::GetEnvironmentVariable("ADMIN_INITIAL_LOGIN_ID")
$AdminPassword = [Environment]::GetEnvironmentVariable("ADMIN_INITIAL_PASSWORD")
$AdminAuth = $null
if (-not [string]::IsNullOrWhiteSpace($AdminLoginId) -and -not [string]::IsNullOrWhiteSpace($AdminPassword)) {
    $AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$AdminLoginId`:$AdminPassword"))
}

function Test-TcpPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $Client = New-Object Net.Sockets.TcpClient
    try {
        $Connect = $Client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if ($Connect.AsyncWaitHandle.WaitOne(500, $false)) {
            $Client.EndConnect($Connect)
            return "open"
        }
        return "closed"
    } catch {
        return "closed"
    } finally {
        $Client.Close()
    }
}

function Get-HttpStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [hashtable]$Headers = @{}
    )

    try {
        $Response = Invoke-WebRequest -UseBasicParsing $Url -Headers $Headers -TimeoutSec 3
        return [string]$Response.StatusCode
    } catch {
        $StatusCode = $_.Exception.Response.StatusCode.value__
        if ($StatusCode) {
            return [string]$StatusCode
        }
        return "unreachable"
    }
}

function Get-StatusLabel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status
    )

    if ($Status -eq "200") {
        return "ok"
    }
    if ($Status -eq "unreachable") {
        return "not-running"
    }
    return "check-needed"
}

function Write-HttpCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [hashtable]$Headers = @{}
    )

    $Status = Get-HttpStatus -Url $Url -Headers $Headers
    Write-Output "$Name=$Status ($(Get-StatusLabel -Status $Status))"
}

$FrontendStatus = Get-HttpStatus -Url "http://localhost:3100/"
$BackendHealthStatus = Get-HttpStatus -Url "http://localhost:8080/actuator/health"
$PublicDatasetsStatus = Get-HttpStatus -Url "http://localhost:8080/api/public/datasets"
$AdminDatasetsStatus = "not-checked"
if ($AdminAuth) {
    $AdminDatasetsStatus = Get-HttpStatus -Url "http://localhost:8080/api/admin/datasets" -Headers @{ Authorization = "Basic $AdminAuth" }
}
$PostgresTcp = Test-TcpPort -Port $DbPort

Write-Output "frontend=$FrontendStatus ($(Get-StatusLabel -Status $FrontendStatus))"
Write-Output "backend_health=$BackendHealthStatus ($(Get-StatusLabel -Status $BackendHealthStatus))"
Write-Output "public_datasets=$PublicDatasetsStatus ($(Get-StatusLabel -Status $PublicDatasetsStatus))"
if ($AdminAuth) {
    Write-Output "admin_datasets=$AdminDatasetsStatus ($(Get-StatusLabel -Status $AdminDatasetsStatus))"
} else {
    Write-Output "admin_datasets=not-checked (ADMIN_INITIAL_* not provided)"
}
Write-Output "postgres_tcp_$DbPort=$PostgresTcp"

Write-Output ""
Write-Output "mock_mode_next="
if ($FrontendStatus -ne "200") {
    Write-Output "1. Frontend check needed: cd $FrontendRoot ; npm run dev"
} else {
    Write-Output "1. Frontend is OK: http://localhost:3100/"
}

if ($BackendHealthStatus -ne "200" -or $PublicDatasetsStatus -ne "200" -or ($AdminAuth -and $AdminDatasetsStatus -ne "200")) {
    Write-Output "2. Backend check needed: cd $BackendRoot ; .\scripts\run-backend-mock.ps1"
} else {
    Write-Output "2. Backend mock API is OK: http://localhost:8080/"
}

if ($PostgresTcp -eq "open") {
    Write-Output "3. PostgreSQL appears to be running on port $DbPort. DB mode can be tested when needed."
} else {
    Write-Output "3. PostgreSQL is not running on port $DbPort. This is OK while DB mode is deferred."
}

Write-Output "4. Excel upload check: cd $BackendRoot ; .\scripts\check-admin-excel-upload.ps1"
Write-Output "5. Backend unit tests: cd $BackendRoot ; mvn test"
Write-Output "   If Maven dependency download is blocked, use the upload check scripts above as the fallback verification."
