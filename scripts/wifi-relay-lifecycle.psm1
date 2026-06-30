Set-StrictMode -Version Latest

function New-WifiRelayToken {
    $Bytes = New-Object byte[] 32
    $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $Generator.GetBytes($Bytes)
        return [Convert]::ToBase64String($Bytes)
    } finally {
        $Generator.Dispose()
    }
}

function Test-WifiRelayTcpPort {
    param([int]$Port = 18088)

    $Client = New-Object System.Net.Sockets.TcpClient
    try {
        $Task = $Client.ConnectAsync("127.0.0.1", $Port)
        return $Task.Wait(500) -and $Client.Connected
    } catch {
        return $false
    } finally {
        $Client.Dispose()
    }
}

function Test-WifiRelayReady {
    param(
        [Parameter(Mandatory = $true)][string]$Token,
        [int]$Port = 18088,
        [int]$TimeoutSeconds = 2
    )

    try {
        $Health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/health" -TimeoutSec $TimeoutSeconds
        if ($Health.status -ne "UP" -or $Health.service -ne "TbPublicWifiInfo_GC") { return $false }
        $Status = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/v1/status" `
            -Headers @{ "X-Relay-Token" = $Token } -TimeoutSec $TimeoutSeconds
        return $Status.service -eq "TbPublicWifiInfo_GC"
    } catch {
        return $false
    }
}

function Write-WifiRelayTokenFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Token
    )

    $Directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Token, [System.Text.UTF8Encoding]::new($false))
    $Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $Path /inheritance:r /grant:r "${Identity}:(R,W)" /grant:r "SYSTEM:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        throw "Unable to restrict the WiFi relay runtime token file permissions."
    }
}

function Read-WifiRelayTokenFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $Token = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8).Trim()
    if ($Token.Length -lt 32) { return $null }
    return $Token
}

function Get-OrStartWifiRelay {
    param(
        [Parameter(Mandatory = $true)][string]$PythonPath,
        [Parameter(Mandatory = $true)][string]$RelayRoot,
        [Parameter(Mandatory = $true)][string]$TokenPath,
        [Parameter(Mandatory = $true)][string]$LogDirectory,
        [int]$Port = 18088,
        [int]$ReadyTimeoutSeconds = 15
    )

    $ExistingToken = Read-WifiRelayTokenFile -Path $TokenPath
    if ($ExistingToken -and (Test-WifiRelayReady -Token $ExistingToken -Port $Port)) {
        return [pscustomobject]@{
            Token = $ExistingToken
            Process = $null
            OwnsProcess = $false
            TokenPath = $TokenPath
        }
    }

    if (Test-WifiRelayTcpPort -Port $Port) {
        throw "Port 127.0.0.1:$Port is occupied by an unmanaged or unauthenticated process."
    }

    if (-not (Test-Path -LiteralPath $LogDirectory)) {
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    }
    $Token = New-WifiRelayToken
    Write-WifiRelayTokenFile -Path $TokenPath -Token $Token
    $PreviousToken = $env:WIFI_RELAY_TOKEN
    $env:WIFI_RELAY_TOKEN = $Token
    $Process = $null
    try {
        $Process = Start-Process -FilePath $PythonPath -ArgumentList "server.py" `
            -WorkingDirectory $RelayRoot -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $LogDirectory "wifi-relay.out.log") `
            -RedirectStandardError (Join-Path $LogDirectory "wifi-relay.err.log")

        $Deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
        do {
            if ($Process.HasExited) { break }
            if (Test-WifiRelayReady -Token $Token -Port $Port) {
                return [pscustomobject]@{
                    Token = $Token
                    Process = $Process
                    OwnsProcess = $true
                    TokenPath = $TokenPath
                }
            }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $Deadline)

        throw "WiFi relay did not become ready on 127.0.0.1:$Port."
    } catch {
        if ($Process -and -not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $TokenPath -Force -ErrorAction SilentlyContinue
        throw
    } finally {
        $env:WIFI_RELAY_TOKEN = $PreviousToken
    }
}

function Stop-WifiRelaySession {
    param([Parameter(Mandatory = $true)]$Session)

    if (-not $Session.OwnsProcess) { return }
    if ($Session.Process -and -not $Session.Process.HasExited) {
        Stop-Process -Id $Session.Process.Id -Force -ErrorAction SilentlyContinue
        try { $Session.Process.WaitForExit(5000) } catch {}
    }
    Remove-Item -LiteralPath $Session.TokenPath -Force -ErrorAction SilentlyContinue
}

function Invoke-WithWifiRelaySession {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Acquire,
        [Parameter(Mandatory = $true)][scriptblock]$RunBackend,
        [Parameter(Mandatory = $true)][scriptblock]$Release
    )

    $Session = & $Acquire
    try {
        & $RunBackend $Session
    } finally {
        & $Release $Session
    }
}

Export-ModuleMember -Function New-WifiRelayToken, Test-WifiRelayTcpPort, Test-WifiRelayReady, `
    Write-WifiRelayTokenFile, Read-WifiRelayTokenFile, Get-OrStartWifiRelay, `
    Stop-WifiRelaySession, Invoke-WithWifiRelaySession
