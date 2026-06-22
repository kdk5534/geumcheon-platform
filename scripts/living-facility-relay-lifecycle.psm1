Set-StrictMode -Version Latest

function New-LivingFacilityRelayToken {
    $Bytes = New-Object byte[] 32
    $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $Generator.GetBytes($Bytes); return [Convert]::ToBase64String($Bytes) } finally { $Generator.Dispose() }
}

function Test-LivingFacilityRelayTcpPort {
    param([int]$Port = 18089)
    $Client = New-Object System.Net.Sockets.TcpClient
    try { $Task = $Client.ConnectAsync("127.0.0.1", $Port); return $Task.Wait(500) -and $Client.Connected }
    catch { return $false } finally { $Client.Dispose() }
}

function Test-LivingFacilityRelayReady {
    param([Parameter(Mandatory = $true)][string]$Token, [int]$Port = 18089, [int]$TimeoutSeconds = 2)
    try {
        $Health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/health" -TimeoutSec $TimeoutSeconds
        if ($Health.status -ne "UP" -or $Health.service -ne "LivingFacilitySeoulOpenAPI") { return $false }
        $Status = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/v1/status" -Headers @{ "X-Relay-Token" = $Token } -TimeoutSec $TimeoutSeconds
        return $Status.service -eq "LivingFacilitySeoulOpenAPI" -and @($Status.allowedServices).Count -eq 5
    } catch { return $false }
}

function Write-LivingFacilityRelayTokenFile {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Token)
    $Directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $Directory)) { New-Item -ItemType Directory -Path $Directory -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Token, [System.Text.UTF8Encoding]::new($false))
    $Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $Path /inheritance:r /grant:r "${Identity}:(R,W)" /grant:r "SYSTEM:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue; throw "Unable to restrict the living facility relay token file permissions." }
}

function Read-LivingFacilityRelayTokenFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $Token = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8).Trim()
    if ($Token.Length -lt 32) { return $null }; return $Token
}

function Get-OrStartLivingFacilityRelay {
    param([Parameter(Mandatory = $true)][string]$PythonPath, [Parameter(Mandatory = $true)][string]$RelayRoot,
        [Parameter(Mandatory = $true)][string]$TokenPath, [Parameter(Mandatory = $true)][string]$LogDirectory,
        [int]$Port = 18089, [int]$ReadyTimeoutSeconds = 15)
    $ExistingToken = Read-LivingFacilityRelayTokenFile -Path $TokenPath
    if ($ExistingToken -and (Test-LivingFacilityRelayReady -Token $ExistingToken -Port $Port)) {
        return [pscustomobject]@{ Token=$ExistingToken; Process=$null; OwnsProcess=$false; TokenPath=$TokenPath }
    }
    if (Test-LivingFacilityRelayTcpPort -Port $Port) { throw "Port 127.0.0.1:$Port is occupied by an unmanaged or unauthenticated process." }
    if (-not (Test-Path -LiteralPath $LogDirectory)) { New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null }
    $Token = New-LivingFacilityRelayToken
    Write-LivingFacilityRelayTokenFile -Path $TokenPath -Token $Token
    $PreviousToken = $env:LIVING_FACILITY_RELAY_TOKEN; $env:LIVING_FACILITY_RELAY_TOKEN = $Token; $Process = $null
    try {
        $Process = Start-Process -FilePath $PythonPath -ArgumentList "server.py" -WorkingDirectory $RelayRoot -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $LogDirectory "living-facility-relay.out.log") `
            -RedirectStandardError (Join-Path $LogDirectory "living-facility-relay.err.log")
        $Deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
        do {
            if ($Process.HasExited) { break }
            if (Test-LivingFacilityRelayReady -Token $Token -Port $Port) { return [pscustomobject]@{ Token=$Token; Process=$Process; OwnsProcess=$true; TokenPath=$TokenPath } }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $Deadline)
        throw "Living facility relay did not become ready on 127.0.0.1:$Port."
    } catch {
        if ($Process -and -not $Process.HasExited) { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue }
        Remove-Item -LiteralPath $TokenPath -Force -ErrorAction SilentlyContinue; throw
    } finally { $env:LIVING_FACILITY_RELAY_TOKEN = $PreviousToken }
}

function Stop-LivingFacilityRelaySession {
    param([Parameter(Mandatory = $true)]$Session)
    if (-not $Session.OwnsProcess) { return }
    if ($Session.Process -and -not $Session.Process.HasExited) { Stop-Process -Id $Session.Process.Id -Force -ErrorAction SilentlyContinue; try { $Session.Process.WaitForExit(5000) } catch {} }
    Remove-Item -LiteralPath $Session.TokenPath -Force -ErrorAction SilentlyContinue
}

Export-ModuleMember -Function New-LivingFacilityRelayToken, Test-LivingFacilityRelayTcpPort, Test-LivingFacilityRelayReady, `
    Write-LivingFacilityRelayTokenFile, Read-LivingFacilityRelayTokenFile, Get-OrStartLivingFacilityRelay, Stop-LivingFacilityRelaySession
