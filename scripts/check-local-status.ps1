$ErrorActionPreference = "Stop"

$AdminAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin1234"))

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

$FrontendStatus = Get-HttpStatus -Url "http://localhost:3000/"
$BackendHealthStatus = Get-HttpStatus -Url "http://localhost:8080/actuator/health"
$PublicDatasetsStatus = Get-HttpStatus -Url "http://localhost:8080/api/public/datasets"
$AdminDatasetsStatus = Get-HttpStatus -Url "http://localhost:8080/api/admin/datasets" -Headers @{ Authorization = "Basic $AdminAuth" }
$PostgresTcp = Test-TcpPort -Port 5432

Write-Output "frontend=$FrontendStatus ($(Get-StatusLabel -Status $FrontendStatus))"
Write-Output "backend_health=$BackendHealthStatus ($(Get-StatusLabel -Status $BackendHealthStatus))"
Write-Output "public_datasets=$PublicDatasetsStatus ($(Get-StatusLabel -Status $PublicDatasetsStatus))"
Write-Output "admin_datasets=$AdminDatasetsStatus ($(Get-StatusLabel -Status $AdminDatasetsStatus))"
Write-Output "postgres_tcp_5432=$PostgresTcp"

Write-Output ""
Write-Output "mock_mode_next="
if ($FrontendStatus -ne "200") {
    Write-Output "1. Frontend check needed: cd C:\Users\Administrator\Documents\geumcheon-platform\frontend-static ; node serve-static.mjs"
} else {
    Write-Output "1. Frontend is OK: http://localhost:3000/"
}

if ($BackendHealthStatus -ne "200" -or $PublicDatasetsStatus -ne "200" -or $AdminDatasetsStatus -ne "200") {
    Write-Output "2. Backend check needed: cd C:\Users\Administrator\Documents\geumcheon-platform ; .\scripts\run-backend-mock.ps1"
} else {
    Write-Output "2. Backend mock API is OK: http://localhost:8080/"
}

if ($PostgresTcp -eq "open") {
    Write-Output "3. PostgreSQL appears to be running. DB mode can be tested when needed."
} else {
    Write-Output "3. PostgreSQL is not running. This is OK while DB mode is deferred."
}
